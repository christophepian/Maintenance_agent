#!/usr/bin/env python3
import json

EN = "apps/web/public/locales/en/manager.json"
FR = "apps/web/public/locales/fr/manager.json"

with open(EN) as f:
    en = json.load(f)
with open(FR) as f:
    fr = json.load(f)

# ── buildings missing keys ──────────────────────────────────────────────────
bld_text_en = {
    "all": "All",
    "occupied": "Occupied",
    "vacant": "Vacant",
    "listed": "Listed",
    "since": "Since ",
    "acceptingApplications": "Accepting applications",
    "commonArea": "Common Area",
    "both": "Both",
    "lease": "Lease",
    "directory": "Directory",
    "noTenantsYet": "No tenants found for this building.",
    "overrideDesc": "Define context-specific approval overrides for this building (e.g., \"auto-approve ovens < CHF 500\").",
    "autoApproveDesc": "Building-level thresholds for auto-approval and emergency dispatch. Leave blank to use org defaults.",
    "leaseTemplateDesc": "A lease template defines the default contract terms (landlord info, notice rules, payment details, deposit) that are automatically applied when a new tenant is selected. Without a template, leases must be created manually.",
    "goToLeaseTemplates": "Go to Lease Templates \u2192",
    "loadingRequests": "Loading requests\u2026",
    "noRequestsYet": "No requests found for this building.",
    "noApprovalRulesYet": "No approval rules yet.",
}
bld_text_fr = {
    "all": "Tout",
    "occupied": "Occup\u00e9",
    "vacant": "Vacant",
    "listed": "En annonce",
    "since": "Depuis ",
    "acceptingApplications": "Candidatures ouvertes",
    "commonArea": "Partie commune",
    "both": "Les deux",
    "lease": "Bail",
    "directory": "R\u00e9pertoire",
    "noTenantsYet": "Aucun locataire trouv\u00e9 pour cet immeuble.",
    "overrideDesc": "D\u00e9finissez des r\u00e8gles d\u2019approbation sp\u00e9cifiques \u00e0 cet immeuble (ex. \u00ab auto-approuver les fours < CHF 500 \u00bb).",
    "autoApproveDesc": "Seuils au niveau de l\u2019immeuble pour l\u2019auto-approbation et l\u2019intervention d\u2019urgence. Laisser vide pour utiliser les param\u00e8tres de l\u2019organisation.",
    "leaseTemplateDesc": "Un mod\u00e8le de bail d\u00e9finit les conditions contractuelles par d\u00e9faut (propri\u00e9taire, pr\u00e9avis, paiement, d\u00e9p\u00f4t) automatiquement appliqu\u00e9es \u00e0 chaque nouveau locataire. Sans mod\u00e8le, les baux doivent \u00eatre cr\u00e9\u00e9s manuellement.",
    "goToLeaseTemplates": "Aller aux mod\u00e8les de bail \u2192",
    "loadingRequests": "Chargement des demandes\u2026",
    "noRequestsYet": "Aucune demande trouv\u00e9e pour cet immeuble.",
    "noApprovalRulesYet": "Aucune r\u00e8gle d\u2019approbation pour l\u2019instant.",
}

bld_label_en = {
    "type": "Type",
    "blankOrgDefault": "(blank = use org default)",
    "autoApproveLimit": "Auto-approve limit (CHF)",
    "ownerThreshold": "Owner threshold (CHF)",
    "emergencyAutoDispatch": "Emergency auto-dispatch",
    "autoApproveLimitView": "Auto-approve limit",
    "ownerThresholdView": "Owner threshold",
    "usingOrgDefault": "(using org default)",
    "enabled": "Enabled",
    "disabled": "Disabled",
    "inactive": "Inactive",
    "priorityPrefix": "Priority: ",
    "ruleName": "Rule name",
    "priorityLabel": "Priority (higher = evaluated first)",
    "conditions": "Conditions (all must match)",
    "action": "Action",
}
bld_label_fr = {
    "type": "Type",
    "blankOrgDefault": "(vide = valeur de l\u2019organisation)",
    "autoApproveLimit": "Limite d\u2019auto-approbation (CHF)",
    "ownerThreshold": "Seuil propri\u00e9taire (CHF)",
    "emergencyAutoDispatch": "Dispatch d\u2019urgence automatique",
    "autoApproveLimitView": "Limite d\u2019auto-approbation",
    "ownerThresholdView": "Seuil propri\u00e9taire",
    "usingOrgDefault": "(valeur de l\u2019organisation)",
    "enabled": "Activ\u00e9",
    "disabled": "D\u00e9sactiv\u00e9",
    "inactive": "Inactif",
    "priorityPrefix": "Priorit\u00e9\u00a0: ",
    "ruleName": "Nom de la r\u00e8gle",
    "priorityLabel": "Priorit\u00e9 (plus \u00e9lev\u00e9e = \u00e9valu\u00e9e en premier)",
    "conditions": "Conditions (toutes doivent correspondre)",
    "action": "Action",
}

