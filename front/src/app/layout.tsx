import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

/**
 * Vazirmatn is the most widely used modern Farsi/Persian web font.
 * It is a variable font (supports all weights 100–900) and includes
 * full Latin characters alongside Persian/Arabic glyphs.
 */
const vazirmatn = Vazirmatn({
  variable: "--font-farsi",
  subsets: ["arabic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "اپلیکیشن حسابداری",
  description: "مدیریت محصولات در اپلیکیشن حسابداری",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
