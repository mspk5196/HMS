import urllib.request
import json
import time

t0 = time.time()
payload = {
    "model": "qwen2.5-coder:1.5b",
    "prompt": 'Extract constraints: "Assign Aiswarya to Day shift". Return JSON with keys: employee_assignments, min_staff.',
    "stream": False,
    "format": "json"
}

req = urllib.request.Request(
    "http://127.0.0.1:11434/api/generate",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode("utf-8"))
        print(f"Ollama responded in {round(time.time() - t0, 2)}s:")
        print(data.get("response"))
except Exception as e:
    print(f"Ollama query failed: {e}")
