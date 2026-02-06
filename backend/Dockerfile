FROM python:3.11-slim

WORKDIR /app

RUN wget -O - https://chsrc.run/posix | bash \
  && (chsrc set debian || true) && (chsrc set pip || true)

# Speed up apt using chsrc (best-effort). If it fails, continue with default sources.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates

COPY pyproject.toml /app/pyproject.toml

RUN pip install --no-cache-dir -U pip \
  && pip install --no-cache-dir .

COPY app /app/app

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
