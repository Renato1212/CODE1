import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TapeFeel — Audio Order Flow",
  description: "Multi-layer audio sonification of crypto futures order flow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-text font-mono antialiased">{children}</body>
    </html>
  );
}
