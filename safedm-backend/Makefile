.PHONY: help install dev-install test lint format train evaluate serve migrate docker-up docker-down feature-parity scripts run-script

UV ?= uv
PYTHON ?= $(UV) run python

# Scripts exécutables en ligne de commande (allowlist partagée avec
# .github/workflows/run-script.yml).
SCRIPT_ALLOWLIST := seed_admin promote_admin seed_applications seed_guide verify_schema purge_inactive_fingerprints

help:
	@echo "SafeDM backend — commandes utiles"
	@echo "  make install       - uv sync (deps runtime)"
	@echo "  make dev-install   - uv sync --group dev"
	@echo "  make test          - pytest (exclut jev_benchmark)"
	@echo "  make lint          - ruff check ml + helpers hardening"
	@echo "  make format        - ruff format ml + helpers"
	@echo "  make train         - entraîner + registry (artefact JSON signé)"
	@echo "  make evaluate      - métriques CV + smoke features"
	@echo "  make feature-parity - alias evaluate (parity 50-dim)"
	@echo "  make serve         - uvicorn app.main:app --reload"
	@echo "  make migrate       - alembic upgrade head"
	@echo "  make docker-up     - postgres + api"
	@echo "  make docker-down   - stop compose"
	@echo "  make scripts       - lister les scripts exécutables"
	@echo "  make run-script SCRIPT=seed_admin ARGS=\"user mdp\""
	@echo "                     - exécuter un script sur la base courante"

install:
	$(UV) sync

dev-install:
	$(UV) sync --group dev

test:
	$(UV) run pytest -q

# Lint scoped to ML package + new hardening helpers (FastAPI Depends = B008 noise).
lint:
	$(UV) run ruff check ml app/core/rate_limit.py app/core/logging_setup.py

format:
	$(UV) run ruff format ml app/core/rate_limit.py app/core/logging_setup.py

train:
	$(PYTHON) scripts/train_local_model.py --out models/artifacts/trained_models/safedm_local_patch.json

evaluate:
	$(PYTHON) scripts/evaluate_model.py --json-out outputs/reports/last_evaluate.json

feature-parity: evaluate

serve:
	$(UV) run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

migrate:
	$(UV) run alembic upgrade head

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

# Liste les scripts exécutables (make run-script SCRIPT=...)
scripts:
	@for s in $(SCRIPT_ALLOWLIST); do \
		echo "  $$s"; \
	done

# Exécute un script de l'allowlist sur la base courante (DATABASE_URL de
# l'environnement). Pour la production : exporter DATABASE_URL puis
# DATABASE_URL='postgresql+psycopg2://…?sslmode=require' make run-script …
run-script:
	@if [ -z "$(SCRIPT)" ]; then \
		echo "usage: make run-script SCRIPT=<$(SCRIPT_ALLOWLIST)> [ARGS=\"...\"]"; \
		exit 1; \
	fi
	@case " $(SCRIPT_ALLOWLIST) " in \
		*" $(SCRIPT) "*) ;; \
		*) echo "Script non autorisé : $(SCRIPT)"; exit 1 ;; \
	esac
	$(PYTHON) -m scripts.$(SCRIPT) $(ARGS)
