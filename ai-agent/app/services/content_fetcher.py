import httpx
import trafilatura

HEADERS = {"User-Agent": "CentoireBot/0.1 (+https://centoire.app)"}


async def fetch_article_text(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=HEADERS) as client:
            response = await client.get(url)
            response.raise_for_status()
            text = trafilatura.extract(
                response.text,
                include_comments=False,
                include_tables=False,
                favor_precision=True,
            )
            return text
    except Exception:
        return None
