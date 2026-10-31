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
