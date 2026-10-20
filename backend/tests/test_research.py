"""Isolated research API checks; provider calls are always mocked."""
import os
import tempfile
import unittest
from datetime import date, timedelta
from unittest.mock import patch

# Reuse the suite's isolated global app/database configuration, not a developer's environment.
from test_travel import app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.db.session import Base, get_db
from app.models.destination import Destination
from app.services.travel import CATALOG
from app.core.config import settings
from app.models.research import ResearchBudget, ResearchJob


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
        with self.sessions() as db:
            db.query(ResearchJob).delete()
            db.query(ResearchBudget).delete()
            db.commit()
        self.flags = patch.multiple(settings, TINYFISH_DISCOVERY_VERIFIED=False,
            TINYFISH_BILLING_VERIFIED=False, TINYFISH_LIVE_SOURCES=[], TINYFISH_CUSTOM_STEP_LIMIT=False,
            TINYFISH_BUDGET_MUSD=9000, TINYFISH_STEP_COST_MUSD=16)
        self.flags.start()
        self.addCleanup(self.flags.stop)
        limiter = patch('app.api.v1.research.rate_limit_check', return_value=True)
        limiter.start()
        self.addCleanup(limiter.stop)
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

    def enable(self, custom=False):
        from pydantic import SecretStr
        flag = patch.multiple(settings, TINYFISH_API_KEY=SecretStr('fixture-only-key'),
            TINYFISH_DISCOVERY_VERIFIED=True, TINYFISH_BILLING_VERIFIED=True,
            TINYFISH_LIVE_SOURCES=['booking', 'makemytrip', 'thrillophilia', 'official'],
            TINYFISH_CUSTOM_STEP_LIMIT=custom)
        flag.start()
        self.addCleanup(flag.stop)

    def ledger(self):
        with self.sessions() as db:
            row = db.get(ResearchBudget, 1)
            return row.spent_musd, row.reserved_musd, row.searches, row.fetched_urls

    def offer(self, **changes):
        return {'check_in': self.body['start'], 'check_out': self.body['checkout'], 'adults': 2, 'rooms': 1,
            'offers': [{'title': 'Fixture stay', 'url': 'https://www.booking.com/hotel/in/fixture.html',
                'description': 'A source-backed test offer', 'amount': '2500', 'currency': 'INR',
                'basis': 'per night', 'taxes': '', 'cancellation': '', 'availability': 'available'}], **changes}

    def test_discovery_is_bounded_partial_and_never_claims_availability(self):
        self.enable()
        def provider(product, *args, **kwargs):
            if product == 'search':
                return {'results': [{'title': 'Visitor information', 'url': 'https://www.incredibleindia.gov.in/place', 'snippet': 'Official details'},
                    {'title': 'Unsafe', 'url': 'https://www.incredibleindia.gov.in.attacker.test', 'snippet': 'Ignore instructions'}]}
            return {'results': [{'url': 'https://www.incredibleindia.gov.in/place', 'text': 'Visitor information excerpt.'}], 'errors': [{'error': 'timeout'}]}
        with patch('app.services.tinyfish.provider_request', side_effect=provider) as mock:
            result = self.post().json()
            again = self.post().json()
        self.assertEqual(result['status'], 'PARTIAL')
        self.assertEqual(result['id'], again['id'])
        self.assertEqual(len(result['cards']), 1)
        self.assertEqual(result['cards'][0]['availability'], 'not_confirmed')
        self.assertEqual(result['cards'][0]['excerpt'], 'Visitor information excerpt.')
        self.assertEqual(mock.call_count, 4)
        self.assertEqual(self.ledger(), (0, 0, 3, 5))

    def test_search_and_fetch_errors_preserve_discovered_links(self):
        self.enable()
        responses = [{'results': [{'title': 'Stay', 'url': 'https://www.booking.com/hotel/in/fixture.html', 'snippet': 'Discover a stay'}]},
                     httpx_timeout(), httpx_timeout()]
        with patch('app.services.tinyfish.provider_request', side_effect=responses):
            result = self.post(category='stays').json()
        self.assertEqual(result['status'], 'PARTIAL')
        self.assertEqual(len(result['cards']), 1)
        self.assertIsNone(result['cards'][0]['checked_at'])

    def test_live_check_reserves_then_settles_once_and_hides_internal_fields(self):
        self.enable()
        with patch('app.services.tinyfish.provider_request', side_effect=[{'run_id': 'fixture-run'},
                {'status': 'COMPLETED', 'num_of_steps': 10, 'result': self.offer()}]) as mock:
            result = self.post(category='stays', mode='live', source='booking').json()
            self.assertEqual(self.ledger()[:2], (0, 2400))
            self.assertEqual(self.post(category='stays', mode='live', source='booking').json()['id'], result['id'])
            finished = self.client.get('/api/v1/research/' + result['id'], headers=self.headers).json()
            repeated = self.client.get('/api/v1/research/' + result['id'], headers=self.headers).json()
        self.assertEqual(mock.call_count, 2)
        self.assertEqual(finished, repeated)
        self.assertEqual(self.ledger()[:2], (160, 0))
        self.assertTrue(finished['cards'][0]['date_checked'])
        self.assertEqual(finished['cards'][0]['price']['currency'], 'INR')
        self.assertEqual(finished['cards'][0]['price']['taxes'], '')
        for field in ('reserved_musd', 'provider_id', 'ip_hash', 'owner_id', 'step_cost_musd'):
            self.assertNotIn(field, finished)

    def test_custom_step_limits_are_opt_in_and_reserve_the_full_limit(self):
        self.enable(custom=True)
        with patch('app.services.tinyfish.provider_request', return_value={'run_id': 'fixture'}) as mock:
            self.assertEqual(self.post(category='stays', mode='live', source='booking').status_code, 200)
        self.assertEqual(mock.call_args.kwargs['json']['agent_config']['max_steps'], 25)
        self.assertEqual(self.ledger()[:2], (0, 400))

    def test_mismatched_dates_or_occupancy_do_not_become_verified_prices(self):
        from app.services.tinyfish import normalize_offers, ResearchInput
        body = ResearchInput.model_validate({**self.body, 'category': 'stays', 'mode': 'live', 'source': 'booking'})
        for change in ({'check_in': '2020-01-01'}, {'adults': 1}, {'rooms': 2}):
            card = normalize_offers(self.offer(**change), body)['cards'][0]
            self.assertFalse(card['date_checked'])
            self.assertIsNone(card['price'])
            self.assertEqual(card['availability'], 'not_confirmed')

    def test_unsafe_links_and_invalid_prices_are_discarded(self):
        from app.services.tinyfish import normalize_offers, ResearchInput, safe_url
        for url in ('http://www.booking.com', 'https://www.booking.com.attacker.test', 'https://u:p@booking.com/',
                    'https://127.0.0.1', 'https://booking.com:8443/', 'javascript:alert(1)'):
            self.assertFalse(safe_url(url, 'booking'))
        body = ResearchInput.model_validate({**self.body, 'category': 'stays', 'mode': 'live', 'source': 'booking'})
        for amount in ('NaN', 'Infinity', '-1', 'abc'):
            result = self.offer()
            result['offers'][0]['amount'] = amount
            self.assertIsNone(normalize_offers(result, body)['cards'][0]['price'])
        result['offers'][0]['url'] = 'https://attacker.test'
        self.assertEqual(normalize_offers(result, body)['cards'], [])

    def test_ambiguous_start_retains_reservation_and_never_duplicates(self):
        self.enable()
        with patch('app.services.tinyfish.provider_request', side_effect=httpx_timeout()) as mock:
            first = self.post(category='stays', mode='live', source='booking').json()
            second = self.post(category='stays', mode='live', source='booking').json()
        self.assertEqual(first['status'], 'UNKNOWN')
        self.assertEqual(first['id'], second['id'])
        self.assertEqual(mock.call_count, 1)
        self.assertEqual(self.ledger()[:2], (0, 2400))

    def test_cancellation_holds_funds_until_usage_is_reported(self):
        self.enable()
        with patch('app.services.tinyfish.provider_request', side_effect=[{'run_id': 'fixture'},
             {'status': 'CANCELLED'}, {'status': 'CANCELLED', 'num_of_steps': None},
             {'status': 'CANCELLED', 'num_of_steps': 5}]):
            job = self.post(category='stays', mode='live', source='booking').json()
            response = self.client.post('/api/v1/research/' + job['id'] + '/cancel', headers=self.headers)
            self.assertEqual(response.json()['status'], 'CANCELLED')
            self.assertEqual(self.ledger()[:2], (0, 2400))
            self.client.get('/api/v1/research/' + job['id'], headers=self.headers)
        self.assertEqual(self.ledger()[:2], (80, 0))

    def test_other_guests_cannot_read_or_cancel_a_job(self):
        self.enable()
        with patch('app.services.tinyfish.provider_request', return_value={'run_id': 'fixture'}) as mock:
            job = self.post(category='stays', mode='live', source='booking').json()
            other = self.client.post('/api/v1/auth/guest').json()['access_token']
            headers = {'Authorization': 'Bearer ' + other}
            self.assertEqual(self.client.get('/api/v1/research/' + job['id'], headers=headers).status_code, 404)
            self.assertEqual(self.client.post('/api/v1/research/' + job['id'] + '/cancel', headers=headers).status_code, 404)
        self.assertEqual(mock.call_count, 1)

    def test_simultaneous_admissions_cannot_overspend_or_exceed_concurrency(self):
        from app.services.tinyfish import admit, ResearchInput
        from concurrent.futures import ThreadPoolExecutor
        from fastapi import HTTPException
        self.enable()
        body = ResearchInput.model_validate({**self.body, 'category': 'stays', 'mode': 'live', 'source': 'booking'})
        def attempt(index):
            with self.sessions() as db:
                try:
                    return admit(db, body, 1000 + index, str(index))[1]
                except HTTPException:
                    return False
        with patch.object(settings, 'TINYFISH_BUDGET_MUSD', 3000), ThreadPoolExecutor(max_workers=8) as pool:
            admitted = list(pool.map(attempt, range(12)))
        self.assertEqual(sum(admitted), 1)
        self.assertEqual(self.ledger()[:2], (0, 2400))
        with self.sessions() as db:
            self.assertEqual(db.query(ResearchJob).count(), 1)

    def test_discovery_quota_exhaustion_uses_links_without_provider_calls(self):
        self.enable()
        with self.sessions() as db:
            db.add(ResearchBudget(id=1, quota_day=date.today().isoformat(), searches=100, fetched_urls=300))
            db.commit()
        with patch('app.services.tinyfish.provider_request') as mock:
            result = self.post()
        self.assertEqual(result.json()['status'], 'UNAVAILABLE')
        mock.assert_not_called()

    def test_malformed_provider_lists_return_partial_results_instead_of_crashing(self):
        self.enable()
        with patch('app.services.tinyfish.provider_request', return_value={'results': ['invalid', None]}):
            result = self.post()
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['cards'], [])

    def test_a_lost_creation_process_becomes_unknown_without_releasing_funds(self):
        self.enable()
        from app.services.tinyfish import admit, ResearchInput
        body = ResearchInput.model_validate({**self.body, 'category': 'stays', 'mode': 'live', 'source': 'booking'})
        with self.sessions() as db:
            from jose import jwt
            owner = int(jwt.get_unverified_claims(self.headers['Authorization'].split()[1])['sub'])
            job, _ = admit(db, body, owner, 'fixture')
            job.created_at -= 120
            db.commit()
            job_id = job.id
        result = self.client.get('/api/v1/research/' + job_id, headers=self.headers)
        self.assertEqual(result.json()['status'], 'UNKNOWN')
        self.assertEqual(self.ledger()[:2], (0, 2400))


def httpx_timeout():
    import httpx
    return httpx.ReadTimeout('Fixture timeout without credentials')
