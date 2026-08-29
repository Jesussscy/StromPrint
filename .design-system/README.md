# 🎨 StormPrint — Design System (guía oficial)

Este es el sistema de diseño REAL de StormPrint, extraído del código vivo
(`app/globals.css`, `tailwind.config.js`, `app/layout.tsx` y componentes).

> ⚠️ ANTES de crear cualquier componente nuevo, consulta esta carpeta.
> Documenta exactamente los colores, fuentes y clases que **ya se usan**,
> para mantener consistencia en toda la web.

## 📦 Estructura

| Archivo | Contenido |
|---|---|
| `colors.md` | Paleta de colores oficial (tokens Tailwind + CSS vars) |
| `typography.md` | Fuentes y clases tipográficas |
| `components.md` | Componentes y clases de vidrio/neón reutilizables |
| `templates.md` | Plantillas de página y tarjeta |

## 🎯 Estilo dominante

- **Cyberpunk técnico + glassmorphism**: fondos oceánicos oscuros, acentos cian, bordes glaseados, glow neón.
- Nombre/slogan: **STORM//PRINT**.
- Tema: monitoreo de inundaciones en tiempo real, Barrio Manga, Cartagena.

## 🔄 Reglas de uso

1. Consulta esta guía **antes** de crear componentes.
2. Usa los tokens de Tailwind (`bg-ocean`, `text-cyan`, `glass`, `glass-strong`, `glass-glow`).
3. Los títulos de display usan **Exo 2** (`font-display`); el cuerpo usa **Inter** (`font-body`); los datos técnicos usan **JetBrains Mono** (`font-mono`).
4. El cian de marca es `#00D2FF` (token `cyan` / `--cyan`).
5. Fondo base: `ocean` → `#050A0F` (deep `#030710`).
6. Estados/riesgo: `risk-normal` `#00E5FF`, `risk-alert` `#FFD600`, `risk-emergency` `#FF0055`, `risk-critical` `#B000FF`.

## ⏳ Cómo se actualiza

Cuando se añada un color, fuente, clase o componente nuevo, actualiza el `.md`
correspondiente para que la guía nunca quede desactualizada.
