import httpx
import pytest
import respx

from helpers import LONG_PARAGRAPH, feed_xml
from scraper_agent.extract.bootstrap import bootstrap_rss_spec, discover_feed_url
from scraper_agent.extract.fetcher import FetchError, HttpFetcher, PoliteFetcher
from scraper_agent.extract.ratelimit import HostLimiter
from scraper_agent.extract.replay import ReplayError, extract_article, list_items, parse_feed
from scraper_agent.extract.robots import RobotsCache
from scraper_agent.spec import SourceSpec

FEED = "https://news.test/feed.xml"


def rss_spec(**over):
    return SourceSpec.model_validate({"source": "news", "site": "https://news.test", "listing": {"strategy": "rss", "urls": [FEED]}, **over})


def html_spec(**over):
    base = {
        "source": "news",
        "site": "https://news.test",
        "listing": {"strategy": "html", "urls": ["https://news.test/latest"], "item_selector": "article.card", "link": {"selectors": ["a::attr(href)"]}, "title": {"selectors": ["h2::text"]}},
        "article": {"title": {"selectors": ["h1::text"]}, "author": {"selectors": [".byline::text"]}, "published_at": {"selectors": ["time::attr(datetime)"]},
                    "body": {"selectors": ["div.body"], "remove": [".ad"]}, "cover_image": {"selectors": ["meta[property='og:image']::attr(content)"]}},
        "verify": {"min_body_chars": 100},
    }
    base.update(over)
    return SourceSpec.model_validate(base)


@pytest.fixture
def fetcher(settings):
    client = httpx.AsyncClient(follow_redirects=True)
    return HttpFetcher(settings, client)


# ── RSS ──────────────────────────────────────────────────────────────────────────


@respx.mock
async def test_rss_listing_parses_items_and_dedupes(fetcher):
    xml = feed_xml([("One", "https://news.test/a", "<p>x</p>"), ("Two", "https://news.test/b", "<p>y</p>"), ("One again", "https://news.test/a", "<p>x</p>")])
    respx.get(FEED).mock(return_value=httpx.Response(200, text=xml))
    items = await list_items(rss_spec(), fetcher)
    assert [i.url for i in items] == ["https://news.test/a", "https://news.test/b"]
    assert items[0].published_at.year == 2026


@respx.mock
async def test_empty_feed_means_the_layout_is_gone(fetcher):
    respx.get(FEED).mock(return_value=httpx.Response(200, text=feed_xml([])))
    with pytest.raises(ReplayError) as err:
        await list_items(rss_spec(), fetcher)
    assert err.value.code == "layout_changed"


@respx.mock
async def test_max_items_caps_the_listing(fetcher):
    xml = feed_xml([(f"T{i}", f"https://news.test/{i}", "") for i in range(10)])
    respx.get(FEED).mock(return_value=httpx.Response(200, text=xml))
    items = await list_items(rss_spec(policy={"max_items": 4}), fetcher)
    assert len(items) == 4


@respx.mock
async def test_feed_body_is_used_directly_when_it_is_long_enough(fetcher):
    body = f"<p>{LONG_PARAGRAPH}</p>"
    respx.get(FEED).mock(return_value=httpx.Response(200, text=feed_xml([("Story", "https://news.test/a", body)])))
    spec = rss_spec(verify={"min_body_chars": 300})
    item = (await list_items(spec, fetcher))[0]
    candidate = await extract_article(spec, fetcher, item)
    assert candidate.title == "Story" and len(candidate.content_text) > 300
    assert candidate.excerpt.startswith("teaser for Story")


# ── HTML listing + article pages ─────────────────────────────────────────────────

LISTING = """<html><body>
<article class="card"><a href="/story-1"><h2>First story</h2></a></article>
<article class="card"><a href="/story-2"><h2>Second story</h2></a></article>
<article class="card"><a href="/story-1"><h2>First story (dup)</h2></a></article>
</body></html>"""

