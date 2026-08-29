# 📐 Plantillas — StormPrint

Patrones de layout reales del proyecto. Usa estas estructuras para nuevos bloques.

## Plantilla: Tarjeta de panel (estándar)

```tsx
<div className="glass rounded-2xl p-6">
  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">
    Etiqueta técnica
  </p>
  <h3 className="font-display text-lg font-bold text-white mb-2">Título</h3>
  <p className="text-slate-400 text-sm leading-relaxed mb-4">Descripción</p>
  {/* contenido */}
</div>
```

## Plantilla: Título de sección con número de paso

```tsx
<div className="flex items-center gap-3 mb-6">
  <div className="flex h-8 w-8 items-center justify-center rounded-lg glass-glow">
    <span className="font-display text-sm font-bold text-cyan">01</span>
  </div>
  <h2 className="font-display text-2xl font-bold text-white">Título de Sección</h2>
</div>
```

## Plantilla: Acción / botón CTA

```tsx
<button className="glass-glow rounded-lg px-6 py-3 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/10 transition">
  Acción
</button>
```

## Plantilla: Hero (sección principal de página)

```tsx
<section className="relative py-24 px-6 overflow-hidden">
  <div className="absolute inset-0 hero-gradient" />
  <div className="relative mx-auto max-w-7xl">
    <h1 className="font-display text-4xl md:text-6xl font-bold text-white mb-4 title-storm">
      STORM//PRINT
    </h1>
    <p className="text-lg text-slate-400 max-w-2xl">Subtítulo / descripción</p>
  </div>
</section>
```

## Plantilla: Badge de riesgo / estado

```tsx
<span
  className={`rounded-md px-3 py-1 font-mono text-[11px] uppercase tracking-wider ${
    estado === "Critico"
      ? "text-risk-critical"
      : estado === "Emergencia"
        ? "text-risk-emergency"
        : estado === "Alerta"
          ? "text-risk-alert"
          : "text-risk-normal"
  }`}
>
  {estado}
</span>
```

## Plantilla: Gráfico (Recharts) dentro de panel

```tsx
<div className="glass rounded-2xl p-4">
  <div className="h-[300px]">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,210,255,0.05)" />
        <XAxis dataKey="hora" stroke="#334155" tick={{ fontSize: 9, fill: "#64748B" }} tickLine={false} />
        <YAxis stroke="#334155" tick={{ fontSize: 9, fill: "#64748B" }} tickLine={false} />
        <Tooltip contentStyle={{ background: "rgba(5,10,15,0.95)", border: "1px solid rgba(0,210,255,0.15)", borderRadius: 12, fontSize: 11, color: "#E2E8F0" }} />
        <Line type="monotone" dataKey="valor" stroke="#00E5FF" strokeWidth={2.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
</div>
```

## Reglas

1. Contenedores de página en `max-w-7xl mx-auto px-6` (o `px-6 md:px-12`).
2. Fondo general `bg-ocean` (le da `ocean-deep` por body/globals).
3. Etiquetas técnicas en `font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500`.
4. Títulos `font-display` + `text-white`/`text-cyan`.
5. Gráficos Recharts: fondo oscuro del tooltip y grid cyan tenue.
