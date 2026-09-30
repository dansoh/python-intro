"""Live golf tournament leaderboard server.

Zero dependencies: only the Python standard library. Serves the web app from
./static, stores tournament data in ./data/tournament.json, and pushes every
change to connected browsers with Server-Sent Events so the leaderboard
updates live on everyone's phone.

    python3 server.py              # http://0.0.0.0:8000
    PORT=9000 python3 server.py
    GOLF_ADMIN_PIN=4321 python3 server.py
"""

import json
import os
import queue
import secrets
import threading
import traceback
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = Path(os.environ.get("GOLF_DATA_DIR", BASE_DIR / "data"))
DATA_FILE = DATA_DIR / "tournament.json"

HOLE_COUNTS = (9, 18, 27, 36)  # the course length is set by how many pars the host enters
DEFAULT_PARS = [4, 4, 4, 3, 5, 4, 3, 4, 5, 4, 3, 5, 4, 4, 5, 4, 3, 4]
DEFAULT_STROKE_INDEX = [7, 3, 11, 15, 1, 9, 17, 5, 13, 8, 16, 2, 10, 4, 14, 6, 18, 12]
MAX_EVENTS = 40
MAX_BODY = 64 * 1024
HEARTBEAT_SECONDS = 15


def now_ms():
    return int(time.time() * 1000)


def new_state():
    return {
        "version": 1,
        "tournament": {
            "name": "The Invitational",
            "subtitle": "Live Tournament Scoring",
            "pars": list(DEFAULT_PARS),
            "strokeIndex": list(DEFAULT_STROKE_INDEX),
            "locked": False,
            "handicaps": False,
            "putts": False,
        },
        "players": [],
        "events": [],
        "updatedAt": now_ms(),
    }


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


class Store:
    """Thread-safe tournament state with JSON persistence and change fan-out."""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self.subscribers = set()
        self.state, self.secrets = self._load()

    def _load(self):
        if self.path.exists():
            raw = json.loads(self.path.read_text())
            return raw["state"], raw["secrets"]
        return new_state(), {"adminPin": None, "playerTokens": {}}

    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"state": self.state, "secrets": self.secrets}, indent=1))
        tmp.replace(self.path)

    def ensure_admin_pin(self):
        env_pin = os.environ.get("GOLF_ADMIN_PIN")
        with self.lock:
            if env_pin:
                self.secrets["adminPin"] = env_pin
            elif not self.secrets.get("adminPin"):
                self.secrets["adminPin"] = f"{secrets.randbelow(10000):04d}"
            self._save()
            return self.secrets["adminPin"]

    def public_json(self):
        with self.lock:
            return json.dumps(self.state)

    def mutate(self, fn):
        """Run fn(state, secrets) under the lock, bump the version, persist, broadcast."""
        with self.lock:
            result = fn(self.state, self.secrets)
            self.state["version"] += 1
            self.state["updatedAt"] = now_ms()
            self._save()
            payload = json.dumps(self.state)
            for q in list(self.subscribers):
                try:
                    q.put_nowait(payload)
                except queue.Full:
                    pass
        return result

    def subscribe(self):
        q = queue.Queue(maxsize=8)
        with self.lock:
            self.subscribers.add(q)
        return q

    def unsubscribe(self, q):
        with self.lock:
            self.subscribers.discard(q)


STORE = Store(DATA_FILE)


# ---------- validation helpers ----------

def clean_name(value):
    name = " ".join(str(value or "").split())[:32]
    if not name:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Player name is required.")
    return name


def clean_handicap(value):
    if value in (None, ""):
        return None
    try:
        hcp = round(float(value), 1)
    except (TypeError, ValueError):
        raise ApiError(HTTPStatus.BAD_REQUEST, "Handicap must be a number.")
    if not -10 <= hcp <= 54:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Handicap must be between -10 and 54.")
    return hcp


def hole_count(state):
    return len(state["tournament"]["pars"])


def clean_hole(value, holes):
    try:
        hole = int(value)
    except (TypeError, ValueError):
        raise ApiError(HTTPStatus.BAD_REQUEST, "Invalid hole.")
    if not 0 <= hole < holes:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Invalid hole.")
    return hole


def clean_score(value, low=1, high=20, label="Score"):
    if value in (None, ""):
        return None
    try:
        score = int(value)
    except (TypeError, ValueError):
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{label} must be a whole number.")
    if not low <= score <= high:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{label} must be between {low} and {high}.")
    return score


def find_player(state, player_id):
    for p in state["players"]:
        if p["id"] == player_id:
            return p
    raise ApiError(HTTPStatus.NOT_FOUND, "Player not found.")


def name_taken(state, name, except_id=None):
    return any(p["name"].lower() == name.lower() and p["id"] != except_id for p in state["players"])


