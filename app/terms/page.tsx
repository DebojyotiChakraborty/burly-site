import Link from "next/link";
import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms, Burly",
  description: "The terms for using the Burly app and this website during the beta.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of use"
      title="Plain terms for a beta."
      updated="1 November 2026"
      intro="By installing Burly or joining the waitlist you agree to these terms. They are short because the app is simple: it runs on your phone, keeps your data there, and is free while in beta."
    >
      <h2>The app</h2>
      <ul>
        <li>Burly is a workout log for iPhone and Android, currently in beta. Features may change, be renamed or be removed between builds.</li>
        <li>It is free during the beta. If a paid tier is ever introduced, the free features you rely on to read and export your data will stay free.</li>
        <li>You need a device and operating system version supported by the current build. Beta builds are distributed through TestFlight and Google Play testing tracks under their own terms.</li>
      </ul>

      <h2>Your data</h2>
      <ul>
        <li>Everything you log belongs to you. The app stores it only on your device, as described in the <Link href="/privacy">privacy policy</Link>.</li>
        <li>You are responsible for backups. Use Settings &rsaquo; Data to export a backup file before switching phones, reinstalling or leaving the beta. Deleting the app deletes its data.</li>
        <li>Imports are read as you provide them. Check an imported history before relying on it.</li>
      </ul>

      <h2>Training safely</h2>
      <p>Burly records numbers and shows trends, ranks and suggestions calculated from what you enter. It is not medical, nutritional or coaching advice. Weight suggestions, strength ranks and recommended splits are estimates for motivation and planning. Lift within your ability, use spotters and safety equipment where appropriate, and talk to a professional before starting or changing a programme, especially if you have a medical condition or an injury.</p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not reverse engineer, resell or redistribute the app or its beta builds.</li>
        <li>Do not use the share cards or the app&apos;s name and mark in a way that suggests we endorse you, your products or your services.</li>
        <li>Exercise names and descriptions bundled with the app are for use inside the app.</li>
      </ul>

      <h2>Beta software, no warranty</h2>
      <p>The app and this website are provided as is and as available, without warranties of any kind, express or implied, including fitness for a particular purpose. Beta builds can contain bugs that lose data, drain battery or behave unexpectedly. To the fullest extent permitted by law, we are not liable for any indirect, incidental or consequential loss, including lost data or missed training, arising from the use of or inability to use the app. Where liability cannot be excluded, it is limited to the amount you paid for the app, which during the beta is nothing.</p>

      <h2>Intellectual property</h2>
      <p>Burly, its mascot, icons, sounds and interface are our work and may not be copied. The 3D phone shown on this website is a third party model used under a Creative Commons licence; its credit is in the footer.</p>

      <h2>The waitlist</h2>
      <p>Joining the waitlist means you agree to receive invitation and release emails about Burly. Every email includes a way to leave the list. Invitations are limited and are sent in the order people joined.</p>

      <h2>Changes</h2>
      <p>These terms may be updated as the app leaves beta. The date at the top shows the current version. Continuing to use the app after a change means you accept the new terms. Questions go through the support link on the app&apos;s store listing.</p>
    </LegalPage>
  );
}
