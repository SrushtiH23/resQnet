import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(parent_dir, "backend") if os.path.isdir(os.path.join(parent_dir, "backend")) else current_dir

for path in [backend_dir, parent_dir, current_dir]:
    if path and path not in sys.path:
        sys.path.insert(0, path)

try:
    from main import app as raw_app
except ImportError:
    from backend.main import app as raw_app

# ASGI wrapper to handle Vercel path rewrites cleanly
async def app(scope, receive, send):
    if scope["type"] in ("http", "websocket"):
        path = scope.get("path", "")
        if path.startswith("/api/index.py"):
            new_path = path[13:]
            scope["path"] = new_path if new_path else "/"
        elif path.startswith("/api/index"):
            new_path = path[10:]
            scope["path"] = new_path if new_path else "/"
    await raw_app(scope, receive, send)
