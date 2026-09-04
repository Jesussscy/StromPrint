"""
StormPrint :: database.py
Persistence layer via SQLAlchemy 2.x async, con soporte opcional de PostgreSQL.

Almacena FloodRecord (pasos de simulacion) y PredictionRecord (corridas de
pronostico) para el territorio Manga (Cartagena).

Estrategia de conexion (degradacion sin crash):
  1. Si se define DATABASE_URL (p. ej. Postgres/Neon/Turso con `+asyncpg`),
     se usa esa base externa DURADERA.
  2. Si no, se usa SQLite. En Vercel va a /tmp (efimera entre invocaciones);
     en local, a un archivo stormprint.db del proyecto.
De este modo, sin configurar nada la app sigue funcionando (historico efimero),
y al configurar DATABASE_URL el historial y las predicciones persisten.
"""

import datetime
import json
import logging
import os
from typing import AsyncGenerator, List, Optional

from sqlalchemy import Float, Integer, String, DateTime, select, delete, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

logger = logging.getLogger("stormprint.database")

# ---------------------------------------------------------------------------
# Engine configuration (with optional external DATABASE_URL)
# ---------------------------------------------------------------------------
_IS_VERCEL = bool(os.environ.get("VERCEL"))

_EXTERNAL_DB_URL = os.environ.get("DATABASE_URL", "").strip()

if _EXTERNAL_DB_URL:
    # Normalizacion: si el usuario da una URL postgres sin driver async,
    # la completamos con asyncpg para que funcione debajo de SQLAlchemy async.
    if _EXTERNAL_DB_URL.startswith("postgres://"):
        _EXTERNAL_DB_URL = "postgresql+asyncpg://" + _EXTERNAL_DB_URL[len("postgres://"):]
    elif _EXTERNAL_DB_URL.startswith("postgresql://"):
        _EXTERNAL_DB_URL = "postgresql+asyncpg://" + _EXTERNAL_DB_URL[len("postgresql://"):]
    DATABASE_URL = _EXTERNAL_DB_URL
    DB_IS_EXTERNAL = True
    logger.info("Usando base de datos externa (persistente): %s", DATABASE_URL.split("@")[-1])
else:
    _DB_PATH = "/tmp/stormprint.db" if _IS_VERCEL else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "stormprint.db"
    )
    DATABASE_URL = f"sqlite+aiosqlite:///{_DB_PATH}"
    DB_IS_EXTERNAL = False
    logger.info("Usando SQLite (%s). Configura DATABASE_URL para persistencia en Vercel.", DATABASE_URL)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


def _utcnow() -> datetime.datetime:
    """Fecha/hora UTC (evita la deprecacion de datetime.utcnow).

    Se guarda como naive-UTC para compatibilidad con columnas DateTime sin
    zona horaria en SQLite y PostgreSQL.
    """
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# FloodRecord — registros de simulacion por timestep
# ---------------------------------------------------------------------------
class FloodRecord(Base):
    __tablename__ = "flood_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=_utcnow, index=True
    )
    hour: Mapped[float] = mapped_column(Float, nullable=False)
    water_level_cm: Mapped[float] = mapped_column(Float, nullable=False)
    rain_intensity: Mapped[float] = mapped_column(Float, nullable=False)
    tide_level: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "hour": self.hour,
            "water_level_cm": round(self.water_level_cm, 3),
            "rain_intensity": round(self.rain_intensity, 3),
            "tide_level": round(self.tide_level, 3),
            "risk_level": self.risk_level,
        }


# ---------------------------------------------------------------------------
# PredictionRecord — predicciones completas guardadas
# ---------------------------------------------------------------------------
class PredictionRecord(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=_utcnow, index=True
    )
    horas_pronostico: Mapped[int] = mapped_column(Integer, nullable=False)
    puntos_json: Mapped[str] = mapped_column(String, nullable=False)
    meteorologia_json: Mapped[str] = mapped_column(String, nullable=False)
    max_water_level_cm: Mapped[float] = mapped_column(Float, nullable=False)
    peak_hour: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    ecuacion: Mapped[str] = mapped_column(String(500), nullable=False)
    data_source: Mapped[str] = mapped_column(String(24), nullable=True, default="simulado")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "horas_pronostico": self.horas_pronostico,
            "puntos": json.loads(self.puntos_json) if self.puntos_json else [],
            "meteorologia_resumen": json.loads(self.meteorologia_json) if self.meteorologia_json else {},
            "max_water_level_cm": round(self.max_water_level_cm, 3),
            "peak_hour": round(self.peak_hour, 1),
            "risk_level": self.risk_level,
            "ecuacion": self.ecuacion,
            "data_source": self.data_source or "simulado",
        }


