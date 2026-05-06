#!/usr/bin/env python3
"""
Add missing leasesIndex.tabs and leasesIndex.col keys to EN/FR manager.json.
"""
import json
from pathlib import Path

BASE = Path(__file__).parent.parent / "apps/web/public/locales"

ADDITIONS = {
    "en": {
        "leasesIndex": {
            "tabs": {
                "active": "Active",
                "drafts": "Draft",
                "submitted": "Submitted",
                "templates": "Templates",
                "archive": "Archive",
            },
            "col": {
                "templateName": "Template Name",
                "building": "Building",
                "landlord": "Landlord",
                "created": "Created",
                "tenantName": "Tenant",
                "unit": "Unit",
                "rent": "Rent",
                "startDate": "Start Date",
                "endDate": "End Date",
                "status": "Status",
            },
            "cta": {
                "newLease": "New Lease",
                "newTemplate": "New Template",
                "actions": "Actions ▾",
                "viewTemplate": "📄 View Template",
                "delete": "🗑️ Delete",
                "sendForSignature": "Send for Signature",
                "terminate": "📋 Terminate",
                "archive": "📦 Archive",
                "invoice": "💰 Invoice",
            },
            "text": {
                "expiredAgo": "Expired {{count}} business day ago",
                "expiredAgo_plural": "Expired {{count}} business days ago",
                "daysLeft": "{{count}} business day left",
                "daysLeft_plural": "{{count}} business days left",
            }
        }
    },
    "fr": {
        "leasesIndex": {
            "tabs": {
                "active": "Actif",
                "drafts": "Brouillon",
                "submitted": "Soumis",
                "templates": "Modèles",
                "archive": "Archive",
            },
            "col": {
                "templateName": "Nom du modèle",
                "building": "Immeuble",
                "landlord": "Bailleur",
                "created": "Créé le",
                "tenantName": "Locataire",
                "unit": "Unité",
                "rent": "Loyer",
                "startDate": "Date de début",
                "endDate": "Date de fin",
                "status": "Statut",
            },
            "cta": {
                "newLease": "Nouveau bail",
                "newTemplate": "Nouveau modèle",
                "actions": "Actions ▾",
                "viewTemplate": "📄 Voir le modèle",
                "delete": "🗑️ Supprimer",
                "sendForSignature": "Envoyer pour signature",
                "terminate": "📋 Résilier",
                "archive": "📦 Archiver",
                "invoice": "💰 Facturer",
            },
            "text": {
                "expiredAgo": "Expiré il y a {{count}} jour ouvrable",
                "expiredAgo_plural": "Expiré il y a {{count}} jours ouvrables",
                "daysLeft": "{{count}} jour ouvrable restant",
                "daysLeft_plural": "{{count}} jours ouvrables restants",
            }
        }
    }
}

for locale, additions in ADDITIONS.items():
    path = BASE / locale / 'manager.json'
    data = json.loads(path.read_text())
    for section, content in additions.items():
        if section not in data:
            data[section] = {}
        for subkey, subval in content.items():
            if subkey not in data[section]:
                data[section][subkey] = subval
            elif isinstance(subval, dict):
                data[section][subkey].update(subval)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f"  Updated {locale}/manager.json")

print("Done")
