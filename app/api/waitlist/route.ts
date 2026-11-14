import { createHash } from "node:crypto";
import { after } from "next/server";
import { Resend } from "resend";
import { waitlistConfirmation } from "@/lib/waitlist-email";

/**
 * POST /api/waitlist
 * Body (JSON): { email: string, hp?: string }
 *
 * Adds the email to the Resend audience (Resend now calls these "segments";
 * RESEND_AUDIENCE_ID holds the segment's id). `hp` is a honeypot: humans
 * never see the field, so a filled value is dropped with a 200 and no call.
 *
 * Resend API: POST /contacts with `segments: [{ id }]` (the `audienceId`
 * form is deprecated). The key must be a "Full access" key; a sending-only
 * key gets 401 restricted_api_key on the contacts endpoints.
 *
 * Confirmations go to first-time signups only. When WAITLIST_FROM is set,
 * GET /contacts/{email} runs before the save; if the address is already a
 * contact, no email is sent. Once a new address is saved, one confirmation
 * goes out after the response (see sendConfirmation); its idempotency key is
 * a backstop of one per address per 24 hours. Neither the lookup nor the
 * email ever changes the signup result.
 */

// Deliberately conservative: the address is also used as a URL path segment
// (POST /contacts/{email}/segments/{id}), so characters that could change the
// path (/ ? # %) are not accepted.
const EMAIL_RE = /^[a-z0-9._+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const EMAIL_MAX = 254;

// Best-effort rate limit: one bucket per IP, kept in this process's memory.
// On Vercel each function instance has its own map and it resets on cold
// start, so this only slows down a single noisy client, it is not a guarantee.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return false;
  }
  b.count += 1;
  return b.count > LIMIT;
}

// Resend calls get this long before the visitor is told to retry.
const RESEND_TIMEOUT_MS = 8000;

type ResendError = { name: string; message: string; statusCode: number | null };
type ResendResult = { error: ResendError | null; headers: Record<string, string> | null };

/** Runs one Resend call with a timeout; a thrown or aborted call becomes an error result. */
async function call(
  fn: (signal: AbortSignal) => Promise<ResendResult>,
  timeoutMs = RESEND_TIMEOUT_MS,
): Promise<ResendResult> {
  const signal = AbortSignal.timeout(timeoutMs);
  const timedOut: ResendResult = {
    error: { name: "timeout", message: "Resend did not answer in time", statusCode: null },
    headers: null,
  };
  try {
    const result = await fn(signal);
    // The SDK turns an aborted fetch into a generic application_error.
    return result.error && signal.aborted ? timedOut : result;
  } catch {
    return timedOut;
  }
}

/** True when Resend refuses the key itself: wrong, deleted, inactive, suspended or sending-only. */
function isKeyError(e: ResendError): boolean {
  return (
    ["restricted_api_key", "missing_api_key", "invalid_api_key", "suspended_api_key", "invalid_permission"].includes(e.name) ||
    /api key/i.test(e.message ?? "")
  );
}

const describe = (e: ResendError) => `${e.name} ${e.statusCode ?? ""} (${e.message})`;

let warnedMissingEnv = false;
let warnedNoConfirmations = false;

// Resend answers 409 with these when the idempotency key was already used in
// the last 24 hours: the confirmation went out (or is going out) already.
const ALREADY_SENT = ["invalid_idempotent_request", "concurrent_idempotent_requests"];

// The lookup only decides whether to send a confirmation, so it gets a short
// leash: a slow answer must not hold up the signup itself.
const LOOKUP_TIMEOUT_MS = 2500;

/**
 * True only when Resend says the address is already a contact. A 404 means
 * new. Anything else (timeout, outage, rate limit, key error) counts as new
 * too, so a new person is never denied a confirmation; the idempotency key
 * still caps it. A key error falls through to create, which reports it.
 */
async function isExistingContact(resend: Resend, email: string): Promise<boolean> {
  const found = await call((signal) => resend.contacts.get({ email }, { signal }), LOOKUP_TIMEOUT_MS);
  if (!found.error) return true;
  if (found.error.statusCode !== 404 && found.error.name !== "not_found") {
    console.error("[waitlist] lookup failed:", describe(found.error));
  }
  return false;
}

/**
 * Sends the signup confirmation. Off when WAITLIST_FROM is empty. The
 * idempotency key is derived from the address, so Resend sends at most one
 * per address per 24 hours however often the form is submitted. Failures,
 * including the free plan's daily or monthly quota, are logged and dropped.
 */
