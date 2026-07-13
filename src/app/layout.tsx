import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Assetto · Allenamento ibrido",
  description: "Programma locale e trasparente per forza e corsa.",
  applicationName: "Assetto",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Assetto" },
};

export const viewport: Viewport = {
  themeColor: "#071521",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>
        <a className="skip-link" href="#main-content">Vai al contenuto</a>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
