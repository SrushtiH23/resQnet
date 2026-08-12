import os
import sys
from fastapi import FastAPI
from fastapi.responses import JSONResponse

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(parent_dir, "backend") if os.path.isdir(os.path.join(parent_dir, "backend")) else current_dir

for path in [backend_dir, parent_dir, current_dir]:
    if path and path not in sys.path:
        sys.path.insert(0, path)

try:
    try:
        from main import app as raw_app
    except Exception:
        from backend.main import app as raw_app
    app = raw_app
except Exception as e:
    import traceback
    err_tb = traceback.format_exc()
    app = FastAPI()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    def catch_all(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "detail": f"Vercel Serverless Startup Error: {str(e)}",
                "traceback": err_tb
            }
        )
