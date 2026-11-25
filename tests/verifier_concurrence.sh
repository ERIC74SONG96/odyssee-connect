#!/usr/bin/env bash
# Test de concurrence réel : plusieurs connexions PostgreSQL en parallèle.
#  1. 20 inscriptions simultanées pour 5 places : exactement 5 acceptées,
#     les 15 autres refusées avec le motif « Complet ».
#  2. Un même identifiant de transaction déclaré en même temps pour une inscription (5 fois)
#     et pour un don (5 fois) : un seul des deux paiements l'obtient ; les répétitions pour ce
#     même paiement sont acceptées (déclaration idempotente) ; toutes les déclarations pour
#     l'autre sont refusées avec le motif « identifiant déjà déclaré ».
#
# DESTRUCTIF : ouvre et referme les inscriptions, supprime ses lignes de test.
# Ne tourne que sur une base de test vide, déclarée comme telle : ODC_BASE_DE_TEST=oui.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${ODC_BASE_DE_TEST:-}" != "oui" ]; then
  echo "Refusé : ce test modifie la base. Lancez-le seulement sur une base de test, avec ODC_BASE_DE_TEST=oui."
  exit 2
fi
q() { psql -v ON_ERROR_STOP=1 -qtAX "$@"; }
deja=$(q -c "select (select count(*) from public.inscriptions) + (select count(*) from public.dons)")
if [ "$deja" != "0" ]; then
  echo "Refusé : la base contient déjà $deja inscriptions ou dons. Ce test ne tourne que sur une base de test vide."
  exit 2
fi

dossier=$(mktemp -d)
nettoyer() {
  q -c "delete from public.inscriptions where nom = 'Concurrence'; delete from public.dons where nom = 'Concurrence';
        update public.reglages_inscriptions set ouvertes = false, quota = 3000, message = null where id = 1;" >/dev/null
  rm -rf "$dossier"
}
trap nettoyer EXIT

# Lance une requête en tâche de fond ; garde son code de sortie et son message d'erreur.
lancer() {  # nom, sql
  ( set +e; psql -qtAX -v ON_ERROR_STOP=1 -c "$2" >"$dossier/$1.out" 2>"$dossier/$1.err"; echo $? >"$dossier/$1.code" ) &
}
reussis() { { grep -lx 0 "$dossier"/$1*.code 2>/dev/null || true; } | wc -l | tr -d ' '; }
# Vérifie que chaque échec d'un groupe porte bien le motif attendu
motifs() {  # préfixe, motif
  local f
  for f in "$dossier"/$1*.code; do
    if [ "$(cat "$f")" != "0" ] && ! grep -q "$2" "${f%.code}.err"; then
      echo "ÉCHEC : refus inattendu ($(basename "${f%.code}")) : $(tr '\n' ' ' < "${f%.code}.err")"; exit 1
    fi
  done
}

# 1. Quota
q -c "update public.reglages_inscriptions set ouvertes = true, quota = 5 where id = 1" >/dev/null
for i in $(seq 1 20); do
  lancer "ins$i" "set role anon; select reference from public.creer_inscription(jsonb_build_object(
      'nom','Concurrence','prenom','P$i','telephone','+2376991$(printf '%05d' "$i")','email','c$i@exemple.cm','sexe','F',
      'distance','5','categorie','etudiant','urgence_nom','U','urgence_tel','+237699200000','consentement',true,
      'consentement_version','2026-11-25','date_naissance','1990-01-01','cle_envoi',gen_random_uuid()))"
done
wait
ok=$(reussis ins); motifs ins "Complet"
n=$(q -c "select count(*) from public.inscriptions where nom = 'Concurrence'")
if [ "$ok" != "5" ] || [ "$n" != "5" ]; then echo "ÉCHEC : $ok envois réussis, $n inscriptions en base, pour 5 places"; exit 1; fi
echo "ok  20 envois simultanés pour 5 places : 5 acceptés, 15 refusés « Complet »"

# 2. Même identifiant de transaction, inscription contre don
ref_i=$(q -c "select reference from public.inscriptions where nom = 'Concurrence' order by created_at limit 1")
tel_i=$(q -c "select telephone from public.inscriptions where reference = '$ref_i'")
ref_d=$(q -c "set role anon; select reference from public.creer_don('{\"montant\":1000,\"nom\":\"Concurrence\",\"telephone\":\"+237699300000\"}'::jsonb)" | tail -1)
for k in 1 2 3 4 5; do
  lancer "pi$k" "set role anon; select public.declarer_paiement('$ref_i', '$tel_i', 'mtn', 'CONC-TX-1')"
  lancer "pd$k" "set role anon; select public.declarer_don('$ref_d', '+237699300000', 'mtn', 'CONC-TX-1')"
done
wait
oi=$(reussis pi); od=$(reussis pd)
motifs pi "identifiant de transaction est déjà déclaré"; motifs pd "identifiant de transaction est déjà déclaré"
if ! { [ "$oi" = "5" ] && [ "$od" = "0" ]; } && ! { [ "$oi" = "0" ] && [ "$od" = "5" ]; }; then
  echo "ÉCHEC : inscription $oi/5 et don $od/5 acceptés (attendu : 5/0 ou 0/5)"; exit 1
fi
m=$(q -c "select (select count(*) from public.inscriptions where transaction_id = 'CONC-TX-1') + (select count(*) from public.dons where transaction_id = 'CONC-TX-1')")
if [ "$m" != "1" ]; then echo "ÉCHEC : identifiant de transaction enregistré $m fois"; exit 1; fi
echo "ok  même transaction en parallèle : un seul paiement l'obtient ($([ "$oi" = 5 ] && echo inscription || echo don)), l'autre refusé 5 fois pour le bon motif"
echo "Concurrence : OK"
