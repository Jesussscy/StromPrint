# 🎨 Paleta de Colores — StormPrint

Estos son los colores **reales** definidos en `tailwind.config.js` y `app/globals.css`.
Úsalos vía tokens de Tailwind (`bg-ocean`, `text-cyan`, etc.) o variables CSS (`var(--cyan)`).

## Fondos (tokens `ocean`)

| Token / var | Hex | Uso |
|---|---|---|
| `ocean` / `--ocean` | `#050A0F` | Fondo general (Dark Blue) |
| `ocean-deep` / `--ocean-deep` | `#030710` | Fondo más profundo / base `<html>` |
| `ocean-mid` / `--ocean-mid` | `#0A1628` | Paneles / secciones |
| `ocean-light` | `#0F1F3A` | Elevación |
| `ocean-surface` | `#132240` | Superficies |
| `ocean-glow` | `#00D2FF` | Acento de superficie |

## Cian de marca (tokens `cyan`)

| Token / var | Hex | Uso |
|---|---|---|
| `cyan` / `--cyan` | `#00D2FF` | **Color principal.** Acentos, bordes, títulos, glow |
| `cyan-dim` / `--cyan-dim` | `#00A8CC` | Subtítulos, texto neón sutil |
| `cyan-bright` / `--cyan-bright` | `#00F0FF` | Brillo / hovers |
| `cyan-muted` | `#007A99` | Muted |

## Riesgo / Estado (tokens `risk`)

| Token / var | Hex | Uso |
|---|---|---|
| `risk-normal` / `--risk-normal` | `#00E5FF` | Estado Normal (agua < 30 cm) |
| `risk-alert` / `--risk-alert` | `#FFD600` | Alerta (30–59 cm) |
| `risk-emergency` / `--risk-emergency` | `#FF0055` | Emergencia (60–99 cm) |
| `risk-critical` / `--risk-critical` | `#B000FF` | Crítico (≥ 100 cm) |

## Texto

| Uso | Color |
|---|---|
| Texto principal | `#E2E8F0` (slate-200) |
| Texto secundario | `#94A3B8` / `slate-400` |
| Muted | `#64748B` / `slate-500` |

## Transparencias / Bordes (clases glass)

| Uso | Valor |
|---|---|
| Borde `glass` | `rgba(0, 229, 255, 0.12)` |
| Borde `glass-strong` | `rgba(0, 229, 255, 0.2)` |
| Borde `glass-glow` | `rgba(0, 229, 255, 0.25)` |
| Glow suave | `rgba(0, 229, 255, 0.05)` |
| Glow fuerte | `0 0 20px rgba(0,210,255,0.15)` |

## Reglas

1. **NUNCA** inventes colores fuera de esta paleta.
2. El cian `#00D2FF` es el color de marca (acordes con `#00E5FF` para accentos de "agua").
3. El fondo **siempre** oscuro (`ocean` / `ocean-deep`).
4. Usa los tokens de Tailwind antes que los hex sueltos.
5. Para riesgo de inundación usa SIEMPRE `risk-{estado}`.
