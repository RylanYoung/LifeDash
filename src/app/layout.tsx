import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Private, single-owner app: keep it out of every index.
export const metadata: Metadata = {
  title: { default: "LifeDash", template: "%s · LifeDash" },
  description: "Tasks, calendar and email in one place.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  appleWebApp: { capable: true, title: "LifeDash", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c0b" },
  ],
};

// Runs before first paint so the saved theme never flashes the wrong colours.
const THEME_SCRIPT = `(function(){var m=window.matchMedia("(prefers-color-scheme: dark)");function apply(){var t=null;try{t=localStorage.getItem("lifedash.theme")}catch(e){}var dark=t==="dark"||(t!=="light"&&m.matches);document.documentElement.dataset.theme=dark?"dark":"light";}apply();m.addEventListener("change",apply);window.__applyTheme=apply;})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
