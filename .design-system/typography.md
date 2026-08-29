# 🔤 Tipografía — StormPrint

Fuentes cargadas vía Google Fonts en `app/globals.css` (línea 5) y mapeadas en
`tailwind.config.js` → `fontFamily`. **No usar Orbitron**: el proyecto usa **Exo 2**.

## Fuentes

| Fuente | Token Tailwind | Uso |
|---|---|---|
| **Exo 2** (400–900) | `font-display` | Títulos H1/H2/H3, números destacados, look tecnológico |
| **Inter** (400–700) | `font-body` | Texto general, descripciones, cuerpo |
| **JetBrains Mono** (400–600) | `font-mono` | Datos técnicos, etiquetas, código, tabular |

El `<body>` usa `font-body` (Inter) por defecto (`app/layout.tsx`).

## Jerarquía tipográfica típica

| Elemento | Clase | Fuente | Color |
|---|---|---|---|
| Título hero / principal | `font-display font-bold` + `title-storm` | Exo 2 900 | degradado cyan metálico |
| Título con glitch | `glitch-title` + `data-text` | Exo 2 900 | degradado cyan |
| Título de sección | `font-display font-bold text-2xl text-white` | Exo 2 | blanco |
| Acento neón | `neon-text` | — | `var(--cyan)` con glow |
| Números grandes | `font-display font-bold font-tabular` | Exo 2 | color según dato |
| Texto cuerpo | `font-body text-slate-400` | Inter | secondary |
| Etiquetas / mono | `font-mono text-[10px] uppercase tracking-wider` | JetBrains Mono | `text-cyan`/`slate-500` |

## Clases CSS reutilizables (globals.css)

| Clase | Efecto |
|---|---|
| `.title-storm` | Título degradado blanco→cyan→azul oscuro con glow pulsante |
| `.glitch-title` | Título con efecto glitch (usa `data-text`) |
| `.neon-text` | Texto cyan con glow neón |
| `.neon-text-subtle` | Texto cyan tenue |
| `.font-tabular` | Números tabulares (`font-variant-numeric`) |

## Reglas

1. Títulos de marca/hero: `font-display` (Exo 2), peso 900, `.title-storm` o `.neon-text`.
2. Subtítulos de sección: `font-display font-bold` + `text-cyan`.
3. Cuerpo: `font-body` (Inter), `text-slate-400` para secundario.
4. Datos técnicos/números/niveles: `font-mono` o `font-display` + `font-tabular`.
5. Etiquetas en MAYÚSCULAS con `tracking-wider` y `font-mono`.
