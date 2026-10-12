from datetime import UTC, datetime

from parsel import Selector

from scraper_agent.extract.clean import html_to_text, make_excerpt, sanitize_html
from scraper_agent.extract.fields import extract_body, extract_field, jsonld_objects, parse_date
from scraper_agent.spec.models import BodyRule, FieldRule

BASE = "https://news.example.com/2026/story"


def test_sanitize_removes_scripts_and_handlers_and_makes_links_absolute():
    dirty = '<p onclick="x()">Hi <a href="/about">about</a><script>alert(1)</script><img src="/a.jpg" onerror="y()"></p>'
    clean = sanitize_html(dirty, BASE)
    assert "<script" not in clean and "onclick" not in clean and "onerror" not in clean
    assert 'href="https://news.example.com/about"' in clean
    assert 'src="https://news.example.com/a.jpg"' in clean
    assert 'rel="noopener noreferrer nofollow"' in clean


def test_sanitize_blocks_javascript_urls():
    assert "javascript:" not in sanitize_html('<a href="javascript:alert(1)">x</a>', BASE)


def test_lazy_loaded_images_use_the_real_source():
    html = sanitize_html('<img src="data:image/gif;base64,AAA" data-src="/real.jpg">', BASE)
    assert "real.jpg" in html


def test_text_keeps_paragraph_breaks_and_excerpt_cuts_on_a_word():
    text = html_to_text("<p>First para</p><p>Second   para</p><ul><li>One</li><li>Two</li></ul>")
    assert text.splitlines() == ["First para", "Second para", "One", "Two"]
    excerpt = make_excerpt("word " * 200, 50)
    assert len(excerpt) <= 50 and excerpt.endswith("…") and " …" not in excerpt


def test_css_xpath_and_attr_selectors_with_first_match_wins():
    sel = Selector(text='<html><head><meta property="og:title" content="OG title"></head><body><h1> Real   title </h1></body></html>')
    assert extract_field(sel, FieldRule(selectors=["h1::text"])) == "Real title"
    assert extract_field(sel, FieldRule(selectors=["h2::text", "meta[property='og:title']::attr(content)"])) == "OG title"
    assert extract_field(sel, FieldRule(selectors=["xpath://h1"])) == "Real title"
    assert extract_field(sel, FieldRule(selectors=["h2::text"])) is None


def test_element_selector_returns_text_not_markup_and_urls_become_absolute():
    sel = Selector(text='<a class="cover" href="/img/x.jpg">link</a><span class="by">By <b>Ada</b></span>')
    assert extract_field(sel, FieldRule(selectors=["span.by"])) == "By Ada"
    assert extract_field(sel, FieldRule(selectors=["a.cover::attr(href)"]), BASE) == "https://news.example.com/img/x.jpg"


def test_jsonld_fields_including_nested_and_graph():
    html = """<script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","headline":"JSON headline",
      "datePublished":"2026-10-05T08:30:00Z","author":{"@type":"Person","name":"Ada Lovelace"},"image":["https://x.com/i.jpg"]}]}</script>"""
    sel = Selector(text=html)
    assert len(jsonld_objects(sel)) == 2
    assert extract_field(sel, FieldRule(selectors=["jsonld:headline"])) == "JSON headline"
    assert extract_field(sel, FieldRule(selectors=["jsonld:author.name"])) == "Ada Lovelace"
    assert extract_field(sel, FieldRule(selectors=["jsonld:image"])) == "https://x.com/i.jpg"


def test_dates_parse_leniently_or_by_format_and_default_to_utc():
    assert parse_date("2026-10-05T08:30:00+02:00").utcoffset().total_seconds() == 7200
    assert parse_date("5 Oct 2026") == datetime(2026, 10, 5, tzinfo=UTC)
    assert parse_date("05/10/2026", "%d/%m/%Y") == datetime(2026, 10, 5, tzinfo=UTC)
    assert parse_date("not a date") is None and parse_date(None) is None


def test_body_extraction_removes_unwanted_blocks_and_sanitizes():
    html = """<article><div class="body"><p>Real paragraph one.</p><div class="ad">BUY NOW</div>
      <p>Second paragraph <a href="/x">link</a>.</p><script>bad()</script></div><aside>related</aside></article>"""
    body_html, body_text = extract_body(Selector(text=html), BodyRule(selectors=["div.missing", "div.body"], remove=["div.ad"]), BASE)
    assert "BUY NOW" not in body_text and "bad()" not in body_html
    assert body_text.splitlines()[0] == "Real paragraph one."
    assert "https://news.example.com/x" in body_html


def test_body_can_come_from_jsonld_article_body():
    text = "Paragraph one is here. " * 15
    html = f'<script type="application/ld+json">{{"@type":"Article","articleBody":"{text}\\n{text}"}}</script>'
    _, body_text = extract_body(Selector(text=html), BodyRule(selectors=["jsonld:articleBody"]), BASE)
    assert body_text.splitlines()[0].startswith("Paragraph one is here.")
    assert len(body_text.splitlines()) == 2  # the two JSON-LD lines became two paragraphs


def test_no_match_gives_empty():
    assert extract_body(Selector(text="<p>x</p>"), BodyRule(selectors=["div.nothing"]), BASE) == ("", "")
