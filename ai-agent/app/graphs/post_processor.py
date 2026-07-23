from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional

from ..models.schemas import AnalysisResult
from ..services.content_fetcher import fetch_article_text
from ..services.gemini_client import get_llm


class PostProcessingState(TypedDict):
    post_id: str
    origin: str
    url: Optional[str]
    existing_content: Optional[str]
    fetched_text: Optional[str]
    analysis: Optional[AnalysisResult]
    status: str
    error: Optional[str]


ANALYSIS_PROMPT = """Analyze the following article content and return a structured classification.

Content (up to 3000 chars):
{content}

Instructions:
- category: classify as one of: news, opinion, listicle, tutorial, announcement, comparison
- quality_score: rate 0.0 (spam/junk) to 1.0 (excellent journalism/writing)
- is_spam: true only if purely promotional, auto-generated spam, or no real substance
- spam_reason: brief explanation if is_spam=true, else null
- summary: a 2-3 sentence TL;DR that captures the key point
- suggested_tags: 3-5 lowercase topic tags (e.g. "fashion", "sustainability", "trend-report")
- clickbait_detected: true if the headline is misleading, sensationalist, or exaggerated vs content
- read_time_minutes: estimate based on ~200 words/minute; minimum 1
"""


async def needs_fetch_node(state: PostProcessingState) -> PostProcessingState:
    return state


async def fetch_content_node(state: PostProcessingState) -> PostProcessingState:
    url = state.get("url")
    if url:
        text = await fetch_article_text(url)
        return {**state, "fetched_text": text}
    return state


async def analyze_node(state: PostProcessingState) -> PostProcessingState:
    content = state.get("fetched_text") or state.get("existing_content") or ""
    if not content.strip():
        return {**state, "status": "error", "error": "No content available for analysis"}

    llm = get_llm()
    structured_llm = llm.with_structured_output(AnalysisResult)

    try:
        result: AnalysisResult = await structured_llm.ainvoke(
            ANALYSIS_PROMPT.format(content=content[:3000])
        )
        return {**state, "analysis": result, "status": "accepted"}
    except Exception as exc:
        return {**state, "status": "error", "error": str(exc)}


def route_after_needs_fetch(state: PostProcessingState) -> str:
    if state.get("url") and state.get("origin") == "aggregated":
        return "fetch_content"
    return "analyze"


def route_after_analyze(state: PostProcessingState) -> str:
    analysis = state.get("analysis")
    if analysis and analysis.is_spam:
        return "reject"
    return END


async def reject_node(state: PostProcessingState) -> PostProcessingState:
    return {**state, "status": "rejected"}


def build_graph() -> StateGraph:
    graph: StateGraph = StateGraph(PostProcessingState)

    graph.add_node("needs_fetch", needs_fetch_node)
    graph.add_node("fetch_content", fetch_content_node)
    graph.add_node("analyze", analyze_node)
    graph.add_node("reject", reject_node)

    graph.set_entry_point("needs_fetch")
    graph.add_conditional_edges("needs_fetch", route_after_needs_fetch, {
        "fetch_content": "fetch_content",
        "analyze": "analyze",
    })
    graph.add_edge("fetch_content", "analyze")
    graph.add_conditional_edges("analyze", route_after_analyze, {
        "reject": "reject",
        END: END,
    })
    graph.add_edge("reject", END)

    return graph.compile()


processor_graph = build_graph()
