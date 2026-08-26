import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StormPrint — Monitoreo de Inundaciones | Barrio Manga, Cartagena",
  description:
    "Sistema predictivo de inundaciones para el Barrio Manga, Cartagena de Indias. Simulación en tiempo real con datos meteorológicos, mareas y drenaje territorial.",
  icons: { icon: "/favicon.svg" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "StormPrint — Monitoreo Inteligente de Inundaciones",
    description:
      "Simulación predictiva en tiempo real para el Barrio Manga, Cartagena de Indias.",
    type: "website",
    locale: "es_CO",
  },
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
