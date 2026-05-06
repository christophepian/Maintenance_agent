#!/usr/bin/env python3
"""Update EN and FR manager.json with all new translation keys for buildings/[id] and requests/[id] pages."""
import json

BASE = "/Users/christophepian/Documents/Maintenance_Agent/"

new_buildings_en = {
  "tabs": {
    "buildingInformation": "Building information",
    "units": "Units",
    "tenants": "Tenants",
    "assets": "Assets",
    "documents": "Documents",
    "policies": "Policies",
    "financials": "Financials",
    "requests": "Requests"
  },
  "kpi": {
    "openRequests": "Open Requests",
    "openJobs": "Open Jobs",
    "noiYtd": "NOI (YTD)",
    "vsPortfolio": "vs Portfolio",
    "pendingApprovedAssigned": "Pending, approved, assigned",
    "pendingPlusInProgress": "Pending + in progress",
    "buildingNoiYtd": "Building NOI (YTD)",
    "vsPortfolioLong": "vs. Portfolio",
    "collectionRate": "collection rate",
    "noFinancialData": "No financial data",
    "notEnoughPortfolioData": "Not enough portfolio data",
    "betterThanOtherAssets": "Better than other assets (NOI)",
    "worseThanOtherAssets": "Worse than other assets (NOI)"
  },
  "btn": {
    "saving": "Saving\u2026",
    "saveChanges": "Save changes",
    "cancel": "Cancel",
    "deactivate": "Deactivate",
    "edit": "Edit",
    "addUnit": "Add unit",
    "cancelUnit": "Cancel",
    "creating": "Creating\u2026",
    "createUnit": "Create unit",
    "addAsset": "+ Add Asset",
    "cancelAsset": "Cancel",
    "save": "Save",
    "remove": "Remove",
    "addOwner": "Add Owner",
    "add": "Add",
    "savePolicies": "Save policies",
    "addCondition": "+ Add condition",
    "createRule": "Create rule",
    "activate": "Activate",
    "delete": "Delete",
    "editPolicies": "Edit policies",
    "cancelPolicies": "Cancel",
    "addOverride": "+ Add override rule"
  },
  "label": {
    "name": "Name",
    "yearBuilt": "Year Built",
    "managedSince": "Managed Since",
    "elevator": "Elevator",
    "concierge": "Concierge",
    "amenities": "Amenities",
    "owners": "Owners",
    "noOwnersAssigned": "No owners assigned to this building.",
    "strategy": "Strategy",
    "roleIntent": "Role intent",
    "buildingType": "Building type",
    "condition": "Condition",
    "approxUnits": "Approx. units",
    "guidelines": "Guidelines",
    "type": "Type",
    "autoApproveLimit": "Auto-approve limit (CHF)",
    "ownerThreshold": "Owner threshold (CHF)",
    "emergencyAutoDispatch": "Emergency auto-dispatch",
    "autoApproveLimitView": "Auto-approve limit",
    "ownerThresholdView": "Owner threshold",
    "usingOrgDefault": "(using org default)",
    "blankOrgDefault": "(blank = use org default)",
    "enabled": "Enabled",
    "disabled": "Disabled",
    "inactive": "Inactive",
    "priorityPrefix": "Priority: ",
    "ruleName": "Rule name",
    "priorityLabel": "Priority (higher = evaluated first)",
    "conditions": "Conditions (all must match)",
    "action": "Action"
  },
  "select": {
    "selectOwner": "Select an owner\u2026",
    "residential": "Residential",
    "commonArea": "Common Area",
    "category": "Category",
    "estimatedCost": "Estimated Cost",
    "unitType": "Unit Type",
    "contractor": "Contractor",
    "equals": "Equals",
    "notEquals": "Not Equals",
    "lessThan": "Less Than",
    "lessThanOrEqual": "Less Than or Equal",
    "greaterThan": "Greater Than",
    "greaterThanOrEqual": "Greater Than or Equal",
    "contains": "Contains",
    "startsWith": "Starts With",
    "endsWith": "Ends With",
    "autoApprove": "Auto-approve",
    "requireManagerReview": "Require manager review",
    "requireOwnerApproval": "Require owner approval"
  },
  "text": {
    "loadingBuilding": "Loading building...",
    "buildingNotFound": "Building not found.",
    "noUnitsYet": "No units yet.",
    "noTenantsYet": "No tenants for this building yet.",
    "noApprovalRulesYet": "No approval rules yet.",
    "loadingRequests": "Loading requests\u2026",
    "noRequestsYet": "No requests for this building yet.",
    "overrideDesc": "Define context-specific approval overrides for this building (e.g., \"auto-approve ovens < CHF 500\").",
    "autoApproveDesc": "Building-level thresholds for auto-approval and emergency dispatch. Leave blank to use org defaults.",
    "leaseTemplateDesc": "A lease template defines the default contract terms (landlord info, notice rules, payment details, deposit) that are automatically applied when a new tenant is selected. Without a template, leases must be created manually.",
    "goToLeaseTemplates": "Go to Lease Templates \u2192",
    "template": "TEMPLATE",
    "landlordPrefix": "Landlord: ",
    "defaultRentPrefix": "Default rent: CHF ",
    "defaultRentSuffix": ".-/month",
    "occupied": "Occupied",
    "vacant": "Vacant",
    "listed": "Listed",
    "all": "All",
    "acceptingApplications": "Accepting applications",
    "since": "Since ",
    "commonArea": "Common Area",
    "unitOf": "of",
    "units": "units",
    "unit": "unit",
    "better": "Better",
    "worse": "Worse",
    "thanOtherAssetsNoi": " than other assets (NOI)",
    "both": "Both",
    "lease": "Lease",
    "directory": "Directory"
  },
  "col": {
    "name": "Name",
    "unit": "Unit",
    "phone": "Phone",
    "email": "Email",
    "moveIn": "Move-in",
    "source": "Source",
    "number": "#",
    "status": "Status",
    "category": "Category",
    "urgency": "Urgency",
    "contractor": "Contractor",
    "date": "Date"
  }
}

