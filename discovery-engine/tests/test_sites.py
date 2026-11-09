import httpx
import pytest

from app.config import REPO_ROOT
from app.models import Source
from app.sites import SiteWatcher, page_links, page_meta, sitemap_urls, title_from_url
from app.sources import load_sources

SNKRS = "https://www.nike.com/sitemap-v2-snkrsweb-en-us.xml"


def sitemap(*paths: str) -> str:
    locs = "".join(f"<url><loc>https://www.nike.com{p}</loc></url>" for p in paths)
    return f'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{locs}</urlset>'


class FakeStore:
    def __init__(self) -> None:
        self.urls: dict[str, set[str]] = {}

    async def site_urls(self, source_id: str) -> set[str]:
        return set(self.urls.get(source_id, set()))

    async def add_site_urls(self, source_id: str, urls: list[str]) -> None:
        self.urls.setdefault(source_id, set()).update(urls)


def snkrs_source(**overrides) -> Source:
    raw = dict(id="nike-snkrs-us", name="Nike SNKRS US", type="sitemap", region="US", role="brand",
               url=SNKRS, include_url=["/launch/t/"], enrich=False)
    return Source(**{**raw, **overrides})


def serve(pages: dict[str, str]) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        body = pages.get(str(request.url))
        return httpx.Response(200, text=body) if body is not None else httpx.Response(404)
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_sitemap_and_page_parsing():
    assert list(sitemap_urls(sitemap("/launch/t/a", "/launch/t/b&amp;c"))) == [
        "https://www.nike.com/launch/t/a", "https://www.nike.com/launch/t/b&c"]
    links = page_links("https://about.nike.com/en/newsroom", """
        <a href="/en/newsroom/releases/flight-force-uptempo"><img src="x.jpg"></a>
        <a class="card" href="/en/newsroom/releases/flight-force-uptempo">Nike reintroduces <b>Flight</b></a>
        <a href="#top">Top</a>""")
    assert links == {"https://about.nike.com/en/newsroom/releases/flight-force-uptempo": "Nike reintroduces Flight"}


def test_title_from_url():
    assert title_from_url("https://www.nike.com/launch/t/air-jordan-4-retro-white-cement-fv5029-100") == \
        "Air Jordan 4 Retro White Cement FV5029 100"
    assert title_from_url("https://supreme.com/previews/springsummer2027/all/30?=waves-zip-pullover") == \
        "Waves Zip Pullover"


def test_page_meta_prefers_og_then_trims_title():
    assert page_meta('<meta property="og:title" content="Nike &amp; Stüssy Baltoro">')["title"] == \
        "Nike & Stüssy Baltoro"
    meta = page_meta("<title>Supreme®/Spyder® – News – Supreme</title>"
                     '<meta content="2026-11-02T09:00:00Z" property="article:published_time">')
    assert meta["title"] == "Supreme®/Spyder®"
    assert meta["published_at"].isoformat() == "2026-11-02T09:00:00+00:00"


async def test_first_listing_seeds_then_only_new_urls_are_items():
    watcher, cache = SiteWatcher(FakeStore()), {}
    source = snkrs_source()
    async with serve({SNKRS: sitemap("/launch/t/old-one", "/launch/t/old-two", "/help/returns")}) as client:
        assert await watcher.fetch(client, source, cache) == []
    assert watcher.store.urls["nike-snkrs-us"] == {"https://www.nike.com/launch/t/old-one", "https://www.nike.com/launch/t/old-two"}

    new_url = "https://www.nike.com/launch/t/air-max-95-og-neon-at2865-100"
    async with serve({SNKRS: sitemap("/launch/t/old-one", "/launch/t/air-max-95-og-neon-at2865-100")}) as client:
        items = await watcher.fetch(client, source, cache)
        assert await watcher.fetch(client, source, cache) == []  # remembered, not repeated
    assert [(i.url, i.title, i.publisher) for i in items] == [
        (new_url, "Air Max 95 Og Neon AT2865 100", "Nike SNKRS US")]
    assert items[0].extra == {"via": "sitemap", "listing": SNKRS}


async def test_new_page_is_opened_for_its_title_when_enrich_is_on():
    page = "https://about.nike.com/en/newsroom"
    article = "https://about.nike.com/en/newsroom/releases/nike-skims-waffle-racer"
    source = Source(id="nike-newsroom", name="Nike Newsroom", type="page", region="GLOBAL", role="brand",
                    url=page, include_url=["/en/newsroom/[a-z-]+/[^/]+$"])
    watcher = SiteWatcher(FakeStore())
    watcher.store.urls["nike-newsroom"] = {"https://about.nike.com/en/newsroom/releases/older"}
    async with serve({
        page: f'<a href="/en/newsroom/releases/older">Older</a><a href="{article}">Read more</a>',
        article: '<meta property="og:title" content="NikeSKIMS Waffle Racer Reimagines Retro Sport">'
                 '<meta property="og:image" content="https://img/1.jpg">',
    }) as client:
        [item] = await watcher.fetch(client, source, {})
    assert item.title == "NikeSKIMS Waffle Racer Reimagines Retro Sport"
    assert item.image_url == "https://img/1.jpg"


async def test_listing_that_matches_nothing_is_an_error():
    async with serve({SNKRS: "<html>Access denied</html>"}) as client:
        with pytest.raises(ValueError, match="no URLs matched"):
            await SiteWatcher(FakeStore()).fetch(client, snkrs_source(), {})


async def test_site_redesign_is_not_reported_as_news():
    watcher = SiteWatcher(FakeStore())
    watcher.store.urls["nike-snkrs-us"] = {"https://www.nike.com/launch/t/old"}
    redesigned = sitemap(*[f"/launch/t/v2/{n}" for n in range(150)])
    async with serve({SNKRS: redesigned}) as client:
        assert await watcher.fetch(client, snkrs_source(), {}) == []


def test_brand_sites_watchlist_loads():
    sources = load_sources(REPO_ROOT / "brand_sites.yaml")
    assert {s.type for s in sources} == {"sitemap", "page", "rss"}
    assert all(s.role == "brand" for s in sources)
    assert all(s.include_url for s in sources if s.type == "page")


async def test_empty_news_sitemap_is_not_an_error():
    source = snkrs_source(id="soleretriever", url="https://www.soleretriever.com/sitemap-google-news.xml",
                          include_url=[])
    async with serve({source.url: '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'}) as client:
        assert await SiteWatcher(FakeStore()).fetch(client, source, {}) == []


async def test_opened_pages_are_read_for_credits():
    page = "https://www.sneakerfreaker.com/"
    article = "https://www.sneakerfreaker.com/releases/corteiz-nike-shox-r4"
    source = Source(id="sneakerfreaker", name="Sneaker Freaker", type="page", region="AU", role="publisher",
                    url=page, include_url=["/releases/[^/]+$"])
    watcher = SiteWatcher(FakeStore())
    watcher.store.urls["sneakerfreaker"] = {"https://www.sneakerfreaker.com/releases/older"}
    async with serve({page: f'<a href="{article}">Corteiz</a>',
                      article: "<article><p>Photos: zsneakerheadz</p></article>"}) as client:
        [item] = await watcher.fetch(client, source, {})
    assert [(c["name"], c["kind"]) for c in item.extra["citations"]] == [("zsneakerheadz", "credit")]
