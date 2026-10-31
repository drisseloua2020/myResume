"""Read-only database checks for operators; never print credentials or user records."""
import argparse
import json
from pathlib import Path
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from app.core.config import DATABASE_SCHEMA_REVISION, settings
from app.db.session import _build_engine
from app.models.entities import User


def database_error_code(error: SQLAlchemyError) -> str | None:
    original = getattr(error, 'orig', None)
    return getattr(original, 'sqlstate', None) or getattr(original, 'pgcode', None)


def database_report(engine: Engine, *, auth_summary: bool = False) -> dict:
    report = {'backend': engine.dialect.name, 'connection': 'unavailable',
              'expectedRevision': DATABASE_SCHEMA_REVISION, 'ready': False}
    if engine.dialect.name == 'sqlite' and engine.url.database not in {None, '', ':memory:'} and not Path(engine.url.database).is_file():
        return {**report, 'error': 'database_file_missing'}
    try:
        with engine.connect() as connection:
            if engine.dialect.name == 'postgresql':
                connection.execute(text('SET TRANSACTION READ ONLY'))
            report['connection'] = 'ok'
            schema = inspect(connection)
            tables = set(schema.get_table_names())
            revisions = connection.execute(text('SELECT version_num FROM alembic_version')).scalars().all() if 'alembic_version' in tables else []
            columns = {column['name'] for column in schema.get_columns('users')} if 'users' in tables else set()
            missing = sorted(set(User.__table__.columns.keys()) - columns)
            report.update({'currentRevisions': revisions, 'migrationMetadataPresent': 'alembic_version' in tables,
                           'usersTablePresent': 'users' in tables, 'missingUserColumns': missing,
                           'ready': revisions == [DATABASE_SCHEMA_REVISION] and not missing})
            if auth_summary and 'password_hash' in columns:
                report['passwordFormats'] = dict(connection.execute(text("""
                    SELECT COUNT(*) AS total,
                      COUNT(CASE WHEN password_hash LIKE '$argon2%' THEN 1 END) AS argon2,
                      COUNT(CASE WHEN password_hash LIKE '$2%' THEN 1 END) AS bcrypt,
                      COUNT(CASE WHEN password_hash IS NULL OR password_hash = '' THEN 1 END) AS no_password,
                      COUNT(CASE WHEN password_hash IS NOT NULL AND password_hash <> ''
                        AND password_hash NOT LIKE '$argon2%' AND password_hash NOT LIKE '$2%' THEN 1 END) AS other
                    FROM users
                """)).mappings().one())
            if auth_summary and 'status' in columns:
                report['accountStatusCounts'] = [dict(row) for row in connection.execute(text('SELECT status, COUNT(*) AS count FROM users GROUP BY status')).mappings()]
            connection.rollback()
    except SQLAlchemyError as error:
        report.update({'ready': False, 'errorType': type(error).__name__, 'sqlstate': database_error_code(error)})
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--auth-summary', action='store_true', help='Include aggregate password-format and account-status counts, never credentials or account identifiers')
    args = parser.parse_args()
    try:
        engine = _build_engine(settings.database_url)
    except (SQLAlchemyError, ValueError) as error:
        print(json.dumps({'connection': 'unavailable', 'ready': False, 'errorType': type(error).__name__}))
        return 1
    try:
        report = database_report(engine, auth_summary=args.auth_summary)
        print(json.dumps(report, sort_keys=True, default=str))
        return 0 if report['ready'] else 1
    finally:
        engine.dispose()


if __name__ == '__main__':
    raise SystemExit(main())
