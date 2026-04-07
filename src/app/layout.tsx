import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MainStreetOS™ — AI-Native Deal Operating System",
  description: "AI-powered business valuations, deal documents, and pipeline management for business brokers.",
  openGraph: {
    title: "MainStreetOS™ - AI-Native Deal Operating System",
    description: "The deal operating system that gets smarter with every deal you close. AI-agentic valuations, semantic memory, and document generation for business brokers.",
    url: "https://mainstreetos.biz",
    images: ["/logo-with-tagline.png"],
  },
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
