import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class ResearchMigrationTests(unittest.TestCase):
    def test_additive_migration_preserves_trips_and_matches_new_model_metadata(self):
        from sqlalchemy import create_engine
        from alembic.autogenerate import compare_metadata
        from alembic.migration import MigrationContext
        from app.db.session import Base
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'migration.db'
            env = {**os.environ, 'DATABASE_URL': 'sqlite:///' + str(file),
                'SECRET_KEY': 'migration-fixture-secret', 'TINYFISH_API_KEY': '', 'TINYFISH_API_KEY_ENCRYPTED': ''}
            def migrate(*args):
                result = subprocess.run([sys.executable, '-m', 'alembic', *args], cwd=root, env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
            migrate('upgrade', '0001_initial_schema')
            with sqlite3.connect(file) as db:
                db.execute("INSERT INTO users (id,username,email,password_hash) VALUES (1,'fixture','fixture@example.test','!')")
                db.execute("INSERT INTO trip_plans (id,user_id,data) VALUES (1,1,'{}')")
            for _ in range(2):
                migrate('upgrade', 'head')
                engine = create_engine(env['DATABASE_URL'])
                with engine.connect() as db:
                    context = MigrationContext.configure(db, opts={'include_object': lambda obj, name, kind, reflected, compared:
                        name in ('research_budget', 'research_jobs') if kind == 'table' else True})
                    self.assertEqual(compare_metadata(context, Base.metadata), [])
                engine.dispose()
                with sqlite3.connect(file) as db:
                    self.assertEqual(db.execute('SELECT username FROM users').fetchone()[0], 'fixture')
                    self.assertEqual(db.execute('SELECT COUNT(*) FROM trip_plans').fetchone()[0], 1)
                migrate('downgrade', '0001_initial_schema')
