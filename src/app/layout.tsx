import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MainStreetOS™ - AI-Native Deal Operating System",
  description: "The deal operating system that gets smarter with every deal you close. AI-agentic valuations, semantic memory, and document generation for business brokers.",
  openGraph: {
    title: "MainStreetOS™ - AI-Native Deal Operating System",
    description: "The deal operating system that gets smarter with every deal you close.",
    url: "https://mainstreetos.biz",
    siteName: "MainStreetOS",
    images: [
      {
        url: "/logo-with-tagline.png",
        width: 2000,
        height: 533,
        alt: "MainStreetOS™ - AI-Native Deal Operating System",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MainStreetOS™ - AI-Native Deal Operating System",
    description: "The deal operating system that gets smarter with every deal you close.",
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
