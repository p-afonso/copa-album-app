import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TrpcProvider } from "@/components/TrpcProvider";

export const metadata: Metadata = {
  title: "Copa 2026",
  description: "Álbum de Figurinhas Copa do Mundo 2026",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#050c05",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full antialiased" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <TrpcProvider>{children}</TrpcProvider>
      </body>
    </html>
  );
}
