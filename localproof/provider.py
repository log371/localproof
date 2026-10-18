import json
from urllib.parse import urlsplit

import httpx


def validate_url(url):
    parsed = urlsplit(url)
    if (
        parsed.scheme != "http"
        or parsed.hostname
        not in {"127.0.0.1", "::1", "localhost", "ollama", "host.docker.internal"}
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
    ):
        raise ValueError("Ollama must use an explicitly permitted local HTTP origin")
    return url.rstrip("/")


class Ollama:
    def __init__(self, url):
        self.url = validate_url(url)

    def request(self, method, path, body=None):
        with httpx.Client(timeout=120, follow_redirects=False, trust_env=False) as client:
            with client.stream(method, self.url + path, json=body) as response:
                response.raise_for_status()
                chunks, size = [], 0
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > 1024 * 1024:
                        raise ValueError("Ollama response too large")
                    chunks.append(chunk)
        return json.loads(b"".join(chunks))

    def metadata(self, model):
        version = self.request("GET", "/api/version")["version"]
        models = self.request("GET", "/api/tags")["models"]
        matches = [m for m in models if m.get("name") == model or m.get("model") == model]
        if not matches:
            raise ValueError("Model not installed: specify its exact local name including tag")
        return {
            "runtime": version,
            "model_digest": matches[0].get("digest"),
            "digest_kind": "ollama-manifest",
        }

    def generate(self, messages, config, case):
        data = self.request(
            "POST",
            "/api/chat",
            {
                "model": config["model"],
                "messages": messages,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": config["temperature"],
                    "seed": config["seed"],
                    "num_predict": 256,
                    "num_ctx": 4096,
                },
            },
        )
        if not data.get("done"):
            raise ValueError("Incomplete model response")
        return data["message"]["content"], {
            "tokens": data.get("eval_count"),
            "generation_ns": data.get("eval_duration"),
        }


class Mock:
    def metadata(self, model):
        return {"runtime": "deterministic-fixture", "model_digest": None, "digest_kind": None}

    def generate(self, messages, config, case):
        # Deliberate reference fixtures; these do not measure model intelligence.
        output = dict(case["expected"])
        if config["model"] == "demo-regression" and case["id"] in {
            "rag-unknown",
            "extract-zero",
            "policy-shell",
        }:
            output = {"unexpected": "deliberately broken fixture"}
        return json.dumps(output, ensure_ascii=False), {"tokens": None, "generation_ns": None}
