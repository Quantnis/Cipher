import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShadowGraph KZ",
  description: "Authorized DarkNet and OSINT threat intelligence platform"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
