import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Reto 30 Días - Transforma tu cuerpo",
  description: "Seguimiento personalizado de tu reto de pérdida de grasa en 30 días",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Reto 30 Días",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
