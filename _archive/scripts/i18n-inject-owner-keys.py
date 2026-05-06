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
    "dashboard.chip.approval":     "Needs approval",
    "dashboard.chip.invoice":      "Invoice pending",
    "dashboard.chip.rfp":          "RFP to review",
    "dashboard.chip.vacancy":      "Vacant unit",
    "dashboard.hero.allClear":     "Everything looks good — no items need attention right now.",
    "dashboard.hero.one":          "1 item needs your attention today.",
    "dashboard.hero.many":         "{{count}} items need your attention today.",
    "dashboard.kpi.title":         "Portfolio summary",
    "dashboard.kpi.netIncomeYtd":  "Net income YTD",
    "dashboard.kpi.occupancy":     "Occupancy",
    "dashboard.kpi.vacancies":     "Vacancies",
    "dashboard.kpi.buildings":     "Buildings",
    "dashboard.feed.noMatch":      "No items match the selected filter.",
    "dashboard.feed.showLess":     "Show less",
    "dashboard.filter.all":        "All",
    "dashboard.filter.approval":   "Approvals",
    "dashboard.filter.invoice":    "Invoices",
    "dashboard.sort.urgency":      "Urgency",
    "dashboard.sort.building":     "Building",
    "dashboard.sort.date":         "Date",
    "dashboard.sort.category":     "Category",
    "dashboard.moreTools.title":   "More tools",
    "dashboard.moreTools.finance": "Finance",
    "dashboard.moreTools.properties":"Properties",
    "dashboard.moreTools.settings":"Settings",
}

FR = {
    "dashboard.chip.approval":     "Approbation requise",
    "dashboard.chip.invoice":      "Facture en attente",
    "dashboard.chip.rfp":          "Appel d'offres a examiner",
    "dashboard.chip.vacancy":      "Unite vacante",
    "dashboard.hero.allClear":     "Tout va bien — aucun element ne necessite d'attention.",
    "dashboard.hero.one":          "1 element necessite votre attention aujourd'hui.",
    "dashboard.hero.many":         "{{count}} elements necessitent votre attention aujourd'hui.",
    "dashboard.kpi.title":         "Resume du portefeuille",
    "dashboard.kpi.netIncomeYtd":  "Revenu net (cumul annuel)",
    "dashboard.kpi.occupancy":     "Occupation",
    "dashboard.kpi.vacancies":     "Vacances",
    "dashboard.kpi.buildings":     "Immeubles",
    "dashboard.feed.noMatch":      "Aucun element ne correspond au filtre.",
    "dashboard.feed.showLess":     "Afficher moins",
    "dashboard.filter.all":        "Tous",
    "dashboard.filter.approval":   "Approbations",
    "dashboard.filter.invoice":    "Factures",
    "dashboard.sort.urgency":      "Urgence",
    "dashboard.sort.building":     "Immeuble",
    "dashboard.sort.date":         "Date",
    "dashboard.sort.category":     "Categorie",
    "dashboard.moreTools.title":   "Plus d'outils",
    "dashboard.moreTools.finance": "Finance",
    "dashboard.moreTools.properties":"Proprietes",
    "dashboard.moreTools.settings":"Parametres",
}

en = load(LOCALES / "en/owner.json")
fr = load(LOCALES / "fr/owner.json")

for k, v in EN.items():
    sn(en, k, v)
for k, v in FR.items():
    sn(fr, k, v)

save(LOCALES / "en/owner.json", en)
save(LOCALES / "fr/owner.json", fr)
print("Done - owner dashboard locale keys injected")
