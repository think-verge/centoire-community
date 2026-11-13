import httpx

from app.citations import article_body, extract_citations
from app.config import Settings
from app.instagram import InstagramClient
from app.models import Source
from app.origins import OriginTracker, drop_boilerplate, is_eligible, publisher_key


def names(html: str, base: str = "https://hypebeast.com/2026/11/x", own: str = "hypebeast.com") -> list:
    return [(c["platform"], c["name"], c["kind"]) for c in extract_citations(html, base, own)]


def test_credit_lines_as_publishers_write_them():
    # Sneaker Bar Detroit / Just Fresh Kicks / Sneaker News, verbatim formats.
    assert names("<p>Price: $155</p><p>Photos: acgtaiwan, agcdaily, runners_highest</p>") == [
        ("instagram", "acgtaiwan", "credit"), ("instagram", "agcdaily", "credit"),
        ("instagram", "runners_highest", "credit")]
    assert names("<p>Images via acgtaiwan, acgdaily and runners_highest.</p>"
                 "<p>Original PE images via Sotheby’s.</p><p>Images and video via Nike.</p>") == [
        ("instagram", "acgtaiwan", "credit"), ("instagram", "acgdaily", "credit"),
        ("instagram", "runners_highest", "credit"), ("name", "Sotheby’s", "credit"),
        ("instagram", "nike", "credit")]
    assert names("<p>the LeBron 24 “Purple Aura,” now emerging via Nike images ahead of release.</p>") == [
        ("instagram", "nike", "credit")]


def test_retail_via_and_sentence_text_are_not_credits():
    assert names("<p>Releases December 2026 for $180 via Nike and select retailers. "
                 "Available now via the JW Anderson webstore. Check out the official photos below.</p>") == []


def test_embeds_and_links():
    html = ('<blockquote class="instagram-media">View this post on Instagram A post shared by flame '
            '(@travisscott)</blockquote>'
            '<a href="https://hypebeast.com/tags/nike">Nike</a>'           # own site
            '<a href="https://www.beams.co.jp/news/123">BEAMS</a>'
            '<a href="https://x.com/py_rates/status/1">post</a>'
            '<a href="https://www.instagram.com/p/DfYOf/">embed</a>'        # a post, not an account
            '<a href="https://www.kqzyfj.com/click?u=nike">buy</a>')       # affiliate
    assert names(html) == [("instagram", "travisscott", "embed"), ("website", "beams.co.jp", "link"),
                           ("x", "py_rates", "link")]


def test_article_body_skips_page_chrome():
    page = ('<nav><a href="https://instagram.com/sbdetroit">us</a></nav><article><style>.photo:hover{opacity:0}'
            '</style><p>Photos: lacedchicago</p></article>')
    assert names(article_body(page), own="sneakerbardetroit.com") == [("instagram", "lacedchicago", "credit")]


def test_eligibility_and_boilerplate():
    doc = {"platform": "instagram", "publishers": ["sneakerbardetroit.com"], "stories": 1, "kinds": ["credit"]}
    assert not is_eligible(doc)
    assert is_eligible({**doc, "publishers": ["sneakerbardetroit.com", "justfreshkicks.com"]})
    assert is_eligible({**doc, "days": ["2026-11-01", "2026-11-03", "2026-11-06"]})
    assert not is_eligible({**doc, "stories": 3, "days": ["2026-11-06"]})  # one story, three editions
    linked = {"platform": "website", "publishers": ["a.com", "b.com"], "stories": 5, "kinds": ["link"]}
    assert not is_eligible(linked)  # shops get linked all the time; needs 3 publishers
    # An outlet linking its own X account in every article is not an origin, however often.
    assert not is_eligible({"platform": "x", "publishers": ["justfreshkicks"], "stories": 12, "kinds": ["link"]})
    # hbx.com is Hypebeast's own shop, linked from 9 of its 10 traced articles.
    hbx = {"platform": "website", "publishers": ["hypebeast.com", "highsnobiety.com"],
           "by": {"hypebeast_com": 9, "highsnobiety_com": 1}}
    assert drop_boilerplate(hbx, {"hypebeast.com": 10, "highsnobiety.com": 20})["publishers"] == ["highsnobiety.com"]
    assert publisher_key(Source(id="hypebeast-jp", name="x", type="rss", region="JP", role="publisher",
                                url="https://hypebeast.cn/feed")) == "hypebeast"


class FakeStore:
    def __init__(self, docs):
        self.docs = {d["_id"]: d for d in docs}
        self.added = []

    async def citing_totals(self):
        return {}

    async def origin_candidates(self, *, statuses=None, limit=0):
        return [d for d in self.docs.values() if not statuses or d["status"] in statuses]

    async def set_origin_status(self, oid, status, *, reason=""):
        self.docs[oid].update(status=status, status_reason=reason)

    async def add_discovered_source(self, source, *, origin_id):
        self.added.append(source)


class FakePoller:
    def __init__(self, store, watched):
        self.store, self.settings = store, Settings()
        self.settings.ig_user_id = self.settings.ig_access_token = None
        self.instagram = InstagramClient(self.settings)
        self.all_sources = self.sources = watched
        self.started = []
        self.review = None  # the Centoire app bridge (tests/test_review.py)

    def add_source(self, source):
        self.started.append(source.id)


def cand(oid, platform, name, publishers, kinds=("credit",), regions=("TW",)):
    return {"_id": oid, "platform": platform, "name": name, "status": "new", "publishers": publishers,
            "stories": len(publishers), "kinds": list(kinds), "regions": list(regions)}


async def test_promote_adds_feeds_waits_for_instagram_and_flags_the_rest():
    watched = [Source(id="ig-nike", name="@nike", type="instagram", region="US", role="brand",
                      url="https://www.instagram.com/nike/")]
    store = FakeStore([
        cand("instagram:acgtaiwan", "instagram", "acgtaiwan", ["sneakerbardetroit.com", "justfreshkicks.com"]),
        cand("instagram:nike", "instagram", "nike", ["a.com", "b.com"]),
        cand("website:beams.co.jp", "website", "beams.co.jp", ["a.com", "b.com", "c.com"], kinds=("link",),
             regions=("JP",)),
        cand("x:py_rates", "x", "py_rates", ["a.com", "b.com"]),
        cand("instagram:once", "instagram", "once", ["a.com"]),
    ])
    poller = FakePoller(store, watched)
    feed = '<?xml version="1.0"?><rss><channel><item><title>BEAMS x New Balance</title><link>https://www.beams.co.jp/news/1</link></item></channel></rss>'

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/":
            return httpx.Response(200, text='<link rel="alternate" type="application/rss+xml" href="/news/rss">')
        if request.url.path == "/news/rss":
            return httpx.Response(200, text=feed)
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        added = await OriginTracker(poller).promote(client)

    assert added == 1 and poller.started == ["site-beams-co-jp"]
    [beams] = store.added
    assert (beams.type, beams.url, beams.region, beams.role) == ("rss", "https://beams.co.jp/news/rss", "JP", "discovered")
    status = {k: d["status"] for k, d in store.docs.items()}
    assert status == {"instagram:acgtaiwan": "pending_instagram", "instagram:nike": "watching",
                      "website:beams.co.jp": "watching", "x:py_rates": "not_watchable", "instagram:once": "new"}
