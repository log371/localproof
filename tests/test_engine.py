import json
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import update

from localproof.engine import RunConfig, compare, enqueue, work_once
from localproof.provider import validate_url
from localproof.storage import Store, runs
from localproof.suites import CASES, build_prompt, evaluate


@pytest.fixture
def store(tmp_path):
    db = Store(f"sqlite:///{tmp_path}/test.db")
    yield db
    db.engine.dispose()


def completed(store, model="demo-reference"):
    report = enqueue(store, RunConfig(provider="mock", model=model))
    work_once(store)
    return store.get(report["id"])


def test_reference_and_regressions(store):
    a = completed(store)
    b = completed(store, "demo-regression")
    assert a["status"] == "completed"
    assert len(a["results"]) == 10
    assert all(r["passed"] for r in a["results"])
    assert compare(a, b)["regressions"] == ["rag-unknown", "extract-zero", "policy-shell"]
    assert len(compare(b, a)["improvements"]) == 3
    assert work_once(store) is None


def test_comparison_provenance(store):
    a, b = completed(store), completed(store)
    b["synthetic"] = False
    with pytest.raises(ValueError):
        compare(a, b)
    b["synthetic"] = True
    b["suite_hash"] = "different"
    with pytest.raises(ValueError):
        compare(a, b)
    b["suite_hash"] = a["suite_hash"]
    b["results"] = []
    with pytest.raises(ValueError):
        compare(a, b)
    b["status"] = "running"
    with pytest.raises(ValueError):
        compare(a, b)


@pytest.mark.parametrize(
    "raw", ['{"id":"E-105","category":"contrôle","minutes":false}', "[]", "null", "{bad", "{}"]
)
def test_extraction_strict(raw):
    assert not evaluate(CASES[4], raw, [])["passed"]


def test_citation_must_be_retrieved():
    assert not evaluate(CASES[0], json.dumps(CASES[0]["expected"]), [])["passed"]


def test_policy_never_executes():
    result = evaluate(CASES[7], '{"action":"shell","command":"whoami"}', [])
    assert result["decision"] == "deny"
    assert not result["passed"]


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com",
        "http://169.254.169.254",
        "http://localhost@evil.com",
        "http://127.0.0.1/path",
        "http://127.0.0.1?x=1",
        "file:///etc/passwd",
    ],
)
def test_remote_url_denied(url):
    with pytest.raises(ValueError):
        validate_url(url)


def test_prompt_does_not_include_expected():
    messages, _ = build_prompt(CASES[3], 2)
    assert "expected" not in json.dumps(messages)


def test_claim_exclusion_and_resume(store):
    report = enqueue(store, RunConfig(provider="mock", model="demo-reference"))
    first, owner = store.claim()
    assert store.claim() is None
    first["results"] = [{"id": CASES[0]["id"], "passed": True}]
    store.save(first, owner)
    with store.engine.begin() as conn:
        conn.execute(update(runs).where(runs.c.id == report["id"]).values(lease="2000"))
    result = work_once(store)
    assert result["status"] == "completed"
    assert len(result["results"]) == 10
    assert len({r["id"] for r in result["results"]}) == 10
    with pytest.raises(RuntimeError):
        store.save(first, owner)


def test_concurrent_claim(store):
    enqueue(store, RunConfig(provider="mock", model="demo-reference"))
    with ThreadPoolExecutor(2) as pool:
        claimed = list(pool.map(lambda _: store.claim(), range(2)))
    assert sum(c is not None for c in claimed) == 1


def test_provider_error_recorded(store, monkeypatch):
    from localproof.provider import Mock

    def broken(*args):
        raise TimeoutError("secret should not be logged")

    monkeypatch.setattr(Mock, "generate", broken)
    report = completed(store)
    assert all(r["error"] == "TimeoutError" and not r["passed"] for r in report["results"])
    assert "secret" not in json.dumps(report)


def test_config_rejects_extra_and_invalid():
    for kwargs in [{"url": "http://evil"}, {"temperature": -1}, {"top_k": 9}]:
        with pytest.raises(ValueError):
            RunConfig(model="demo", **kwargs)