ARTICLE = f"""<html><head><meta property="og:image" content="/cover.jpg"></head><body>
<h1>First story</h1><span class="byline">By Ada</span><time datetime="2026-10-05T08:30:00Z"></time>
<div class="body"><p>{LONG_PARAGRAPH}</p><div class="ad">BUY</div></div></body></html>"""


@respx.mock
async def test_html_listing_and_article_extraction(fetcher):
    respx.get("https://news.test/latest").mock(return_value=httpx.Response(200, text=LISTING))
    respx.get("https://news.test/story-1").mock(return_value=httpx.Response(200, text=ARTICLE))
    spec = html_spec()
    items = await list_items(spec, fetcher)
    assert [i.url for i in items] == ["https://news.test/story-1", "https://news.test/story-2"]
    candidate = await extract_article(spec, fetcher, items[0])
    assert candidate.title == "First story" and candidate.author == "By Ada"
    assert candidate.published_at.isoformat().startswith("2026-10-05T08:30")
    assert candidate.cover_image_url == "https://news.test/cover.jpg"
    assert "BUY" not in candidate.content_text and len(candidate.content_text) > 300


@respx.mock
async def test_html_listing_with_no_matches_is_layout_changed(fetcher):
    respx.get("https://news.test/latest").mock(return_value=httpx.Response(200, text="<html><body><div class='new-design'></div></body></html>"))
    with pytest.raises(ReplayError) as err:
        await list_items(html_spec(), fetcher)
    assert err.value.code == "layout_changed"


@respx.mock
async def test_pagination_follows_next_links_up_to_max_pages(fetcher):
    spec = html_spec(listing={
        "strategy": "html", "urls": ["https://news.test/latest"], "item_selector": "article.card",
        "link": {"selectors": ["a::attr(href)"]}, "pagination": {"next_selector": "a.next::attr(href)", "max_pages": 2},
    })
    page1 = '<article class="card"><a href="/a">A</a></article><a class="next" href="/latest?p=2">next</a>'
    page2 = '<article class="card"><a href="/b">B</a></article><a class="next" href="/latest?p=3">next</a>'
    respx.get("https://news.test/latest", params={"p": "2"}).mock(return_value=httpx.Response(200, text=page2))
    respx.get("https://news.test/latest").mock(return_value=httpx.Response(200, text=page1))
    items = await list_items(spec, fetcher)
    assert [i.url for i in items] == ["https://news.test/a", "https://news.test/b"]


@respx.mock
async def test_paywall_marker_means_the_login_was_lost(fetcher):
    teaser = "<html><body><h1>Locked</h1><div class='body'><p>Short.</p></div><div>Subscribe to keep reading</div></body></html>"
    respx.get("https://news.test/story-1").mock(return_value=httpx.Response(200, text=teaser))
    from scraper_agent.extract.replay import ListingItem

    spec = html_spec(article={"title": {"selectors": ["h1::text"]}, "body": {"selectors": ["div.body"]}, "paywall_markers": ["Subscribe to keep reading"]},
                     auth={"required": True, "credential_ref": "news", "steps": [{"action": "click", "selector": "button"}], "success_check": {"selector": ".me"}})
    with pytest.raises(ReplayError) as err:
        await extract_article(spec, fetcher, ListingItem(url="https://news.test/story-1"))
    assert err.value.code == "login_expired"


@respx.mock
async def test_blocked_responses_are_reported_as_blocked(fetcher):
    respx.get(FEED).mock(return_value=httpx.Response(403))
    with pytest.raises(FetchError) as err:
        await list_items(rss_spec(), fetcher)
    assert err.value.code == "blocked"


# ── politeness ───────────────────────────────────────────────────────────────────


