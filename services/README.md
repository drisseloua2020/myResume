# ResumeForge Services - Production Python Port

This is a second-pass FastAPI conversion of the original TypeScript services. It upgrades the first port with SQLAlchemy 2.0 ORM models, Alembic migrations, stricter Pydantic v2 schemas, pytest coverage, and a cleaner service layout.

## Quick start

```bash
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 3000
```

## Run tests

```bash
pytest
```