bld_col_en = {
    "number": "#",
    "name": "Name",
    "unit": "Unit",
    "phone": "Phone",
    "email": "Email",
    "moveIn": "Move-in",
    "source": "Source",
    "status": "Status",
    "category": "Category",
    "urgency": "Urgency",
    "contractor": "Contractor",
    "date": "Date",
}
bld_col_fr = {
    "number": "#",
    "name": "Nom",
    "unit": "Unit\u00e9",
    "phone": "T\u00e9l\u00e9phone",
    "email": "Email",
    "moveIn": "Emm\u00e9nagement",
    "source": "Source",
    "status": "Statut",
    "category": "Cat\u00e9gorie",
    "urgency": "Urgence",
    "contractor": "Prestataire",
    "date": "Date",
}

bld_btn_en = {
    "cancelPolicies": "Cancel",
    "editPolicies": "Edit policies",
    "deactivate": "Deactivate",
    "activate": "Activate",
    "delete": "Delete",
    "addOverride": "Create rule",
    "createRule": "Create rule",
}
bld_btn_fr = {
    "cancelPolicies": "Annuler",
    "editPolicies": "Modifier les politiques",
    "deactivate": "D\u00e9sactiver",
    "activate": "Activer",
    "delete": "Supprimer",
    "addOverride": "Cr\u00e9er une r\u00e8gle",
    "createRule": "Cr\u00e9er une r\u00e8gle",
}

bld_select_en = {
    "residential": "Residential",
    "commonArea": "Common Area",
    "category": "Category",
    "estimatedCost": "Estimated Cost",
    "unitType": "Unit Type",
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
    "requireOwnerApproval": "Require owner approval",
}
bld_select_fr = {
    "residential": "R\u00e9sidentiel",
    "commonArea": "Partie commune",
    "category": "Cat\u00e9gorie",
    "estimatedCost": "Co\u00fbt estim\u00e9",
    "unitType": "Type d\u2019unit\u00e9",
    "equals": "\u00c9gal \u00e0",
    "notEquals": "Diff\u00e9rent de",
    "lessThan": "Inf\u00e9rieur \u00e0",
    "lessThanOrEqual": "Inf\u00e9rieur ou \u00e9gal \u00e0",
    "greaterThan": "Sup\u00e9rieur \u00e0",
    "greaterThanOrEqual": "Sup\u00e9rieur ou \u00e9gal \u00e0",
    "contains": "Contient",
    "startsWith": "Commence par",
    "endsWith": "Termine par",
    "autoApprove": "Auto-approuver",
    "requireManagerReview": "Exiger la revue du gestionnaire",
    "requireOwnerApproval": "Exiger l\u2019approbation du propri\u00e9taire",
}

# ── requests missing keys ───────────────────────────────────────────────────
req_text_en = {
    "noAssetLinkedNoUnit": "No asset linked.",
    "throughUsefulLife": "is {pct}% through its useful life",
    "yUsefulLife": "y / {n}y useful life",
}
req_text_fr = {
    "noAssetLinkedNoUnit": "Aucun \u00e9quipement li\u00e9.",
    "throughUsefulLife": "a \u00e9puis\u00e9 {pct}% de sa dur\u00e9e de vie utile",
    "yUsefulLife": "ans / {n} ans de dur\u00e9e de vie utile",
}

req_rec_en = {
    "planreplacement": "Plan Replacement",
}
req_rec_fr = {
    "planreplacement": "Planifier le remplacement",
}

req_stage_en = {
    "inprogress": "In Progress",
    "ownerapproval": "Owner Approval",
}
req_stage_fr = {
    "inprogress": "En cours",
    "ownerapproval": "Approbation propri\u00e9taire",
}

# ── merge ───────────────────────────────────────────────────────────────────
def merge(d, path, additions):
    node = d
    for k in path:
        node = node.setdefault(k, {})
    for k, v in additions.items():
        if k not in node:
            node[k] = v

merge(en, ["buildingsId", "text"], bld_text_en)
merge(en, ["buildingsId", "label"], bld_label_en)
merge(en, ["buildingsId", "col"], bld_col_en)
merge(en, ["buildingsId", "btn"], bld_btn_en)
merge(en, ["buildingsId", "select"], bld_select_en)
merge(en, ["requestsId", "text"], req_text_en)
merge(en, ["requestsId", "rec"], req_rec_en)
merge(en, ["requestsId", "stage"], req_stage_en)

merge(fr, ["buildingsId", "text"], bld_text_fr)
merge(fr, ["buildingsId", "label"], bld_label_fr)
merge(fr, ["buildingsId", "col"], bld_col_fr)
merge(fr, ["buildingsId", "btn"], bld_btn_fr)
merge(fr, ["buildingsId", "select"], bld_select_fr)
merge(fr, ["requestsId", "text"], req_text_fr)
merge(fr, ["requestsId", "rec"], req_rec_fr)
merge(fr, ["requestsId", "stage"], req_stage_fr)

with open(EN, "w") as f:
    json.dump(en, f, ensure_ascii=False, indent=2)
with open(FR, "w") as f:
    json.dump(fr, f, ensure_ascii=False, indent=2)

print("Done — missing keys added.")
