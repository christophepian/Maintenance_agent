#!/usr/bin/env python3
import json

EN = "apps/web/public/locales/en/manager.json"
FR = "apps/web/public/locales/fr/manager.json"

with open(EN) as f:
    en = json.load(f)
with open(FR) as f:
    fr = json.load(f)

req_text_en = {
    "asset": "Asset",
    "assetInventoryRecordsAreRequiredForAnalysis": "Asset inventory records are required for analysis.",
    "building": "Building",
    "calculating": "Calculating\u2026",
    "category": "Category",
    "contractor": "Contractor",
    "description": "Description",
    "dismiss": "Dismiss",
    "error": "Error:",
    "estRepair": "Est. Repair",
    "estReplacement": "Est. Replacement",
    "failedToLoadAssetAnalysis": "Failed to load asset analysis.",
    "installed": "Installed",
    "manufacturer": "Manufacturer",
    "noAssetLinkedToThisRequest": "No asset linked to this request.",
    "noLegalAnalysisAvailableForThisRequest": "No legal analysis available for this request.",
    "noRepairvsreplaceDataAvailableForThisAsset": "No repair vs. replace data available for this asset.",
    "requestNotFound": "Request not found.",
    "suggested": "Suggested",
    "suggestedMatch": "Suggested match",
    "tenant": "Tenant",
    "unit": "Unit",
}

req_text_fr = {
    "asset": "\u00c9quipement",
    "assetInventoryRecordsAreRequiredForAnalysis": "Un inventaire des \u00e9quipements est requis pour l\u2019analyse.",
    "building": "Immeuble",
    "calculating": "Calcul en cours\u2026",
    "category": "Cat\u00e9gorie",
    "contractor": "Prestataire",
    "description": "Description",
    "dismiss": "Fermer",
    "error": "Erreur\u00a0:",
    "estRepair": "Estim. r\u00e9paration",
    "estReplacement": "Estim. remplacement",
    "failedToLoadAssetAnalysis": "\u00c9chec du chargement de l\u2019analyse d\u2019\u00e9quipement.",
    "installed": "Install\u00e9",
    "manufacturer": "Fabricant",
    "noAssetLinkedToThisRequest": "Aucun \u00e9quipement li\u00e9 \u00e0 cette demande.",
    "noLegalAnalysisAvailableForThisRequest": "Aucune analyse juridique disponible pour cette demande.",
    "noRepairvsreplaceDataAvailableForThisAsset": "Aucune donn\u00e9e r\u00e9paration/remplacement disponible pour cet \u00e9quipement.",
    "requestNotFound": "Demande introuvable.",
    "suggested": "Sugg\u00e9r\u00e9",
    "suggestedMatch": "Correspondance sugg\u00e9r\u00e9e",
    "tenant": "Locataire",
    "unit": "Unit\u00e9",
}

def merge(d, path, additions):
    node = d
    for k in path:
        node = node.setdefault(k, {})
    for k, v in additions.items():
        if k not in node:
            node[k] = v

merge(en, ["requestsId", "text"], req_text_en)
merge(fr, ["requestsId", "text"], req_text_fr)

# common:loading
en.setdefault("loading", "Loading\u2026")
fr.setdefault("loading", "Chargement\u2026")

with open(EN, "w") as f:
    json.dump(en, f, ensure_ascii=False, indent=2)
with open(FR, "w") as f:
    json.dump(fr, f, ensure_ascii=False, indent=2)

print("Done.")
