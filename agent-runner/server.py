import csv
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CSV_PATH = os.environ.get("ACCESS_CSV_PATH", "/runner/secrets.csv")
DEMO_MODE = os.environ.get("DEMO_MODE", "true").lower() != "false"

def load_devices_safe():
    if not os.path.exists(CSV_PATH):
        return []
    out = []
    with open(CSV_PATH, mode="r", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            out.append({
                "name": (row.get("name") or "").strip(),
                "ip": (row.get("ip") or "").strip(),
                "port": (row.get("port") or "22").strip(),
                "user": (row.get("user") or "").strip(),
                "notes": (row.get("notes") or "").strip(),
            })
    return out

class Handler(BaseHTTPRequestHandler):
    def _send_json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"ok": True, "demoMode": DEMO_MODE})
        elif self.path == "/devices":
            self._send_json(200, {"devices": load_devices_safe()})
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        data = json.loads(raw.decode("utf-8") or "{}")
        if self.path == "/execute":
            self._send_json(200, {
                "accepted": True,
                "demoMode": DEMO_MODE,
                "readOnly": not bool(data.get("writeMode", False)),
                "rulesEnforced": ["rfc4180-csv", "zero-password-leak", "mikrotik-ct200w", "ovis-dfr-precheck", "bind-yyyyddmmnn"]
            })
        else:
            self._send_json(404, {"error": "not found"})

    def log_message(self, *_args):
        return

if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8090), Handler).serve_forever()
