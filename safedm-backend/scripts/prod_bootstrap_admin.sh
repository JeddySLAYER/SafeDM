#!/usr/bin/env bash
# Crée (ou promeut) le compte administrateur dans la base pointée par
# DATABASE_URL, puis vérifie que l'API de production accepte la connexion et
# que le compte porte bien le rôle admin.
#
# Usage :
#   export DATABASE_URL='postgresql+psycopg2://…?sslmode=require'
#   export ADMIN_USERNAME='admin'
#   export ADMIN_PASSWORD='…'
#   ./scripts/prod_bootstrap_admin.sh
#
# Variables optionnelles :
#   API_BASE  — base de l'API testée (défaut : la prod FastAPI Cloud)
#
# Pourquoi : le dashboard n'accepte que les comptes admin
# (AuthContext : isAuthenticated = token && user.is_admin). Un compte créé
# uniquement en base locale n'existe pas en prod, et la connexion échoue
# avec un message qui ressemble à un refus d'identifiants.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_BASE="${API_BASE:-https://safedmnew-back.fastapicloud.dev/api/v1}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERREUR : DATABASE_URL absent." >&2
  echo "  export DATABASE_URL='postgresql+psycopg2://…?sslmode=require'" >&2
  exit 1
fi

if [ -z "${ADMIN_USERNAME:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "ERREUR : ADMIN_USERNAME et ADMIN_PASSWORD doivent être définis." >&2
  exit 1
fi

case "$DATABASE_URL" in
  *localhost*|*127.0.0.1*)
    echo "ATTENTION : DATABASE_URL pointe sur une base locale — l'admin créé"
    echo "ne sera pas visible par le dashboard en ligne." >&2
    ;;
esac

echo "→ Création / promotion de l'admin « ${ADMIN_USERNAME} »"
uv run python -m scripts.seed_admin

echo "→ Vérification de la connexion sur ${API_BASE}"
payload="$(uv run python - <<'PY'
import json
import os

print(json.dumps({
    "username": os.environ["ADMIN_USERNAME"],
    "password": os.environ["ADMIN_PASSWORD"],
}))
PY
)"

response="$(printf '%s' "$payload" | curl -sS -m 30 -w $'\n%{http_code}' \
  -X POST "${API_BASE}/auth/login" \
  -H 'Content-Type: application/json' \
  --data @-)"
status="${response##*$'\n'}"
body="${response%$'\n'*}"

if [ "$status" != "200" ]; then
  echo "ERREUR : connexion refusée (HTTP ${status})." >&2
  echo "${body}" >&2
  exit 1
fi

read -r token is_admin <<<"$(printf '%s' "$body" | uv run python -c '
import json
import sys

data = json.load(sys.stdin)
print(data["access_token"], data["user"]["is_admin"])
')"

if [ "$is_admin" != "True" ]; then
  echo "ERREUR : le compte n'a pas le rôle admin (is_admin=${is_admin})." >&2
  exit 1
fi

echo "→ Vérification d'un endpoint admin (GET /admin/stats)"
status="$(curl -sS -m 30 -o /dev/null -w '%{http_code}' \
  "${API_BASE}/admin/stats" \
  -H "Authorization: Bearer ${token}")"

if [ "$status" != "200" ]; then
  echo "ERREUR : endpoint admin refusé (HTTP ${status})." >&2
  exit 1
fi

echo "OK : « ${ADMIN_USERNAME} » est admin en production, le dashboard peut se connecter."
