/**
 * The one email sent at signup. Nothing user-provided goes into it, so there
 * is nothing to escape. No images, tracking pixels or web fonts; colours are
 * left to the mail client so it reads the same in light and dark mode.
 */

const SITE = "https://burlylog.com";

const LINES = [
  "Thanks for signing up. Your TestFlight or beta invitation will reach you before the store listing goes live.",
  "This is the only email you will get until then. No newsletter.",
  "If you did not sign up, you can ignore this email. The launch email will include a link to unsubscribe.",
];

export function waitlistConfirmation(): { subject: string; html: string; text: string } {
  const subject = "You're on the Burly waitlist";

  const text = [subject + ".", ...LINES, `Burly\n${SITE}`].join("\n\n") + "\n";

  const p = (s: string) => `<p style="margin:0 0 16px">${s.replace(/'/g, "&#39;")}</p>`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${subject.replace(/'/g, "&#39;")}</title>
</head>
<body style="margin:0;padding:24px 16px">
<div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5">
<p style="margin:0 0 16px;font-size:20px;font-weight:600">You&#39;re on the Burly waitlist.</p>
${LINES.map(p).join("\n")}
<p style="margin:24px 0 0">Burly<br><a href="${SITE}" style="color:inherit">burlylog.com</a></p>
</div>
</body>
</html>
`;

  return { subject, html, text };
}
