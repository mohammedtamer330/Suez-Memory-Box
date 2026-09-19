import type { Metadata, Viewport } from "next";
import "@fontsource-variable/newsreader/wght.css";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource-variable/hanken-grotesk/wght.css";
import "@fontsource/covered-by-your-grace/400.css";
import "./globals.css";
import "./experience.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Suez Summer ’26",
  description: "A memory box, made for you.",
  openGraph: { title: "Suez Summer ’26", description: "You didn’t open a website. You opened a gift someone made for you.", images: ["/og.jpg"], type: "website" },
  icons: { icon: "/favicon.ico" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05070a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
