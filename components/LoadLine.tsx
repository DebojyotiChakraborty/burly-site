const CURVE =
  "M0,300 C80,300 80,240 160,240 C240,240 240,330 320,330 C400,330 400,180 480,180 C560,180 560,260 640,260 C720,260 720,150 800,150 C880,150 880,220 960,220 C1040,220 1040,110 1120,110 C1200,110 1200,190 1280,190 C1360,190 1360,70 1440,70 C1520,70 1520,120 1600,120";

/** The light theme's progress curve; [filled] adds the soft area under it. */
export default function LoadLine({ filled = false }: { filled?: boolean }) {
  return (
    <svg className="load-line" viewBox="0 0 1600 400" preserveAspectRatio="none" aria-hidden="true">
      {filled && (
        <>
          <defs>
            <linearGradient id="ll" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${CURVE} L1600,400 L0,400Z`} fill="url(#ll)" />
        </>
      )}
      <path d={CURVE} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