def make_player(state, name, handicap):
    if name_taken(state, name):
        raise ApiError(HTTPStatus.CONFLICT, f"{name} is already on the leaderboard.")
    return {
        "id": secrets.token_hex(6),
        "name": name,
        "handicap": handicap,
        "scores": [None] * hole_count(state),
        "putts": [None] * hole_count(state),
        "joinedAt": now_ms(),
        "updatedAt": now_ms(),
    }


def record_event(state, player, hole, old, new):
    if new is None or new == old:
        return
    state["events"].insert(0, {
        "ts": now_ms(),
        "playerId": player["id"],
        "name": player["name"],
        "hole": hole,
        "score": new,
        "par": state["tournament"]["pars"][hole],
    })
    del state["events"][MAX_EVENTS:]


def set_hole(state, player, hole, score, putts):
    old = player["scores"][hole]
    player["scores"][hole] = score
    player["putts"][hole] = putts if score is not None else None
    player["updatedAt"] = now_ms()
    record_event(state, player, hole, old, score)


# ---------- API actions ----------

def api_join(body):
    name = clean_name(body.get("name"))
    handicap = clean_handicap(body.get("handicap"))

    def fn(state, sec):
        if state["tournament"]["locked"]:
            raise ApiError(HTTPStatus.FORBIDDEN, "Scoring is locked by the tournament host.")
        # Players can only set a handicap when the host has turned handicap scoring on.
        player = make_player(state, name, handicap if state["tournament"].get("handicaps") else None)
        state["players"].append(player)
        token = secrets.token_urlsafe(18)
        sec["playerTokens"][player["id"]] = token
        return {"player": player, "token": token}

    return STORE.mutate(fn)


def api_score(body):
    player_id = str(body.get("playerId", ""))
    token = str(body.get("token", ""))
    raw_hole = body.get("hole")
    score = clean_score(body.get("score"))
    putts = clean_score(body.get("putts"), low=0, high=10, label="Putts")

    def fn(state, sec):
        hole = clean_hole(raw_hole, hole_count(state))
        expected = sec["playerTokens"].get(player_id)
        if not expected or not secrets.compare_digest(expected, token):
            raise ApiError(HTTPStatus.FORBIDDEN, "This device can't post scores for that player.")
        if state["tournament"]["locked"]:
            raise ApiError(HTTPStatus.FORBIDDEN, "Scoring is locked by the tournament host.")
        player = find_player(state, player_id)
        # When putts aren't being tracked, leave whatever was stored.
        keep = putts if state["tournament"].get("putts") else player["putts"][hole]
        set_hole(state, player, hole, score, keep)
        return {"ok": True}

    return STORE.mutate(fn)


def check_pin(body):
    pin = str(body.get("pin", ""))
    expected = STORE.secrets.get("adminPin") or ""
    if not expected or not secrets.compare_digest(pin, expected):
        raise ApiError(HTTPStatus.UNAUTHORIZED, "Incorrect admin PIN.")


