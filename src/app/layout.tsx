import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Structural Health Monitor",
  description:
    "Passive vibration sensing system that computes a structural health index from low-cost accelerometer streams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
