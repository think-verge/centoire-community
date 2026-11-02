import os
from pathlib import Path
from dotenv import load_dotenv

# Try loading backend/.env if local .env is not found
local_env = Path(".env")
backend_env = Path("../../backend/.env")
root_backend_env = Path("backend/.env")

if local_env.exists():
    load_dotenv(local_env)
elif backend_env.exists():
    load_dotenv(backend_env)
elif root_backend_env.exists():
    load_dotenv(root_backend_env)

# Service-local settings: do NOT fall back to bare PORT or HOST from shared backend/.env
HOST = os.getenv("RECSYS_HOST", "127.0.0.1")
PORT = int(os.getenv("RECSYS_PORT", "8004"))
ANNOUNCE_ADDRESS = os.getenv(
    "RECSYS_ANNOUNCE_ADDRESS",
    f"http://{HOST}:{PORT}"
)

NATS_URL = os.getenv("NATS_URL", "nats://127.0.0.1:4222")

GATEWAY_SECRET = os.getenv("GATEWAY_SECRET", "dev-gateway-secret")
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "dev-internal-secret")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
MONGODB_URI = os.getenv("MONGODB_URI", "")
