/** The page's SVG sprite: every <use href="#i-..."> points here. */
export default function Icons() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="i-phone" viewBox="0 0 24 24">
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.2" />
          <path d="M10 5h4" />
        </symbol>
        <symbol id="i-arrow" viewBox="0 0 24 24">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </symbol>
        <symbol id="i-close" viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6L6 18" />
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </symbol>
      </defs>
    </svg>
  );
}
