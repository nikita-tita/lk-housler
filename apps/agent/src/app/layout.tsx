import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CompareFloatingBar } from "@/components/CompareFloatingBar";
import { CookieBanner } from "@/components/CookieBanner";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Housler Новостройки - Квартиры в новостройках СПб",
  description: "Поиск квартир в новостройках Санкт-Петербурга. Актуальные цены от застройщиков, удобные фильтры.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <Header />
          <main className="min-h-[calc(100vh-200px)]">{children}</main>
          <CompareFloatingBar />
          <Footer />
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}
