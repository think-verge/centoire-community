import json

from app.gnews import article_id, batch_body, parse_resolved, parse_signature


def test_google_news_link_parts():
    assert article_id("https://news.google.com/rss/articles/CBMiZEFVX3lx?oc=5") == "CBMiZEFVX3lx"
    assert article_id("https://hypebeast.com/x") is None
    assert parse_signature('<c-wiz data-n-a-sg="AZ5r3e" data-n-a-ts="1762700000">') == ("AZ5r3e", 1762700000)
    assert parse_signature("<html>consent page</html>") is None
    inner = json.loads(json.loads(batch_body("CBMi", "AZ5r3e", 1762700000)["f.req"])[0][0][1])
    assert inner[0] == "garturlreq" and inner[2:] == ["CBMi", 1762700000, "AZ5r3e"]


def test_resolved_url_is_read_from_the_batch_response():
    body = ')]}\'\n\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://www.webuomo.jp/sneaker/a/\\",1]",null]]'
    assert parse_resolved(body) == "https://www.webuomo.jp/sneaker/a/"
    assert parse_resolved('[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://news.google.com/x\\",1]"]]') is None
    assert parse_resolved("error") is None
