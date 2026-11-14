# Burly site

Landing page for Burly, the workout log app. A Next.js app (App Router, TypeScript, no Tailwind).

- `app/page.tsx` assembles the page from `components/` (Nav, Hero with the CSS 3D depth phone,
  the sticky scroll Story, Bento, Cta, Footer, WaitlistSheet).
- `app/globals.css` holds every token and rule, including the dark/light `:root[data-theme]`
  palettes. `app/layout.tsx` resolves the theme before first paint (localStorage key
  `burly-site-theme`, else the system) and sets the metadata and icons.
- `app/fonts/` ships Geist Mono and Geist Serif (SIL OFL, see `app/fonts/LICENSE.txt`), loaded
  with `next/font/local` in `app/fonts.ts` as `--font-mono` and `--font-serif`.
- `public/media/screens/{dark,light}/` are simulator captures of the app, one set per theme; the
  page swaps them with the theme toggle. `tool/capture/README.md` explains how to re-shoot them.

```
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (type check included)
npm run lint
```

## Waitlist

The waitlist sheet posts to `app/api/waitlist/route.ts`, which adds the address to a Resend
segment (what Resend used to call an audience) so the launch email can go out from the same tool.
It needs two environment variables, listed in `.env.example`:

- `RESEND_API_KEY`: a Resend API key with the "Full access" permission (sending-only keys cannot
  create contacts).
- `RESEND_AUDIENCE_ID`: the id of the segment that collects signups (Segments, More options,
  Copy Segment ID).

Copy `.env.example` to `.env.local` for local work and set both as Production and Preview
variables in the Vercel project, then redeploy. Without them, or with a key Resend rejects, the
route answers 503 and the sheet shows a retry message; the reason is in the server log under
`[waitlist]`.

What the route does, in order: accepts JSON only, drops honeypot submissions with a silent 200,
validates the email, applies a best-effort per-IP limit (5 per 10 minutes, kept in memory, so it
does not survive across serverless instances), then creates the contact with an 8 second timeout
and one retry if Resend rate limits. An address that is already a contact is added to the segment
and counts as a successful signup. Nothing is emailed at signup.
