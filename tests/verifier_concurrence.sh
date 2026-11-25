#!/usr/bin/env bash
# Test de concurrence réel : plusieurs connexions PostgreSQL en parallèle.
#  1. 20 inscriptions simultanées pour 5 places : exactement 5 acceptées.
#  2. Un même identifiant de transaction déclaré en même temps pour une inscription
#     et pour un don : une seule déclaration acceptée.
# Laisse la base comme avant (lignes de test supprimées, inscriptions refermées).
set -euo pipefail
cd "$(dirname "$0")/.."
q() { psql -v ON_ERROR_STOP=1 -qtAX "$@"; }
nettoyer() {
  q -c "delete from public.inscriptions where nom = 'Concurrence'; delete from public.dons where nom = 'Concurrence';
        update public.reglages_inscriptions set ouvertes = false, quota = 3000, message = null where id = 1;" >/dev/null
}
trap nettoyer EXIT
nettoyer
avant=$(q -c "select count(*) from public.inscriptions where statut <> 'annule'")
q -c "update public.reglages_inscriptions set ouvertes = true, quota = $((avant + 5)) where id = 1" >/dev/null

for i in $(seq 1 20); do
  ( psql -qtAX -c "set role anon; select reference from public.creer_inscription(jsonb_build_object(
      'nom','Concurrence','prenom','P$i','telephone','+2376991$(printf '%05d' "$i")','email','c$i@exemple.cm','sexe','F',
      'distance','5','categorie','etudiant','urgence_nom','U','urgence_tel','+237699200000','consentement',true,
      'consentement_version','2026-11-25','date_naissance','1990-01-01','cle_envoi',gen_random_uuid()))" >/dev/null 2>&1 || true ) &
done
wait
n=$(q -c "select count(*) from public.inscriptions where nom = 'Concurrence'")
if [ "$n" != "5" ]; then echo "ÉCHEC : $n inscriptions acceptées pour 5 places"; exit 1; fi
echo "ok  20 envois simultanés, 5 places : $n acceptées"

ref_i=$(q -c "select reference from public.inscriptions where nom = 'Concurrence' order by created_at limit 1")
tel_i=$(q -c "select telephone from public.inscriptions where reference = '$ref_i'")
ref_d=$(q -c "set role anon; select reference from public.creer_don('{\"montant\":1000,\"nom\":\"Concurrence\",\"telephone\":\"+237699300000\"}'::jsonb)" | tail -1)
for k in 1 2 3 4 5; do
  ( psql -qtAX -c "set role anon; select public.declarer_paiement('$ref_i', '$tel_i', 'mtn', 'CONC-TX-1')" >/dev/null 2>&1 || true ) &
  ( psql -qtAX -c "set role anon; select public.declarer_don('$ref_d', '+237699300000', 'mtn', 'CONC-TX-1')" >/dev/null 2>&1 || true ) &
done
wait
m=$(q -c "select (select count(*) from public.inscriptions where transaction_id = 'CONC-TX-1') + (select count(*) from public.dons where transaction_id = 'CONC-TX-1')")
if [ "$m" != "1" ]; then echo "ÉCHEC : identifiant de transaction déclaré $m fois"; exit 1; fi
echo "ok  même transaction déclarée en parallèle (inscription et don) : acceptée une seule fois"
echo "Concurrence : OK"
