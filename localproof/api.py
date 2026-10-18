import os
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from .engine import RunConfig, compare, enqueue
from .storage import Store


class BodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > 4096:
                response = JSONResponse({"detail": "Request too large"}, status_code=413)
                return await response(scope, receive, send)
            chunks.append(chunk)
            if not message.get("more_body"):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": b"".join(chunks), "more_body": False}

        await self.app(scope, replay, send)


def create_app(store=None, token=None):
    token = token or os.getenv("LOCALPROOF_TOKEN", "")

    @asynccontextmanager
    async def lifespan(app):
        if len(token) < 32:
            raise RuntimeError("LOCALPROOF_TOKEN must have at least 32 characters")
        app.state.store = store or Store()
        yield
        if store is None:
            app.state.store.engine.dispose()

    app = FastAPI(
        title="LocalProof",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "api", "testserver"]
    )
    app.add_middleware(BodyLimit)

    def auth(authorization: str = Header(default="")):
        if not secrets.compare_digest(authorization, "Bearer " + token) or len(token) < 32:
            raise HTTPException(401, "Authentication required")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/runs", dependencies=[Depends(auth)])
    def list_runs():
        return app.state.store.list()

    @app.post("/runs", status_code=202, dependencies=[Depends(auth)])
    def create_run(config: RunConfig):
        return enqueue(app.state.store, config)

    def get(run_id):
        report = app.state.store.get(run_id)
        if report is None:
            raise HTTPException(404, "Run not found")
        return report

    @app.get("/runs/{run_id}", dependencies=[Depends(auth)])
    def get_run(run_id: str):
        return get(run_id)

    @app.get("/compare", dependencies=[Depends(auth)])
    def compare_runs(baseline: str, candidate: str):
        try:
            return compare(get(baseline), get(candidate))
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from exc

    return app
