"""
StormPrint :: database.py
Async SQLite persistence layer via SQLAlchemy 2.x + aiosqlite.
Stores FloodRecord (simulation timesteps) and PredictionRecord (forecast runs)
for the Manga (Cartagena) territory.
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
# Engine configuration
# ---------------------------------------------------------------------------
_IS_VERCEL = bool(os.environ.get("VERCEL"))
_DB_PATH = "/tmp/stormprint.db" if _IS_VERCEL else os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "stormprint.db"
)
DATABASE_URL = f"sqlite+aiosqlite:///{_DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# FloodRecord — registros de simulacion por timestep
# ---------------------------------------------------------------------------
class FloodRecord(Base):
    __tablename__ = "flood_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, index=True
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
        DateTime, default=datetime.datetime.utcnow, index=True
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


async def init_db() -> None:
    global _db_initialized
    if _db_initialized:
        return
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migracion ligera: anyade la columna data_source a tablas predictions existentes
        try:
            await conn.execute(text("ALTER TABLE predictions ADD COLUMN data_source VARCHAR(24)"))
        except Exception as e:
            if "duplicate column" not in str(e).lower():
                logger.warning("Migration add data_source failed: %s", e)
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
