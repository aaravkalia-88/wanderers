"""Local encrypted credentials; production may supply the secret directly."""
import base64
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def decrypt_tinyfish(value: str) -> str:
    try:
        envelope = base64.b64decode(value, validate=True)
        key = (Path(__file__).resolve().parents[3] / '.runtime/tinyfish-env.key').read_bytes()
        return AESGCM(key).decrypt(envelope[:12], envelope[12:], b'wanderers-tinyfish-v1').decode()
    except Exception:
        raise ValueError('Cannot decrypt TinyFish configuration. Restore the local encryption key.') from None
