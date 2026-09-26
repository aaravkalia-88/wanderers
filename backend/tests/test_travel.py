"""Run with: venv/bin/python -m unittest discover -s tests -v"""
import os
import tempfile
import unittest
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

_test_db = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
_test_db.close()
os.environ['DATABASE_URL'] = 'sqlite:///' + _test_db.name
os.environ['SECRET_KEY'] = 'isolated-test-key-not-for-deployment'
from fastapi.testclient import TestClient
from fastapi import HTTPException
from app.main import app
from app.services.travel import progression, BY_ID

class TravelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Never use a developer's Redis cache with the isolated test database.
        cls.cache_init = patch('app.main.init_cache', return_value=False)
        cls.cache_mode = patch('app.core.cache._using_redis', False)
        cls.cache_init.start()
        cls.cache_mode.start()
        cls.context = TestClient(app)
        cls.client = cls.context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.context.__exit__(None, None, None)
        cls.cache_init.stop()
        cls.cache_mode.stop()
        os.unlink(_test_db.name)

    def setUp(self):
        limiter = patch('app.api.v1.auth.rate_limit_check', return_value=True)
        limiter.start()
        self.addCleanup(limiter.stop)
        token = self.client.post('/api/v1/auth/guest').json()['access_token']
        self.headers = {'Authorization': 'Bearer ' + token}

    def put(self, place, **data):
        return self.client.put(f'/api/v1/passport/places/{place}', headers=self.headers, json=data)

    def test_save_visit_edit_and_reverse(self):
        self.assertEqual(self.put(1, status='Saved').json()['xp'], 0)
        result = self.put(1, status='Visited', visit_date=str(date.today()), notes='A beautiful day', rating=4).json()
        self.assertEqual(result['xp'], 400)
        stamp = result['entries'][0]['stamp_id']
        repeated = self.put(1, status='Visited', visit_date=str(date.today()), notes='Edited memory', rating=5).json()
        self.assertEqual(repeated['xp'], 400)
        self.assertEqual(repeated['entries'][0]['stamp_id'], stamp)
        loaded = self.client.get('/api/v1/passport', headers=self.headers).json()
        self.assertEqual(loaded['entries'][0]['notes'], 'Edited memory')
        reverted = self.put(1, status='Not Visited').json()
        self.assertEqual(reverted['xp'], 0)
        self.assertIsNone(reverted['entries'][0]['stamp_id'])

    def test_user_isolation(self):
        self.put(2, status='Saved')
        other = self.client.post('/api/v1/auth/guest').json()['access_token']
        self.assertEqual(self.client.get('/api/v1/passport', headers={'Authorization': 'Bearer '+other}).json()['entries'], [])
        self.assertEqual(self.client.get('/api/v1/passport').status_code, 401)
        self.assertEqual(self.client.get('/api/v1/passport', headers={'Authorization':'Bearer invalid'}).status_code, 401)

    def test_validation(self):
        self.assertEqual(self.put(1, status='Visited').status_code, 422)
        self.assertEqual(self.put(1, status='Visited', visit_date=str(date.today()+timedelta(days=1))).status_code, 422)
        self.assertEqual(self.put(1, status='Visited', visit_date=str(date.today()), rating=6).status_code, 422)
        self.assertEqual(self.put(999, status='Saved').status_code, 404)
        self.assertEqual(self.put(1, status='Made up').status_code, 422)

    def test_register_and_login_preserves_guest_journal(self):
        self.put(2, status='Saved')
        register = self.client.post('/api/v1/auth/register', headers=self.headers, json={'username':'Test Explorer','email':'test@example.test','password':'test-password-123'})
        self.assertEqual(register.status_code, 200, register.text)
        login = self.client.post('/api/v1/auth/login/access-token', data={'username':'test@example.test','password':'test-password-123'})
        self.assertEqual(login.status_code, 200)
        passport = self.client.get('/api/v1/passport', headers={'Authorization':'Bearer '+login.json()['access_token']}).json()
        self.assertEqual(passport['entries'][0]['place_id'], 2)
        self.assertEqual(self.client.post('/api/v1/auth/login/access-token', data={'username':'test@example.test','password':'wrong'}).status_code, 401)

    def test_legacy_bcrypt_account_can_sign_in_without_passlib(self):
        import bcrypt
        from jose import jwt
        from app.core.security import verify_password
        from app.db.session import SessionLocal
        from app.models.user import User
        self.put(2, status='Saved')
        user_id = int(jwt.get_unverified_claims(self.headers['Authorization'].split()[1])['sub'])
        password = 'legacy-password'
        with SessionLocal() as db:
            user = db.get(User, user_id)
            user.email = 'legacy@example.test'
            user.password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=4)).decode()
            db.commit()
        login = self.client.post('/api/v1/auth/login/access-token', data={'username': 'legacy@example.test', 'password': password})
        self.assertEqual(login.status_code, 200, login.text)
        passport = self.client.get('/api/v1/passport', headers={'Authorization': 'Bearer ' + login.json()['access_token']}).json()
        self.assertEqual(passport['entries'][0]['place_id'], 2)
        self.assertEqual(self.client.post('/api/v1/auth/login/access-token', data={'username': 'legacy@example.test', 'password': 'wrong'}).status_code, 401)
        long_password = 'é' * 40  # Older bcrypt accounts truncated by bytes, not characters.
        hashed = bcrypt.hashpw(long_password.encode()[:72], bcrypt.gensalt(rounds=4)).decode()
        self.assertTrue(verify_password(long_password, hashed))
        for malformed in ['!', 'scrypt$bad', '$2b$broken', 'unknown']:
            self.assertFalse(verify_password(password, malformed))

    def test_trip_persistence_and_validation(self):
        trip = {'place_id':2,'origin':'Delhi','start':str(date.today()),'days':3,'travelers':2,'budget':10000,'mode':'driving','style':'Slow travel'}
        self.assertEqual(self.client.post('/api/v1/trips', headers=self.headers, json=trip).status_code, 200)
        loaded = self.client.get('/api/v1/trips', headers=self.headers).json()
        self.assertEqual(loaded[0]['origin'], 'Delhi')
        self.assertEqual(self.client.post('/api/v1/trips', headers=self.headers, json={**trip,'days':0}).status_code, 422)

    def test_progression_milestones(self):
        entries = [SimpleNamespace(status='Visited',place_id=i) for i in list(BY_ID)[:5]]
        result = progression(entries)
        states = len({BY_ID[e.place_id]['state'] for e in entries})
        self.assertEqual(result['xp'], 5*150 + states*250 + 200)
        self.assertEqual(result['tier'], 'Tier II Wanderer')
        self.assertTrue(result['achievements'][0]['unlocked'])

    def test_trip_route_survives_reload_and_is_private(self):
        trip = {'place_id': 2, 'origin': 'New Delhi', 'start': str(date.today()), 'days': 3,
                'travelers': 2, 'budget': 10000, 'mode': 'driving', 'style': 'Slow travel',
                'stop_ids': [4, 3], 'origin_point': {'name': 'New Delhi', 'latitude': 28.6139, 'longitude': 77.209}}
        response = self.client.post('/api/v1/trips', headers=self.headers, json=trip)
        self.assertEqual(response.status_code, 200, response.text)
        loaded = self.client.get('/api/v1/trips', headers=self.headers).json()[0]
        self.assertEqual(loaded['stop_ids'], [4, 3])
        self.assertEqual(loaded['origin_point'], trip['origin_point'])
        other = self.client.post('/api/v1/auth/guest').json()['access_token']
        self.assertEqual(self.client.get('/api/v1/trips', headers={'Authorization': 'Bearer ' + other}).json(), [])
        for stops, expected in [([999], 404), ([3, 3], 422), ([2], 422), ([3, 4, 5, 6], 422)]:
            with self.subTest(stops=stops):
                result = self.client.post('/api/v1/trips', headers=self.headers, json={**trip, 'stop_ids': stops})
                self.assertEqual(result.status_code, expected)
        result = self.client.post('/api/v1/trips', headers=self.headers, json={**trip, 'origin_point': {**trip['origin_point'], 'latitude': 100}})
        self.assertEqual(result.status_code, 422)

    def test_catalog_coordinates_and_weather_missing_destination(self):
        places = self.client.get('/api/v1/destinations/').json()
        self.assertEqual(len(places), 30)
        self.assertTrue(all(-90 <= p['latitude'] <= 90 and -180 <= p['longitude'] <= 180 for p in places))
        self.assertEqual(self.client.get('/api/v1/destinations/999/weather').status_code, 404)

    def test_registration_validation_and_account_guard(self):
        data = {'username': 'Wanderer-Security', 'email': 'security@example.test', 'password': 'test-password-123'}
        for change in [{'username': '  '}, {'email': 'test@GUEST.LOCAL'}]:
            self.assertEqual(self.client.post('/api/v1/auth/register', headers=self.headers, json={**data, **change}).status_code, 422)
        self.assertTrue(self.client.get('/api/v1/passport', headers=self.headers).json()['is_guest'])
        self.assertEqual(self.client.post('/api/v1/auth/register', headers=self.headers, json=data).status_code, 200)
        passport = self.client.get('/api/v1/passport', headers=self.headers).json()
        self.assertEqual(passport['username'], data['username'])
        self.assertFalse(passport['is_guest'])
        self.assertEqual(self.client.post('/api/v1/auth/login/access-token', data={'username': ' SECURITY@EXAMPLE.TEST ', 'password': data['password']}).status_code, 200)
        self.assertEqual(self.client.post('/api/v1/auth/login/access-token', data={'username': data['email'], 'password': 'x' * 1025}).status_code, 401)
        # Legacy registered addresses in the reserved domain are still accounts.
        from app.api.v1.auth import register, Registration
        with self.assertRaises(HTTPException) as caught:
            register(SimpleNamespace(client=None), Registration(**data), SimpleNamespace(email='legacy@guest.local', password_hash='scrypt$existing'), Mock())
        self.assertEqual(caught.exception.status_code, 400)

    def test_tokens_require_expiry_and_private_responses_are_not_cached(self):
        from jose import jwt
        from app.core.config import settings
        payload = jwt.get_unverified_claims(self.headers['Authorization'].split()[1])
        del payload['exp']
        forged = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        response = self.client.get('/api/v1/passport', headers={'Authorization': 'Bearer ' + forged})
        self.assertEqual(response.status_code, 401)
        for response in [response, self.client.get('/api/v1/passport', headers=self.headers), self.client.post('/api/v1/auth/guest')]:
            self.assertEqual(response.headers['cache-control'], 'no-store')
            self.assertEqual(response.headers['x-content-type-options'], 'nosniff')

    def test_export_escapes_text_and_blocks_resource_loading(self):
        from html import escape
        from app.api.v1.export import _passport_html, _deny_resource
        attack = '<img src="http://127.0.0.1/private"><link rel="attachment" href="file:///private/secret">&'
        entry = {'place_id': 2, 'status': 'Visited', 'notes': attack, 'rating': 5}
        html = _passport_html(SimpleNamespace(username=attack, password_hash='scrypt$existing'), [entry], [{'place_id': 2, 'origin': attack}], {})
        self.assertNotIn(attack, html)
        self.assertEqual(html.count(escape(attack)), 4)  # Title, holder, memory, origin.
        for url in ['file:///private/secret', 'http://127.0.0.1/private', 'https://example.test/image', 'data:text/html,hello']:
            with self.assertRaises(ValueError):
                _deny_resource(url)
        # Verify the endpoint wires the policy to the renderer without loading native PDF libraries.
        renderer = Mock()
        renderer.HTML.return_value.write_pdf.return_value = b'%PDF-test'
        with patch.dict('sys.modules', {'weasyprint': renderer}):
            self.assertEqual(self.client.get('/api/v1/passport/export/pdf', headers=self.headers).status_code, 200)
        self.assertIs(renderer.HTML.call_args.kwargs['url_fetcher'], _deny_resource)

    def test_redis_failure_does_not_disable_auth_limits(self):
        from app.core.cache import rate_limit_check
        redis = Mock()
        redis.eval.side_effect = ConnectionError('offline')
        with patch('app.core.cache._using_redis', True), patch('app.core.cache._redis_client', redis):
            self.assertFalse(rate_limit_check('login:test', 5, 60))

    def test_multiple_logins_keep_independent_tokens_and_preserve_journal(self):
        from app.core.cache import rate_limit_check, _memory_cache
        self.put(2, status='Saved')
        email = 'multiple-logins@example.test'
        response = self.client.post('/api/v1/auth/register', headers=self.headers, json={
            'username': 'Multiple Sessions', 'email': email, 'password': 'test-password-123'})
        self.assertEqual(response.status_code, 200)
        _memory_cache.delete_pattern('rate:login')
        tokens = []
        with patch('app.api.v1.auth.rate_limit_check', side_effect=rate_limit_check):
            for _ in range(7):
                response = self.client.post('/api/v1/auth/login/access-token', data={'username': email, 'password': 'test-password-123'})
                self.assertEqual(response.status_code, 200, response.text)
                tokens.append(response.json()['access_token'])
            for _ in range(5):
                response = self.client.post('/api/v1/auth/login/access-token', data={'username': email, 'password': 'wrong'})
                self.assertEqual(response.status_code, 401)
            self.assertEqual(self.client.post('/api/v1/auth/login/access-token', data={'username': email, 'password': 'wrong'}).status_code, 429)
            self.assertEqual(self.client.post('/api/v1/auth/login/access-token', data={'username': 'another@example.test', 'password': 'wrong'}).status_code, 401)
        self.assertEqual(len(set(tokens)), len(tokens))
        for token in tokens:
            response = self.client.get('/api/v1/passport', headers={'Authorization': 'Bearer ' + token})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['entries'][0]['place_id'], 2)

    def test_rate_limit_counts_concurrent_attempts_and_expires(self):
        from concurrent.futures import ThreadPoolExecutor
        from app.core.cache import rate_limit_check, _memory_cache
        _memory_cache.delete_pattern('rate:concurrent-check')
        with patch('app.core.cache.time.time', return_value=1000):
            with ThreadPoolExecutor(max_workers=10) as workers:
                allowed = list(workers.map(lambda _: rate_limit_check('concurrent-check', 5, 60), range(30)))
            self.assertEqual(sum(allowed), 5)
        with patch('app.core.cache.time.time', return_value=1061):
            self.assertTrue(rate_limit_check('concurrent-check', 5, 60))

    def test_public_community_privacy_drafts_and_moderation(self):
        from app.db.session import SessionLocal
        from app.models.user import User
        from jose import jwt
        prefix = '/api/v1'
        # Guests can read; only registered accounts can contribute.
        self.assertEqual(self.client.get(prefix + '/blogs').json(), {'items': [], 'next': None})
        self.assertEqual(self.client.post(prefix + '/blogs', headers=self.headers).status_code, 403)
        self.put(2, status='Visited', visit_date=str(date.today()), notes='PRIVATE JOURNAL', rating=3)
        self.assertEqual(self.client.post(prefix + '/auth/register', headers=self.headers, json={
            'username': 'Community Writer', 'email': 'community@example.test', 'password': 'test-password-123'}).status_code, 200)
        profile = self.client.get(prefix + '/profiles/me', headers=self.headers).json()
        self.assertFalse(profile['is_public'])
        self.assertEqual(self.client.get(prefix + '/profiles/u/Community%20Writer').status_code, 404)
        draft = self.client.post(prefix + '/blogs', headers=self.headers).json()
        story_url = prefix + '/blogs/' + str(draft['id'])
        body = {'title': 'A morning in the hills', 'subtitle': 'The longer way home', 'body': '# A real journey\n\nChai by the trail.', 'place_id': 2, 'status': 'draft', 'version': draft['version']}
        saved = self.client.patch(story_url, headers=self.headers, json=body)
        self.assertEqual(saved.status_code, 200, saved.text)
        body['version'] = saved.json()['version']
        self.assertEqual(self.client.get(story_url).status_code, 404)
        self.assertEqual(self.client.get(story_url + '/edit', headers=self.headers).json()['body'], body['body'])
        self.assertEqual(self.client.patch(story_url, headers=self.headers, json={**body, 'status': 'published'}).status_code, 422)
        public = {'display_name': 'A mountain wanderer', 'bio': 'Walk slowly.', 'home_region': '', 'interests': 'Mountains', 'is_public': True}
        self.assertEqual(self.client.patch(prefix + '/profiles/me', headers=self.headers, json=public).status_code, 200)
        self.assertEqual(self.client.patch(prefix + '/profiles/me', headers=self.headers, json={**public, 'role': 'ADMIN'}).status_code, 422)
        published = self.client.patch(story_url, headers=self.headers, json={**body, 'status': 'published'})
        self.assertEqual(published.status_code, 200, published.text)
        self.assertEqual(self.client.patch(story_url, headers=self.headers, json=body).status_code, 409)
        body['version'] = published.json()['version']
        feed = self.client.get(prefix + '/blogs').json()
        self.assertEqual([s['id'] for s in feed['items']], [draft['id']])
        self.assertNotIn('body', feed['items'][0])
        self.assertEqual(self.client.get(prefix + '/blogs?q=morning').json()['items'][0]['id'], draft['id'])
        self.assertEqual(self.client.get(prefix + '/blogs?q=%25').json()['items'], [])
        self.assertEqual(self.client.get(prefix + '/blogs?state=Unknown').json()['items'], [])
        for response in [self.client.get(story_url), self.client.get(prefix + '/profiles/u/Community%20Writer'), self.client.get(prefix + '/blogs')]:
            for private in ['community@example.test', 'password_hash', 'PRIVATE JOURNAL', 'visit_date', 'travel_entries']:
                self.assertNotIn(private, response.text)
        other = self.client.post(prefix + '/auth/guest').json()['access_token']
        other_headers = {'Authorization': 'Bearer ' + other}
        self.client.post(prefix + '/auth/register', headers=other_headers, json={'username': 'Community Reader', 'email': 'reader@example.test', 'password': 'test-password-123'})
        self.assertEqual(self.client.get(story_url + '/edit', headers=other_headers).status_code, 404)
        self.assertEqual(self.client.patch(story_url, headers=other_headers, json=body).status_code, 404)
        self.assertEqual(self.client.delete(story_url, headers=other_headers).status_code, 404)
        report = self.client.post(story_url + '/report', headers=other_headers, json={'reason': 'Unsafe advice'})
        self.assertEqual(report.status_code, 200, report.text)
        self.assertEqual(self.client.get(story_url).status_code, 200)  # Reporting alone never hides content.
        self.assertEqual(self.client.post(story_url + '/report', headers=other_headers, json={'reason': 'Spam'}).status_code, 409)
        self.assertEqual(self.client.get(prefix + '/community/reports', headers=other_headers).status_code, 403)
        self.assertEqual(self.client.patch(prefix + '/community/blogs/' + str(draft['id']), headers=other_headers, json={'hidden': True}).status_code, 403)
        with SessionLocal() as db:
            moderator = db.get(User, int(jwt.get_unverified_claims(other)['sub']))
            moderator.role = 'MODERATOR'
            db.commit()
        self.assertTrue(self.client.get(prefix + '/community/reports', headers=other_headers).json())
        self.client.patch(prefix + '/community/blogs/' + str(draft['id']), headers=other_headers, json={'hidden': True})
        self.assertEqual(self.client.get(story_url).status_code, 404)
        edited = self.client.patch(story_url, headers=self.headers, json={**body, 'status': 'published'})
        self.assertEqual(edited.status_code, 200)
        self.assertTrue(edited.json()['hidden'])
        body['version'] = edited.json()['version']
        self.client.patch(prefix + '/community/blogs/' + str(draft['id']), headers=other_headers, json={'hidden': False})
        unlisted = self.client.patch(story_url, headers=self.headers, json={**body, 'status': 'unlisted'})
        self.assertEqual(unlisted.status_code, 200)
        self.assertEqual(self.client.get(story_url).status_code, 200)
        self.assertEqual(self.client.get(prefix + '/blogs').json()['items'], [])
        self.client.patch(prefix + '/profiles/me', headers=self.headers, json={**public, 'is_public': False})
        self.assertEqual(self.client.get(story_url).status_code, 404)
        self.assertEqual(self.client.delete(story_url, headers=self.headers).status_code, 200)
        self.assertEqual(self.client.get(story_url + '/edit', headers=self.headers).status_code, 404)
        self.assertEqual(self.client.get(prefix + '/passport', headers=self.headers).json()['entries'][0]['notes'], 'PRIVATE JOURNAL')

    def test_community_pagination_and_validation(self):
        self.client.post('/api/v1/auth/register', headers=self.headers, json={'username': 'Page Writer', 'email': 'pages@example.test', 'password': 'test-password-123'})
        self.client.patch('/api/v1/profiles/me', headers=self.headers, json={'display_name': '', 'bio': '', 'home_region': '', 'interests': '', 'is_public': True})
        with patch('app.api.v1.community.rate_limit_check', return_value=True):
            ids = []
            for index in range(14):
                draft = self.client.post('/api/v1/blogs', headers=self.headers).json()
                ids.append(draft['id'])
                response = self.client.patch('/api/v1/blogs/' + str(draft['id']), headers=self.headers, json={'title': f'Story {index}', 'subtitle': '', 'body': 'A real experience.', 'place_id': 2, 'status': 'published', 'version': 1})
                self.assertEqual(response.status_code, 200, response.text)
            first = self.client.get('/api/v1/blogs?username=Page%20Writer').json()
            self.assertEqual(len(first['items']), 12)
            second = self.client.get('/api/v1/blogs?username=Page%20Writer&before=' + str(first['next'])).json()
            self.assertEqual(len(second['items']), 2)
            self.assertIsNone(second['next'])
            self.assertEqual([row['id'] for row in first['items'] + second['items']], list(reversed(ids)))
            mine = self.client.get('/api/v1/blogs/mine', headers=self.headers).json()
            self.assertEqual(len(mine['items']), 12)
            draft = self.client.get('/api/v1/blogs/' + str(ids[0]) + '/edit', headers=self.headers).json()
            data = {key: draft[key] for key in ['title', 'subtitle', 'body', 'place_id', 'status', 'version']}
            for changes in [{'place_id': 999}, {'title': ' '}, {'body': 'x' * 50001}, {'status': 'made-up'}, {'author_id': 1}]:
                self.assertEqual(self.client.patch('/api/v1/blogs/' + str(ids[0]), headers=self.headers, json={**data, **changes}).status_code, 422)
            for story_id in ids:
                self.client.delete('/api/v1/blogs/' + str(story_id), headers=self.headers)
        with patch('app.api.v1.community.rate_limit_check', return_value=False):
            self.assertEqual(self.client.post('/api/v1/blogs', headers=self.headers).status_code, 429)

if __name__ == '__main__':
    unittest.main()
