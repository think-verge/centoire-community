from app.fetchers import parse_feed, parse_shopify_products
from app.config import REPO_ROOT
from app.models import FetchedItem, Source
from app.sources import ItemFilter, load_blocked_publishers, load_sources
from app.urls import canonical_url, item_key

GOOGLE_NEWS_RSS = b"""<?xml version="1.0"?>
<rss version="2.0"><channel><title>Google News</title>
<item>
  <title>Founders Shut Down Coperni - The Business of Fashion</title>
  <link>https://news.google.com/rss/articles/CBMiabc?oc=5</link>
  <pubDate>Wed, 04 Nov 2026 13:54:10 GMT</pubDate>
  <source url="https://www.businessoffashion.com">The Business of Fashion</source>
</item>
</channel></rss>"""

ATOM = b"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>r/Sneakers</title>
<entry>
  <title>Leaked: Travis Scott x Jordan colourway</title>
  <link href="https://www.reddit.com/r/Sneakers/comments/abc/leaked/" />
  <updated>2026-11-04T10:00:00+00:00</updated>
  <category term="Sneakers_India" label="r/Sneakers_India"/>
  <content type="html">&lt;p&gt;Photos from a &lt;b&gt;factory&lt;/b&gt; sample&lt;/p&gt;</content>
</entry>
</feed>"""


def test_canonical_url_strips_tracking_and_trailing_slash():
    a = canonical_url("https://www.Hypebeast.com/2026/11/drop/?utm_source=x&id=7#top")
    b = canonical_url("https://hypebeast.com/2026/11/drop?id=7")
    assert a == b == "https://hypebeast.com/2026/11/drop?id=7"


def test_google_news_title_suffix_removed_and_keyed_on_publisher():
    [item] = parse_feed(GOOGLE_NEWS_RSS)
    assert item.title == "Founders Shut Down Coperni"
    assert item.publisher == "The Business of Fashion"
    assert item.published_at.isoformat() == "2026-11-04T13:54:10+00:00"
    # The same story behind a different opaque Google News link dedupes to one key.
    other = "https://news.google.com/rss/articles/CBMiXYZ?oc=5"
    assert item_key(item.url, publisher=item.publisher, title=item.title) == item_key(
        other, publisher="the business of fashion", title="Founders  shut down Coperni"
    )


def test_atom_entry_summary_is_plain_text():
    [item] = parse_feed(ATOM)
    assert item.summary == "Photos from a factory sample"
    assert item.url.endswith("/leaked/")


def test_reddit_region_comes_from_subreddit():
    [item] = parse_feed(ATOM)
    source = Source(id="reddit", name="Reddit", type="reddit", url="https://reddit.com",
                    region="GLOBAL", role="community", region_by_tag={"Sneakers_India": "IN"})
    assert source.regions_for(item.extra["tag"]) == ["IN"]
    assert source.regions_for("sneakers_INDIA") == ["IN"]
    assert source.regions_for("streetwear") == ["GLOBAL"]


def test_watchlist_loads_and_filters_junk():
    path = REPO_ROOT / "sources.yaml"
    sources = {s.id: s for s in load_sources(path)}
    f = ItemFilter(load_blocked_publishers(path))
    job = FetchedItem(url="https://x", title="Client Insights Coordinator - Milan job with Stone Island")
    news = FetchedItem(url="https://y", title="Founders Shut Down Coperni")
    spam = FetchedItem(url="https://z", title="Nike KD 6", publisher="auroradesio.it")
    assert not f.keep(sources["bof"], job)
    assert f.keep(sources["bof"], news)
    assert not f.keep(sources["gn-in-sneakers"], spam)


def test_shopify_products_become_items():
    payload = {"products": [{
        "handle": "desert-trek-4", "title": "DESERT TREK", "vendor": "Clarks",
        "published_at": "2026-11-02T16:27:15-08:00", "body_html": "<p>Smooth leather</p>",
        "images": [{"src": "https://cdn.shopify.com/a.png"}],
        "variants": [{"price": "160.00"}, {"price": "150.00"}], "tags": ["new-arrivals"],
    }]}
    [item] = parse_shopify_products("https://bdgastore.com/", payload)
    assert item.url == "https://bdgastore.com/products/desert-trek-4"
    assert item.title == "Clarks — DESERT TREK"
    assert item.extra["min_price"] == 150.0
    assert item.published_at.isoformat() == "2026-11-03T00:27:15+00:00"
