import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Arthakram — Ecosystem OS", template: "%s · Arthakram" },
  description:
    "Arthakram helps students discover where they belong and helps organizations run the ecosystem around them — events, competitions, judging, documentation, mentors and opportunities in one place.",
};

export const viewport: Viewport = { themeColor: "#fdf4ee" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
