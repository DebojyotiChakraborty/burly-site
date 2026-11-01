import { Resend } from "resend";

/**
 * POST /api/waitlist
 * Body: { email: string, company?: string }
 *
 * Adds the email to the Resend audience (Resend now calls these "segments";
 * RESEND_AUDIENCE_ID holds the segment's id). `company` is a honeypot: humans
 * never see the field, so a filled value is dropped with a 200 and no call.
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

  if (error) {
    // A contact that is already on the list counts as joined.
    const msg = error.message?.toLowerCase() ?? "";
    if (error.statusCode === 409 || msg.includes("already exist")) return json({ ok: true });
    console.error("[waitlist] Resend error:", error.name, error.statusCode);
    return json({ ok: false, error: "Could not save your email right now. Please try again." }, 502);
  }

  return json({ ok: true });
}
