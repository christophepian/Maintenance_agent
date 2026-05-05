#!/usr/bin/env python3
"""
Fix all [FR] placeholder values in FR locale files.
Strips the ' [FR]' suffix, applies translation dictionary,
and falls back to the raw English string (better than showing [FR]).
"""
import json, re, copy
from pathlib import Path

BASE = Path(__file__).parent.parent / "apps/web/public/locales"

# Comprehensive EN→FR phrase dictionary (exact and substring)
TRANSLATIONS = {
    # Nav / page titles
    "Requests Inbox": "Boîte des demandes",
    "Rental Applications": "Candidatures locatives",
    "Charge Reconciliations": "Réconciliation des charges",
    "Billing Schedules": "Calendriers de facturation",
    "Rent Adjustments": "Révisions de loyer",
    "Cashflow Plans": "Plans de trésorerie",
    "Cashflow": "Trésorerie",
    "Cash Flow": "Flux de trésorerie",
    "Building Financials": "Finances de l'immeuble",
    "Legal Templates": "Modèles juridiques",
    "Lease Templates": "Modèles de bail",
    "Legal Engine": "Moteur juridique",
    "Manage rental contracts": "Gérer les contrats de location",
    "Create New Lease": "Créer un nouveau bail",
    "New Lease": "Nouveau bail",
    "New Template": "Nouveau modèle",
    "New Request": "Nouvelle demande",
    "New Job": "Nouvelle intervention",
    "New Invoice": "Nouvelle facture",
    "New Building": "Nouvel immeuble",
    "New Unit": "Nouvelle unité",
    "New Plan": "Nouveau plan",
    "New Contact": "Nouveau contact",
    "Add Building": "Ajouter un immeuble",
    "Add Unit": "Ajouter une unité",
    "View Template": "Voir le modèle",
    "View Lease": "Voir le bail",
    "View Details": "Voir les détails",
    "Send for Signature": "Envoyer pour signature",
    "All Buildings": "Tous les immeubles",
    "All Units": "Toutes les unités",
    "Select a building to auto-fill": "Sélectionner un immeuble pour auto-remplir",
    "Select a unit": "Sélectionner une unité",
    "Select a lease to copy from": "Sélectionner un bail à copier",
    "e.g. Standard 3-room apartment": "ex. Appartement 3 pièces standard",
    "No templates yet": "Aucun modèle pour l'instant",
    "No templates match this filter.": "Aucun modèle ne correspond à ce filtre.",
    "No submitted leases": "Aucun bail soumis",
    "Leases sent to candidates for signature appear here.": "Les baux envoyés aux candidats pour signature apparaissent ici.",
    "Loading leases...": "Chargement des baux…",
    "Loading templates…": "Chargement des modèles…",
    "Ready for review": "Prêt pour révision",
    "All buildings already have a template.": "Tous les immeubles ont déjà un modèle.",
    # Tab labels
    "Active": "Actif",
    "Draft": "Brouillon",
    "Submitted": "Soumis",
    "Templates": "Modèles",
    "Archive": "Archive",
    "Archived": "Archivé",
    "Pending": "En attente",
    "Approved": "Approuvé",
    "Rejected": "Rejeté",
    "Cancelled": "Annulé",
    "Completed": "Terminé",
    "In Progress": "En cours",
    "Expired": "Expiré",
    "Signed": "Signé",
    "Paid": "Payé",
    "Unpaid": "Impayé",
    "Overdue": "En retard",
    "Sent": "Envoyé",
    "Ready to Sign": "Prêt à signer",
    "Terminated": "Résilié",
    "Open": "Ouvert",
    "Closed": "Fermé",
    "All": "Tous",
    # Column headers
    "Template Name": "Nom du modèle",
    "Template Nom": "Nom du modèle",
    "Building": "Immeuble",
    "Landlord": "Bailleur",
    "Tenant": "Locataire",
    "Tenants": "Locataires",
    "Tenant Name": "Nom du locataire",
    "Tenant Nom": "Nom du locataire",
    "Tenant E-mail": "E-mail du locataire",
    "Unit": "Unité",
    "Units": "Unités",
    "Floor": "Étage",
    "Address": "Adresse",
    "City": "Ville",
    "Created": "Créé le",
    "Created At": "Créé le",
    "Updated": "Mis à jour",
    "Start Date": "Date de début",
    "End Date": "Date de fin",
    "Start": "Début",
    "End": "Fin",
    "Due Date": "Date d'échéance",
    "Due Today": "Dû aujourd'hui",
    "Sent date unavailable": "Date d'envoi indisponible",
    "Deadline": "Échéance",
    "Tag": "Étiquette",
    "Total/mo": "Total/mois",
    "Actions": "Actions",
    "Action": "Action",
    "Date": "Date",
    "Amount": "Montant",
    "Balance": "Solde",
    "Total": "Total",
    "Subtotal": "Sous-total",
    "Tax": "Taxe",
    "VAT": "TVA",
    "Net Rent": "Loyer net",
    "Rent": "Loyer",
    "Charges": "Charges",
    "Deposit": "Dépôt",
    "Name": "Nom",
    "First Name": "Prénom",
    "Last Name": "Nom de famille",
    "Full Name": "Nom complet",
    "Email": "E-mail",
    "Phone": "Téléphone",
    "Mobile": "Mobile",
    "Role": "Rôle",
    "Type": "Type",
    "Category": "Catégorie",
    "Description": "Description",
    "Notes": "Notes",
    "Comment": "Commentaire",
    "Reference": "Référence",
    "Number": "Numéro",
    "Status": "Statut",
    "Priority": "Priorité",
    "Urgency": "Urgence",
    "Title": "Titre",
    "Subject": "Objet",
    "Direction": "Direction",
    "Mode": "Mode",
    # CTAs / buttons
    "Search": "Rechercher",
    "Filter": "Filtrer",
    "Filters": "Filtres",
    "Sort by": "Trier par",
    "Reset": "Réinitialiser",
    "Apply": "Appliquer",
    "Cancel": "Annuler",
    "Save": "Enregistrer",
    "Save changes": "Enregistrer les modifications",
    "Submit": "Soumettre",
    "Confirm": "Confirmer",
    "Close": "Fermer",
    "Back": "Retour",
    "Next": "Suivant",
    "Previous": "Précédent",
    "Continue": "Continuer",
    "Delete": "Supprimer",
    "Remove": "Retirer",
    "Edit": "Modifier",
    "Update": "Mettre à jour",
    "Download": "Télécharger",
    "Upload": "Téléverser",
    "Export": "Exporter",
    "Generate": "Générer",
    "Refresh": "Actualiser",
    "Add": "Ajouter",
    "View": "Voir",
    "Send": "Envoyer",
    "Archive": "Archiver",
    "Terminate": "Résilier",
    "Approve": "Approuver",
    "Reject": "Rejeter",
    "Assign": "Attribuer",
    "Complete": "Terminer",
    "Duplicate": "Dupliquer",
    "Preview": "Aperçu",
    "Clear": "Effacer",
    "Select": "Sélectionner",
    "Select all": "Tout sélectionner",
    "Loading": "Chargement",
    # Form labels / placeholders
    "Select building...": "Sélectionner un immeuble…",
    "Select unit...": "Sélectionner une unité…",
    "+41 21 ...": "+41 21 …",
    "Search by tenant, building or unit…": "Rechercher par locataire, immeuble ou unité…",
    "e.g. Régie du Lac SA": "ex. Régie du Lac SA",
    "e.g. Rue du Lac 15": "ex. Rue du Lac 15",
    "e.g. 1003 Lausanne": "ex. 1003 Lausanne",
    "regie@example.ch": "regie@example.ch",
    "CH93 0076 2011 6238 5295 7": "CH93 0076 2011 6238 5295 7",
    "— Choose —": "— Choisir —",
    "— None —": "— Aucun —",
    "— Select a unit —": "— Sélectionner une unité —",
    "IBAN *": "IBAN *",
    "Notice Rule": "Règle de préavis",
    "Préavis Rule": "Règle de préavis",
    "Source Bail": "Bail source",
    "Source Lease": "Bail source",
    "Template Nom": "Nom du modèle",
    "Locataire Nom": "Nom du locataire",
    "Locataire E-mail": "E-mail du locataire",
    # Requests page
    "Inbox": "Boîte de réception",
    "Assigned": "Assigné",
    "Unassigned": "Non assigné",
    "High": "Élevé",
    "Medium": "Moyen",
    "Low": "Faible",
    "Critical": "Critique",
    "Urgent": "Urgent",
    "Normal": "Normal",
    "Reported by": "Signalé par",
    "Assigned to": "Assigné à",
    # Finance
    "Journal": "Journal",
    "Trial Balance": "Balance des comptes",
    "Ledger": "Grand livre",
    "Account": "Compte",
    "Transaction": "Transaction",
    "Debit": "Débit",
    "Credit": "Crédit",
    "Entry": "Écriture",
    "Revenue": "Revenus",
    "Expenses": "Dépenses",
    "Budget": "Budget",
    "Forecast": "Prévision",
    "Actual": "Réel",
    "NOI YTD": "RNE CDA",
    "NOI": "RNE",
    "Choose": "Choisir",
    # People / contacts
    "Phone Number": "Numéro de téléphone",
    "Move In": "Emménagement",
    "Move Out": "Déménagement",
    "Move-in Date": "Date d'emménagement",
    "Move-out Date": "Date de déménagement",
    "Current Tenant": "Locataire actuel",
    "Owner": "Propriétaire",
    "Owners": "Propriétaires",
    "Manager": "Gestionnaire",
    "Contractor": "Prestataire",
    "Contractors": "Prestataires",
    "Contact": "Contact",
    "Contacts": "Contacts",
    "Company": "Société",
    # Inventory
    "Asset": "Actif",
    "Assets": "Actifs",
    "Serial Number": "Numéro de série",
    "Manufacturer": "Fabricant",
    "Warranty": "Garantie",
    "Installation Date": "Date d'installation",
    "Last Service": "Dernier entretien",
    "Next Service": "Prochain entretien",
    "Condition": "État",
    "Canton": "Canton",
    "Ratio": "Ratio",
    "= at current repair rate, when total repairs will exceed replacement cost.":
        "= au taux de réparation actuel, quand le total des réparations dépassera le coût de remplacement.",
    # Messages
    "Success": "Succès",
    "Error": "Erreur",
    "Warning": "Avertissement",
    "Something went wrong": "Une erreur s'est produite",
    "Please try again": "Veuillez réessayer",
    "Not found": "Non trouvé",
    "Loading...": "Chargement…",
    "No data": "Aucune donnée",
    "No results": "Aucun résultat",
    "Optional": "Optionnel",
    "Required": "Obligatoire",
    "Yes": "Oui",
    "No": "Non",
    "Unknown": "Inconnu",
    "N/A": "N/D",
    "Other": "Autre",
    "Default": "Par défaut",
    "Custom": "Personnalisé",
    "Global": "Global",
    "Available": "Disponible",
    "Unavailable": "Indisponible",
    "Enabled": "Activé",
    "Disabled": "Désactivé",
    # Misc
    "Overview": "Vue d'ensemble",
    "Summary": "Résumé",
    "Details": "Détails",
    "History": "Historique",
    "Activity": "Activité",
    "Settings": "Paramètres",
    "Profile": "Profil",
    "Notifications": "Notifications",
    "Dashboard": "Tableau de bord",
    "Report": "Rapport",
    "Reports": "Rapports",
    "Document": "Document",
    "Documents": "Documents",
    "Attachment": "Pièce jointe",
    "Attachments": "Pièces jointes",
    "Photo": "Photo",
    "Image": "Image",
    "More options": "Plus d'options",
    "See all": "Voir tout",
    "Show more": "Afficher plus",
    "Show less": "Afficher moins",
    "Read more": "Lire la suite",
    "Collapse": "Réduire",
    "Expand": "Développer",
    "Copy": "Copier",
    "Move": "Déplacer",
    "Enable": "Activer",
    "Disable": "Désactiver",
    "Activate": "Activer",
    "Deactivate": "Désactiver",
    "Restore": "Restaurer",
    "Dismiss": "Ignorer",
    "Tags": "Étiquettes",
    "Label": "Étiquette",
    "Period": "Période",
    "Month": "Mois",
    "Year": "Année",
    "Quarter": "Trimestre",
    "Week": "Semaine",
    "Occupancy": "Taux d'occupation",
    "Vacancy": "Vacance",
    "Yield": "Rendement",
    "Portfolio": "Portefeuille",
    "Property": "Bien",
    "Properties": "Biens",
    "Lease": "Bail",
    "Leases": "Baux",
    "Request": "Demande",
    "Requests": "Demandes",
    "Job": "Intervention",
    "Jobs": "Interventions",
    "Invoice": "Facture",
    "Invoices": "Factures",
    "Payment": "Paiement",
    "Payments": "Paiements",
}

