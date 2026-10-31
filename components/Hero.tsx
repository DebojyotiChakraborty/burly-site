import DepthHero from "./DepthHero";
import LoadLine from "./LoadLine";
import Nav from "./Nav";
import { JoinLink, StoreButtons } from "./StoreButtons";
import { vars } from "@/lib/style";

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="cave" aria-hidden="true">
        <i></i>
        <i></i>
        <i></i>
        <div className="rock"></div>
        <LoadLine filled />
      </div>

      <div className="wrap">
        <Nav />

        <div className="hero-grid">
          <div className="hero-copy">
            <h1 data-in style={vars({ "--d": 180 })}>
              Lift.
              <br className="br-tall" />
              Log.
              <br />
              <em>Level up.</em>
            </h1>
            <p className="sub" data-in style={vars({ "--d": 300 })}>
              Fast between sets. Honest with the numbers.
            </p>
            <div className="stores" data-in style={vars({ "--d": 420 })}>
              <StoreButtons source="hero" />
            </div>
            <div data-in style={vars({ "--d": 480 })}>
              <JoinLink source="hero" />
            </div>
            <div className="laurels" data-in style={vars({ "--d": 560 })}>
              <span>
                <b>Offline first.</b> No account, no cloud, no ads.
              </span>
              <span>
                <b>Free while in beta</b> · invites go to the waitlist first
              </span>
            </div>
          </div>

          <div className="hero-phone" data-in style={vars({ "--d": 240 })}>
            <DepthHero />
          </div>
        </div>
      </div>
      <div className="scroll-hint">Scroll</div>
    </section>
  );
}
