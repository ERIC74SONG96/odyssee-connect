#!/usr/bin/env bash
# Test de charge (issue #7) : N inscriptions simultanées sur une base de TEST vide.
# Usage : ODC_BASE_DE_TEST=oui PGHOST=… PGDATABASE=… tests/test_de_charge.sh [quota] [clients] [envois_par_client]
# Vérifie : exactement « quota » inscriptions acceptées, aucune référence en double.
set -euo pipefail
cd "$(dirname "$0")/.."
[ "${ODC_BASE_DE_TEST:-}" = "oui" ] || { echo "Refusé : ne tourne que sur une base de test (ODC_BASE_DE_TEST=oui)."; exit 1; }
QUOTA=${1:-3000}; CLIENTS=${2:-100}; ENVOIS=${3:-40}
n=$(psql -tAc "select count(*) from public.inscriptions")
[ "$n" = "0" ] || { echo "Refusé : la base contient déjà $n inscriptions (base de test vide attendue)."; exit 1; }
psql -qc "update public.reglages_inscriptions set ouvertes = true, quota = $QUOTA where id = 1"
PGBENCH=$(command -v pgbench || ls /usr/lib/postgresql/*/bin/pgbench | tail -1)
echo "$((CLIENTS * ENVOIS)) envois par $CLIENTS clients simultanés pour $QUOTA places…"
"$PGBENCH" -n -f tests/charge/inscription.sql -c "$CLIENTS" -j 8 -t "$ENVOIS" 2>&1 \
  | grep -E "^(number of transactions actually|latency average|tps)" || true
read -r total refs <<<"$(psql -tAc "select count(*), count(distinct reference) from public.inscriptions" | tr '|' ' ')"
attendu=$(( QUOTA < CLIENTS * ENVOIS ? QUOTA : CLIENTS * ENVOIS ))
[ "$total" = "$attendu" ] || { echo "ÉCHEC : $total inscriptions acceptées, $attendu attendues"; exit 1; }
[ "$refs" = "$total" ] || { echo "ÉCHEC : références en double"; exit 1; }
echo "ok  $total inscriptions acceptées pour $QUOTA places, aucune référence en double"
psql -qc "update public.reglages_inscriptions set ouvertes = false where id = 1"
