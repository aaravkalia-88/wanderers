"""Cross-platform, project-owned development process supervisor."""
from __future__ import annotations
import argparse
import ctypes
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.runtime'
STATE = RUNTIME / 'services.json'
WINDOWS = os.name == 'nt'


def alive(pid):
    if WINDOWS:
        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        code = ctypes.c_ulong()
        ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(code))
        ctypes.windll.kernel32.CloseHandle(handle)
        return code.value == 259
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def start_identity(pid):
    """A process birth marker guards against PID reuse."""
    if WINDOWS:
        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return None
        values = [ctypes.c_ulonglong() for _ in range(4)]
        ok = ctypes.windll.kernel32.GetProcessTimes(handle, *(ctypes.byref(v) for v in values))
        ctypes.windll.kernel32.CloseHandle(handle)
        return str(values[0].value) if ok else None
    result = subprocess.run(['ps', '-p', str(pid), '-o', 'lstart='], capture_output=True, text=True)
    return result.stdout.strip() or None


def owns(record):
    if record.get('root') != str(ROOT) or not alive(record['pid']) or start_identity(record['pid']) != record['born']:
        return False
    if WINDOWS:
        command = subprocess.run(['powershell', '-NoProfile', '-Command', f'(Get-CimInstance Win32_Process -Filter "ProcessId = {int(record["pid"])}").CommandLine'], capture_output=True, text=True).stdout
    else:
        command = subprocess.run(['ps', '-p', str(record['pid']), '-o', 'command='], capture_output=True, text=True).stdout
    return str(Path(__file__).resolve()) in command and record['marker'] in command


def read_state():
    try:
        value = json.loads(STATE.read_text())
        return value if value.get('root') == str(ROOT) else None
    except (OSError, ValueError):
        return None


def port_free(port):
    with socket.socket() as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(('127.0.0.1', port))
            return True
        except OSError:
            return False


def ready(url, expected=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'Accept': 'text/html,application/json'}), timeout=1) as response:
            content = response.read(200000).decode()
            return response.status == 200 and (expected is None or expected in content)
    except Exception:
        return False


def stop_record(record):
    if not owns(record):
        return
    if WINDOWS:
        # /T is restricted to this verified, project-owned process tree.
        subprocess.run(['taskkill', '/PID', str(record['pid']), '/T', '/F'], capture_output=True)
    else:
        try:
            os.killpg(record['pid'], signal.SIGTERM)
        except ProcessLookupError:
            return
        for _ in range(50):
            if not alive(record['pid']):
                return
            time.sleep(.1)
        if owns(record):
            os.killpg(record['pid'], signal.SIGKILL)


