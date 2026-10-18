import json
import sys

from localproof.cli import main


def test_cli(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/cli.db")

    def call(*args):
        monkeypatch.setattr(sys, "argv", ["localproof", *args])
        main()
        return capsys.readouterr().out

    report = json.loads(call("run", "--provider", "mock", "--model", "demo-reference"))
    call("worker", "--once")
    assert len(json.loads(call("list"))) == 1
    assert json.loads(call("export", report["id"]))["status"] == "completed"
    assert json.loads(call("compare", report["id"], report["id"]))["regressions"] == []
