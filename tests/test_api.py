import pytest
from fastapi.testclient import TestClient

from localproof.api import create_app
from localproof.engine import work_once
from localproof.storage import Store

TOKEN = "test-only-token-" * 4


@pytest.fixture
def client(tmp_path):
    store = Store(f"sqlite:///{tmp_path}/test.db")
    with TestClient(create_app(store, TOKEN)) as client:
        yield client, store
    store.engine.dispose()


def test_auth_and_lifecycle(client):
    c, store = client
    assert c.get("/health").status_code == 200
    assert c.get("/runs").status_code == 401
    headers = {"Authorization": "Bearer " + TOKEN}
    a = c.post("/runs", headers=headers, json={"provider": "mock", "model": "demo-reference"})
    assert a.status_code == 202
    assert c.get("/runs/missing", headers=headers).status_code == 404
    assert (
        c.get(
            "/compare",
            headers=headers,
            params={"baseline": a.json()["id"], "candidate": a.json()["id"]},
        ).status_code
        == 409
    )
    work_once(store)
    assert c.get("/runs/" + a.json()["id"], headers=headers).json()["status"] == "completed"
    assert (
        c.get(
            "/compare",
            headers=headers,
            params={"baseline": a.json()["id"], "candidate": a.json()["id"]},
        ).json()["regressions"]
        == []
    )


def test_body_host_and_schema(client):
    c, _ = client
    headers = {"Authorization": "Bearer " + TOKEN}
    assert c.post("/runs", content="x" * 5000, headers=headers).status_code == 413
    assert (
        c.post("/runs", json={"model": "a", "url": "http://evil"}, headers=headers).status_code
        == 422
    )
    assert c.get("/health", headers={"Host": "evil.example"}).status_code == 400
    assert (
        c.options("/runs", headers={"Origin": "https://evil.example"}).headers.get(
            "access-control-allow-origin"
        )
        is None
    )


def test_short_secret_fails_startup():
    with pytest.raises(RuntimeError), TestClient(create_app(token="short")):
        pass
