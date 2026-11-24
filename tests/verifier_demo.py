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
        nav.close()
    if echecs:
        print("\n".join(["", "ÉCHECS :"] + echecs))
        sys.exit(1)
    print("\nTout est en ordre.")

if __name__ == "__main__":
    main()
