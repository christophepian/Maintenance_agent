#!/usr/bin/env python3
"""
Auto-translate EN→FR placeholder keys in locale JSON files.
Only translates keys where FR value == EN value (placeholders set by the codemod).
Skips keys with existing proper FR translations.
"""
import json, re
from pathlib import Path

LOCALES = Path(__file__).parent.parent / "apps/web/public/locales"

# ── Phrase-level translations (longest match first) ─────────────────────────
PHRASES = {
    # Status / workflow
    "Pending review": "En attente de révision",
    "Pending signature": "En attente de signature",
    "Pending payment": "En attente de paiement",
    "Pending approval": "En attente d'approbation",
    "In progress": "En cours",
    "In Progress": "En cours",
    "All clear": "Tout est en ordre",
    "Not found": "Introuvable",
    "No data available": "Aucune donnée disponible",
    "No results found": "Aucun résultat",
    "No items to display": "Aucun élément à afficher",
    "No options available": "Aucune option disponible",
    "Failed to load": "Échec du chargement",
    "Failed to save": "Échec de la sauvegarde",
    "Failed to create": "Échec de la création",
    "Something went wrong": "Une erreur est survenue",
    "Try again": "Réessayer",
    "Please try again": "Veuillez réessayer",
    "Are you sure": "Êtes-vous sûr",

    # Actions
    "Save changes": "Enregistrer les modifications",
    "Save failed": "Échec de l'enregistrement",
    "Saving…": "Enregistrement…",
    "Loading…": "Chargement…",
    "Creating…": "Création en cours…",
    "Uploading…": "Téléversement…",
    "Processing…": "Traitement en cours…",
    "Deleting…": "Suppression…",
    "Upload failed": "Échec du téléversement",
    "Create Template": "Créer un modèle",
    "Create plan": "Créer un plan",
    "Reset filters": "Réinitialiser les filtres",
    "Reset to defaults": "Réinitialiser par défaut",
    "View all": "Voir tout",
    "View details": "Voir les détails",
    "Mark all read": "Tout marquer comme lu",
    "Send for signature": "Envoyer pour signature",
    "Add comment": "Ajouter un commentaire",
    "Add note": "Ajouter une note",
    "Add asset": "Ajouter un actif",
    "Select contractor…": "Sélectionner un prestataire…",
    "Select…": "Sélectionner…",
    "Search…": "Rechercher…",

    # Finance
    "Net Operating Income": "Revenu net d'exploitation",
    "Net Income": "Revenu net",
    "Earned Income": "Revenu encaissé",
    "Projected Income": "Revenu projeté",
    "Rental Income": "Revenu locatif",
    "Service Charges": "Charges de service",
    "Collection Rate": "Taux de recouvrement",
    "Total Expenses": "Total des dépenses",
    "Capital Expenditure": "Dépenses d'investissement",
    "Outstanding Balances": "Soldes impayés",
    "Billing Schedule": "Calendrier de facturation",
    "Billing Entity": "Entité de facturation",
    "Billing Entities": "Entités de facturation",
    "Chart of Accounts": "Plan comptable",
    "General Ledger": "Grand livre",
    "Invoice #": "Facture n°",
    "Invoice PDF": "PDF de la facture",
    "Invoice Details": "Détails de la facture",
    "New Invoice": "Nouvelle facture",
    "Upload Invoice": "Téléverser une facture",
    "Dispute Invoice": "Contester la facture",
    "Line Items": "Lignes de détail",
    "Date range": "Plage de dates",
    "Date Range": "Plage de dates",
    "Opening balance": "Solde d'ouverture",
    "Cumulative balance": "Solde cumulé",
    "No cashflow data": "Aucune donnée de flux",
    "Income growth": "Croissance des revenus",
    "Projected breakdown": "Ventilation projetée",
    "Cost / Unit": "Coût / Unité",
    "Cost per unit": "Coût par unité",
    "Receivables": "Créances",
    "Payables": "Dettes fournisseurs",
    "Expenses": "Dépenses",
    "Payments": "Paiements",
    "Charges": "Charges",
    "Finances": "Finances",
    "Finance": "Finance",
    "Budget": "Budget",
    "Balance": "Solde",
    "Amount": "Montant",
    "Total": "Total",
    "Scope": "Périmètre",
    "Acompte Paid": "Acompte versé",
    "Actual Costs": "Coûts réels",
    "Net Rent": "Loyer net",
    "Settlement Invoice": "Facture de solde",

    # Legal / lease
    "Lease Contract": "Contrat de bail",
    "Lease Template": "Modèle de bail",
    "Lease Templates": "Modèles de bail",
    "Lease Index Settings": "Paramètres d'indexation du bail",
    "Create New Lease": "Créer un nouveau bail",
    "Terminate Lease": "Résilier le bail",
    "Create Lease Invoice": "Créer une facture de bail",
    "Send for Signature": "Envoyer pour signature",
    "Signature Requests": "Demandes de signature",
    "Rent Estimate": "Estimation du loyer",
    "Rent Reduction": "Réduction de loyer",
    "Rent Change": "Changement de loyer",
    "Rent Adjustments": "Ajustements de loyer",
    "Indexation Details": "Détails d'indexation",
    "Nebenkosten Summary": "Résumé des charges accessoires",
    "Legal Analysis": "Analyse juridique",
    "Maintenance Decision": "Décision de maintenance",
    "Defect signals": "Signaux de défaut",
    "Recommended actions": "Actions recommandées",
    "Asset depreciation": "Dépréciation des actifs",
    "Rent reduction precedents": "Précédents de réduction de loyer",
    "Estimated rent reduction": "Réduction de loyer estimée",
    "Repair vs Replace Analysis": "Analyse réparation vs remplacement",
    "Cap applied": "Plafond appliqué",

    # Properties / buildings
    "Residential Units": "Unités résidentielles",
    "Common Areas": "Parties communes",
    "Ownership & Management": "Propriété et gestion",
    "Management Guidelines": "Directives de gestion",
    "Asset Inventory": "Inventaire des actifs",
    "Asset Inventory & Depreciation": "Inventaire & dépréciation",
    "Building information": "Informations sur l'immeuble",
    "Building Financials": "Finances de l'immeuble",
    "Building name": "Nom de l'immeuble",
    "Vacant Units": "Unités vacantes",
    "Open for Applications": "Ouvert aux candidatures",
    "Rental Applications": "Candidatures locatives",
    "Application Detail": "Détail de la candidature",
    "Household & Current Housing": "Foyer et logement actuel",
    "Unit Evaluations": "Évaluations de l'unité",
    "Candidate Selection": "Sélection des candidats",

    # Requests / jobs
    "Requests Inbox": "Boîte de réception des demandes",
    "Open Requests": "Demandes ouvertes",
    "Stale job": "Travail en retard",
    "Stale jobs": "Travaux en retard",
    "RFP routed": "Appel d'offres transmis",
    "RFP Details": "Détails de l'appel d'offres",
    "RFP Candidates": "Candidats à l'appel d'offres",
    "Requests for Proposal": "Appels d'offres",
    "Linked Maintenance Request": "Demande de maintenance liée",
    "Fallback Actions": "Actions de repli",
    "Photos / Attachments": "Photos / Pièces jointes",
    "No photos yet": "Aucune photo pour l'instant",
    "Upload to document the issue": "Téléversez pour documenter le problème",
    "No requests match this filter": "Aucune demande ne correspond à ce filtre",
    "Select contractor": "Sélectionner un prestataire",
    "All urgencies": "Toutes les urgences",
    "All buildings": "Tous les immeubles",
    "All categories": "Toutes les catégories",

    # People / contacts
    "Personal information": "Informations personnelles",
    "Professional": "Professionnel",
    "Corroborative Documents": "Documents justificatifs",
    "Contracts": "Contrats",
    "Service details": "Détails du service",
    "Contacts": "Contacts",
    "Owners": "Propriétaires",
    "Tenants": "Locataires",
    "Contractors": "Prestataires",

    # Strategy / planning
    "Cashflow plan": "Plan de trésorerie",
    "Scheduled CapEx events": "Événements CapEx planifiés",
    "Projection horizon": "Horizon de projection",
    "Plan horizon": "Horizon du plan",
    "Trade group": "Groupe de métier",
    "Shift year": "Décaler l'année",
    "Bundled": "Groupé",
    "No CapEx items scheduled within the plan horizon": "Aucun investissement planifié dans l'horizon du plan",
    "No scheduled CapEx events in the projection horizon": "Aucun événement CapEx planifié dans l'horizon de projection",
    "Loading RFP candidates": "Chargement des candidats d'appel d'offres",
    "Loading cashflow plan": "Chargement du plan de trésorerie",
    "12-mo projected income": "Revenu projeté sur 12 mois",
    "Next 12 projected months": "12 prochains mois projetés",
    "Total projected CapEx": "CapEx total projeté",
    "Peak monthly CapEx": "CapEx mensuel maximal",
    "Lowest cumulative balance": "Solde cumulé le plus bas",
    "Set opening balance to see": "Définir le solde d'ouverture pour afficher",

    # Settings
    "Legal Sources": "Sources juridiques",
    "Legal Variables": "Variables juridiques",
    "Settings": "Paramètres",

    # Common UI
    "Priority feed": "Fil de priorité",
    "More tools": "Plus d'outils",
    "Refresh dashboard": "Actualiser le tableau de bord",
    "Sort schedules": "Trier les plannings",
    "Sort charges": "Trier les charges",
    "Sort buildings": "Trier les immeubles",
    "Sort contractors": "Trier les prestataires",
    "Sort owners": "Trier les propriétaires",
    "Sort tenants": "Trier les locataires",
    "Search requests": "Rechercher des demandes",
    "Search buildings": "Rechercher des immeubles",
    "Search owners": "Rechercher des propriétaires",
    "Search tenants": "Rechercher des locataires",
    "Filter buildings": "Filtrer les immeubles",
    "Filter by canton": "Filtrer par canton",
    "Dismiss message": "Ignorer le message",
    "Dismiss": "Ignorer",
    "Error": "Erreur",
    "Confirmed": "Confirmé",
    "Auto-confirmed": "Confirmé automatiquement",
    "Exceeded": "Dépassé",
    "Review": "Révision",
    "Repair": "Réparation",
    "Replace": "Remplacement",
    "Plan Replacement": "Planifier le remplacement",
    "Landlord": "Propriétaire",
    "Unknown": "Inconnu",
    "Untitled request": "Demande sans titre",
    "Back to Inventory": "Retour à l'inventaire",
    "Back": "Retour",
    "Close": "Fermer",
    "Cancel": "Annuler",
    "Confirm": "Confirmer",
    "Save": "Enregistrer",
    "Edit": "Modifier",
    "Delete": "Supprimer",
    "Add": "Ajouter",
    "Create": "Créer",
    "Submit": "Soumettre",
    "Search": "Rechercher",
    "Filter": "Filtrer",
    "Export": "Exporter",
    "Download": "Télécharger",
    "Preview": "Aperçu",
    "View": "Voir",
    "More": "Plus",

    # Table columns
    "Actions": "Actions",
    "Action": "Action",
    "Status": "Statut",
    "Category": "Catégorie",
    "Description": "Description",
    "Name": "Nom",
    "Date": "Date",
    "Building": "Immeuble",
    "Unit": "Unité",
    "Tenant": "Locataire",
    "Contractor": "Prestataire",
    "Owner": "Propriétaire",
    "Email": "E-mail",
    "Phone": "Téléphone",
    "Address": "Adresse",
    "Type": "Type",
    "Notes": "Notes",
    "Priority": "Priorité",
    "Urgency": "Urgence",
    "Created": "Créé",
    "Updated": "Mis à jour",
    "Deadline": "Échéance",
    "Rank": "Rang",
    "Versions": "Versions",
    "Notice": "Préavis",
    "Tag": "Tag",
    "Charges": "Charges",
    "Override": "Remplacement",

    # Urgency values
    "🚨 Emergency": "🚨 Urgence",
    "⚠️ High": "⚠️ Élevée",
    "Normal": "Normal",
    "Low": "Basse",
    "High": "Élevée",

    # Load / empty states
    "Loading asset models": "Chargement des modèles d'actifs",
    "Loading assets": "Chargement des actifs",
    "Loading categories": "Chargement des catégories",
    "Loading financials": "Chargement des données financières",
    "Loading depreciation standards": "Chargement des standards de dépréciation",
    "Loading documents": "Chargement des documents",
    "No expenses": "Aucune dépense",
    "No documents uploaded yet": "Aucun document téléversé",
    "No assets recorded yet": "Aucun actif enregistré",
    "No notifications": "Aucune notification",
    "Unread": "Non lu",
    "Notifications": "Notifications",

    # Specific sections
    "Summary": "Résumé",
    "Overview": "Aperçu",
    "Income": "Revenus",
    "Advanced": "Avancé",
    "Timeline": "Chronologie",
    "Accounting": "Comptabilité",
    "Recipient": "Destinataire",
    "Issuer": "Émetteur",
    "Original Capture": "Capture originale",
    "PDF Preview": "Aperçu PDF",
    "Linked Records": "Enregistrements liés",
    "Documents": "Documents",
    "Properties": "Biens",
    "Invoices": "Factures",

    # Contractor portal
    "My Jobs": "Mes interventions",
    "My Invoices": "Mes factures",
    "My RFPs": "Mes appels d'offres",
    "Quote submitted": "Devis soumis",
    "Quote accepted": "Devis accepté",
    "Quote rejected": "Devis refusé",
    "Submit quote": "Soumettre un devis",
    "Assign to job": "Assigner à l'intervention",
    "Mark complete": "Marquer terminé",

    # Tenant portal
    "My Requests": "Mes demandes",
    "My Leases": "Mes baux",
    "My Invoices": "Mes factures",
    "Submit request": "Soumettre une demande",
    "New request": "Nouvelle demande",
    "Inbox": "Boîte de réception",

    # Owner portal
    "My Properties": "Mes biens",
    "My Buildings": "Mes immeubles",
    "Approve": "Approuver",
    "Reject": "Rejeter",
    "Approvals": "Approbations",
    "Strategy": "Stratégie",
    "Reporting": "Rapports",

    # Severity / area
    "Severity:": "Gravité :",
    "Area:": "Zone :",
    "Duration:": "Durée :",
    "Repairs:": "Réparations :",
    "Replace est.:": "Remplacement est. :",
    "Income growth:": "Croissance des revenus :",
    "% / year": "% / an",
    "RFP created": "Appel d'offres créé",

    # Specific patterns from extraction
    "Evaluating legal obligations…": "Évaluation des obligations légales…",
    "Analysing repair vs replace…": "Analyse réparation vs remplacement…",
    "No photos yet. Upload to document the issue.": "Aucune photo pour l'instant. Téléversez pour documenter le problème.",
    "Cap applied — reduction clamped to legal maximum.": "Plafond appliqué — réduction limitée au maximum légal.",

    # Additional common labels
    "Description": "Description",
    "Type": "Type",
    "To": "À",
    "From": "De",
    "Loading invoices…": "Chargement des factures…",
    "Loading invoice…": "Chargement de la facture…",
    "Country": "Pays",
    "City": "Ville",
    "City *": "Ville *",
    "Total": "Total",
    "Actions": "Actions",
    "Expense Type": "Type de dépense",
    "Finance": "Finance",
    "Net": "Net",
    "Account": "Compte",
    "Collection": "Recouvrement",
    "Paid": "Payé",
    "Subtotal": "Sous-total",
    "Issue Date": "Date d'émission",
    "Due Date": "Date d'échéance",
    "Postal code": "Code postal",
    "Postal Code": "Code postal",
    "Postal Code *": "Code postal *",
    "VAT number": "Numéro TVA",
    "VAT Number": "Numéro TVA",
    "Installed": "Installé",
    "Code": "Code",
    "Sent": "Envoyé",
    "Currency": "Devise",
    "Job": "Intervention",
    "Lease": "Bail",
    "No tenants found.": "Aucun locataire trouvé.",
    "Floor": "Étage",
    "Request #": "Demande n°",
    "Legal Obligation": "Obligation légale",
    "Valid Until": "Valable jusqu'au",
    "Work Plan": "Plan de travail",
    "Assumptions": "Hypothèses",
    "Frequency": "Fréquence",
    "Confidence": "Confiance",
    "All": "Tous",
    "Pending": "En attente",
    "All expense types": "Tous les types de dépenses",
    "Settlement date": "Date de règlement",
    "Mode": "Mode",
    "All accounts": "Tous les comptes",
    "Loading portfolio summary…": "Chargement du résumé de portefeuille…",
    "Avg collection rate:": "Taux de recouvrement moy. :",
    "No buildings in this portfolio yet.": "Aucun immeuble dans ce portefeuille.",
    "Net Result": "Résultat net",
    "Creating capture session…": "Création de la session de capture…",
    "Photos received!": "Photos reçues !",
    "Done": "Terminé",
    "Mobile link": "Lien mobile",
    "Invoice not found.": "Facture introuvable.",
    "Invoice Number": "Numéro de facture",
    "Direction": "Direction",
    "Payment Ref": "Réf. paiement",
    "Postal Code · City": "Code postal · Ville",
    "Portfolio": "Portefeuille",
    "Canton": "Canton",
    "Loading buildings…": "Chargement des immeubles…",
    "Ratio": "Ratio",
    "Break-even": "Seuil de rentabilité",
    "Depreciation": "Dépréciation",
    "Recommendation": "Recommandation",
    "Effective Date": "Date d'effet",
    "Reason": "Motif",
    "Rent": "Loyer",
    "Start Date *": "Date de début *",
    "Select a building...": "Sélectionner un immeuble…",
    "Zip / City *": "CP / Ville *",
    "3 months": "3 mois",
    "2 weeks": "2 semaines",
    "Deposit Due": "Dépôt dû",
    "At signature": "À la signature",
    "By lease start": "Au début du bail",
    "Actual": "Réel",
    "Old": "Ancien",
    "New": "Nouveau",
    "Change": "Modification",
    "Signers": "Signataires",
    "Start Date": "Date de début",
    "End Date": "Date de fin",
    "Monthly Rent": "Loyer mensuel",
    "Deposit": "Dépôt de garantie",
    "Signed At": "Signé le",
    "Scheduled Date": "Date planifiée",
    "Completed Date": "Date de réalisation",
    "Total/mo": "Total/mois",
    "Jean Dupont": "Jean Dupont",
    "Loading…": "Chargement…",
    "OpEx": "OpEx",
    "CapEx": "CapEx",
    "Historical / projected": "Historique / projeté",
    "Income": "Revenus",
    "All scopes": "Tous les périmètres",
    "Org-private": "Privé (org.)",
    "Global library": "Bibliothèque globale",
    "Expand All": "Tout développer",
    "Collapse All": "Tout réduire",
    "Source": "Source",
    "Lifespan Legend": "Légende des durées de vie",
    "Columns": "Colonnes",
    "Density": "Densité",
    "Comfortable": "Confortable",
    "Compact": "Compact",
    "Drag to reorder": "Glisser pour réordonner",

    # More common labels
    "By specific date": "À une date précise",
    "Payment Due Day": "Jour d'échéance du paiement",
    "Payment IBAN": "IBAN de paiement",
    "Reference Rate %": "Taux de référence %",
    "Includes house rules": "Inclut le règlement intérieur",
    "Select a lease to copy from...": "Sélectionner un bail à copier…",
    "Loading templates…": "Chargement des modèles…",
    "No leases found": "Aucun bail trouvé",
    "No contractors found.": "Aucun prestataire trouvé.",
    "Org ID": "ID Organisation",
    "Loading leases…": "Chargement des baux…",
    "Loading jobs…": "Chargement des interventions…",
    "No repair-vs-replace data available for this asset.": "Aucune analyse réparation/remplacement disponible pour cet actif.",
    "Est. repair": "Réparation est.",
    "Est. replacement": "Remplacement est.",
    "Request not found.": "Demande introuvable.",
    "No legal analysis available for this request.": "Aucune analyse juridique disponible pour cette demande.",
    "No asset linked to this request.": "Aucun actif lié à cette demande.",
    "Paying Party": "Partie payante",
    "Model": "Modèle",
    "excl. VAT": "HT",
    "Duration": "Durée",
    "Available": "Disponible",
    "RFP not found.": "Appel d'offres introuvable.",
    "Invited": "Invité",
    "Coming soon": "Bientôt disponible",
    "Notification Preferences": "Préférences de notification",
    "Integrations": "Intégrations",
    "Loading sources…": "Chargement des sources…",
    "Last Synced": "Dernière synchronisation",
    "Key": "Clé",
    "Disqualified": "Disqualifié",
    "Minimum 3 characters. This will be recorded for audit.": "Minimum 3 caractères. Ceci sera enregistré pour audit.",
    "Applicant": "Candidat",
    "Score": "Score",
    "Medium": "Moyen",
    "Emergency": "Urgence",
    "Outstanding": "En suspens",
    "Location": "Emplacement",
    "Brand": "Marque",
    "📍 Location": "📍 Emplacement",
    "No emails in outbox.": "Aucun e-mail dans la boîte d'envoi.",
    "Template": "Modèle",
    "Subject": "Objet",
    "Body": "Corps",
    "Payload": "Données",
    "Charge Items": "Éléments de charge",
    "Loading charges...": "Chargement des charges…",
    "No itemized charge data found.": "Aucune donnée de charge détaillée.",
    "Loading expenses...": "Chargement des dépenses…",
    "Loading PDF…": "Chargement du PDF…",
    "The invoice is being processed.": "La facture est en cours de traitement.",
    "Recurring": "Récurrent",
    "No invoices match this filter.": "Aucune facture ne correspond à ce filtre.",
    "⚠ This invoice needs review": "⚠ Cette facture nécessite une révision",
    "Select billing entity": "Sélectionner une entité de facturation",
    "No billing entity linked.": "Aucune entité de facturation liée.",
    "Locked": "Verrouillé",
    "Qty": "Qté",
    "No journal entries found": "Aucune écriture comptable trouvée",
    "No entries for this period": "Aucune écriture pour cette période",
    "Adjust the date range and apply filters above.": "Ajustez la plage de dates et appliquez les filtres ci-dessus.",
    "Event type": "Type d'événement",
    "Loading payments...": "Chargement des paiements…",
    "No payments found for the selected filters.": "Aucun paiement trouvé pour les filtres sélectionnés.",
    "No buildings found.": "Aucun immeuble trouvé.",
    "Analysing assets…": "Analyse des actifs…",
    "Select a unit to see its repair vs replace analysis.": "Sélectionnez une unité pour voir l'analyse réparation/remplacement.",
    "No assets recorded for this unit yet.": "Aucun actif enregistré pour cette unité.",
    "If next repair CHF": "Si la prochaine réparation CHF",
    "Sensitivity unavailable": "Sensibilité indisponible",
    "Hover a row for the recommendation reason.": "Survolez une ligne pour voir la raison de la recommandation.",
    "Age / Life": "Âge / Durée de vie",
    "Loading lease...": "Chargement du bail…",
    "No repair-vs-replace data available for this asset.": "Aucune donnée réparation/remplacement disponible.",
    "Bundle": "Grouper",
    "Administration": "Administration",
    "Performance": "Performance",
    "Mode": "Mode",
    "Direction": "Direction",
    "Canton": "Canton",
    "OK:": "OK :",
    "▼ docs": "▼ docs",

    # Charge reconciliations
    "Charge Reconciliations": "Réconciliations des charges",
    "Expense Lines": "Lignes de dépenses",
    "Nebenkosten": "Charges accessoires",

    # Email
    "Email Detail": "Détail de l'e-mail",

    # Contractor billing
    "Schedule Details": "Détails du planning",
    "Create Billing Schedule": "Créer un calendrier de facturation",
    "Contractor Billing": "Facturation des prestataires",

    # People
    "View tenant": "Voir le locataire",
    "View vendor": "Voir le prestataire",

    # Vacancy/applications
    "Override Disqualification": "Annuler la disqualification",
    "Adjust Score": "Ajuster le score",
    "Click to view corroborative documents": "Cliquer pour voir les documents justificatifs",
    "Inventory": "Inventaire",
    "Applications": "Candidatures",

    # Rent adjustments
    "Rejection": "Rejet",
    "Application": "Candidature",

    # Settings
    "Configure building": "Configurer l'immeuble",

    # Asset catalogue additions
    "Asset": "Actif",
    "Scheduled": "Planifié",
    "Estimated cost": "Coût estimé",
    "Useful Life": "Durée de vie utile",
    "Replace Cost": "Coût de remplacement",
    "Model ref.": "Réf. modèle",
    "Manufacturer": "Fabricant",
    "Org-Private": "Privé (org.)",
    "Editable by your org": "Modifiable par votre organisation",
    "Global Library": "Bibliothèque globale",
    "Shared read-only models": "Modèles partagés en lecture seule",
    "Name is required.": "Le nom est requis.",
    "Category is required.": "La catégorie est requise.",
    "Uncategorised": "Non catégorisé",

    # Contractor portal (extra)
    "Completed jobs": "Interventions terminées",
    "Pending jobs": "Interventions en attente",
    "Active jobs": "Interventions actives",
    "Open invoices": "Factures ouvertes",
    "Pending invoices": "Factures en attente",
    "Open RFPs": "Appels d'offres ouverts",

    # General
    "Showing": "Affichage",
    "of": "de",
    "Page": "Page",
    "Previous": "Précédent",
    "Next": "Suivant",
    "Confirmed": "Confirmé",
    "Active": "Actif",
    "Completed": "Terminé",
    "Cancelled": "Annulé",
    "Approved": "Approuvé",
    "Rejected": "Rejeté",
    "Signed": "Signé",
    "Draft": "Brouillon",
    "Expired": "Expiré",
    "Terminated": "Résilié",
    "Failed": "Échoué",
    "Success": "Succès",
    "Warning": "Avertissement",
    "Info": "Information",
}

