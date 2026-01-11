import type { Metadata } from "next";
import { Noto_Sans, Luckiest_Guy } from "next/font/google";
import "./globals.css";
import BackgroundMusic from '@/components/BackgroundMusic';

const notoSans = Noto_Sans({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const luckiestGuy = Luckiest_Guy({
  variable: "--font-luckiest",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Vamos a Betel 2026",
  description: "Reserva tu lugar para el viaje a Betel - 7-9 de Abril 2026",
  openGraph: {
    title: "Vamos a Betel 2026",
    description: "Reserva tu lugar para el viaje a Betel - 7-9 de Abril 2026",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${notoSans.variable} ${luckiestGuy.variable}`} style={{ fontFamily: 'var(--font-noto), sans-serif' }}>
        <BackgroundMusic />
        {children}
      </body>
    </html>
  );
}
