import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy, Burly",
  description: "What Burly stores on your phone, which permissions it asks for, and what never leaves your device.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy policy"
      title="Your training stays on your phone."
      updated="1 November 2026"
      intro="Burly is an offline workout log. There is no account, no server and no analytics. This page lists every kind of data the app handles, where it lives, and the only ways it can leave your device, which are all actions you take yourself."
    >
      <h2>What the app stores</h2>
      <p>Everything you enter is written to a local database inside the app&apos;s private storage on your phone:</p>
      <ul>
        <li>Workouts, sets, reps, weights, rest timers, notes and the time you trained.</li>
        <li>Routines, folders, workout splits and your exercise library, including custom exercises.</li>
        <li>Body measurements and body weight entries you log.</li>
        <li>Profile details you choose to fill in: a display name, birth year, height, sex and a profile photo. The app uses these to size weight suggestions, strength ranks and split recommendations. All of them are optional.</li>
        <li>Up to three photos you attach to a workout.</li>
        <li>Settings: units, theme, accent, sounds, haptics, rest timer defaults and which widgets you use.</li>
        <li>Derived numbers the app calculates from the above, such as records, streaks, strength ranks and achievements.</li>
      </ul>
      <p>Deleting the app deletes all of it. Nothing is kept anywhere else unless you export it.</p>

      <h2>What the app does not do</h2>
      <ul>
        <li>No account or sign in. The app never asks for an email, phone number or password.</li>
        <li>No network connection for your data. The app has no backend, no sync and no cloud backup of its own.</li>
        <li>No analytics, crash reporting, advertising or tracking libraries. No identifiers are generated for those purposes.</li>
        <li>No reading of health platforms. Burly does not connect to Apple Health or Health Connect.</li>
        <li>No selling, sharing or renting of data. There is nothing on our side to sell.</li>
      </ul>

      <h2>Permissions and why they are asked for</h2>
      <p>Every permission is optional and is requested only when you use the feature that needs it.</p>
      <ul>
        <li><strong>Camera.</strong> To take a profile photo or a workout photo. The image is stored only inside the app.</li>
        <li><strong>Photo library.</strong> To pick a profile or workout photo from your library, and to save a share card into your library when you ask for one.</li>
        <li><strong>Notifications.</strong> To tell you when a rest timer ends, including while the screen is locked. On Android this also covers the live workout notification.</li>
        <li><strong>Live Activities and widgets.</strong> On iOS, the live workout and the Lock Screen and Home Screen widgets read a small summary of the current session and your recent stats from a storage area shared between the app and its widgets on the same device. Android widgets do the same through the app&apos;s own storage. Nothing is sent off the phone.</li>
        <li><strong>Files.</strong> To read a backup or CSV file you choose to import, and to write an export you choose to share.</li>
        <li><strong>Start at boot (Android).</strong> So a rest timer scheduled before a restart still fires.</li>
      </ul>

      <h2>When data leaves the device</h2>
      <p>Only when you start one of these actions, and only to where you send it:</p>
      <ul>
        <li><strong>Export.</strong> Settings &rsaquo; Data creates a backup file of your history. The app hands it to the system share sheet; you choose the destination, such as Files, AirDrop, a cloud drive or an email. Burly never receives a copy.</li>
        <li><strong>Import.</strong> You pick a backup or CSV export on your phone and the app reads it into the local database.</li>
        <li><strong>Share cards.</strong> A workout, record, rank or monthly card is rendered as an image and passed to the share sheet or saved to your photo library.</li>
        <li><strong>Links.</strong> Tapping an external link opens it in your browser. The site you land on has its own privacy policy.</li>
      </ul>
      <p>System backups made by iOS or Android (iCloud Backup, Google One) may include the app&apos;s storage if you have those enabled. They are governed by Apple&apos;s and Google&apos;s policies, not ours.</p>

      <h2>This website</h2>
      <p>This site is static. It sets one value in your browser&apos;s local storage to remember your light or dark choice and one session flag so the loading animation plays once. It has no cookies, no analytics and no third party scripts. If you join the waitlist, the email you enter is used only to send you the TestFlight or beta invitation and release news, and you can ask for it to be removed at any time.</p>

      <h2>Children</h2>
      <p>Burly is not directed at children under 13 and does not knowingly collect anything from them. Since the app keeps all data on the device, no data about anyone is held by us.</p>

      <h2>Changes and contact</h2>
      <p>If a future version adds anything that changes the above, such as an optional sync, this page will be updated first and the app will ask before turning it on. Questions go through the support link on the app&apos;s store listing.</p>
    </LegalPage>
  );
}