new_requests_en = {
  "stage": {
    "review": "Review",
    "rfp": "RFP",
    "contractor": "Contractor",
    "inProgress": "In Progress",
    "completed": "Completed",
    "ownerApproval": "Owner Approval"
  },
  "status": {
    "pendingReview": "Pending Review",
    "rfpPending": "RFP Pending",
    "ownerApproval": "Owner Approval",
    "autoApproved": "Auto-Approved",
    "approved": "Approved",
    "rejected": "Rejected",
    "tenantFunded": "Tenant-Funded"
  },
  "urgency": {
    "low": "Low",
    "medium": "Medium",
    "high": "High"
  },
  "tabs": {
    "details": "Details",
    "advisory": "Advisory"
  },
  "btn": {
    "approve": "\u2713 Approve",
    "reject": "\u2717 Reject",
    "viewRfp": "View RFP",
    "assignContractor": "Assign Contractor",
    "unassign": "Unassign",
    "confirm": "Confirm",
    "cancel": "Cancel",
    "unlink": "Unlink",
    "linkAsset": "Link asset",
    "routing": "Routing\u2026",
    "routeToRfp": "Route to RFP \u2192"
  },
  "text": {
    "loadingAssetAnalysis": "Loading asset analysis\u2026",
    "ownerContext": "Owner Context",
    "archetypeAdjusted": "Archetype adjusted",
    "tenantFundedBadge": "Tenant-funded",
    "reasonPrefix": "Reason: ",
    "floorPrefix": "Floor ",
    "landlord": "Landlord",
    "noAssetLinked": "No asset linked \u2014 use \"+ Link asset\" above",
    "viewRfpLink": "View Request for Proposals \u2192",
    "legalObligation": "This request is a legal obligation \u2014 the landlord must act. Auto-routing was skipped or not yet applied.",
    "throughUsefulLife": "% through its useful life",
    "checkAdvisoryTab": "Check the Advisory tab for repair/replace analysis.",
    "replacementRecommended": "Replacement recommended",
    "planReplacementSoon": "Plan replacement soon",
    "cumulative": "(cumulative)",
    "ratioPrefix": "Ratio: ",
    "breakEvenPrefix": "Break-even: ",
    "exceeded": "Exceeded",
    "yUsefulLife": "y useful life",
    "confidence": "confidence",
    "selectContractor": "Select contractor\u2026"
  },
  "rec": {
    "repair": "Repair",
    "monitor": "Monitor & Repair",
    "planReplacement": "Plan Replacement",
    "replace": "Replace"
  }
}

