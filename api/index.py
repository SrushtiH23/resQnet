import os
import sys

# Add backend and root directories to Python path dynamically
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(parent_dir, "backend") if os.path.isdir(os.path.join(parent_dir, "backend")) else current_dir

for path in [backend_dir, parent_dir, current_dir]:
    if path and path not in sys.path:
        sys.path.insert(0, path)

try:
    from main import app
except ImportError:
    from backend.main import app

app = app
