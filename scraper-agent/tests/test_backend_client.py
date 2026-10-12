import httpx
import pytest
import respx

from scraper_agent.backend_client import BackendClient, BackendError

BASE = "http://backend.test/api/v1/internal/scrape"


@pytest.fixture
def client(settings):
    return BackendClient(settings)


@respx.mock
async def test_requests_carry_the_secret_and_worker_id(client):
    route = respx.post(f"{BASE}/jobs/lease").mock(return_value=httpx.Response(204))
    assert await client.lease(["scrape"]) is None
    request = route.calls.last.request
    assert request.headers["x-scraper-secret"] == "test-secret"
    assert request.content == b'{"workerId":"test-worker","types":["scrape"]}'


@respx.mock
async def test_lease_parses_the_job_and_source(client):
    respx.post(f"{BASE}/jobs/lease").mock(return_value=httpx.Response(200, json={
        "job": {"id": "j1", "type": "discover", "attempts": 2},
        "source": {"id": "s1", "name": "Site", "spec": {"status": "none", "store": "excerpt"}},
    }))
    job = await client.lease()
    assert (job.id, job.type, job.attempts, job.source_id) == ("j1", "discover", 2, "s1")


@respx.mock
async def test_server_errors_are_retried_then_succeed(client, monkeypatch):
    async def no_sleep(_):
        return None

    monkeypatch.setattr("scraper_agent.backend_client.asyncio.sleep", no_sleep)
    route = respx.post(f"{BASE}/jobs/j1/heartbeat").mock(side_effect=[httpx.Response(503), httpx.Response(502), httpx.Response(204)])
    await client.heartbeat("j1")
    assert route.call_count == 3


@respx.mock
async def test_client_errors_are_not_retried_and_carry_the_servers_message(client):
    route = respx.post(f"{BASE}/jobs/j1/complete").mock(return_value=httpx.Response(409, json={"detail": "Job is not leased to this worker"}))
    with pytest.raises(BackendError) as err:
        await client.complete("j1", ok=True)
    assert err.value.status == 409 and "not leased" in err.value.detail
    assert route.call_count == 1


@respx.mock
async def test_network_failures_give_up_with_a_clear_error(client, monkeypatch):
    async def no_sleep(_):
        return None

    monkeypatch.setattr("scraper_agent.backend_client.asyncio.sleep", no_sleep)
    respx.post(f"{BASE}/jobs/lease").mock(side_effect=httpx.ConnectError("refused"))
    with pytest.raises(BackendError, match="unreachable"):
        await client.lease()


@respx.mock
async def test_dedupe_checks_are_batched_in_200s(client):
    route = respx.post(f"{BASE}/posts/exists").mock(return_value=httpx.Response(200, json={"existing": ["https://x.com/0"]}))
    found = await client.existing_urls([f"https://x.com/{i}" for i in range(450)])
    assert route.call_count == 3 and found == {"https://x.com/0"}


@respx.mock
async def test_upsert_maps_the_response_and_complete_sends_camel_case(client):
    respx.put(f"{BASE}/posts").mock(return_value=httpx.Response(201, json={"outcome": "created", "postId": "p1", "status": "pending_review"}))
    result = await client.upsert_post("s1", {"url": "https://x.com/a", "title": "T"})
    assert (result.outcome, result.post_id) == ("created", "p1")
    route = respx.post(f"{BASE}/jobs/j1/complete").mock(return_value=httpx.Response(204))
    await client.complete("j1", ok=False, stats={"itemsSeen": 3}, error_code="layout_changed", error_message="x" * 5000)
    body = route.calls.last.request.read().decode()
    assert '"errorCode":"layout_changed"' in body and '"ok":false' in body
    assert len(body) < 2500  # the message was truncated
