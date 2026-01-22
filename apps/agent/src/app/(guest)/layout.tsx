import { GuestProviders } from "@/components/guest/GuestProviders";
import { HeaderGuest } from "@/components/guest/HeaderGuest";
import { FooterGuest } from "@/components/guest/FooterGuest";

export const metadata = {
  title: "Подборка квартир",
  description: "Персональная подборка квартир от вашего агента",
};

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GuestProviders>
      <HeaderGuest />
      <main className="min-h-[calc(100vh-200px)]">{children}</main>
      <FooterGuest />
    </GuestProviders>
  );
}
