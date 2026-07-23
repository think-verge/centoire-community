import os
import httpx
from fastapi import APIRouter, BackgroundTasks

from ...models.schemas import (
    AnalysisResult,
    ProcessPostRequest,
    ProcessingResult,
    ScorePostRequest,
    ScorePostResult,
)
from ...graphs.post_processor import PostProcessingState, processor_graph
from ...services.content_fetcher import fetch_article_text
from ...services.gemini_client import get_llm

router = APIRouter(prefix="/v1")

NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:8000")
AI_INTERNAL_SECRET = os.getenv("AI_INTERNAL_SECRET", "dev-internal-secret")


async def _run_and_callback(request: ProcessPostRequest) -> None:
    state: PostProcessingState = {
        "post_id": request.postId,
        "origin": request.origin,
        "url": request.url,
        "existing_content": request.content,
        "fetched_text": None,
        "analysis": None,
        "status": "pending",
        "error": None,
    }

    final_state: PostProcessingState = await processor_graph.ainvoke(state)
    analysis: AnalysisResult | None = final_state.get("analysis")

    payload = {
        "status": final_state["status"],
        "aiReadTimeMinutes": analysis.read_time_minutes if analysis else None,
        "aiCategory": analysis.category if analysis else None,
        "aiQualityScore": analysis.quality_score if analysis else None,
        "aiIsSpam": analysis.is_spam if analysis else None,
        "aiSummary": analysis.summary if analysis else None,
        "clickbaitDetected": analysis.clickbait_detected if analysis else None,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.patch(
                f"{NODE_BACKEND_URL}/api/v1/internal/posts/{request.postId}/ai-result",
                json=payload,
                headers={"X-Internal-Secret": AI_INTERNAL_SECRET},
            )
    except Exception:
        pass  # callback failure is non-critical


@router.post("/process-post", response_model=ProcessingResult)
async def process_post(
    request: ProcessPostRequest, background_tasks: BackgroundTasks
) -> ProcessingResult:
    """Enqueue full async pipeline. Returns immediately; result written back via callback."""
    background_tasks.add_task(_run_and_callback, request)
    return ProcessingResult(post_id=request.postId, status="queued")


@router.post("/score-post", response_model=ScorePostResult)
async def score_post(request: ScorePostRequest) -> ScorePostResult:
    """Synchronous quick-score for user-submitted posts (no callback)."""
    content = request.content or ""
    if request.url and not content:
        content = await fetch_article_text(request.url) or ""

    llm = get_llm()
    structured_llm = llm.with_structured_output(AnalysisResult)
    prompt = (
        f"Score this article for quality and spam detection.\n"
        f"Title: {request.title}\n"
        f"Content excerpt: {content[:1000]}\n\n"
        "Return the full AnalysisResult schema. For summary and suggested_tags use brief placeholders."
    )

    result: AnalysisResult = await structured_llm.ainvoke(prompt)
    return ScorePostResult(
        quality_score=result.quality_score,
        is_spam=result.is_spam,
        category=result.category,
    )


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}
