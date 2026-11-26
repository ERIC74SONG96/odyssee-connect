#!/usr/bin/env bash
# Test de concurrence réel : plusieurs connexions PostgreSQL en parallèle.
#  1. 20 inscriptions simultanées pour 5 places : exactement 5 acceptées,
#     les 15 autres refusées avec le motif « Complet ».
#  2. Un même identifiant de transaction déclaré en même temps pour une inscription (5 fois)
#     et pour un don (5 fois) : un seul des deux paiements l'obtient ; les répétitions pour ce
#     même paiement sont acceptées (déclaration idempotente) ; toutes les déclarations pour
#     l'autre sont refusées avec le motif « identifiant déjà déclaré ».
#  3. Dernière place disputée : une inscription hors délai déclare son paiement pendant que
#     5 nouvelles inscriptions arrivent ; une seule de ces 6 demandes obtient la place.
#  4. Annulation par l'équipe et déclaration de paiement en même temps : l'inscription
#     finit toujours annulée (jamais remise en « paiement déclaré »).
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
        delete from public.staff where user_id = '00000000-0000-0000-0000-00000000c0c0';
        delete from auth.users where id = '00000000-0000-0000-0000-00000000c0c0';
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

# 3. Dernière place : paiement tardif contre nouvelles inscriptions
ref_x=$(q -c "select reference from public.inscriptions where nom = 'Concurrence' and statut = 'en_attente' order by created_at limit 1")
tel_x=$(q -c "select telephone from public.inscriptions where reference = '$ref_x'")
q -c "update public.inscriptions set paiement_avant = now() - interval '1 hour' where reference = '$ref_x'" >/dev/null
lancer "tard" "set role anon; select public.declarer_paiement('$ref_x', '$tel_x', 'orange', 'CONC-TX-3')"
sleep 0.2   # le paiement tardif part en premier ; les inscriptions arrivent pendant qu'il est en cours
for i in $(seq 21 25); do
  lancer "der$i" "set role anon; select reference from public.creer_inscription(jsonb_build_object(
      'nom','Concurrence','prenom','P$i','telephone','+2376991$(printf '%05d' "$i")','email','c$i@exemple.cm','sexe','F',
      'distance','5','categorie','etudiant','urgence_nom','U','urgence_tel','+237699200000','consentement',true,
      'consentement_version','2026-11-25','date_naissance','1990-01-01','cle_envoi',gen_random_uuid()))"
done
wait
gagnants=$(( $(reussis tard) + $(reussis der) )); [ -n "${ODC_DEBUG:-}" ] && { echo "tard=$(reussis tard) der=$(reussis der)"; cat "$dossier"/tard.err; }
motifs der "Complet"; motifs tard "délai de paiement"
tenues=$(q -c "select public._places_prises()")
if [ "$gagnants" != "1" ] || [ "$tenues" != "5" ]; then
  echo "ÉCHEC : $gagnants demandes ont obtenu la dernière place, $tenues places tenues pour 5"; exit 1
fi
echo "ok  dernière place disputée par un paiement tardif et 5 inscriptions : une seule l'obtient, quota respecté"

# 4. Annulation par l'équipe contre déclaration de paiement
q -c "insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c0c0', 'conc@exemple.cm') on conflict do nothing;
      insert into public.staff (user_id) values ('00000000-0000-0000-0000-00000000c0c0') on conflict do nothing;
      update public.reglages_inscriptions set quota = 100 where id = 1" >/dev/null
for k in 1 2 3 4 5; do
  ref_k=$(q -c "set role anon; select reference from public.creer_inscription(jsonb_build_object(
      'nom','Concurrence','prenom','Q$k','telephone','+23769920000$k','email','q$k@exemple.cm','sexe','M',
      'distance','10','categorie','etudiant','urgence_nom','U','urgence_tel','+237699200000','consentement',true,
      'consentement_version','2026-11-25','date_naissance','1991-01-01','cle_envoi',gen_random_uuid()))" | tail -1)
  id_k=$(q -c "select id from public.inscriptions where reference = '$ref_k'")
  lancer "ann$k" "set role authenticated; set request.jwt.uid = '00000000-0000-0000-0000-00000000c0c0'; select public.annuler_inscription('$id_k')"
  lancer "dec$k" "set role anon; select public.declarer_paiement('$ref_k', '+23769920000$k', 'mtn', 'CONC-TX-4-$k')"
done
wait
motifs dec "Inscription introuvable ou déjà traitée"
mauvais=$(q -c "select count(*) from public.inscriptions where nom = 'Concurrence' and prenom like 'Q%' and statut <> 'annule'")
if [ "$(reussis ann)" != "5" ] || [ "$mauvais" != "0" ]; then
  echo "ÉCHEC : $(reussis ann)/5 annulations réussies, $mauvais inscriptions non annulées à la fin"; exit 1
fi
echo "ok  annulation et déclaration simultanées (5 fois) : l'inscription finit toujours annulée"
echo "Concurrence : OK"
