# Backend architecture (pointer)

SafeDM backend keeps a **FastAPI runtime** under `app/` and an **offline ML**
package under `ml/`.

```text
app/          API, services, ORM, runtime FastText helpers
ml/           train / evaluate / registry (no request path)
config/       model.yaml
models/       artefacts + model_registry.json
deployment/   Dockerfile.api
```

Product architecture and privacy contracts for the monorepo live in
[`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) and
[`../../docs/SECURITY.md`](../../docs/SECURITY.md).

## Runbook (local)

```bash
make docker-up    # postgres + api image
make migrate
make serve        # or use compose api on :8000
make test
```

Health:

- `GET /api/v1/health` — liveness
- `GET /api/v1/health/ready` — DB ping (503 if down)
