"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Notification {
  id: string;
  tipo: string;
  riesgo: string;
  mensaje: string;
  timestamp: string;
  nivel_cm?: number;
  email_enviado?: boolean;
  webhook_enviado?: boolean;
}

const CHANNELS = [
  { key: "email", label: "Email", icon: "📧" },
  { key: "telegram", label: "Telegram", icon: "💬" },
  { key: "sms", label: "SMS", icon: "📱" },
  { key: "web", label: "Web", icon: "🔔", active: true },
];

const RISK_STYLE: Record<string, { color: string; label: string; icon: string }> = {
  CRITICO: { color: "#B000FF", label: "CRÍTICO", icon: "🔴" },
  EMERGENCIA: { color: "#FF0055", label: "EMERGENCIA", icon: "🟠" },
  ALERTA: { color: "#FFD600", label: "ALERTA", icon: "🟡" },
  NORMAL: { color: "#00E5FF", label: "INFO", icon: "🔵" },
};

export default function NotificationsCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeChannels, setActiveChannels] = useState<string[]>(["email", "web"]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/v1/notifications?limit=50");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.notifications) return;
        const mapped: Notification[] = data.notifications.map((n: any) => ({
          id: n.timestamp ?? `${Math.random()}`,
          tipo: String(n.riesgo ?? "NORMAL").toUpperCase(),
          riesgo: String(n.riesgo ?? "NORMAL").toUpperCase(),
          mensaje: n.mensaje ?? "Notificación de StormPrint",
          timestamp: n.timestamp ?? new Date().toISOString(),
          nivel_cm: n.nivel_cm,
          email_enviado: n.email_enviado,
          webhook_enviado: n.webhook_enviado,
        }));
        setNotifications(mapped.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)));
      } catch {
        /* API no disponible */
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const toggleChannel = (key: string) => {
    setActiveChannels((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  };

  const lastHour = notifications.filter(
    (n) => Date.now() - new Date(n.timestamp).getTime() < 3600_000
  ).length;
  const last24 = notifications.filter(
    (n) => Date.now() - new Date(n.timestamp).getTime() < 86_400_000
  ).length;
  const maxRiesgo =
    notifications.find((n) => n.riesgo === "CRITICO")?.riesgo ??
    notifications.find((n) => n.riesgo === "EMERGENCIA")?.riesgo ??
    notifications.find((n) => n.riesgo === "ALERTA")?.riesgo ??
    "NORMAL";

  return (
    <div className="glass-strong rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg glass-glow">
          <span>🔔</span>
        </div>
        <div>
          <p className="font-display text-sm font-bold text-white">Centro de Notificaciones</p>
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
            {notifications.length} eventos · actualización 30s
          </p>
        </div>
      </div>

      {/* Canales */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CHANNELS.map((ch) => {
          const active = activeChannels.includes(ch.key);
          return (
            <button
              key={ch.key}
              onClick={() => toggleChannel(ch.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${
                active && ch.active
                  ? "bg-cyan/20 text-cyan border border-cyan/30"
                  : active
                    ? "glass-subtle text-slate-300 border border-white/10"
                    : "opacity-40 text-slate-500"
              }`}
            >
              <span>{ch.icon}</span>
              {ch.label}
              {active && <span className="h-1 w-1 rounded-full bg-cyan" />}
            </button>
          );
        })}
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-slate-600">Config</span>
      </div>

      {/* Lista */}
      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {notifications.length === 0 ? (
          <p className="py-6 text-center font-mono text-xs text-slate-500">Sin notificaciones registradas</p>
        ) : (
          notifications.map((n, i) => {
            const rs = RISK_STYLE[n.riesgo] ?? RISK_STYLE.NORMAL;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(0.05 * i, 0.4) }}
                className="flex items-start gap-3 rounded-lg bg-white/[0.03] p-3"
              >
                <span className="mt-0.5 text-sm leading-none">{rs.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200 leading-snug">{n.mensaje}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-slate-500">
                    <span style={{ color: rs.color }}>{rs.label}</span>
                    {typeof n.nivel_cm === "number" && <span>{n.nivel_cm.toFixed(0)} cm</span>}
                    <span>{new Date(n.timestamp).toLocaleString("es-CO")}</span>
                    {n.email_enviado && <span className="rounded bg-white/10 px-1 py-0.5">📧 email</span>}
                    {n.webhook_enviado && <span className="rounded bg-white/10 px-1 py-0.5">🔗 webhook</span>}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Estadísticas */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Última hora</p>
          <p className="font-display text-xl font-bold font-tabular text-white">{lastHour}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Últimas 24h</p>
          <p className="font-display text-xl font-bold font-tabular text-white">{last24}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Riesgo actual</p>
          <p className="font-display text-sm font-bold" style={{ color: RISK_STYLE[maxRiesgo]?.color ?? "#00E5FF" }}>
            {RISK_STYLE[maxRiesgo]?.label ?? "NORMAL"}
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Próx. refresco</p>
          <p className="font-display text-xl font-bold font-tabular text-white">30s</p>
        </div>
      </div>
    </div>
  );
}