# ── translation function ─────────────────────────────────────────────────────

def translate(text):
    """Try to translate a text string. Returns None if no translation found."""
    t = text.strip()

    # Exact match first
    if t in PHRASES:
        return PHRASES[t]

    # Strip trailing colon, translate, re-add
    if t.endswith(":") and t[:-1].strip() in PHRASES:
        return PHRASES[t[:-1].strip()] + " :"

    # Strip trailing ellipsis, translate, re-add
    for suffix in ["…", "..."]:
        if t.endswith(suffix):
            base = t[:-len(suffix)].strip()
            if base in PHRASES:
                return PHRASES[base] + suffix

    # Case-insensitive match
    tl = t.lower()
    for en, fr in PHRASES.items():
        if en.lower() == tl:
            return fr

    # Try applying phrase substitutions within a longer string
    result = t
    replaced = False
    for en_phrase, fr_phrase in sorted(PHRASES.items(), key=lambda x: -len(x[0])):
        if en_phrase in result:
            result = result.replace(en_phrase, fr_phrase, 1)
            replaced = True

    if replaced and result != t:
        return result

    return None

# ── apply to locale files ────────────────────────────────────────────────────

def translate_dict(en_d: dict, fr_d: dict, path: str = "") -> tuple[int, int]:
    """
    Walk en_d and fr_d in parallel.
    For each leaf where fr_d[k] == en_d[k] (placeholder), try to translate.
    Returns (translated, skipped).
    """
    translated = 0
    skipped = 0
    for k in en_d:
        en_val = en_d[k]
        fr_val = fr_d.get(k)
        if isinstance(en_val, dict):
            sub_fr = fr_d.setdefault(k, {})
            t, s = translate_dict(en_val, sub_fr, f"{path}.{k}")
            translated += t
            skipped += s
        elif isinstance(en_val, str):
            if fr_val == en_val:  # placeholder
                tr = translate(en_val)
                if tr:
                    fr_d[k] = tr
                    translated += 1
                else:
                    skipped += 1
    return translated, skipped


def process_ns(ns: str):
    en_path = LOCALES / "en" / f"{ns}.json"
    fr_path = LOCALES / "fr" / f"{ns}.json"
    if not en_path.exists():
        return
    en_data = json.loads(en_path.read_text())
    fr_data = json.loads(fr_path.read_text()) if fr_path.exists() else {}

    translated, skipped = translate_dict(en_data, fr_data)
    fr_path.write_text(json.dumps(fr_data, indent=2, ensure_ascii=False) + "\n")
    print(f"  [{ns}] translated={translated} still-EN={skipped}")


if __name__ == "__main__":
    for ns in ["common", "manager", "owner", "contractor", "tenant"]:
        process_ns(ns)
    print("\nDone.")
