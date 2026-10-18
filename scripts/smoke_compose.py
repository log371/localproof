"""Disposable integration test: HTTP -> queue -> worker -> Postgres -> backup/restore."""

import json
import os
import secrets
import subprocess
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
env = {
    **os.environ,
    "POSTGRES_PASSWORD": secrets.token_hex(32),
    "LOCALPROOF_TOKEN": secrets.token_hex(32),
}
project = "localproof-check-" + secrets.token_hex(3)
base = ["docker", "compose", "-p", project]


def docker(*args, data=None):
    return subprocess.run(
        [*base, *args],
        cwd=ROOT,
        env=env,
        input=data,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    ).stdout


def main():
    try:
        print("Building and starting disposable Compose stack", flush=True)
        docker("up", "--build", "-d")
        with httpx.Client(base_url="http://127.0.0.1:3080", trust_env=False, timeout=15) as client:
            for _ in range(60):
                try:
                    if client.get("/api/health").status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(1)
            assert client.get("/").status_code == 200
            assert client.get("/api/runs").status_code == 401
            headers = {"Authorization": "Bearer " + env["LOCALPROOF_TOKEN"]}
            ids = []
            for model in ["demo-reference", "demo-regression"]:
                response = client.post(
                    "/api/runs", headers=headers, json={"provider": "mock", "model": model}
                )
                assert response.status_code == 202, response.status_code
                ids.append(response.json()["id"])
            for _ in range(60):
                reports = [
                    client.get("/api/runs/" + run_id, headers=headers).json() for run_id in ids
                ]
                if all(r["status"] == "completed" for r in reports):
                    break
                time.sleep(1)
            assert all(r["status"] == "completed" for r in reports)
            diff = client.get(
                "/api/compare", headers=headers, params={"baseline": ids[0], "candidate": ids[1]}
            ).json()
            assert len(diff["regressions"]) == 3
            docker("restart", "api", "worker")
            for _ in range(30):
                try:
                    if client.get("/api/runs/" + ids[0], headers=headers).status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(1)
            assert (
                client.get("/api/runs/" + ids[0], headers=headers).json()["status"] == "completed"
            )
        backup = docker(
            "exec", "-T", "db", "pg_dump", "-U", "localproof", "-d", "localproof", "-Fc"
        )
        docker("exec", "-T", "db", "createdb", "-U", "localproof", "localproof_restore")
        docker(
            "exec",
            "-T",
            "db",
            "pg_restore",
            "-U",
            "localproof",
            "-d",
            "localproof_restore",
            data=backup,
        )
        count = docker(
            "exec",
            "-T",
            "db",
            "psql",
            "-U",
            "localproof",
            "-d",
            "localproof_restore",
            "-tAc",
            "SELECT count(*) FROM runs_v1;",
        )
        assert int(count.strip()) == 2
        print(
            json.dumps(
                {
                    "http": "pass",
                    "postgres": "pass",
                    "worker": "pass",
                    "restart": "pass",
                    "backup_restore": "pass",
                    "regressions": 3,
                }
            )
        )
    except subprocess.CalledProcessError as exc:
        # These commands never print env/secrets; bound diagnostics nevertheless.
        print(exc.stderr.decode(errors="replace")[-4000:])
        raise SystemExit(1) from None
    finally:
        docker("down", "--volumes", "--remove-orphans")


if __name__ == "__main__":
    main()
