"""Integration check: requires free ports 8000/5173; leaves Wanderer running."""
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
control = [sys.executable, str(ROOT / 'scripts/dev.py')]
sentinel = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(90)'])
try:
    subprocess.run(control + ['start'], check=True)
    first = json.loads((ROOT / '.runtime/services.json').read_text())
    subprocess.run(control + ['start'], check=True)
    second = json.loads((ROOT / '.runtime/services.json').read_text())
    assert first == second, 'Duplicate start created new processes'
    subprocess.run(control + ['stop'], check=True)
    assert sentinel.poll() is None, 'An unrelated process was stopped'
    assert not (ROOT / '.runtime/services.json').exists()
    subprocess.run(control + ['stop'], check=True)
    subprocess.run(control + ['start'], check=True)
    print('PASS: readiness, duplicate start, safe stop, repeated stop, restart; unrelated process preserved.')
finally:
    sentinel.terminate()
    sentinel.wait()
