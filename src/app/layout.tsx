import type { Metadata, Viewport } from "next";
import Providers from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Desk — Global & Iran, last 12 hours",
  description:
    "A local-first reading desk for global, Iranian, and Persian diaspora headlines within a configurable time window.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
  ],
};

const themeBootstrap = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <link rel="icon" href="data:," />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
