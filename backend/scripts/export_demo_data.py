"""
Export a static snapshot of the API for the GitHub Pages build.

GitHub Pages has no backend, so the deployed dashboard falls back to these JSON files
when the API is unreachable. The snapshot is produced by the real backend: suppliers and
dependencies come from the seed, the example signals below (the same ones the landing
page uses) are scored by the production risk-fusion code, and mitigation plans come from
the PuLP solver.

    cd backend && python -m scripts.export_demo_data
"""
import hashlib
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

DB_FILE = Path(tempfile.gettempdir()) / "sentinelx_demo.db"
if DB_FILE.exists():
    DB_FILE.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{DB_FILE}"
os.environ["ENABLE_SCHEDULER"] = "false"

from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.risk_event import RiskEvent  # noqa: E402
from app.nlp.pipeline import NLPRiskPipeline  # noqa: E402
from app.seed import seed_database  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "demo"

# (event_type, headline, source, region, severity, sentiment, days_ago)
# Tuned so the corridors land at different levels (a few critical, most elevated, some low)
# rather than every region saturating at 100.
SIGNALS = [
    ("weather", "Typhoon warning for the Kaohsiung and Hsinchu science parks", "weather", "East Asia", 48, -0.35, 2),
    ("supply_shortage", "DRAM wafer allocations tighten as fabs shift capacity to HBM", "news", "East Asia", 34, -0.3, 6),
    ("other", "Hualien earthquake prompts fab tool inspections", "news", "East Asia", 30, -0.5, 21),
    ("weather", "Typhoon remnants flood low-lying Shenzhen districts", "weather", "East Asia", 36, -0.3, 16),
    ("weather", "Monsoon flooding closes roads around the Bayan Lepas industrial zone", "weather", "Southeast Asia", 30, -0.4, 5),
    ("logistics", "Yard congestion lengthens berth waits in Singapore", "news", "Southeast Asia", 22, -0.35, 4),
    ("supply_shortage", "Cathode precursor prices jump after a refinery outage", "news", "Southeast Asia", 26, -0.4, 11),
    ("labor", "Contract talks stall at US East and Gulf Coast container ports", "news", "North America", 16, -0.4, 7),
    ("weather", "Heat advisory and rolling power cuts across Nuevo León", "weather", "North America", 15, -0.2, 10),
    ("logistics", "Long Beach terminals report container dwell times rising", "news", "North America", 12, -0.3, 15),
    ("logistics", "Asia to Europe carriers keep routing around the Cape, adding 10 to 14 days", "news", "Europe", 32, -0.55, 3),
    ("geopolitical", "Export licence review widened for lithography tooling", "news", "Europe", 26, -0.45, 8),
    ("labor", "Rail freight strike called across the German network", "news", "Europe", 22, -0.5, 10),
    ("logistics", "Convoy delays build at the Suez Canal's southern entrance", "news", "Europe", 20, -0.45, 25),
]

BUDGET_STEP = 10_000
BUDGET_MAX = 3_000_000


NAIVE_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$")


def utc(value):
    """SQLite drops tzinfo; mark naive timestamps as UTC like the Postgres backend does."""
    if isinstance(value, dict):
        return {k: utc(v) for k, v in value.items()}
    if isinstance(value, list):
        return [utc(v) for v in value]
    if isinstance(value, str) and NAIVE_ISO.match(value):
        return value + "Z"
    return value


def write(name: str, data) -> None:
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(utc(data), separators=(",", ":")))


def main() -> int:
    Base.metadata.create_all(bind=engine)
    now = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        seed_database(db)
        for etype, headline, source, region, sev, sent, days in SIGNALS:
            db.add(RiskEvent(
                region=region, source=source, headline=headline, summary=None,
                sentiment_score=sent, event_type=etype, detected_at=now - timedelta(days=days),
                fingerprint=hashlib.sha256(headline.encode()).hexdigest(),
                severity=float(sev), confidence=0.8, classification_source="demo",
            ))
        db.commit()
        NLPRiskPipeline(db, sentiment_analyzer=object(), classifier=object()).calculate_supplier_risks(current_time=now)
    finally:
        db.close()

    with TestClient(app) as client:
        def get(path: str):
            r = client.get(path)
            r.raise_for_status()
            return r.json()

        if OUT.exists():
            for f in sorted(OUT.rglob("*"), reverse=True):
                f.unlink() if f.is_file() else f.rmdir()
        write("health.json", get("/health"))
        write("dashboard-summary.json", get("/dashboard/summary"))
        suppliers = get("/suppliers?limit=200")
        write("suppliers.json", suppliers)
        for s in suppliers:
            write(f"suppliers/{s['id']}.json", get(f"/suppliers/{s['id']}"))
        write("network.json", get("/network"))
        write("risk-events.json", get("/risk-events?limit=200"))

        # Solver plans across the slider's range. A supplier's row is the same in every plan,
        # so rows are stored once and each distinct plan keeps only the ids it selected.
        rows: dict[str, dict] = {}
        plans, index = [], []
        seen: dict[str, int] = {}
        for budget in range(BUDGET_STEP, BUDGET_MAX + BUDGET_STEP, BUDGET_STEP):
            r = client.post("/prioritize", json={"budget": budget})
            r.raise_for_status()
            plan = r.json()
            ids = [x["supplier_id"] for x in plan.pop("selected_suppliers", [])]
            for x in r.json()["selected_suppliers"]:
                assert rows.setdefault(x["supplier_id"], x) == x, "supplier row varies between plans"
            key = json.dumps(sorted(ids))
            if key not in seen:
                seen[key] = len(plans)
                for k in ("plan_id", "generated_at", "budget", "remaining_budget"):
                    plan.pop(k, None)
                plans.append({**plan, "ids": ids})
            index.append(seen[key])
        write("plans.json", {"step": BUDGET_STEP, "max": BUDGET_MAX, "rows": rows, "index": index, "plans": plans})

    print(f"Wrote demo snapshot to {OUT} ({len(suppliers)} suppliers, {len(plans)} distinct plans)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
