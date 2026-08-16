import type { Metadata } from "next";
import { AppProviders } from "@/components/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "DecentraLicense — Decentralized Software Licensing",
  description: "Purchase a software license with USDT on BNB Smart Chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-navy-950 text-white antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
