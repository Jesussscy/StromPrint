"""
StormPrint :: notification_service.py
Sistema de notificaciones multi-canal por umbrales de riesgo.

- Email (SMTP, opcional)
- Webhook (Telegram/Discord, opcional)
- Historial persistente local (es evasion de spam en estado ALERTA)

Los umbrales coinciden con la fuente de verdad de physics_engine.py:
  Normal < 30cm · Alerta 30-59 · Emergencia 60-99 · Critico >= 100
"""

import json
import logging
import os
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

import httpx

from .physics_engine import (
    RISK_THRESHOLD_ALERTA,
    RISK_THRESHOLD_EMERGENCIA,
    RISK_THRESHOLD_NORMAL,
)

logger = logging.getLogger("stormprint.notifications")

DASHBOARD_URL = "https://stormprint.vercel.app"


class NotificationService:
    """Canal de notificaciones con deduplicacion y persistencia leve."""

    HISTORY_FILE = (
        "/tmp/stormprint_notifications.json"
        if os.getenv("VERCEL")
        else "notifications.json"
    )
    MAX_HISTORY = 100
    RISK_COOLDOWN_SECONDS = 1800  # 30 min: no repetir el mismo nivel de riesgo

    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.webhook_url = os.getenv("WEBHOOK_URL", "")
        self.notification_history = self._load_history()

    async def check_and_notify(
        self, nivel_cm: float, weather_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Clasifica el nivel, decide si notificar (anti-spam) y envia."""
        riesgo, mensaje = self._clasificar(nivel_cm)

        if not self._should_send_notification(riesgo, nivel_cm):
            return []

        email_sent = await self._send_email(mensaje, nivel_cm, weather_data)
        webhook_sent = await self._send_webhook(mensaje, nivel_cm, weather_data)

        notification = {
            "timestamp": datetime.now().isoformat(),
            "riesgo": riesgo,
            "nivel_cm": round(nivel_cm, 1),
            "mensaje": mensaje,
            "email_enviado": email_sent,
            "webhook_enviado": webhook_sent,
        }
        self._store_notification(notification)
        return [notification]

    def _clasificar(self, nivel_cm: float):
        """Mapea el nivel (cm) a riesgo y mensaje usando umbrales reales."""
        nivel_cm = float(nivel_cm or 0.0)
        if nivel_cm >= RISK_THRESHOLD_EMERGENCIA:  # >= 100
            riesgo = "CRITICO"
            mensaje = (
                f"ALERTA CRITICA! Nivel de agua {nivel_cm:.1f} cm en Manga, Cartagena. "
                "EVACUE hacia puntos altos."
            )
        elif nivel_cm >= RISK_THRESHOLD_ALERTA:  # >= 60
            riesgo = "EMERGENCIA"
            mensaje = (
                f"Alerta de emergencia. Nivel de agua {nivel_cm:.1f} cm en Manga. "
                "El agua entra a viviendas: proteja sus pertenencias."
            )
        elif nivel_cm >= RISK_THRESHOLD_NORMAL:  # >= 30
            riesgo = "ALERTA"
            mensaje = (
                f"Nivel de agua {nivel_cm:.1f} cm en Manga. "
                "Mantengase informado y evite calles bajas."
            )
        else:
            riesgo = "NORMAL"
            mensaje = f"Nivel de agua normal ({nivel_cm:.1f} cm) en Manga."
        return riesgo, mensaje

    def _should_send_notification(self, riesgo: str, nivel_cm: float) -> bool:
        """Evita spam: nunca envia NORMAL y deduplica por nivel de riesgo."""
        if riesgo == "NORMAL":
            return False

        # Si ya se notifico este mismo nivel de riesgo recientemente, no repetir.
        last = self._get_last_notification_for(riesgo)
        if last is not None:
            try:
                ts = datetime.fromisoformat(str(last.get("timestamp", "")))
            except (ValueError, TypeError):
                ts = None
            if ts is not None and (datetime.now() - ts).total_seconds() < self.RISK_COOLDOWN_SECONDS:
                return False

        return True

    async def _send_email(
        self, mensaje: str, nivel_cm: float, weather_data: Dict[str, Any]
    ) -> bool:
        """Envia correo (solo si SMTP esta configurado)."""
        if not self.smtp_user or not self.smtp_password:
            return False
        try:
            dest = os.getenv("SMTP_TO", self.smtp_user)
            msg = MIMEMultipart()
            msg["From"] = self.smtp_user
            msg["To"] = dest
            msg["Subject"] = "StormPrint - Alerta de Inundacion (Manga)"

            w = weather_data or {}
            body = (
                "StormPrint - Alerta de Inundacion\n\n"
                f"Ubicacion: Barrio Manga, Cartagena\n"
                f"Nivel de agua: {nivel_cm:.1f} cm\n\n"
                f"Temperatura: {w.get('temperatura', 'N/A')} C\n"
                f"Humedad: {w.get('humedad', 'N/A')}%\n"
                f"Lluvia: {w.get('precipitacion_actual_mm_h', w.get('precipitacion_actual', 'N/A'))} mm/h\n"
                f"Viento: {w.get('velocidad_viento_kmh', w.get('velocidad_viento', 'N/A'))} km/h\n"
                f"Fuente: {w.get('source', 'N/A')}\n\n"
                f"{mensaje}\n\n"
                f"Dashboard: {DASHBOARD_URL}\n"
            )
            msg.attach(MIMEText(body, "plain"))

            server = smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=10)
            server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)
            server.quit()
            logger.info("Email enviado")
            return True
        except Exception as exc:
            logger.error("Error enviando email: %s", exc)
            return False

    async def _send_webhook(
        self, mensaje: str, nivel_cm: float, weather_data: Dict[str, Any]
    ) -> bool:
        """Envia a webhook (Telegram/Discord) si esta configurado."""
        if not self.webhook_url:
            return False
        try:
            w = weather_data or {}
            text = (
                "StormPrint - Alerta de Inundacion\n"
                "-------------------------------\n"
                f"Ubicacion: Barrio Manga, Cartagena\n"
                f"Nivel de agua: {nivel_cm:.1f} cm\n"
                f"Temp: {w.get('temperatura', 'N/A')} C | "
                f"Humedad: {w.get('humedad', 'N/A')}%\n"
                f"Lluvia: {w.get('precipitacion_actual_mm_h', w.get('precipitacion_actual', 'N/A'))} mm/h\n"
                f"Viento: {w.get('velocidad_viento_kmh', w.get('velocidad_viento', 'N/A'))} km/h\n"
                f"\n{mensaje}\n\n{DASHBOARD_URL}"
            )
            payload = {"text": text}
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(self.webhook_url, json=payload)
            if resp.status_code == 200:
                logger.info("Webhook enviado")
                return True
            logger.warning("Webhook error %s", resp.status_code)
            return False
        except Exception as exc:
            logger.error("Error enviando webhook: %s", exc)
            return False

    def _load_history(self) -> List[Dict[str, Any]]:
        try:
            if os.path.exists(self.HISTORY_FILE):
                with open(self.HISTORY_FILE, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                if isinstance(data, list):
                    return data
        except Exception:
            pass
        return []

    def _store_notification(self, notification: Dict[str, Any]) -> None:
        self.notification_history.append(notification)
        if len(self.notification_history) > self.MAX_HISTORY:
            self.notification_history = self.notification_history[-self.MAX_HISTORY:]
        try:
            with open(self.HISTORY_FILE, "w", encoding="utf-8") as fh:
                json.dump(self.notification_history, fh)
        except Exception as exc:
            logger.warning("No se pudo guardar historial: %s", exc)

    def _get_last_notification_for(self, riesgo: str) -> Optional[Dict[str, Any]]:
        """Devuelve la ultima notificacion almacenada de un nivel de riesgo."""
        for notif in reversed(self.notification_history):
            if notif.get("riesgo") == riesgo:
                return notif
        return None

    # ------------------------------------------------------------------
    # Estado en tiempo real (para el Centro de Alertas)
    # ------------------------------------------------------------------
    STATE_INTERVAL_SECONDS = 45  # persistir snapshot de estado como mucho cada 45s

    @staticmethod
    def _conf_riesgo(riesgo: str) -> Dict[str, Any]:
        table = {
            "CRITICO": {
                "icono": "🚨",
                "color": "#FF0055",
                "titulo": "¡ALERTA CRÍTICA!",
                "zona": "Manga Oeste",
                "ubicacion": "Av. Pedro de Heredia",
            },
            "EMERGENCIA": {
                "icono": "🌊",
                "color": "#FF7700",
                "titulo": "Alerta de Emergencia",
                "zona": "Manga Centro",
                "ubicacion": "Calle 24",
            },
            "ALERTA": {
                "icono": "⚠️",
                "color": "#F3F300",
                "titulo": "Nivel en Aumento",
                "zona": "Manga Este",
                "ubicacion": "Calle 30",
            },
            "NORMAL": {
                "icono": "✅",
                "color": "#00F3FF",
                "titulo": "Sistema Estable",
                "zona": "Manga Norte",
                "ubicacion": "Barrio Manga, Cartagena",
            },
        }
        return table.get(riesgo, table["NORMAL"])

    @staticmethod
    def _describir_estado(riesgo: str, nivel_cm: float) -> str:
        if riesgo == "CRITICO":
            return (
                f"El nivel supera los {nivel_cm:.0f} cm en Manga Oeste. "
                "EVACÚE hacia puntos altos de inmediato."
            )
        if riesgo == "EMERGENCIA":
            return (
                f"Se esperan {nivel_cm:.0f} cm de agua. El agua entra a "
                "viviendas: proteja sus pertenencias y suba a plantas altas."
            )
        if riesgo == "ALERTA":
            return (
                f"Nivel de agua en {nivel_cm:.0f} cm y en aumento. "
                "Evite transitar por calles bajas."
            )
        return "Todos los sensores funcionando correctamente. Sin anomalías."

    def current_state_notification(
        self,
        nivel_cm: float,
        tendencia_cm_h: Optional[float] = None,
        weather_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Tarjeta de estado que refleja el nivel REAL actual (todos los
        niveles, incluido NORMAL -> INFO). El timestamp es fresco para que
        el cliente muestre 'hace X' en tiempo real."""
        riesgo, _ = self._clasificar(nivel_cm)
        conf = self._conf_riesgo(riesgo)
        tendencia = None
        if tendencia_cm_h is not None:
            if tendencia_cm_h > 2:
                tendencia = f"+{tendencia_cm_h:.0f} cm/h"
            elif tendencia_cm_h < -2:
                tendencia = f"{tendencia_cm_h:.0f} cm/h"
            else:
                tendencia = "estable"

        ahora = datetime.now()
        state = {
            "id": f"state_{ahora.strftime('%Y%m%d%H%M%S%f')}",
            "nivel": riesgo,
            "riesgo": riesgo,
            "icono": conf["icono"],
            "color": conf["color"],
            "titulo": conf["titulo"],
            "descripcion": self._describir_estado(riesgo, nivel_cm),
            "ubicacion": conf["ubicacion"],
            "zona": conf["zona"],
            "nivel_agua": round(float(nivel_cm), 1),
            "nivel_cm": round(float(nivel_cm), 1),
            "tendencia": tendencia,
            "timestamp": ahora.isoformat(),
            "de_sistema": True,
        }

        # Persistir throttled (evitar llenar el historial cada polling)
        last_state = None
        for n in reversed(self.notification_history):
            if n.get("de_sistema"):
                last_state = n
                break
        persist = True
        if last_state is not None:
            try:
                last_ts = datetime.fromisoformat(str(last_state.get("timestamp", "")))
                elapsed = (ahora - last_ts).total_seconds()
                if last_state.get("riesgo") == riesgo and elapsed < self.STATE_INTERVAL_SECONDS:
                    persist = False
            except (ValueError, TypeError):
                persist = True
        if persist:
            self._store_notification(state)
        return state

    def build_metrics(self, nivel_maximo_cm: Optional[float] = None) -> Dict[str, Any]:
        """Metricas agregadas a partir del historial real."""
        history = self.notification_history
        ahora = datetime.now()
        uld = ahora - timedelta(hours=24)

        # ultima_alerta: timestamp mas reciente con riesgo relevante
        ultima_alerta = None
        for n in history:
            ts = n.get("timestamp", "")
            if n.get("riesgo") in ("CRITICO", "EMERGENCIA", "ALERTA") and ts:
                if ultima_alerta is None or ts > ultima_alerta:
                    ultima_alerta = ts

        alertas_hoy = 0
        zonas = set()
        for n in history:
            riesgo = n.get("riesgo")
            if riesgo not in ("CRITICO", "EMERGENCIA", "ALERTA"):
                continue
            try:
                ts = datetime.fromisoformat(str(n.get("timestamp", "")))
            except (ValueError, TypeError):
                continue
            if ts >= uld:
                alertas_hoy += 1
            if n.get("zona"):
                zonas.add(n.get("zona"))

        return {
            "ultima_alerta": ultima_alerta,
            "alertas_hoy": alertas_hoy,
            "nivel_maximo": nivel_maximo_cm,
            "zonas_afectadas": len(zonas) if zonas else None,
        }


# Instancia singleton
notification_service = NotificationService()
