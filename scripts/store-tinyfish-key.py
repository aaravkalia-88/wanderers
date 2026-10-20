"""Run with backend/venv/bin/python scripts/store-tinyfish-key.py; never pass keys as arguments."""
import base64
import getpass
import os
import re
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def main():
    root = Path(__file__).resolve().parents[1]
    secret = getpass.getpass('TinyFish API key (hidden): ').strip()
    if not secret or len(secret) > 4096 or any(char.isspace() for char in secret):
        raise SystemExit('Enter a non-empty API key without whitespace.')
    runtime = root / '.runtime'
    runtime.mkdir(mode=0o700, exist_ok=True)
    key_path = runtime / 'tinyfish-env.key'
    if key_path.exists():
        key = key_path.read_bytes()
    else:
        key = AESGCM.generate_key(bit_length=256)
        with os.fdopen(os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as handle:
            handle.write(key)
    os.chmod(key_path, 0o600)
    nonce = os.urandom(12)
    envelope = base64.b64encode(nonce + AESGCM(key).encrypt(nonce, secret.encode(), b'wanderers-tinyfish-v1')).decode()
    target = root / 'backend/.env.local'
    previous = target.read_text() if target.exists() else ''
    previous = re.sub(r'^\s*(?:export\s+)?TINYFISH_(?:API_KEY(?:_ENCRYPTED)?|DISCOVERY_VERIFIED|BILLING_VERIFIED|LIVE_SOURCES|CUSTOM_STEP_LIMIT)\s*=.*(?:\n|$)', '', previous, flags=re.MULTILINE)
    temporary = target.with_suffix('.local.tmp')
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, 'w') as handle:
            handle.write(previous.rstrip() + '\nTINYFISH_API_KEY_ENCRYPTED=' + envelope + '\n'
                'TINYFISH_DISCOVERY_VERIFIED=false\nTINYFISH_BILLING_VERIFIED=false\n'
                'TINYFISH_LIVE_SOURCES=[]\nTINYFISH_CUSTOM_STEP_LIMIT=false\n')
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    print('Encrypted key saved. Account/source verification remains required before live calls.')


if __name__ == '__main__':
    main()
