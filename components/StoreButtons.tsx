/** The two "coming soon" store buttons; both open the waitlist sheet. */
export function StoreButtons({ source }: { source: string }) {
  return (
    <>
      <button className="store" type="button" data-waitlist={source} aria-label="Coming soon to the App Store: get notified">
        <svg aria-hidden="true">
          <use href="#i-phone" />
        </svg>
        <span>
          <small>Coming soon to</small> <b>App Store</b>
        </span>
      </button>
      <button className="store" type="button" data-waitlist={source} aria-label="Coming soon to Google Play: get notified">
        <svg aria-hidden="true">
          <use href="#i-phone" />
        </svg>
        <span>
          <small>Coming soon to</small> <b>Google Play</b>
        </span>
      </button>
    </>
  );
}

/** "Join the waitlist" text link with its one-line promise. */
export function JoinLink({ source }: { source: string }) {
  return (
    <p className="join">
      <button type="button" data-waitlist={source}>
        Join the waitlist
        <svg aria-hidden="true">
          <use href="#i-arrow" />
        </svg>
      </button>
      <span>Get the TestFlight link before anyone else.</span>
    </p>
  );
}
