import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "@/components/shared/CookieBanner";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LK Housler - Личный кабинет",
  description: "Платформа автоматизации агентских сделок на рынке недвижимости",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} antialiased`}>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
