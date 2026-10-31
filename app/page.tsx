import Bento from "@/components/Bento";
import Cta from "@/components/Cta";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import Icons from "@/components/Icons";
import Reveals from "@/components/Reveals";
import Story from "@/components/Story";
import WaitlistSheet from "@/components/WaitlistSheet";

export default function Home() {
  return (
    <>
      <Icons />
      <Hero />
      <Story />
      <Bento />
      <Cta />
      <Footer />
      <WaitlistSheet />
      <Reveals />
    </>
  );
}
