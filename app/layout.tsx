import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CapLens",
  description: "NHL salary cap and contract comparison tool.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="flex items-center gap-6 border-b border-slate-800 bg-slate-950 px-8 py-4 text-white">
          <Link href="/" className="font-bold">
            CapLens
          </Link>
          <Link href="/" className="text-sm text-slate-400 hover:text-white">
            Rosters
          </Link>
          <Link
            href="/compare"
            className="text-sm text-slate-400 hover:text-white"
          >
            Compare
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