new_buildings_fr = {
  "tabs": {
    "buildingInformation": "Informations immeuble",
    "units": "Unit\u00e9s",
    "tenants": "Locataires",
    "assets": "\u00c9quipements",
    "documents": "Documents",
    "policies": "Politiques",
    "financials": "Finances",
    "requests": "Demandes"
  },
  "kpi": {
    "openRequests": "Demandes ouvertes",
    "openJobs": "Postes ouverts",
    "noiYtd": "RNI (cumul annuel)",
    "vsPortfolio": "vs Portefeuille",
    "pendingApprovedAssigned": "En attente, approuv\u00e9, assign\u00e9",
    "pendingPlusInProgress": "En attente + en cours",
    "buildingNoiYtd": "RNI Immeuble (cumul)",
    "vsPortfolioLong": "vs Portefeuille",
    "collectionRate": "taux d\u2019encaissement",
    "noFinancialData": "Pas de donn\u00e9es financi\u00e8res",
    "notEnoughPortfolioData": "Donn\u00e9es portefeuille insuffisantes",
    "betterThanOtherAssets": "Mieux que les autres biens (RNI)",
    "worseThanOtherAssets": "Moins bien que les autres biens (RNI)"
  },
  "btn": {
    "saving": "Enregistrement\u2026",
    "saveChanges": "Enregistrer",
    "cancel": "Annuler",
    "deactivate": "D\u00e9sactiver",
    "edit": "Modifier",
    "addUnit": "Ajouter une unit\u00e9",
    "cancelUnit": "Annuler",
    "creating": "Cr\u00e9ation\u2026",
    "createUnit": "Cr\u00e9er l\u2019unit\u00e9",
    "addAsset": "+ Ajouter \u00e9quipement",
    "cancelAsset": "Annuler",
    "save": "Enregistrer",
    "remove": "Supprimer",
    "addOwner": "Ajouter un propri\u00e9taire",
    "add": "Ajouter",
    "savePolicies": "Enregistrer les politiques",
    "addCondition": "+ Ajouter condition",
    "createRule": "Cr\u00e9er la r\u00e8gle",
    "activate": "Activer",
    "delete": "Supprimer",
    "editPolicies": "Modifier les politiques",
    "cancelPolicies": "Annuler",
    "addOverride": "+ Ajouter r\u00e8gle d\u2019exception"
  },
  "label": {
    "name": "Nom",
    "yearBuilt": "Ann\u00e9e de construction",
    "managedSince": "G\u00e9r\u00e9 depuis",
    "elevator": "Ascenseur",
    "concierge": "Concierge",
    "amenities": "\u00c9quipements",
    "owners": "Propri\u00e9taires",
    "noOwnersAssigned": "Aucun propri\u00e9taire assign\u00e9 \u00e0 cet immeuble.",
    "strategy": "Strat\u00e9gie",
    "roleIntent": "Intention de r\u00f4le",
    "buildingType": "Type d\u2019immeuble",
    "condition": "\u00c9tat",
    "approxUnits": "Unit\u00e9s approx.",
    "guidelines": "Directives",
    "type": "Type",
    "autoApproveLimit": "Limite d\u2019approbation automatique (CHF)",
    "ownerThreshold": "Seuil propri\u00e9taire (CHF)",
    "emergencyAutoDispatch": "D\u00e9ploiement automatique d\u2019urgence",
    "autoApproveLimitView": "Limite d\u2019approbation automatique",
    "ownerThresholdView": "Seuil propri\u00e9taire",
    "usingOrgDefault": "(valeur org par d\u00e9faut)",
    "blankOrgDefault": "(vide = valeur org par d\u00e9faut)",
    "enabled": "Activ\u00e9",
    "disabled": "D\u00e9sactiv\u00e9",
    "inactive": "Inactif",
    "priorityPrefix": "Priorit\u00e9 : ",
    "ruleName": "Nom de la r\u00e8gle",
    "priorityLabel": "Priorit\u00e9 (plus \u00e9lev\u00e9e = \u00e9valu\u00e9e en premier)",
    "conditions": "Conditions (toutes doivent \u00eatre remplies)",
    "action": "Action"
  },
  "select": {
    "selectOwner": "S\u00e9lectionner un propri\u00e9taire\u2026",
    "residential": "R\u00e9sidentiel",
    "commonArea": "Partie commune",
    "category": "Cat\u00e9gorie",
    "estimatedCost": "Co\u00fbt estim\u00e9",
    "unitType": "Type d\u2019unit\u00e9",
    "contractor": "Prestataire",
    "equals": "\u00c9gal \u00e0",
    "notEquals": "Diff\u00e9rent de",
    "lessThan": "Inf\u00e9rieur \u00e0",
    "lessThanOrEqual": "Inf\u00e9rieur ou \u00e9gal \u00e0",
    "greaterThan": "Sup\u00e9rieur \u00e0",
    "greaterThanOrEqual": "Sup\u00e9rieur ou \u00e9gal \u00e0",
    "contains": "Contient",
    "startsWith": "Commence par",
    "endsWith": "Se termine par",
    "autoApprove": "Approbation automatique",
    "requireManagerReview": "R\u00e9vision gestionnaire requise",
    "requireOwnerApproval": "Approbation propri\u00e9taire requise"
  },
  "text": {
    "loadingBuilding": "Chargement de l\u2019immeuble\u2026",
    "buildingNotFound": "Immeuble introuvable.",
    "noUnitsYet": "Aucune unit\u00e9 pour l\u2019instant.",
    "noTenantsYet": "Aucun locataire pour cet immeuble.",
    "noApprovalRulesYet": "Aucune r\u00e8gle d\u2019approbation.",
    "loadingRequests": "Chargement des demandes\u2026",
    "noRequestsYet": "Aucune demande pour cet immeuble.",
    "overrideDesc": "D\u00e9finissez des exceptions contextuelles pour cet immeuble (ex. : approbation automatique < CHF 500 pour les fours).",
    "autoApproveDesc": "Seuils au niveau de l\u2019immeuble pour l\u2019approbation automatique et l\u2019urgence. Laissez vide pour utiliser les valeurs par d\u00e9faut de l\u2019organisation.",
    "leaseTemplateDesc": "Un mod\u00e8le de bail d\u00e9finit les conditions contractuelles par d\u00e9faut (informations bailleur, r\u00e8gles de r\u00e9siliation, modalit\u00e9s de paiement, d\u00e9p\u00f4t) appliqu\u00e9es automatiquement lors de la s\u00e9lection d\u2019un nouveau locataire. Sans mod\u00e8le, les baux doivent \u00eatre cr\u00e9\u00e9s manuellement.",
    "goToLeaseTemplates": "Aller aux mod\u00e8les de bail \u2192",
    "template": "MOD\u00c8LE",
    "landlordPrefix": "Bailleur : ",
    "defaultRentPrefix": "Loyer par d\u00e9faut : CHF ",
    "defaultRentSuffix": ".-/mois",
    "occupied": "Occup\u00e9",
    "vacant": "Vacant",
    "listed": "En annonce",
    "all": "Tout",
    "acceptingApplications": "Candidatures ouvertes",
    "since": "Depuis ",
    "commonArea": "Partie commune",
    "unitOf": "sur",
    "units": "unit\u00e9s",
    "unit": "unit\u00e9",
    "better": "Mieux",
    "worse": "Moins bien",
    "thanOtherAssetsNoi": " que les autres biens (RNI)",
    "both": "Les deux",
    "lease": "Bail",
    "directory": "Annuaire"
  },
  "col": {
    "name": "Nom",
    "unit": "Unit\u00e9",
    "phone": "T\u00e9l\u00e9phone",
    "email": "E-mail",
    "moveIn": "Emm\u00e9nagement",
    "source": "Source",
    "number": "N\u00b0",
    "status": "Statut",
    "category": "Cat\u00e9gorie",
    "urgency": "Urgence",
    "contractor": "Prestataire",
    "date": "Date"
  }
}