# ---------------------------------------------------------------------------
# DB lifecycle — run once per cold start, not per request
# ---------------------------------------------------------------------------
_db_initialized = False


async def _migrate_data_source(conn) -> None:
    """Anade la columna `data_source` a `predictions` si no existe, de forma
    agnostica del dialecto (SQLite y PostgreSQL)."""
    dialect = conn.dialect.name
    try:
        if dialect == "sqlite":
            cols = await conn.execute(text("PRAGMA table_info(predictions)"))
            names = {row[1] for row in cols.all()}
            if "data_source" not in names:
                await conn.execute(text("ALTER TABLE predictions ADD COLUMN data_source VARCHAR(24)"))
        else:
            cols = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='predictions' AND column_name='data_source'"
            ))
            if cols.first() is None:
                await conn.execute(text("ALTER TABLE predictions ADD COLUMN data_source VARCHAR(24)"))
    except Exception as e:
        logger.warning("Migration add data_source failed: %s", e)


async def init_db() -> None:
    global _db_initialized
    if _db_initialized:
        return
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migracion ligera: anyade la columna data_source a tablas predictions existentes
        await _migrate_data_source(conn)
    _db_initialized = True


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    if not _db_initialized:
        try:
            await init_db()
        except Exception as e:
            logger.exception("Failed to initialize database: %s", e)
            # Continue anyway — endpoints will handle the error with a 500
    async with AsyncSessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# FloodRecord CRUD
# ---------------------------------------------------------------------------
async def persist_records(session: AsyncSession, records: List[dict]) -> None:
    orm_records = [
        FloodRecord(
            hour=r["hour"],
            water_level_cm=r["water_level_cm"],
            rain_intensity=r["rain_intensity"],
            tide_level=r["tide_level"],
            risk_level=r["risk_level"],
        )
        for r in records
    ]
    session.add_all(orm_records)
    await session.commit()


async def fetch_recent_records(session: AsyncSession, limit: int = 168) -> List[dict]:
    stmt = select(FloodRecord).order_by(FloodRecord.id.desc()).limit(limit)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return [r.to_dict() for r in reversed(rows)]


SQLITE_MAX_VARIABLES = 900  # SQLite default limit is 999, leave margin


async def clear_old_records(session: AsyncSession, keep_last: int = 5000) -> None:
    stmt = select(FloodRecord.id).order_by(FloodRecord.id.desc()).offset(keep_last)
    result = await session.execute(stmt)
    ids_to_delete = [row[0] for row in result.all()]
    if ids_to_delete:
        # Chunk deletes to stay within SQLite variable limit
        for i in range(0, len(ids_to_delete), SQLITE_MAX_VARIABLES):
            chunk = ids_to_delete[i : i + SQLITE_MAX_VARIABLES]
            await session.execute(delete(FloodRecord).where(FloodRecord.id.in_(chunk)))
        await session.commit()


# ---------------------------------------------------------------------------
# PredictionRecord CRUD
# ---------------------------------------------------------------------------
async def persist_prediction(
    session: AsyncSession,
    horas_pronostico: int,
    puntos: List[dict],
    meteorologia: dict,
    max_water_level_cm: float,
    peak_hour: float,
    risk_level: str,
    ecuacion: str,
    data_source: str = "simulado",
) -> None:
    record = PredictionRecord(
        horas_pronostico=horas_pronostico,
        puntos_json=json.dumps(puntos),
        meteorologia_json=json.dumps(meteorologia),
        max_water_level_cm=max_water_level_cm,
        peak_hour=peak_hour,
        risk_level=risk_level,
        ecuacion=ecuacion,
        data_source=data_source,
    )
    session.add(record)
    await session.commit()


async def fetch_recent_predictions(session: AsyncSession, limit: int = 10) -> List[dict]:
    stmt = select(PredictionRecord).order_by(PredictionRecord.id.desc()).limit(limit)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return [r.to_dict() for r in reversed(rows)]


async def clear_old_predictions(session: AsyncSession, keep_last: int = 200) -> None:
    stmt = select(PredictionRecord.id).order_by(PredictionRecord.id.desc()).offset(keep_last)
    result = await session.execute(stmt)
    ids_to_delete = [row[0] for row in result.all()]
    if ids_to_delete:
        # Chunk deletes to stay within SQLite variable limit
        for i in range(0, len(ids_to_delete), SQLITE_MAX_VARIABLES):
            chunk = ids_to_delete[i : i + SQLITE_MAX_VARIABLES]
            await session.execute(delete(PredictionRecord).where(PredictionRecord.id.in_(chunk)))
        await session.commit()
