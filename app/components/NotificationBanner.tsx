// app/components/NotificationBanner.tsx
'use client';

import { useEffect, useState } from 'react';
import { formatFechaHoraCartagena } from '@/app/lib/datetime';
import { AnimatePresence, motion } from 'framer-motion';

interface Notification {
  id: string;
  tipo: 'info' | 'warning' | 'error' | 'success';
  mensaje: string;
  timestamp: string;
  nivel_agua?: number;
  email_enviado?: boolean;
  webhook_enviado?: boolean;
  riesgo?: string;
}

export const NotificationBanner = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    let alive = true;

    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/v1/notifications?limit=5');
        if (!response.ok) return;
        const data = await response.json();
        if (!alive || !data.notifications) return;

        const mapped: Notification[] = data.notifications.map((n: any) => {
          const riesgo: string = n.riesgo ?? 'NORMAL';
          const tipo =
            riesgo === 'CRITICO'
              ? 'error'
              : riesgo === 'EMERGENCIA' || riesgo === 'ALERTA'
                ? 'warning'
                : 'info';
          return {
            id: n.timestamp ?? `${Math.random()}`,
            tipo,
            mensaje: n.mensaje ?? 'Notificacion de StormPrint',
            timestamp: n.timestamp ?? new Date().toISOString(),
            nivel_agua: n.nivel_cm,
            email_enviado: n.email_enviado,
            webhook_enviado: n.webhook_enviado,
            riesgo,
          };
        });

        // Dedupe: solo la notificacion mas reciente de cada nivel de riesgo,
        // para no repetir las mismas alertas en el panel.
        const porRiesgo = new Map<string, Notification>();
        for (const n of mapped) {
          const prev = porRiesgo.get(n.riesgo!);
          if (!prev || n.timestamp > prev.timestamp) porRiesgo.set(n.riesgo!, n);
        }
        const deduped = Array.from(porRiesgo.values())
          .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
          .slice(0, 3);
        setNotifications(deduped);
      } catch (err) {
        // La API puede no estar disponible en desarrollo; no crashear la UI.
        console.error('Error fetching notifications:', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  if (notifications.length === 0) return null;

  const getTipoStyles = (tipo: string) => {
    switch (tipo) {
      case 'error':
        return 'bg-red-500/20 border-red-500/50 text-red-300';
      case 'warning':
        return 'bg-orange-500/20 border-orange-500/50 text-orange-300';
      case 'success':
        return 'bg-green-500/20 border-green-500/50 text-green-300';
      default:
        return 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300';
    }
  };

  const getIcon = (tipo: string): React.ReactNode => {
    const common = {
      width: 22, height: 22, viewBox: "0 0 24 24", fill: "none",
      stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    };
    switch (tipo) {
      case 'error':
        return <svg {...common}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
      case 'warning':
        return <svg {...common}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
      case 'success':
        return <svg {...common}><polyline points="20 6 9 17 4 12" /></svg>;
      default:
        return <svg {...common}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
    }
  };

  const dismiss = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  return (
    <div className="fixed top-16 right-3 left-3 sm:left-auto sm:right-4 z-[2000] sm:max-w-sm space-y-2" role="region" aria-label="Notificaciones del sistema">
      <AnimatePresence>
        {notifications.slice(0, 3).map((notif, index) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ delay: index * 0.08 }}
            role="status"
            aria-live="polite"
            className={`p-4 rounded-xl border backdrop-blur-md shadow-glow ${getTipoStyles(notif.tipo)}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl leading-none">{getIcon(notif.tipo)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug">{notif.mensaje}</p>
                {typeof notif.nivel_agua === 'number' && (
                  <p className="text-xs opacity-75 mt-1">
                    Nivel: {notif.nivel_agua.toFixed(1)} cm
                  </p>
                )}
                <p className="text-xs opacity-50 mt-1">
                  {formatFechaHoraCartagena(notif.timestamp)}
                </p>
                {(notif.email_enviado || notif.webhook_enviado) && (
                  <div className="flex gap-1 mt-1.5">
                    {notif.email_enviado && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                          <svg className="inline-block mr-1 -mt-0.5" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                          email
                      </span>
                    )}
                    {notif.webhook_enviado && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                          <svg className="inline-block mr-1 -mt-0.5" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                          webhook
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => dismiss(notif.id)}
                aria-label="Cerrar notificacion"
                className="text-white/50 hover:text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBanner;
