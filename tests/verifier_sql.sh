#!/usr/bin/env bash
# Applique toutes les migrations deux fois sur une base PostgreSQL vide
# (la seconde fois vérifie qu'elles peuvent être relancées sans erreur).
# Variables attendues : PGHOST, PGPORT, PGUSER, PGPASSWORD (facultatif), PGDATABASE.
set -euo pipefail
cd "$(dirname "$0")/.."
psql -v ON_ERROR_STOP=1 -q -f tests/mock_supabase.sql
for passe in 1 2; do
  for f in supabase/migrations/*.sql; do
    echo "passe $passe : $f"
    psql -v ON_ERROR_STOP=1 -q -f "$f" > /dev/null
  done
done
psql -tAc "select public.etat_public()"
psql -v ON_ERROR_STOP=1 -q -f tests/verifier_002.sql
echo "Migrations : OK"
