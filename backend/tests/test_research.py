"""Isolated research API checks; provider calls are always mocked."""
import os
import tempfile
import unittest
from datetime import date, timedelta
from unittest.mock import patch

os.environ.setdefault('SECRET_KEY', 'research-test-secret-not-for-deployment')
os.environ.setdefault('DATABASE_URL', 'sqlite://')
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db.session import Base, get_db
from app.models.destination import Destination
from app.services.travel import CATALOG


class ResearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handle, cls.path = tempfile.mkstemp(suffix='.db')
        os.close(handle)
        cls.engine = create_engine('sqlite:///' + cls.path, connect_args={'check_same_thread': False})
        cls.sessions = sessionmaker(bind=cls.engine)
        Base.metadata.create_all(cls.engine)
        with cls.sessions() as db:
            allowed = {column.name for column in Destination.__table__.columns}
            db.add_all(Destination(**{k: v for k, v in item.items() if k in allowed}) for item in CATALOG)
            db.commit()
        def session():
            with cls.sessions() as db:
                yield db
        app.dependency_overrides[get_db] = session
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        app.dependency_overrides.pop(get_db, None)
        cls.engine.dispose()
        os.unlink(cls.path)

    def setUp(self):
        with patch('app.api.v1.auth.rate_limit_check', return_value=True):
            token = self.client.post('/api/v1/auth/guest').json()['access_token']
        self.headers = {'Authorization': 'Bearer ' + token}
        self.body = {'place_id': 1, 'start': str(date.today() + timedelta(days=7)), 'days': 3,
                     'travelers': 2, 'style': 'Slow travel', 'adults': 2, 'rooms': 1,
                     'checkout': str(date.today() + timedelta(days=9)), 'category': 'essentials', 'mode': 'discovery'}

    def post(self, **changes):
        return self.client.post('/api/v1/research', headers=self.headers, json={**self.body, **changes})

    def test_unconfigured_guest_receives_source_links_without_payment_prompts(self):
        result = self.post()
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['status'], 'UNAVAILABLE')
        self.assertTrue(result.json()['sources'])
        for forbidden in ('api_key', 'balance', 'upgrade', 'checkout_url'):
            self.assertNotIn(forbidden, result.text.lower())

    def test_research_requires_guest_or_account_authentication(self):
        result = self.client.post('/api/v1/research', json=self.body)
        self.assertEqual(result.status_code, 401)

    def test_rejects_invalid_dates_occupancy_and_arbitrary_urls(self):
        for change in ({'checkout': self.body['start']}, {'rooms': 3}, {'adults': 0},
                       {'start': '2020-01-01'}, {'url': 'http://127.0.0.1'},
                       {'source': 'unapproved'}, {'place_id': 999}):
            with self.subTest(change=change):
                self.assertIn(self.post(**change).status_code, (404, 422))

    def test_disabled_live_checks_fail_without_contacting_provider(self):
        result = self.post(category='stays', mode='live', source='booking')
        self.assertEqual(result.status_code, 503)
        self.assertEqual(result.json()['detail'], 'Live checks are temporarily unavailable.')

    def test_live_source_must_match_category(self):
        self.assertEqual(self.post(category='experiences', mode='live', source='booking').status_code, 422)

    def test_job_endpoints_require_authentication(self):
        self.assertEqual(self.client.get('/api/v1/research/missing').status_code, 401)
        self.assertEqual(self.client.post('/api/v1/research/missing/cancel').status_code, 401)
