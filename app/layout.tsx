import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StormPrint \u2014 Prediccion de Inundaciones Manga, Cartagena",
  description:
    "Simulacion ciberfisica del riesgo de inundacion en el barrio Manga, Cartagena de Indias. Modelo de ecuaciones diferenciales de segundo orden con datos meteorologicos en tiempo real.",
  icons: {
    icon: "/favicon.svg",
  },
  robots: { index: false, follow: false },
  openGraph: {
    title: "StormPrint \u2014 Prediccion de Inundaciones Manga, Cartagena",
    description:
      "Simulacion ciberfisica del riesgo de inundacion en el barrio Manga, Cartagena de Indias.",
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