def serve(name, marker):
    """Stable wrapper PID owns one service and its child processes."""
    if sys.platform == 'darwin':
        os.environ.setdefault('DYLD_FALLBACK_LIBRARY_PATH', '/opt/homebrew/lib:/usr/local/lib:/usr/lib')
    python = ROOT / 'backend' / 'venv' / ('Scripts/python.exe' if WINDOWS else 'bin/python')
    commands = {
        'backend': ([str(python), '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], ROOT / 'backend'),
        'frontend': ([shutil.which('node'), str(ROOT / 'frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort'], ROOT / 'frontend'),
    }
    cmd, cwd = commands[name]
    process = subprocess.Popen(cmd, cwd=cwd)
    def terminate(_signum, _frame):
        if process.poll() is None:
            process.terminate()
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            process.kill()
        raise SystemExit(0)
    signal.signal(signal.SIGTERM, terminate)
    if not WINDOWS:
        signal.signal(signal.SIGINT, terminate)
    return process.wait()


def start():
    state = read_state()
    if state and any(owns(r) for r in state['services']):
        if all(owns(r) for r in state['services']) and ready('http://127.0.0.1:8000/health', '"ok"') and ready('http://127.0.0.1:5173', 'Wanderer'):
            print('Wanderer is already running. http://127.0.0.1:5173')
            return 0
        raise RuntimeError('Some recorded services are still running. Run stop first, then start again.')
    python = ROOT / 'backend' / 'venv' / ('Scripts/python.exe' if WINDOWS else 'bin/python')
    if not python.is_file():
        raise RuntimeError('Backend virtual environment is missing. Follow README.md setup.')
    if not shutil.which('node') or not (ROOT / 'frontend/node_modules/vite/bin/vite.js').is_file():
        raise RuntimeError('Node.js or frontend dependencies are missing. Run npm install in frontend/.')
    if not (ROOT / 'backend/.env').is_file():
        raise RuntimeError('backend/.env is missing. Use backend/.env.example and supply your settings.')
    check = subprocess.run([str(python), '-c', 'from app.main import app'], cwd=ROOT / 'backend', capture_output=True)
    if check.returncode:
        raise RuntimeError('Backend configuration/dependencies are invalid. Check .env and the installation instructions.')
    for port in (8000, 5173):
        if not port_free(port):
            raise RuntimeError(f'Port {port} is already in use. No existing process was stopped or adopted.')
    (RUNTIME / 'logs').mkdir(parents=True, exist_ok=True)
    records = []
    print('WANDERER DEVELOPMENT\n[OK] Environment checked', flush=True)
    try:
        for name, url, expected in [('backend', 'http://127.0.0.1:8000/health', '"ok"'), ('frontend', 'http://127.0.0.1:5173', 'Wanderer')]:
            marker = uuid.uuid4().hex
            with (RUNTIME / 'logs' / f'{name}.log').open('ab') as log:
                kwargs = {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS} if WINDOWS else {'start_new_session': True}
                process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), 'serve', name, marker], cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=log, **kwargs)
            born = start_identity(process.pid)
            if not born:
                raise RuntimeError(f'{name} exited before startup. See .runtime/logs/{name}.log.')
            record = {'name': name, 'pid': process.pid, 'born': born, 'root': str(ROOT), 'marker': marker}
            records.append(record)
            (RUNTIME / f'{name}.pid').write_text(str(process.pid))
            STATE.write_text(json.dumps({'root': str(ROOT), 'services': records}, indent=2))
            deadline = time.monotonic() + 25
            while time.monotonic() < deadline and process.poll() is None:
                if ready(url, expected):
                    print(f'[OK] {name.title()} ready — {url}', flush=True)
                    break
                time.sleep(.25)
            else:
                raise RuntimeError(f'{name.title()} failed readiness. See .runtime/logs/{name}.log.')
        print('[OK] No additional local services are required by the active app.\nWanderer is running. Use stop.sh / stop.bat to stop it.')
        return 0
    except BaseException:
        for record in reversed(records):
            stop_record(record)
        STATE.unlink(missing_ok=True)
        for name in ('backend', 'frontend'):
            (RUNTIME / f'{name}.pid').unlink(missing_ok=True)
        raise


def stop():
    state = read_state()
    if not state:
        print('No recorded Wanderer services to stop.')
        return 0
    for record in reversed(state['services']):
        if owns(record):
            stop_record(record)
            print(f'[OK] {record["name"].title()} stopped')
        else:
            print(f'[OK] {record["name"].title()} is not running as a Wanderer-owned process; skipped')
        (RUNTIME / f'{record["name"]}.pid').unlink(missing_ok=True)
    STATE.unlink(missing_ok=True)
    print('Wanderer stopped safely. Logs retained in .runtime/logs/.')
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['start', 'stop', 'serve'])
    parser.add_argument('service', nargs='?')
    parser.add_argument('marker', nargs='?')
    args = parser.parse_args()
    try:
        if args.action == 'serve':
            raise SystemExit(serve(args.service, args.marker))
        # Atomic directory lock serializes start/stop so concurrent starts cannot duplicate services.
        RUNTIME.mkdir(exist_ok=True)
        lock = RUNTIME / 'control.lock'
        try:
            lock.mkdir()
        except FileExistsError:
            raise RuntimeError('Another start/stop operation holds .runtime/control.lock. Wait for it to finish.')
        try:
            raise SystemExit(start() if args.action == 'start' else stop())
        finally:
            lock.rmdir()
    except (RuntimeError, KeyboardInterrupt) as exc:
        print(f'Wanderer: {exc}', file=sys.stderr)
        raise SystemExit(1)