async function sendConfirmation(resend: Resend, email: string): Promise<void> {
  const from = process.env.WAITLIST_FROM?.trim();
  if (!from) {
    if (!warnedNoConfirmations) {
      warnedNoConfirmations = true;
      console.info("[waitlist] WAITLIST_FROM is not set; confirmation emails are off.");
    }
    return;
  }
  const replyTo = process.env.WAITLIST_REPLY_TO?.trim() || undefined;
  const { subject, html, text } = waitlistConfirmation();
  const idempotencyKey = "waitlist-confirm-" + createHash("sha256").update(email).digest("hex");

  const sent = await call((signal) =>
    resend.emails.send({ from, to: email, replyTo, subject, html, text }, { idempotencyKey, signal }),
  );
  if (!sent.error || ALREADY_SENT.includes(sent.error.name)) return;
  console.error("[waitlist] confirmation not sent:", describe(sent.error));
}

function json(body: { ok: true } | { ok: false; error: string }, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

const NOT_SET_UP = "The waitlist is not set up yet. Please try again later.";

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    if (!warnedMissingEnv) {
      warnedMissingEnv = true;
      console.error("[waitlist] RESEND_API_KEY or RESEND_AUDIENCE_ID is not set; signups are disabled.");
    }
    return json({ ok: false, error: NOT_SET_UP }, 503);
  }

  // Only JSON. A cross-site form or a no-preflight fetch cannot send this
  // content type, so other pages cannot submit on a visitor's behalf.
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return json({ ok: false, error: "Send a JSON body with an email." }, 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Send a JSON body with an email." }, 400);
  }
  const { email: rawEmail, hp } = (body ?? {}) as { email?: unknown; hp?: unknown };

  // Honeypot: bots fill every field. Pretend it worked and do nothing.
  if (typeof hp === "string" && hp.trim() !== "") return json({ ok: true });

  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email || email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: "That does not look like an email address." }, 400);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return json({ ok: false, error: "Too many attempts. Please wait a few minutes." }, 429);
  }

  const resend = new Resend(apiKey);
  // Only look the address up when confirmations are on: no extra call otherwise.
  const existed = process.env.WAITLIST_FROM?.trim() ? await isExistingContact(resend, email) : false;

  const create = () =>
    call((signal) =>
      resend.contacts.create({ email, unsubscribed: false, segments: [{ id: audienceId }] }, { signal }),
    );

  let created = await create();
  // Resend allows 10 requests a second per team. On a burst, wait as long as
  // it asks (capped) and try once more before giving up.
  if (created.error?.name === "rate_limit_exceeded") {
    const wait = Math.min(Math.max(Number(created.headers?.["retry-after"]) || 1, 0.25), 2);
    await new Promise((r) => setTimeout(r, wait * 1000));
    created = await create();
  }
  // The address is on the list: answer now, and confirm by email after the
  // response if it was not on the list before.
  const saved = () => {
    if (!existed) after(() => sendConfirmation(resend, email));
    return json({ ok: true });
  };

  if (!created.error) return saved();

  // Configuration problems: say so in the server log, never to the client.
  if (isKeyError(created.error)) {
    console.error("[waitlist] Resend rejected the API key (it must be a Full access key):", describe(created.error));
    return json({ ok: false, error: NOT_SET_UP }, 503);
  }
  if (created.error.name === "rate_limit_exceeded") {
    return json({ ok: false, error: "Too many signups right now. Please try again in a minute." }, 503);
  }

  // Timeouts, network failures and Resend outages: a second call would only
  // make the visitor wait longer for the same answer.
  const status = created.error.statusCode;
  if (status === null || status === undefined || status >= 500) {
    console.error("[waitlist] Resend unavailable:", describe(created.error));
    return json({ ok: false, error: "Could not save your email right now. Please try again." }, 502);
  }

  // Resend does not document the response for an email that already exists.
  // Whatever 4xx create returned, adding the existing contact to the segment
  // is idempotent for our purposes: if that succeeds, the address is on the list.
  const added = await call((signal) => resend.contacts.segments.add({ email, segmentId: audienceId }, { signal }));
  if (!added.error) return saved();

  // Server log only; the client never sees Resend's wording.
  console.error("[waitlist] Resend error:", describe(created.error), "/ segment add:", describe(added.error));
  return json({ ok: false, error: "Could not save your email right now. Please try again." }, 502);
}
