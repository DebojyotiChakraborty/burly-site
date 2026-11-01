import { Resend } from "resend";

/**
 * POST /api/waitlist
 * Body: { email: string, company?: string }
 *
 * Adds the email to the Resend audience (Resend now calls these "segments";
 * RESEND_AUDIENCE_ID holds the segment's id). `company` is a honeypot: humans
 * never see the field, so a filled value is dropped with a 200 and no call.
 *
 * Resend API: POST /contacts with `segments: [{ id }]` (the `audienceId`
 * form is deprecated). The key must be a "full access" key; a sending-only
 * key gets 401 restricted_api_key on the contacts endpoints.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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

let warnedMissingEnv = false;

function json(body: { ok: true } | { ok: false; error: string }, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    if (!warnedMissingEnv) {
      warnedMissingEnv = true;
      console.error("[waitlist] RESEND_API_KEY or RESEND_AUDIENCE_ID is not set; signups are disabled.");
    }
    return json({ ok: false, error: "The waitlist is not set up yet. Please try again later." }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Send a JSON body with an email." }, 400);
  }
  const { email: rawEmail, company } = (body ?? {}) as { email?: unknown; company?: unknown };

  // Honeypot: bots fill every field. Pretend it worked and do nothing.
  if (typeof company === "string" && company.trim() !== "") return json({ ok: true });

  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email || email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: "That does not look like an email address." }, 400);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return json({ ok: false, error: "Too many attempts. Please wait a few minutes." }, 429);
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.contacts.create({
    email,
    unsubscribed: false,
    segments: [{ id: audienceId }],
  });

  if (!error) return json({ ok: true });

  // Configuration problems: say so in the server log, never to the client.
  if (error.name === "restricted_api_key" || error.name === "invalid_api_key" || error.name === "missing_api_key") {
    console.error("[waitlist] Resend rejected the API key (needs a full access key):", error.name);
    return json({ ok: false, error: "The waitlist is not set up yet. Please try again later." }, 503);
  }
  if (error.name === "rate_limit_exceeded") {
    return json({ ok: false, error: "Too many signups right now. Please try again in a minute." }, 503);
  }

  // Resend does not document the response for an email that already exists.
  // Whatever create returned, adding the existing contact to the segment is
  // idempotent for our purposes: if that succeeds, the address is on the list.
  const added = await resend.contacts.segments.add({ email, segmentId: audienceId });
  if (!added.error) return json({ ok: true });

  // Server log only; the client never sees Resend's wording.
  console.error(
    "[waitlist] Resend error:",
    `${error.name} ${error.statusCode ?? ""} (${error.message})`,
    "/ segment add:",
    `${added.error.name} ${added.error.statusCode ?? ""} (${added.error.message})`,
  );
  return json({ ok: false, error: "Could not save your email right now. Please try again." }, 502);
}
