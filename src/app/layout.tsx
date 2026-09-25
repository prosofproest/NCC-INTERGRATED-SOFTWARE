import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NCC Data Collection & Organization System",
  description: "Enterprise cadet information management platform for the National Cadet Corps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
