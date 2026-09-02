import type { Metadata, Viewport } from "next";
import { Exo_2, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Tipografías self-hosted vía next/font: eliminan el @import de Google Fonts
// (que era ignorado por estar después de los @tailwind de globals.css, de modo
// que las fuentes de marca nunca llegaban a cargarse). Mejoran el rendimiento
// (preload + hash) y no dependen de un tercero en runtime.
const exo2 = Exo_2({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "STORM//PRINT — Monitoreo de Inundaciones | Barrio Manga, Cartagena",
  description:
    "Sistema predictivo de inundaciones para el Barrio Manga, Cartagena de Indias. Simulación en tiempo real con datos meteorológicos, mareas y drenaje territorial.",
  icons: { icon: "/favicon.svg" },
  robots: { index: true, follow: true },
  applicationName: "STORM//PRINT",
  appleWebApp: {
    capable: true,
    title: "STORM//PRINT",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "STORM//PRINT — Monitoreo Inteligente de Inundaciones",
    description:
      "Simulación predictiva en tiempo real para el Barrio Manga, Cartagena de Indias.",
    type: "website",
    locale: "es_CO",
  },
};

// Metadatos específicos para móvil/PWA: viewport-fit=cover permite que el
// contenido use el área segura bajo las barras de iOS, y theme-color tiñe la
// barra de estado del navegador con la identidad visual.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050A0F",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`dark ${exo2.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-ocean antialiased font-body safe-area-pad" suppressHydrationWarning>
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        {children}
      </body>
    </html>
  );
}
