"use client";

import { motion } from "framer-motion";

interface EquationDisplayProps {
  ecuacion?: string;
  parametros?: {
    masa?: number;
    amortiguamiento?: number;
    rigidez?: number;
    humedadSuelo?: number;
    diasLluviosos?: number;
  };
}

export default function EquationDisplay({
  ecuacion = "m\u00b7H''(t) + c(t)\u00b7H'(t) + k(t)\u00b7H(t) = F_lluvia(t) + F_marea(t) + F_viento(t)",
  parametros,
}: EquationDisplayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="glass-panel equation-glow px-5 py-3"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-cyan/60 mb-1">
            Ecuacion Diferencial de Segundo Orden
          </p>
          <p className="font-mono text-sm text-fog leading-relaxed">
            {ecuacion}
          </p>
        </div>

        {parametros && (
          <div className="flex flex-wrap gap-3">
            <ParamBadge label="m" value={parametros.masa ?? 1.0} />
            <ParamBadge label="c(t)" value={parametros.amortiguamiento ?? 0.45} />
            <ParamBadge label="k(t)" value={parametros.rigidez ?? 0.65} />
            {parametros.humedadSuelo !== undefined && (
              <ParamBadge label="h_suelo" value={parametros.humedadSuelo} suffix="%" multiplier={100} />
            )}
            {parametros.diasLluviosos !== undefined && (
              <ParamBadge label="d" value={parametros.diasLluviosos} suffix="d" />
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-4">
        <span className="font-mono text-[8px] uppercase tracking-widest text-mist/40">
          Resuelta con Runge-Kutta 45 (scipy.integrate.solve_ivp)
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[8px] uppercase tracking-widest text-mist/40">
          Forma integral de Volterra
        </span>
      </div>
    </motion.div>
  );
}

function ParamBadge({
  label,
  value,
  suffix = "",
  multiplier = 1,
}: {
  label: string;
  value: number;
  suffix?: string;
  multiplier?: number;
}) {
  const displayValue = (value * multiplier).toFixed(multiplier > 1 ? 0 : 2);
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-cyan/15 bg-abyss-3/50 px-2 py-0.5">
      <span className="font-mono text-[10px] text-cyan/70">{label}</span>
      <span className="font-mono text-[10px] text-fog font-tabular">
        {displayValue}{suffix}
      </span>
    </div>
  );
}
