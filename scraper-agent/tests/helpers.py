from __future__ import annotations

LONG_PARAGRAPH = "Fashion houses are rethinking how collections reach customers. " * 12


def feed_xml(items: list[tuple[str, str, str]]) -> str:
    """items: (title, link, body_html)."""
    entries = "".join(
        f"<item><title>{t}</title><link>{link}</link><pubDate>Mon, 06 Oct 2026 10:00:00 GMT</pubDate>"
        f"<description>teaser for {t}</description><content:encoded><![CDATA[{b}]]></content:encoded></item>"
        for t, link, b in items
    )
    return (
        '<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">'
        f"<channel><title>Feed</title>{entries}</channel></rss>"
    )


class FakeBackend:
    """In-memory stand-in for BackendClient that records what the agent does."""

    def __init__(self, known: set[str] | None = None, queue=None):
        self.known = set(known or [])
        self.queue = list(queue or [])
        self.upserts: list[tuple[str, dict]] = []
        self.completed: list[dict] = []
        self.specs: list[dict] = []
        self.heartbeats = 0

    async def lease(self, types=None):
        return self.queue.pop(0) if self.queue else None

    async def heartbeat(self, job_id):
        self.heartbeats += 1

    async def complete(self, job_id, *, ok, stats=None, error_code=None, error_message=None):
        self.completed.append({"job": job_id, "ok": ok, "stats": stats, "error_code": error_code, "error_message": error_message})

    async def existing_urls(self, urls):
        return {u for u in urls if u in self.known}

    async def upsert_post(self, source_id, payload):
        from scraper_agent.backend_client import UpsertResult

        self.upserts.append((source_id, payload))
        return UpsertResult(outcome="created", post_id=f"p{len(self.upserts)}", status="pending_review")

    async def report_spec(self, source_id, *, status, spec_hash=None, store=None):
        self.specs.append({"source_id": source_id, "status": status, "hash": spec_hash, "store": store})

    async def aclose(self):
        pass


def make_job(job_type="scrape", *, store="excerpt", name="News Site", feed_url="https://news.test/feed.xml", requires_login=False):
    from scraper_agent.backend_client import LeasedJob

    return LeasedJob(
        id="job1",
        type=job_type,
        attempts=1,
        source={"id": "src1", "name": name, "siteUrl": "https://news.test", "feedUrl": feed_url, "requiresLogin": requires_login,
                "credentialRef": None, "spec": {"status": "ready", "hash": None, "store": store}},
    )
