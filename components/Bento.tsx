import { vars } from "@/lib/style";

export default function Bento() {
  return (
    <section className="wrap" id="offline">
      <div className="bento">
        <div className="cell wide" data-reveal>
          <svg className="sketch" viewBox="0 0 320 200" aria-hidden="true">
            <rect x="110" y="12" width="100" height="176" rx="18" />
            <path d="M140 24h40" />
            <rect x="124" y="44" width="72" height="26" rx="6" fill="currentColor" fillOpacity="0.22" stroke="none" />
            <rect x="124" y="80" width="72" height="26" rx="6" fill="currentColor" fillOpacity="0.22" stroke="none" />
            <rect x="124" y="116" width="72" height="26" rx="6" fill="currentColor" fillOpacity="0.22" stroke="none" />
            <path d="M40 60c0-9 13-16 30-16s30 7 30 16-13 16-30 16-30-7-30-16z" />
            <path d="M40 60v60c0 9 13 16 30 16s30-7 30-16V60M40 90c0 9 13 16 30 16s30-7 30-16" />
            <path d="M250 100h30M265 85v30" strokeOpacity="0.5" />
          </svg>
          <h3>Offline first.</h3>
          <p>No account, no cloud, no ads. Everything lives in a database on your phone, and a JSON backup leaves only when you say so.</p>
        </div>
        <div className="cell" data-reveal style={vars({ "--d": 120 })}>
          <svg className="sketch" viewBox="0 0 236 200" aria-hidden="true">
            <g>
              <circle cx="70" cy="100" r="26" fill="currentColor" fillOpacity="0.22" />
              <circle cx="70" cy="100" r="46" />
              <circle cx="70" cy="100" r="66" strokeOpacity="0.5" />
            </g>
            <g>
              <circle cx="160" cy="100" r="26" fill="currentColor" fillOpacity="0.22" />
              <circle cx="160" cy="100" r="46" />
              <circle cx="160" cy="100" r="66" strokeOpacity="0.5" />
            </g>
          </svg>
          <div className="kpi">2 taps</div>
          <h3>To log a set.</h3>
          <p>Nothing hides behind a menu.</p>
        </div>
        <div className="cell" data-reveal>
          <svg className="sketch" viewBox="0 0 220 200" aria-hidden="true">
            <rect x="30" y="30" width="160" height="140" rx="10" />
            <path d="M30 70h160M30 110h160M85 30v140M140 30v140" strokeOpacity="0.6" />
            <path d="M110 150V50M96 64l14-14 14 14" strokeWidth="3.5" />
          </svg>
          <div className="kpi">CSV</div>
          <h3>Bring your history.</h3>
          <p>Import the export from your old app. Lookalike exercise names are matched for you.</p>
        </div>
        <div className="cell wide" data-reveal style={vars({ "--d": 120 })}>
          <svg className="sketch" viewBox="0 0 340 200" aria-hidden="true">
            <rect x="14" y="40" width="120" height="120" rx="22" />
            <circle cx="74" cy="100" r="34" />
            <circle cx="74" cy="100" r="22" strokeOpacity="0.5" />
            <rect x="150" y="40" width="176" height="56" rx="14" />
            <rect x="150" y="112" width="84" height="48" rx="14" fill="currentColor" fillOpacity="0.22" stroke="none" />
            <rect x="248" y="112" width="78" height="48" rx="14" />
            <path d="M168 68h60M240 68h60" strokeOpacity="0.6" />
          </svg>
          <h3>Widgets, Live Activity, Liquid Glass.</h3>
          <p>
            Twelve home-screen widgets on iPhone and Android, the rest timer in the Dynamic Island, and iOS 26 glass chrome in light and
            dark.
          </p>
        </div>
      </div>
    </section>
  );
}
