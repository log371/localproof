import argparse
import json
import time

from .engine import RunConfig, compare, enqueue, work_once
from .storage import Store


def main():
    parser = argparse.ArgumentParser(description="LocalProof — local evaluation runner")
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("run")
    run.add_argument("--provider", choices=["mock", "ollama"], default="ollama")
    run.add_argument("--model", required=True)
    run.add_argument("--top-k", type=int, default=2)
    worker = commands.add_parser("worker")
    worker.add_argument("--once", action="store_true")
    commands.add_parser("list")
    export = commands.add_parser("export")
    export.add_argument("id")
    diff = commands.add_parser("compare")
    diff.add_argument("baseline")
    diff.add_argument("candidate")
    args = parser.parse_args()
    store = Store()
    try:
        dispatch(args, parser, store)
    finally:
        store.engine.dispose()


def dispatch(args, parser, store):
    if args.command == "run":
        print(
            json.dumps(
                enqueue(
                    store, RunConfig(provider=args.provider, model=args.model, top_k=args.top_k)
                )
            )
        )
    elif args.command == "worker":
        while True:
            result = work_once(store)
            if result:
                print(json.dumps({"id": result["id"], "status": result["status"]}), flush=True)
            if args.once:
                break
            if not result:
                time.sleep(2)
    elif args.command == "list":
        print(
            json.dumps(
                [
                    {"id": r["id"], "status": r["status"], "model": r["config"]["model"]}
                    for r in store.list()
                ]
            )
        )
    elif args.command == "export":
        report = store.get(args.id)
        if report is None:
            parser.error("Unknown run")
        print(json.dumps(report, ensure_ascii=False, indent=2))
    elif args.command == "compare":
        a, b = store.get(args.baseline), store.get(args.candidate)
        if a is None or b is None:
            parser.error("Unknown run")
        print(json.dumps(compare(a, b), indent=2))


if __name__ == "__main__":
    main()
