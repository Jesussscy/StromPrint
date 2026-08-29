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
from typing import Any, Dict, List

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
    ALERTA_COOLDOWN_HOURS = 1
    ALERTA_MIN_SPACING = 2  # numero minimo de horas entre alertas del mismo tipo

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
        """Evita spam: siempre notifica CRITICO/EMERGENCIA, limita ALERTA."""
        if riesgo in ("CRITICO", "EMERGENCIA"):
            return True

        if riesgo == "ALERTA":
            # Limitar a una alerta cada cooldown (por tipo)
            recent = self._get_recent_notifications("ALERTA", hours=self.ALERTA_COOLDOWN_HOURS)
            if len(recent) >= self.ALERTA_MIN_SPACING:
                return False

        # NORMAL nunca genera notificacion (evita ruido)
        return riesgo != "NORMAL"

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

    def _get_recent_notifications(
        self, riesgo: str, hours: int = 1
    ) -> List[Dict[str, Any]]:
        cutoff = datetime.now() - timedelta(hours=hours)
        recent = []
        for notif in reversed(self.notification_history):
            try:
                ts = datetime.fromisoformat(str(notif.get("timestamp", "")))
            except (ValueError, TypeError):
                continue
            if ts < cutoff:
                break
            if notif.get("riesgo") == riesgo:
                recent.append(notif)
        return recent


# Instancia singleton
notification_service = NotificationService()
