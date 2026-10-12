import pytest

from scraper_agent.extract.robots import RobotsCache

UA = "CentoireBot/1.0"


def cache(status, body=""):
    async def fetch(url):
        if isinstance(status, Exception):
            raise status
        return status, body

    return RobotsCache(fetch, UA)


async def test_disallow_rules_are_honoured_per_path():
    c = cache(200, "User-agent: *\nDisallow: /members/\n")
    assert await c.allowed("https://x.com/news/a")
    assert not await c.allowed("https://x.com/members/a")


async def test_agent_specific_rules_beat_the_wildcard():
    c = cache(200, "User-agent: CentoireBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n")
    assert not await c.allowed("https://x.com/anything")


@pytest.mark.parametrize("status,expected", [(404, True), (410, True), (403, True), (500, False), (503, False)])
async def test_missing_robots_allows_but_server_errors_do_not(status, expected):
    assert await cache(status).allowed("https://x.com/a") is expected


async def test_network_failure_is_treated_as_disallowed():
    assert await cache(ConnectionError("down")).allowed("https://x.com/a") is False


async def test_robots_is_fetched_once_per_origin():
    calls = []

    async def fetch(url):
        calls.append(url)
        return 200, "User-agent: *\nAllow: /\n"

    c = RobotsCache(fetch, UA)
    for path in ("a", "b", "c"):
        await c.allowed(f"https://x.com/{path}")
    await c.allowed("https://y.com/a")
    assert calls == ["https://x.com/robots.txt", "https://y.com/robots.txt"]


async def test_limiter_spaces_requests_per_host_only(real_limiter):
    now = [100.0]
    sleeps = []

    async def sleep(seconds):
        sleeps.append(round(seconds, 3))
        now[0] += seconds

    limiter = real_limiter(rps=2, clock=lambda: now[0], sleep=sleep)
    await limiter.wait("https://a.com/1")
    await limiter.wait("https://a.com/2")  # must wait 0.5s
    await limiter.wait("https://b.com/1")  # different host: no wait
    assert sleeps == [0.5]
