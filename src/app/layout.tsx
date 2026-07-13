import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "RobertaFunctional · Allenamento ibrido",
  description: "Programma locale e trasparente per forza e corsa.",
  applicationName: "RobertaFunctional",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "RobertaFunctional" },
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
