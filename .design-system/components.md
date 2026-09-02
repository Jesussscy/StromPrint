# 🧩 Componentes y Clases — StormPrint

## Sistema de "vidrio" (glassmorphism)

Clases definidas en `app/globals.css`. Se usan como `className` en cualquier elemento.

| Clase | Efecto | Ideal para |
|---|---|---|
| `glass` | Fondo translúcido + blur 16px + borde cyan tenue | Tarjetas, paneles |
| `glass-strong` | Más opaco + blur 24px + glow cyan | Paneles principales, HUD |
| `glass-subtle` | Muy tenue + blur 8px | Elementos secundarios |
| `glass-glow` | Fondo cyan tenue + glow exterior | Botones, CTAs, estados activos |

```tsx
<div className="glass rounded-2xl">Tarjeta</div>
<div className="glass-strong rounded-2xl">Panel principal</div>
<button className="glass-glow rounded-lg px-4 py-2">Activo</button>
```

## Texto neón

| Clase | Uso |
|---|---|
| `neon-text` | Títulos/acentos con glow cyan |
| `neon-text-subtle` | Sutil |
| `neon-line` | Bordes/líneas con glow (útil con `box-shadow`) |

## Títulos

| Clase | Uso |
|---|---|
| `title-storm` | Hero / nombre de marca (degradado cyan metálico) |
| `glitch-title` | Título con glitch (añade `data-text` con el mismo texto) |

## Glow (box-shadow de Tailwind)

| Tokens | Valor |
|---|---|
| `shadow-glow` | `0 0 20px rgba(0,210,255,0.15), 0 0 60px rgba(0,210,255,0.05)` |
| `shadow-glow-strong` | `0 0 30px rgba(0,210,255,0.3), 0 0 80px rgba(0,210,255,0.1)` |
| `shadow-glow-red` | glow rojo (riesgo) |
| `shadow-neon-line` | línea neón |

```tsx
<div className="shadow-glow">…</div>
```

## HUD / decoración

| Clase | Uso |
|---|---|
| `hud-connector` | Conector vertical con punto (para diagramas HUD) |
| `scan-line` | Línea de escaneo animada (overlay con ::before) |
| `light-sweep` | Barrido de luz en texto al hacer scroll |
| `float-card` | Flotación suave animada |

## Animaciones Tailwind disponibles

`animate-pulse-slow`, `animate-glow-pulse`, `animate-wave`, `animate-wave-slow`,
`animate-float`, `animate-scan-line`, `animate-fade-in-up`, `animate-glitch`.

## Componentes reales (app/components)

| Componente | Uso |
|---|---|
| `Navbar` | Navegación superior |
| `MetricsPanel` | Métricas del punto activo |
| `CesiumMap` | Visor 3D Cesium (Panel en vivo) |
| `ForecastChart` / `ForecastDayCard` | Pronóstico |
| `RainParticles` | Lluvia animada (estado tormenta) |
| `AlertDrawer` | Panel de alertas |
| `NotificationBanner` | Notificaciones flotantes |
| `AnimatedCounter` | Contador animado |
| `WeatherBadge` | Badge de clima |

## Reglas

1. Tarjetas/paneles → `glass`, `glass-strong` o `glass-glow`.
2. Botones CTAs → `glass-glow` (o `shadow-glow`) con `font-mono uppercase tracking-wider text-cyan`.
3. Estados de riesgo → tokens `risk-*`.
4. Títulos → `font-display` + `neon-text` / `title-storm`.
