import type { ReactNode } from "react";
import Footer from "@/components/Footer";
import Icons from "@/components/Icons";
import Nav from "@/components/Nav";
import WaitlistSheet from "@/components/WaitlistSheet";

type Props = {
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  children: ReactNode;
};

export default function LegalPage({ eyebrow, title, updated, intro, children }: Props) {
  return (
    <>
      <Icons />
      <div className="legal-top wrap" id="top">
        <Nav />
      </div>
      <main className="legal wrap">
        <p className="legal-eyebrow">{eyebrow}</p>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-updated">Last updated {updated}</p>
        <p className="legal-intro">{intro}</p>
        <article className="legal-body">{children}</article>
      </main>
      <Footer />
      <WaitlistSheet />
    </>
  );
}
