from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.posts import router as posts_router
from .api.v1.embed import router as embed_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Centoire AI Agent",
    description="Content processing, classification, and quality scoring for Centoire posts.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],
    allow_methods=["POST", "GET", "PATCH"],
    allow_headers=["*"],
)

app.include_router(posts_router)
app.include_router(embed_router)
