import json

import httpx
import pytest

from localproof.provider import Ollama


def test_metadata_and_request(monkeypatch):
    real_client = httpx.Client

    def handler(request):
        if request.url.path == "/api/version":
            return httpx.Response(200, json={"version": "test"})
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "test:latest", "digest": "abc"}]})
        body = json.loads(request.content)
        assert body["stream"] is False
        return httpx.Response(200, json={"done": True, "message": {"content": "{}"}})

    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    provider = Ollama("http://127.0.0.1:11434")
    assert provider.metadata("test:latest")["model_digest"] == "abc"
    with pytest.raises(ValueError):
        provider.metadata("missing")
    assert (
        provider.generate([], {"model": "test:latest", "temperature": 0, "seed": 1}, {})[0] == "{}"
    )


@pytest.mark.parametrize(
    "status,body", [(302, b"redirect"), (200, b"x" * (1024 * 1024 + 1)), (200, b"invalid-json")]
)
def test_response_rejected(monkeypatch, status, body):
    real_client = httpx.Client
    monkeypatch.setattr(
        httpx,
        "Client",
        lambda **kwargs: real_client(
            transport=httpx.MockTransport(lambda _: httpx.Response(status, content=body)), **kwargs
        ),
    )
    with pytest.raises((ValueError, httpx.HTTPError)):
        Ollama("http://localhost:11434").request("GET", "/api/tags")
