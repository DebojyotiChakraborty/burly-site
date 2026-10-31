import LoadLine from "./LoadLine";
import { JoinLink, StoreButtons } from "./StoreButtons";
import { vars } from "@/lib/style";

export default function Cta() {
  return (
    <section className="cta">
      <LoadLine />
      <div className="wrap">
        <h2 data-reveal>Be first under the bar.</h2>
        <p data-reveal style={vars({ "--d": 80 })}>
          Burly is coming to iPhone and Android. Join the waitlist and get the beta first.
        </p>
        <div className="stores" data-reveal style={vars({ "--d": 140 })}>
          <StoreButtons source="cta" />
        </div>
        <div data-reveal style={vars({ "--d": 200 })}>
          <JoinLink source="cta" />
        </div>
      </div>
    </section>
  );
}
