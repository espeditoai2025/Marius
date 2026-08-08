import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agent Lab | Financial Intelligence Platform",
  description:
    "Per banche, studi professionali e consulenti finanziari: risposte ancorate ai tuoi documenti, con la fonte sempre citata.",
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