@respx.mock
async def test_polite_fetcher_stops_at_robots_disallow(settings):
    respx.get("https://news.test/robots.txt").mock(return_value=httpx.Response(200, text="User-agent: *\nDisallow: /private/\n"))
    page = respx.get("https://news.test/private/x").mock(return_value=httpx.Response(200, text="secret"))
    inner = HttpFetcher(settings, httpx.AsyncClient())
    robots = RobotsCache(inner.text, settings.user_agent)
    polite = PoliteFetcher(inner, rss_spec().policy, robots, HostLimiter(1000))
    with pytest.raises(FetchError) as err:
        await polite.get("https://news.test/private/x")
    assert err.value.code == "blocked" and not page.called


@respx.mock
async def test_robots_can_be_turned_off_per_source_for_licensed_access(settings):
    respx.get("https://news.test/private/x").mock(return_value=httpx.Response(200, text="ok"))
    inner = HttpFetcher(settings, httpx.AsyncClient())
    robots = RobotsCache(inner.text, settings.user_agent)  # would disallow everything (500)
    polite = PoliteFetcher(inner, rss_spec(policy={"respect_robots": False}).policy, robots, HostLimiter(1000))
    assert (await polite.get("https://news.test/private/x")).html == "ok"


# ── bootstrap (spec without a browser or LLM) ────────────────────────────────────


def test_feed_autodiscovery_from_the_homepage():
    html = '<html><head><link rel="alternate" type="application/rss+xml" href="/rss"></head></html>'
    assert discover_feed_url(html, "https://news.test/") == "https://news.test/rss"
    assert discover_feed_url("<html></html>", "https://news.test/") is None


@respx.mock
async def test_bootstrap_uses_the_feed_url_and_keeps_full_text_only_if_the_feed_has_it(fetcher):
    source = {"id": "s1", "name": "News Site", "siteUrl": "https://news.test", "feedUrl": FEED}
    full = feed_xml([(f"T{i}", f"https://news.test/{i}", f"<p>{LONG_PARAGRAPH}</p>") for i in range(4)])
    respx.get(FEED).mock(return_value=httpx.Response(200, text=full))
    respx.get("https://news.test").mock(return_value=httpx.Response(200, text="<html></html>"))
    spec = await bootstrap_rss_spec(source, fetcher)
    assert spec.listing.strategy == "rss" and spec.source == "news-site" and spec.source_id == "s1"
    assert spec.policy.store == "full" and len(spec.verify.sample_urls) == 3

    teasers = feed_xml([(f"T{i}", f"https://news.test/{i}", "<p>short</p>") for i in range(4)])
    respx.get(FEED).mock(return_value=httpx.Response(200, text=teasers))
    assert (await bootstrap_rss_spec(source, fetcher)).policy.store == "excerpt"


@respx.mock
async def test_bootstrap_finds_the_feed_when_the_configured_one_is_wrong(fetcher):
    source = {"id": "s1", "name": "News", "siteUrl": "https://news.test", "feedUrl": "https://news.test/old-feed"}
    # respx treats a bare-host URL as matching every path, so register the specific routes first.
    respx.get("https://news.test/old-feed").mock(return_value=httpx.Response(404))
    respx.get("https://news.test/atom").mock(return_value=httpx.Response(200, text=feed_xml([("A", "https://news.test/a", "")])))
    respx.get("https://news.test").mock(return_value=httpx.Response(200, text='<link rel="alternate" type="application/atom+xml" href="/atom">'))
    spec = await bootstrap_rss_spec(source, fetcher)
    assert spec.listing.urls == ["https://news.test/atom"]


@respx.mock
async def test_bootstrap_gives_up_cleanly_when_there_is_no_feed(fetcher):
    source = {"id": "s1", "name": "News", "siteUrl": "https://news.test", "feedUrl": None}
    respx.get("https://news.test").mock(return_value=httpx.Response(200, text="<html><body>no feed</body></html>"))
    assert await bootstrap_rss_spec(source, fetcher) is None


def test_parse_feed_extracts_cover_images():
    xml = ('<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><item><title>T</title><link>/a</link>'
           '<media:content url="https://img.test/c.jpg" medium="image"/></item></channel></rss>')
    assert parse_feed(xml, "https://news.test")[0].cover_image_url == "https://img.test/c.jpg"