# Sort by length descending for greedy matching
DICT_SORTED = sorted(TRANSLATIONS.items(), key=lambda x: -len(x[0]))

def translate_value(en_val: str) -> str:
    """Translate an EN string value to FR."""
    # Exact match
    if en_val in TRANSLATIONS:
        return TRANSLATIONS[en_val]
    # Case-insensitive exact
    lower = en_val.lower()
    for en, fr in DICT_SORTED:
        if en.lower() == lower:
            return fr
    # Try stripping emoji prefix and matching
    stripped = re.sub(r'^[^\w\s]+\s*', '', en_val).strip()
    if stripped and stripped != en_val:
        prefix = en_val[:en_val.index(stripped)]
        if stripped in TRANSLATIONS:
            return prefix + TRANSLATIONS[stripped]
        for en, fr in DICT_SORTED:
            if en.lower() == stripped.lower():
                return prefix + fr
    return en_val  # Return as-is (EN fallback — better than [FR])

def process_json(fr_obj: dict) -> tuple[dict, int, int]:
    """Strip [FR] suffix from all values and attempt translation."""
    result = copy.deepcopy(fr_obj)
    fixed = 0
    kept_en = 0
    
    def recurse(node):
        nonlocal fixed, kept_en
        for k in node:
            v = node[k]
            if isinstance(v, dict):
                recurse(v)
            elif isinstance(v, str) and v.endswith(' [FR]'):
                en_val = v[:-5]  # Strip ' [FR]'
                translated = translate_value(en_val)
                node[k] = translated
                if translated != en_val:
                    fixed += 1
                else:
                    kept_en += 1  # Falls back to EN (acceptable)
    
    recurse(result)
    return result, fixed, kept_en

namespaces = ['manager', 'owner', 'contractor', 'tenant', 'common']
total_fixed = 0
total_en_fallback = 0

for ns in namespaces:
    fr_path = BASE / 'fr' / f'{ns}.json'
    if not fr_path.exists():
        continue
    
    fr_obj = json.loads(fr_path.read_text())
    new_fr, fixed, en_fb = process_json(fr_obj)
    
    fr_path.write_text(json.dumps(new_fr, ensure_ascii=False, indent=2) + '\n')
    print(f"  {ns}: {fixed} translated, {en_fb} kept as EN (no FR equivalent)")
    total_fixed += fixed
    total_en_fallback += en_fb

print(f"\nTotal: {total_fixed} translated, {total_en_fallback} EN fallbacks (no [FR] remains)")
