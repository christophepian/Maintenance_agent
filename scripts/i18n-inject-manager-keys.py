#!/usr/bin/env python3
import json
from pathlib import Path

LOCALES = Path("apps/web/public/locales")

def load(p):
    if p.exists():
        return json.loads(p.read_text())
    return {}

def save(p, d):
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")

def sn(d, key, val):
    parts = key.split(".")
    cur = d
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = val

EN = {
    "dashboard.chip.review":       "Pending review",
    "dashboard.chip.approval":     "Owner approval",
    "dashboard.chip.disputed":     "Disputed invoice",
    "dashboard.chip.stale":        "Stale job",
    "dashboard.chip.rfp":          "RFP routed",
    "dashboard.hero.allClear":     "Everything looks good — no items need attention right now.",
    "dashboard.hero.one":          "1 item needs your attention today.",
    "dashboard.hero.many":         "{{count}} items need your attention today.",
    "dashboard.portfolioOverview": "Portfolio overview",
    "dashboard.kpi.noiYtd":        "NOI YTD",
    "dashboard.kpi.spendMtd":      "Spend MTD",
    "dashboard.kpi.collectionRate":"Collection rate",
    "dashboard.kpi.buildingsInRed":"Buildings in red",
    "dashboard.kpi.openRequests":  "Open requests",
    "dashboard.kpi.openJobs":      "Open jobs",
    "dashboard.kpi.jobAvgDuration":"Job avg. duration",
    "dashboard.kpi.pendingInvoices":"Pending invoices",
    "dashboard.feed.allClearTitle":"All clear — no items need action",
    "dashboard.feed.allClearSub":  "Check back after new requests or invoices arrive.",
    "dashboard.feed.noMatch":      "No items match the selected filter.",
    "dashboard.feed.showLess":     "Show less ↑",
    "dashboard.feed.inProgressStale":"In progress > 7 days",
    "dashboard.filter.all":        "All",
    "dashboard.filter.disputed":   "Disputed",
    "dashboard.filter.stale":      "Stale jobs",
    "dashboard.filter.rfps":       "RFPs",
    "dashboard.sort.urgency":      "Urgency",
    "dashboard.sort.building":     "Building",
    "dashboard.sort.date":         "Date",
    "dashboard.sort.category":     "Category",
    "dashboard.moreTools.title":   "More tools",
    "dashboard.moreTools.sub":     "Deeper views for finance, strategy, and tenant portal.",
    "dashboard.moreTools.finance": "Finance overview",
    "dashboard.moreTools.settings":"Settings",
    "dashboard.moreTools.allRequests":"All requests",
}

FR = {
    "dashboard.chip.review":       "En attente de revision",
    "dashboard.chip.approval":     "Approbation du proprietaire",
    "dashboard.chip.disputed":     "Facture contestee",
    "dashboard.chip.stale":        "Travail en retard",
    "dashboard.chip.rfp":          "Appel d'offres transmis",
    "dashboard.hero.allClear":     "Tout va bien — aucun element ne necessite d'attention.",
    "dashboard.hero.one":          "1 element necessite votre attention aujourd'hui.",
    "dashboard.hero.many":         "{{count}} elements necessitent votre attention aujourd'hui.",
    "dashboard.portfolioOverview": "Apercu du portefeuille",
    "dashboard.kpi.noiYtd":        "RNE (cumul annuel)",
    "dashboard.kpi.spendMtd":      "Depenses du mois",
    "dashboard.kpi.collectionRate":"Taux de recouvrement",
    "dashboard.kpi.buildingsInRed":"Immeubles en deficit",
    "dashboard.kpi.openRequests":  "Demandes ouvertes",
    "dashboard.kpi.openJobs":      "Travaux en cours",
    "dashboard.kpi.jobAvgDuration":"Duree moy. des travaux",
    "dashboard.kpi.pendingInvoices":"Factures en attente",
    "dashboard.feed.allClearTitle":"Tout est en ordre",
    "dashboard.feed.allClearSub":  "Revenez apres l'arrivee de nouvelles demandes ou factures.",
    "dashboard.feed.noMatch":      "Aucun element ne correspond au filtre selectionne.",
    "dashboard.feed.showLess":     "Afficher moins haut",
    "dashboard.feed.inProgressStale":"En cours depuis plus de 7 jours",
    "dashboard.filter.all":        "Tous",
    "dashboard.filter.disputed":   "Conteste",
    "dashboard.filter.stale":      "Travaux en retard",
    "dashboard.filter.rfps":       "Appels d'offres",
    "dashboard.sort.urgency":      "Urgence",
    "dashboard.sort.building":     "Immeuble",
    "dashboard.sort.date":         "Date",
    "dashboard.sort.category":     "Categorie",
    "dashboard.moreTools.title":   "Plus d'outils",
    "dashboard.moreTools.sub":     "Vues detaillees pour la finance, la strategie et le portail locataire.",
    "dashboard.moreTools.finance": "Apercu financier",
    "dashboard.moreTools.settings":"Parametres",
    "dashboard.moreTools.allRequests":"Toutes les demandes",
}

en = load(LOCALES / "en/manager.json")
fr = load(LOCALES / "fr/manager.json")

for k, v in EN.items():
    sn(en, k, v)
for k, v in FR.items():
    sn(fr, k, v)

save(LOCALES / "en/manager.json", en)
save(LOCALES / "fr/manager.json", fr)
print("Done - manager dashboard locale keys injected")
