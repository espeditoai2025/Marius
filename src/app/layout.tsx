import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Financial AI Lab | RAG Notebook",
  description: "Piattaforma di testing per agenti AI finanziari con RAG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="dark">
      <body className={`${inter.className} bg-[#0a0a0f] text-slate-200 antialiased selection:bg-violet-500/30`}>
        {children}
      </body>
    </html>
  );
}
