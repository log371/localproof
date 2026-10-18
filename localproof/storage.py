import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import JSON, Column, MetaData, String, Table, create_engine, select, update

metadata = MetaData()
runs = Table(
    "runs_v1",
    metadata,
    Column("id", String, primary_key=True),
    Column("status", String, nullable=False),
    Column("created", String, nullable=False),
    Column("lease", String, nullable=False),
    Column("owner", String, nullable=False),
    Column("report", JSON, nullable=False),
)


def now():
    return datetime.now(UTC).isoformat()


class Store:
    def __init__(self, url=None):
        url = url or os.getenv("DATABASE_URL", "sqlite:///localproof.db")
        self.engine = create_engine(
            url, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {}
        )
        metadata.create_all(self.engine)

    def create(self, report):
        run_id = str(uuid4())
        report = {**report, "id": run_id, "created": now(), "status": "queued", "results": []}
        with self.engine.begin() as conn:
            conn.execute(
                runs.insert().values(
                    id=run_id,
                    created=report["created"],
                    status="queued",
                    lease="",
                    owner="",
                    report=report,
                )
            )
        return report

    def get(self, run_id):
        with self.engine.connect() as conn:
            return conn.execute(
                select(runs.c.report).where(runs.c.id == run_id)
            ).scalar_one_or_none()

    def list(self):
        with self.engine.connect() as conn:
            return list(
                conn.execute(
                    select(runs.c.report).order_by(runs.c.created.desc()).limit(100)
                ).scalars()
            )

    def claim(self):
        owner = str(uuid4())
        with self.engine.begin() as conn:
            # Optimistic compare-and-swap works in SQLite and PostgreSQL.
            row = (
                conn.execute(
                    select(runs)
                    .where(
                        (runs.c.status == "queued")
                        | ((runs.c.status == "running") & (runs.c.lease < now()))
                    )
                    .order_by(runs.c.created)
                    .limit(1)
                )
                .mappings()
                .first()
            )
            if not row:
                return None
            report = dict(row["report"])
            report["status"] = "running"
            lease = (datetime.now(UTC) + timedelta(minutes=10)).isoformat()
            result = conn.execute(
                update(runs)
                .where(
                    runs.c.id == row["id"],
                    runs.c.owner == row["owner"],
                    runs.c.lease == row["lease"],
                    runs.c.status == row["status"],
                )
                .values(status="running", lease=lease, owner=owner, report=report)
            )
            return (report, owner) if result.rowcount == 1 else None

    def save(self, report, owner):
        with self.engine.begin() as conn:
            result = conn.execute(
                update(runs)
                .where(runs.c.id == report["id"], runs.c.owner == owner)
                .values(
                    report=report,
                    status=report["status"],
                    lease=(datetime.now(UTC) + timedelta(minutes=10)).isoformat(),
                )
            )
            if result.rowcount != 1:
                raise RuntimeError("Worker lease lost")
