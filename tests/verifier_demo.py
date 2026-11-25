"""Vérifie que l'appli s'affiche sans erreur JavaScript, en mode démonstration.

Lancer depuis la racine du dépôt :
    python3 -m http.server 8765 &
    python3 tests/verifier_demo.py
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/index.html"
ECRANS = ["accueil", "services", "course", "inscription", "parcours", "resultats", "evenements",
          "actions", "impact", "communaute", "carte", "fil", "fonds", "don", "boutique",
          "formations", "profil", "benevoles", "actualites", "admin"]

def main():
    echecs = []
    with sync_playwright() as p:
        nav = p.chromium.launch()
        page = nav.new_page(viewport={"width": 390, "height": 844})
        erreurs = []
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.goto(URL + "#accueil")
        page.wait_for_timeout(1000)
        for ecran in ECRANS:
            erreurs.clear()
            page.goto(f"{URL}#{ecran}")
            page.wait_for_timeout(500)
            texte = page.inner_text("body")
            if erreurs:
                echecs.append(f"#{ecran} : erreur JavaScript : {erreurs[0]}")
            elif len(texte.strip()) < 40:
                echecs.append(f"#{ecran} : écran vide")
            else:
                print(f"ok  #{ecran}")
        # Les trois épreuves et leurs tracés
        page.goto(URL + "#parcours"); page.wait_for_timeout(500)
        for km in ("3", "5", "10"):
            page.click(f'button[data-action="distance"][data-id="{km}"]')
            page.wait_for_timeout(300)
            if not page.locator(".trace-reel svg").count():
                echecs.append(f"parcours {km} km : tracé absent")
            else:
                print(f"ok  tracé {km} km")
        # Inscription d'un participant mineur : e-mail et accord parental obligatoires
        page.goto(URL + "#inscription"); page.wait_for_timeout(600)
        page.fill('input[name="nom"]', "Test"); page.fill('input[name="prenom"]', "Mineur")
        page.fill('input[name="date_naissance"]', "2012-03-15")
        page.check('input[name="sexe"][value="F"]')
        page.fill('input[name="telephone"]', "+237699000011")
        page.fill('input[name="urgence_nom"]', "Parent"); page.fill('input[name="urgence_tel"]', "+237699000012")
        page.click('form[data-form="ins1"] button[type="submit"]'); page.wait_for_timeout(400)
        if not page.inner_text('form[data-form="ins1"] .erreur').strip() or not page.locator('input[name="email"]:focus').count():
            echecs.append("inscription : l'e-mail n'est pas obligatoire")
        page.fill('input[name="email"]', "test@exemple.cm")
        page.click('form[data-form="ins1"] button[type="submit"]'); page.wait_for_timeout(600)
        if not page.locator('input[name="consentement_parental"]').count():
            echecs.append("inscription : accord parental absent pour un mineur")
        else:
            page.click('[data-action="taille-ins"][data-t="M"]')
            page.check('input[name="reglement"]'); page.check('input[name="consentement"]'); page.check('input[name="consentement_parental"]')
            page.click('form[data-form="inscription"] button[type="submit"]'); page.wait_for_timeout(1200)
            if "paiement" not in page.url:
                echecs.append("inscription d'un mineur : échec — " + page.inner_text('form[data-form="inscription"] .erreur'))
            else:
                ins = page.evaluate("JSON.parse(localStorage.getItem('odc_demo_v1')).inscriptions.slice(-1)[0]")
                if not ins.get("consentement_parental") or not ins.get("consentement_at") or ins.get("ville") is not None:
                    echecs.append("inscription d'un mineur : accord parental, horodatage ou ville mal enregistrés")
                else:
                    print("ok  inscription d'un mineur avec accord parental")
        # Anti-doublons (#28) : un même envoi répété ne crée qu'une inscription ; même personne refusée
        res = page.evaluate("""async () => {
          const E = window.ODC_DATA.creer();
          const f = { nom: 'Ngo', prenom: 'Alice', telephone: '+237699000021', email: 'a@exemple.cm', date_naissance: '1990-02-02',
                      sexe: 'F', distance: '5', categorie: 'travailleur', urgence_nom: 'U', urgence_tel: '+237699000022',
                      consentement: true, consentement_version: '2026-11-25', don: 0, cle_envoi: crypto.randomUUID() };
          const avant = JSON.parse(localStorage.getItem('odc_demo_v1')).inscriptions.length;
          const r1 = await E.creerInscription(f); const r2 = await E.creerInscription(f);
          const apres = JSON.parse(localStorage.getItem('odc_demo_v1')).inscriptions.length;
          let doublon = '';
          try { await E.creerInscription({ ...f, nom: ' NGO ', distance: '10', cle_envoi: crypto.randomUUID() }); } catch (e) { doublon = e.message; }
          let modifie = '';
          try { await E.creerInscription({ ...f, prenom: 'Alicia' }); } catch (e) { modifie = e.message; }
          let sansCle = '';
          try { const g = { ...f, prenom: 'Bea' }; delete g.cle_envoi; await E.creerInscription(g); } catch (e) { sansCle = e.message; }
          return { meme: r1.reference === r2.reference, cree: apres - avant, doublon, sansCle, modifie };
        }""")
        if not res["meme"] or res["cree"] != 1:
            echecs.append(f"anti-doublons : envoi répété mal géré ({res})")
        elif not res["doublon"].startswith("Cette personne est déjà inscrite"):
            echecs.append(f"anti-doublons : même personne acceptée ({res['doublon']!r})")
        elif not res["modifie"].startswith("Une inscription a déjà été enregistrée depuis ce formulaire"):
            echecs.append(f"anti-doublons : même clé avec des données modifiées acceptée ({res['modifie']!r})")
        elif not res["sansCle"].startswith("Version de l'appli"):
            echecs.append(f"anti-doublons : envoi sans clé accepté ({res['sansCle']!r})")
        else:
            print("ok  envoi répété, même personne et clé manquante")
        # Interrupteur (#29) : l'équipe ferme, l'appli l'affiche, puis l'équipe rouvre depuis l'espace organisateurs
        page.evaluate("""async () => { const E = window.ODC_DATA.creer(); await E.connexion('equipe@exemple.cm', 'odyssee2027');
                          await E.reglerInscriptions(false, 3000, 'Inscriptions suspendues pour le test.'); }""")
        page.goto(URL + "#course"); page.reload(); page.wait_for_timeout(900)
        corps = page.inner_text("body")
        if "Inscriptions fermées" not in corps or "suspendues pour le test" not in corps:
            echecs.append("interrupteur : la fermeture n'apparaît pas sur l'écran de la course")
        else:
            page.goto(URL + "#inscription"); page.wait_for_timeout(500)
            if page.locator('form[data-form="ins1"]').count():
                echecs.append("interrupteur : le formulaire reste accessible quand c'est fermé")
            else:
                page.goto(URL + "#admin"); page.wait_for_timeout(1500)
                page.check('form[data-form="reglages"] input[name="ouvertes"][value="oui"]')
                page.fill('form[data-form="reglages"] input[name="quota"]', "3000")
                page.click('form[data-form="reglages"] button[type="submit"]'); page.wait_for_timeout(1200)
                page.goto(URL + "#course"); page.wait_for_timeout(600)
                if not page.locator('.barre-bas a[data-action="ins-debut"]').count():
                    echecs.append("interrupteur : réouverture depuis l'espace organisateurs sans effet")
                else:
                    print("ok  fermeture affichée, formulaire bloqué, réouverture par l'équipe")

        # Délai de paiement : une inscription non payée depuis plus de 48 h libère sa place
        page.goto(URL + "#accueil"); page.wait_for_timeout(500)
        r = page.evaluate("""async () => {
            const E = window.ODC_DATA.creer();
            await E.connexion('equipe@exemple.cm', 'odyssee2027');
            const avant = (await E.etatPublic()).inscriptions;
            await E.reglerInscriptions(true, avant.quota - avant.restantes + 1, null);
            const p = { nom: 'Delai', prenom: 'Test', telephone: '+237699500001', email: 'd@exemple.cm', sexe: 'F',
                        distance: '5', categorie: 'etudiant', urgence_nom: 'U', urgence_tel: '+237699500002', consentement: true,
                        consentement_version: '2026-11-25', date_naissance: '1990-01-01' };
            const a = await E.creerInscription({ ...p, cle_envoi: crypto.randomUUID() });
            let complet = false;
            try { await E.creerInscription({ ...p, prenom: 'Autre', cle_envoi: crypto.randomUUID() }); } catch (e) { complet = /Complet/.test(e.message); }
            const d = JSON.parse(localStorage.getItem('odc_demo_v1'));
            d.inscriptions.find((i) => i.reference === a.reference).created_at = new Date(Date.now() - 49 * 3600e3).toISOString();
            localStorage.setItem('odc_demo_v1', JSON.stringify(d));
            const E2 = window.ODC_DATA.creer();   // relit le stockage modifié
            await E2.connexion('equipe@exemple.cm', 'odyssee2027');
            const libre = (await E2.etatPublic()).inscriptions.restantes;
            let refus = '';
            await E2.creerInscription({ ...p, prenom: 'Autre', cle_envoi: crypto.randomUUID() });
            try { await E2.declarerPaiement(a.reference, p.telephone, 'mtn', 'TX-DELAI-1'); } catch (e) { refus = e.message; }
            await E2.reglerInscriptions(true, 3000, null);
            return { complet, libre, refus };
        }""")
        if not r["complet"]:
            echecs.append("délai : la place en attente n'est pas comptée tant que le délai court")
        elif r["libre"] != 1:
            echecs.append(f"délai : la place expirée n'est pas libérée (restantes = {r['libre']})")
        elif "délai de paiement" not in r["refus"]:
            echecs.append(f"délai : paiement d'une inscription expirée accepté alors que c'est complet ({r['refus']!r})")
        else:
            page.goto(URL + "#admin"); page.reload(); page.wait_for_timeout(1800)
            tableau = page.inner_text("body")
            page.click('button[data-action="adm-onglet"][data-k="inscriptions"]'); page.wait_for_timeout(800)
            if "hors délai" not in tableau or "délai dépassé" not in page.inner_text("body"):
                echecs.append("délai : l'espace organisateurs ne signale pas l'inscription hors délai")
            else:
                print("ok  délai de paiement : place libérée après 48 h, paiement tardif refusé si complet, signalé à l'équipe")
        nav.close()
    if echecs:
        print("\n".join(["", "ÉCHECS :"] + echecs))
        sys.exit(1)
    print("\nTout est en ordre.")

if __name__ == "__main__":
    main()
