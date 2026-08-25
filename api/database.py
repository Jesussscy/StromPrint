"""
StormPrint :: database.py
Async SQLite persistence layer via SQLAlchemy 2.x + aiosqlite.
Stores every simulated FloodRecord for the Manga (Cartagena) territory.
"""

import datetime
import os
from typing import AsyncGenerator, List, Optional

from sqlalchemy import Float, Integer, String, DateTime, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# ---------------------------------------------------------------------------
# Engine configuration
# ---------------------------------------------------------------------------
# Vercel serverless functions only allow writes to /tmp, so we detect that
# environment and redirect the SQLite file there; locally it lives at the
# project root as stormprint.db.
_IS_VERCEL = bool(os.environ.get("VERCEL"))
_DB_PATH = "/tmp/stormprint.db" if _IS_VERCEL else os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "stormprint.db"
)
DATABASE_URL = f"sqlite+aiosqlite:///{_DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


class FloodRecord(Base):
    """
    Persists one timestep of a StormPrint simulation run for Manga.
    """

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


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def persist_records(session: AsyncSession, records: List[dict]) -> None:
    """Bulk-persist a simulation's timestep results."""
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


async def clear_old_records(session: AsyncSession, keep_last: int = 5000) -> None:
    """Housekeeping: cap table growth on long-running deployments."""
    stmt = select(FloodRecord.id).order_by(FloodRecord.id.desc()).offset(keep_last)
    result = await session.execute(stmt)
    ids_to_delete = [row[0] for row in result.all()]
    if ids_to_delete:
        from sqlalchemy import delete

        await session.execute(delete(FloodRecord).where(FloodRecord.id.in_(ids_to_delete)))
        await session.commit()
