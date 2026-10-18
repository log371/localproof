FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY localproof ./localproof
RUN uv sync --frozen --no-dev --no-editable && useradd --uid 10001 --create-home runner
ENV PATH="/app/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER 10001:10001
CMD ["uvicorn", "localproof.api:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
