import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StormPrint — Manga, Cartagena",
  description: "La huella que deja cada tormenta en el territorio",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