new_requests_fr = {
  "stage": {
    "review": "R\u00e9vision",
    "rfp": "Appel d\u2019offres",
    "contractor": "Prestataire",
    "inProgress": "En cours",
    "completed": "Termin\u00e9",
    "ownerApproval": "Approbation propri\u00e9taire"
  },
  "status": {
    "pendingReview": "En attente de r\u00e9vision",
    "rfpPending": "Appel d\u2019offres en attente",
    "ownerApproval": "Approbation propri\u00e9taire",
    "autoApproved": "Approuv\u00e9 automatiquement",
    "approved": "Approuv\u00e9",
    "rejected": "Rejet\u00e9",
    "tenantFunded": "Financ\u00e9 par le locataire"
  },
  "urgency": {
    "low": "Faible",
    "medium": "Moyen",
    "high": "\u00c9lev\u00e9"
  },
  "tabs": {
    "details": "D\u00e9tails",
    "advisory": "Conseil"
  },
  "btn": {
    "approve": "\u2713 Approuver",
    "reject": "\u2717 Rejeter",
    "viewRfp": "Voir l\u2019appel d\u2019offres",
    "assignContractor": "Assigner un prestataire",
    "unassign": "D\u00e9sassigner",
    "confirm": "Confirmer",
    "cancel": "Annuler",
    "unlink": "Dissocier",
    "linkAsset": "Lier l\u2019\u00e9quipement",
    "routing": "Routage\u2026",
    "routeToRfp": "Envoyer en appel d\u2019offres \u2192"
  },
  "text": {
    "loadingAssetAnalysis": "Chargement de l\u2019analyse \u00e9quipement\u2026",
    "ownerContext": "Contexte propri\u00e9taire",
    "archetypeAdjusted": "Ajust\u00e9 par arch\u00e9type",
    "tenantFundedBadge": "Financ\u00e9 par le locataire",
    "reasonPrefix": "Motif : ",
    "floorPrefix": "\u00c9tage ",
    "landlord": "Bailleur",
    "noAssetLinked": "Aucun \u00e9quipement li\u00e9 \u2014 utilisez \u00ab\u00a0+ Lier l\u2019\u00e9quipement\u00a0\u00bb ci-dessus",
    "viewRfpLink": "Voir l\u2019appel d\u2019offres \u2192",
    "legalObligation": "Cette demande est une obligation l\u00e9gale \u2014 le bailleur doit agir. Le routage automatique a \u00e9t\u00e9 ignor\u00e9 ou n\u2019a pas encore \u00e9t\u00e9 appliqu\u00e9.",
    "throughUsefulLife": "% de sa dur\u00e9e de vie utile",
    "checkAdvisoryTab": "Consultez l\u2019onglet Conseil pour l\u2019analyse r\u00e9parer/remplacer.",
    "replacementRecommended": "Remplacement recommand\u00e9",
    "planReplacementSoon": "Planifier le remplacement prochainement",
    "cumulative": "(cumulatif)",
    "ratioPrefix": "Ratio : ",
    "breakEvenPrefix": "Seuil de rentabilit\u00e9 : ",
    "exceeded": "D\u00e9pass\u00e9",
    "yUsefulLife": "ans de dur\u00e9e de vie utile",
    "confidence": "confiance",
    "selectContractor": "S\u00e9lectionner un prestataire\u2026"
  },
  "rec": {
    "repair": "R\u00e9parer",
    "monitor": "Surveiller et r\u00e9parer",
    "planReplacement": "Planifier le remplacement",
    "replace": "Remplacer"
  }
}

pairs = [
    ("apps/web/public/locales/en/manager.json", new_buildings_en, new_requests_en),
    ("apps/web/public/locales/fr/manager.json", new_buildings_fr, new_requests_fr),
]

for relpath, bldg_new, req_new in pairs:
    full = BASE + relpath
    with open(full) as f:
        d = json.load(f)
    for k, v in bldg_new.items():
        d["buildingsId"][k] = v
    for k, v in req_new.items():
        d["requestsId"][k] = v
    with open(full, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Updated {relpath}")

print("Done")
