from pydantic import BaseModel, Field
from typing import Optional


class AnalysisResult(BaseModel):
    category: str = Field(description="One of: news, opinion, listicle, tutorial, announcement, comparison")
    quality_score: float = Field(ge=0.0, le=1.0, description="0=spam/low quality, 1=excellent")
    is_spam: bool
    spam_reason: Optional[str] = None
    summary: str = Field(description="2-3 sentence TL;DR of the article")
    suggested_tags: list[str] = Field(description="3-5 relevant topic tags, lowercase")
    clickbait_detected: bool
    read_time_minutes: int = Field(ge=1, description="Estimated reading time in minutes")


class ProcessPostRequest(BaseModel):
    postId: str
    url: Optional[str] = None
    content: Optional[str] = None
    origin: str  # "aggregated" | "native"


class ProcessingResult(BaseModel):
    post_id: str
    status: str  # queued | accepted | rejected | error
    analysis: Optional[AnalysisResult] = None
    error: Optional[str] = None


class ScorePostRequest(BaseModel):
    title: str
    content: Optional[str] = None
    url: Optional[str] = None


class ScorePostResult(BaseModel):
    quality_score: float
    is_spam: bool
    category: str
