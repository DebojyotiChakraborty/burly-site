export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <span className="foot-left">
          © 2026 Burly
          <details className="credit">
            <summary aria-label="Attribution" title="Attribution">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="8" cy="5" r="0.9" fill="currentColor" />
                <path d="M8 7.3v4.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </summary>
            <p className="credit-pop">
              Phone model:{" "}
              <a
                href="https://sketchfab.com/3d-models/apple-iphone-15-pro-max-black-df17520841214c1792fb8a44c6783ee7"
                rel="license noopener"
                target="_blank"
              >
                Apple iPhone 15 Pro Max Black
              </a>{" "}
              by{" "}
              <a href="https://sketchfab.com/Polyman_3D" rel="noopener" target="_blank">
                polyman Studio
              </a>
              ,{" "}
              <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" target="_blank">
                CC BY 4.0
              </a>
              , modified.
            </p>
          </details>
        </span>
        <span>
          <a href="#">Privacy</a> · <a href="#">Terms</a>
        </span>
      </div>
    </footer>
  );
}
