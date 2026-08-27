import { Audiowide } from "next/font/google";

/**
 * Pack 24C — ACTUC slogan font only (scoped via className / CSS variable).
 * Self-hosted by Next.js build — no runtime stylesheet requests to Google.
 */
export const actucAudiowide = Audiowide({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--actuc-font-audiowide",
});
