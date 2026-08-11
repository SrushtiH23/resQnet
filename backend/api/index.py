import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
backend_dir = parent_dir if os.path.exists(os.path.join(parent_dir, "main.py")) else current_dir

for path in [backend_dir, parent_dir, current_dir]:
    if path and path not in sys.path:
        sys.path.insert(0, path)

try:
    from main import app as raw_app
except ImportError:
    from backend.main import app as raw_app

async def app(scope, receive, send):
    if scope["type"] in ("http", "websocket"):
        path = scope.get("path", "")
        for prefix in ["/api/index.py", "/api/index"]:
            if path.startswith(prefix):
                path = path[len(prefix):]
                break
        if not path or path == "//":
            path = "/"
        elif not path.startswith("/"):
            path = "/" + path
        scope["path"] = path
    await raw_app(scope, receive, send)