def api_admin(body):
    check_pin(body)
    action = body.get("action")

    if action == "login":
        return {"ok": True}

    if action == "addPlayer":
        name = clean_name(body.get("name"))
        handicap = clean_handicap(body.get("handicap"))

        def fn(state, sec):
            player = make_player(state, name, handicap)
            state["players"].append(player)
            sec["playerTokens"][player["id"]] = secrets.token_urlsafe(18)
            return {"player": player}

    elif action == "updatePlayer":
        player_id = str(body.get("playerId", ""))
        name = clean_name(body.get("name"))
        handicap = clean_handicap(body.get("handicap"))

        def fn(state, sec):
            player = find_player(state, player_id)
            if name_taken(state, name, except_id=player_id):
                raise ApiError(HTTPStatus.CONFLICT, f"{name} is already on the leaderboard.")
            player["name"] = name
            player["handicap"] = handicap
            player["updatedAt"] = now_ms()
            return {"ok": True}

    elif action == "removePlayer":
        player_id = str(body.get("playerId", ""))

        def fn(state, sec):
            player = find_player(state, player_id)
            state["players"].remove(player)
            state["events"] = [e for e in state["events"] if e["playerId"] != player_id]
            sec["playerTokens"].pop(player_id, None)
            return {"ok": True}

    elif action == "playerLink":
        # Lets the host hand a phone its scoring rights (e.g. re-pairing a lost device).
        player_id = str(body.get("playerId", ""))
        with STORE.lock:
            find_player(STORE.state, player_id)
            return {"token": STORE.secrets["playerTokens"].get(player_id)}

    elif action == "setScores":
        # changes: [{playerId, hole, score}] - bulk edit from the admin grid.
        changes = body.get("changes") or []
        if not isinstance(changes, list) or len(changes) > 36 * 200 or not all(isinstance(c, dict) for c in changes):
            raise ApiError(HTTPStatus.BAD_REQUEST, "Invalid changes.")
        parsed = [(str(c.get("playerId", "")), c.get("hole"), clean_score(c.get("score"))) for c in changes]

        def fn(state, sec):
            for player_id, raw_hole, score in parsed:
                hole = clean_hole(raw_hole, hole_count(state))
                player = find_player(state, player_id)
                putts = player["putts"][hole]
                set_hole(state, player, hole, score, putts)
            return {"ok": True, "count": len(parsed)}

    elif action == "setCourse":
        pars = body.get("pars")
        stroke_index = body.get("strokeIndex")
        if not isinstance(pars, list) or len(pars) not in HOLE_COUNTS:
            raise ApiError(HTTPStatus.BAD_REQUEST, "The course must be 9, 18, 27 or 36 holes.")
        holes = len(pars)
        pars = [clean_score(p, low=3, high=6, label="Par") for p in pars]
        if None in pars:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Every hole needs a par.")
        try:
            stroke_index = [int(x) for x in stroke_index]
        except (TypeError, ValueError):
            stroke_index = None
        if not stroke_index or sorted(stroke_index) != list(range(1, holes + 1)):
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Stroke index must use each number 1-{holes} exactly once.")

        def fn(state, sec):
            state["tournament"]["pars"] = pars
            state["tournament"]["strokeIndex"] = stroke_index
            # Changing the course length keeps scores on holes that still exist.
            for p in state["players"]:
                for key in ("scores", "putts"):
                    p[key] = (p[key] + [None] * holes)[:holes]
            state["events"] = [e for e in state["events"] if e["hole"] < holes]
            return {"ok": True}

    elif action == "setSettings":
        name = " ".join(str(body.get("name") or "").split())[:48] or "The Invitational"
        subtitle = " ".join(str(body.get("subtitle") or "").split())[:64]
        locked = bool(body.get("locked"))
        handicaps = bool(body.get("handicaps"))
        track_putts = bool(body.get("putts"))

        def fn(state, sec):
            state["tournament"].update(name=name, subtitle=subtitle, locked=locked, handicaps=handicaps, putts=track_putts)
            return {"ok": True}

    elif action == "resetScores":
        def fn(state, sec):
            for p in state["players"]:
                p["scores"] = [None] * hole_count(state)
                p["putts"] = [None] * hole_count(state)
            state["events"] = []
            return {"ok": True}

    elif action == "resetAll":
        def fn(state, sec):
            fresh = new_state()
            fresh["version"] = state["version"]
            state.clear()
            state.update(fresh)
            sec["playerTokens"] = {}
            return {"ok": True}

    else:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Unknown admin action.")

    return STORE.mutate(fn)


ROUTES = {
    "/api/join": api_join,
    "/api/score": api_score,
    "/api/admin": api_admin,
}


# ---------- HTTP handler ----------

class Handler(SimpleHTTPRequestHandler):
    server_version = "Leaderboard/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def log_message(self, fmt, *args):
        if os.environ.get("GOLF_QUIET"):
            return
        super().log_message(fmt, *args)

    def end_headers(self):
        if self.path.startswith("/api/") or self.path in ("/", "/index.html"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/state":
            data = STORE.public_json().encode()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif path == "/api/stream":
            self.stream()
        elif path.startswith("/api/"):
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
        else:
            if path not in ("/", "/index.html") and not (STATIC_DIR / path.lstrip("/")).is_file():
                self.path = "/"  # single-page app: unknown paths get the app shell
            super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        handler = ROUTES.get(path)
        if not handler:
            return self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Request too large.")
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
            except json.JSONDecodeError:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Invalid JSON.")
            if not isinstance(body, dict):
                raise ApiError(HTTPStatus.BAD_REQUEST, "Invalid JSON.")
            self.send_json(HTTPStatus.OK, handler(body))
        except ApiError as err:
            self.send_json(err.status, {"error": err.message})
        except Exception:
            # Never leave a phone hanging: report the failure so it can show an error and retry.
            self.log_error("Unexpected error handling %s", path)
            traceback.print_exc()
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Something went wrong saving that. Please try again."})

    def stream(self):
        q = STORE.subscribe()
        try:
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("X-Accel-Buffering", "no")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            self.wfile.write(f"retry: 3000\ndata: {STORE.public_json()}\n\n".encode())
            self.wfile.flush()
            while True:
                try:
                    payload = q.get(timeout=HEARTBEAT_SECONDS)
                    self.wfile.write(f"data: {payload}\n\n".encode())
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            STORE.unsubscribe(q)


class Server(ThreadingHTTPServer):
    daemon_threads = True


def main():
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    pin = STORE.ensure_admin_pin()
    httpd = Server((host, port), Handler)
    print(f"\n  Leaderboard running at http://{host}:{port}")
    print(f"  Admin PIN: {pin}  (set GOLF_ADMIN_PIN to choose your own)\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
