import os
import platform
import time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from . import __version__
from .provider import Mock, Ollama
from .suites import CASES, SUITE_HASH, build_prompt, digest, evaluate


class RunConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: Literal["mock", "ollama"] = "ollama"
    model: str = Field(min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9_.:/-]+$")
    temperature: float = Field(default=0, ge=0, le=2)
    seed: int = Field(default=42, ge=0, le=2147483647)
    top_k: int = Field(default=2, ge=1, le=3)


def enqueue(store, config):
    return store.create(
        {
            "schema_version": 1,
            "suite_hash": SUITE_HASH,
            "app_version": __version__,
            "config": config.model_dump(),
            "synthetic": config.provider == "mock",
            "hardware": {"system": platform.system(), "machine": platform.machine()},
            "limitations": [
                "10 synthetic cases; not representative",
                "Exact-match grading, not semantic entailment",
                "Policy tool execution is simulated",
                "No GPU/RAM telemetry in v0.1",
            ],
        }
    )


def work_once(store):
    claim = store.claim()
    if not claim:
        return None
    report, owner = claim
    try:
        if report["suite_hash"] != SUITE_HASH:
            raise ValueError("Suite changed: enqueue a new run")
        config = report["config"]
        provider = (
            Mock()
            if config["provider"] == "mock"
            else Ollama(os.getenv("OLLAMA_URL", "http://127.0.0.1:11434"))
        )
        runtime = provider.metadata(config["model"])
        if report.get("runtime") and report["runtime"] != runtime:
            raise ValueError("Model/runtime changed during resumed run")
        report["runtime"] = runtime
        store.save(report, owner)
        completed = {r["id"] for r in report["results"]}
        for case in CASES:
            if case["id"] in completed:
                continue
            messages, sources = build_prompt(case, config["top_k"])
            started = time.perf_counter()
            try:
                raw, metrics = provider.generate(messages, config, case)
                result = evaluate(case, raw, sources)
                result["metrics"] = metrics
            except Exception as exc:
                result = {
                    "passed": False,
                    "checks": {},
                    "output": None,
                    "decision": None,
                    "error": type(exc).__name__,
                }
            report["results"].append(
                {
                    **result,
                    "id": case["id"],
                    "suite": case["suite"],
                    "latency_ms": round((time.perf_counter() - started) * 1000, 2),
                    "prompt_hash": digest(messages),
                    "sources": sources,
                    "expected": case["expected"],
                }
            )
            store.save(report, owner)
        if provider.metadata(config["model"]) != runtime:
            raise ValueError("Model/runtime changed during evaluation")
        report["status"] = "completed"
    except Exception as exc:
        report["status"] = "failed"
        report["error"] = type(exc).__name__
    store.save(report, owner)
    return report


def compare(a, b):
    if a["status"] != "completed" or b["status"] != "completed":
        raise ValueError("Only completed runs can be compared")
    if a["suite_hash"] != b["suite_hash"] or a["synthetic"] != b["synthetic"]:
        raise ValueError("Incompatible suite or synthetic/real provenance")
    before = {r["id"]: r for r in a["results"]}
    after = {r["id"]: r for r in b["results"]}
    if before.keys() != after.keys():
        raise ValueError("Different case sets")
    return {
        "baseline": a["id"],
        "candidate": b["id"],
        "regressions": [
            key for key in before if before[key]["passed"] and not after[key]["passed"]
        ],
        "improvements": [
            key for key in before if not before[key]["passed"] and after[key]["passed"]
        ],
    }
