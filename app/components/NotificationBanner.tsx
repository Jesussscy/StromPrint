// app/components/NotificationBanner.tsx
'use client';

import { useEffect, useState } from 'react';
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

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'error':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      default:
        return 'ℹ️';
    }
  };

  const dismiss = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  return (
    <div className="fixed top-4 right-4 z-[2000] max-w-sm space-y-2">
      <AnimatePresence>
        {notifications.slice(0, 3).map((notif, index) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ delay: index * 0.08 }}
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
                  {new Date(notif.timestamp).toLocaleString('es-CO')}
                </p>
                {(notif.email_enviado || notif.webhook_enviado) && (
                  <div className="flex gap-1 mt-1.5">
                    {notif.email_enviado && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                        📧 email
                      </span>
                    )}
                    {notif.webhook_enviado && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                        🔗 webhook
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
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBanner;
