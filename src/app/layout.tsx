import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";

import "./globals.css";

// Self hosted by next/font, so campus wifi never leaves the room staring at
// a fallback face while Google Fonts resolves.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  // 300 is for the projected screens, where type is huge and a hairline is
  // elegant. The room reads 500: Cormorant's light strokes vanish on a phone.
  weight: ["300", "400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  // 200 and 300 stay for the presenter screens only. Nothing the room reads
  // goes below 400, and labels sit at 600.
  weight: ["200", "300", "400", "500", "600"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Six things AI does well",
  description: "Steiger Bean session board",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No zoom ceiling. Capping pinch zoom fails WCAG 1.4.4, and it is the first
  // thing somebody reaches for when the type is still too small for them.
  userScalable: true,
  themeColor: "#FAF8F5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
