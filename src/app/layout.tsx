import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MainStreetOS™ — AI-Native Deal Operating System",
  description: "AI-powered business valuations, deal documents, and pipeline management for business brokers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
