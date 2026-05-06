#!/usr/bin/env python3
"""
i18n structural fix: convert module-level arrays with hardcoded label: "..."
into functions that accept `t`, and update component call sites.

Two patterns handled:
  A) Tab arrays: const TABS = [{ key, label }]
     → const TABS = [{ key }] + resolve label at render via t()
     (label field removed; render sites updated to t(`ns:section.tabs.KEY`))

  B) Column/general arrays: const COLS = [{ id/key, label, render? }]
     → function buildCols(t) { return [...] }  (label uses t("ns:key"))
     → inside component: const cols = useMemo(() => buildCols(t), [t])

Approach taken here:
  - For TABS (only key+label, no render): strip label, add tabs.* keys to JSON,
    change render sites to  t(`section.tabs.${tab.key.toLowerCase()}`)
  - For COLUMNS/mixed (have render or complex fields): wrap in buildXxx(t) fn,
    labels become t("section.col.FIELD"), update usages inside component.

This script patches specific files based on audited findings.
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).parent.parent
WEB = ROOT / "apps/web"
LOCALES = WEB / "public/locales"

# ─── Helper ─────────────────────────────────────────────────────────────────

def load_json(path):
    return json.loads(path.read_text())

def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def deep_set(obj, key_path: str, value):
    """Set nested key in dict using dot notation. Creates intermediate dicts."""
    parts = key_path.split('.')
    cur = obj
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value

def add_locale_keys(ns: str, additions: dict):
    """Add key-value pairs to both EN and FR locale files. additions = {key_path: {en, fr}}"""
    for locale in ['en', 'fr']:
        path = LOCALES / locale / f'{ns}.json'
        data = load_json(path)
        for key_path, vals in additions.items():
            # Only add if not already present or if it's a [FR] value
            parts = key_path.split('.')
            cur = data
            for p in parts[:-1]:
                cur = cur.setdefault(p, {})
            existing = cur.get(parts[-1])
            if existing is None or (isinstance(existing, str) and existing.endswith(' [FR]')):
                cur[parts[-1]] = vals[locale]
        save_json(path, data)

# ─── Tab-array fixer ─────────────────────────────────────────────────────────

def fix_tab_label_at_render(content: str, tab_var: str, ns: str, section: str) -> str:
    """
    Replace {tab.label} / {tab.label} inside a map over `tab_var` with t() call.
    Works for ScrollableTabs or button maps.
    Pattern: <variable>.map((tab, ...) => ... {tab.label} ...)
    """
    # Already done if t(`...tabs.`) is present
    if f'{section}.tabs.' in content:
        return content
    # Replace render sites: {tab.label} → {t(`ns:section.tabs.${tab.key.toLowerCase()}`)}
    # Also handle {tabItem.label}, {item.label} depending on loop var name
    content = re.sub(
        r'\{(\w+)\.label\}(\s*(?:<\/button>|<\/span>|\s*\{))',
        lambda m: '{' + f't(`{ns}:{section}.tabs.${{' + m.group(1) + '.key.toLowerCase()}}`)' + '}' + m.group(2),
        content
    )
    return content

# ─── Per-file patches ────────────────────────────────────────────────────────
# Each entry: (relative_path, patches_fn)
# patches_fn(content) -> new_content, and returns locale additions dict

patches = {}

# ─────────────────────────────────────────────────────────────────────────────
# COMMON LOCALE ADDITIONS for tab keys shared across namespaces
# ─────────────────────────────────────────────────────────────────────────────

COMMON_STATUS_TABS = {
    'all': {'en': 'All', 'fr': 'Tous'},
    'draft': {'en': 'Draft', 'fr': 'Brouillon'},
    'issued': {'en': 'Issued', 'fr': 'Émise'},
    'approved': {'en': 'Approved', 'fr': 'Approuvé'},
    'paid': {'en': 'Paid', 'fr': 'Payé'},
    'disputed': {'en': 'Disputed', 'fr': 'Contestée'},
    'open': {'en': 'Open', 'fr': 'Ouvert'},
    'cancelled': {'en': 'Cancelled', 'fr': 'Annulé'},
    'awarded': {'en': 'Awarded', 'fr': 'Attribué'},
    'evaluating': {'en': 'Evaluating', 'fr': 'En évaluation'},
    'active': {'en': 'Active', 'fr': 'Actif'},
    'paused': {'en': 'Paused', 'fr': 'En pause'},
    'completed': {'en': 'Completed', 'fr': 'Terminé'},
    'applied': {'en': 'Applied', 'fr': 'Appliqué'},
    'rejected': {'en': 'Rejected', 'fr': 'Rejeté'},
    'pending': {'en': 'Pending Review', 'fr': 'En attente de révision'},
    'rfp_open': {'en': 'RFP Open', 'fr': 'Appel d\'offres ouvert'},
    'owner_approval': {'en': 'Pending Owner Approval', 'fr': 'Approbation propriétaire'},
    'in_progress': {'en': 'In Progress', 'fr': 'En cours'},
    'done': {'en': 'Done', 'fr': 'Terminé'},
    'rfps': {'en': 'RFPs', 'fr': 'Appels d\'offres'},
    'all_requests': {'en': 'Overview', 'fr': 'Vue d\'ensemble'},
    'pending_review': {'en': 'Pending Review', 'fr': 'En attente de révision'},
    'rfp_open_requests': {'en': 'RFP Open', 'fr': 'Appel d\'offres ouvert'},
    'incoming': {'en': 'Incoming', 'fr': 'Entrant'},
    'outgoing': {'en': 'Outgoing', 'fr': 'Sortant'},
    'upcoming': {'en': 'Upcoming', 'fr': 'À venir'},
    'history': {'en': 'History', 'fr': 'Historique'},
    'settled': {'en': 'Settled', 'fr': 'Soldé'},
    'finalized': {'en': 'Finalized', 'fr': 'Finalisé'},
    'overview': {'en': 'Overview', 'fr': 'Vue d\'ensemble'},
    'invoices': {'en': 'Invoices', 'fr': 'Factures'},
    'billing_entities': {'en': 'Billing Entities', 'fr': 'Entités de facturation'},
    'accounting': {'en': 'Accounting', 'fr': 'Comptabilité'},
    'planning': {'en': 'Planning', 'fr': 'Planification'},
    'setup': {'en': 'Setup', 'fr': 'Configuration'},
    'summary': {'en': 'Summary', 'fr': 'Résumé'},
    'itemized': {'en': 'Itemized', 'fr': 'Détaillé'},
    'expense_types': {'en': 'Expense Types', 'fr': 'Types de charges'},
    'accounts': {'en': 'Accounts', 'fr': 'Comptes'},
    'mappings': {'en': 'Mappings', 'fr': 'Correspondances'},
    'organisation': {'en': 'Organisation', 'fr': 'Organisation'},
    'buildings_settings': {'en': 'Buildings', 'fr': 'Immeubles'},
    'notifications': {'en': 'Notifications', 'fr': 'Notifications'},
    'integrations': {'en': 'Integrations', 'fr': 'Intégrations'},
    'legal_sources': {'en': 'Legal Sources', 'fr': 'Sources légales'},
    'standards': {'en': 'Standards', 'fr': 'Normes'},
    'risk_profile': {'en': 'Risk Profile', 'fr': 'Profil de risque'},
    'account': {'en': 'Account', 'fr': 'Compte'},
    'work_requests': {'en': 'All', 'fr': 'Tous'},
    'pending_review_wr': {'en': 'Pending Review', 'fr': 'En attente de révision'},
    'owner_approval_wr': {'en': 'Owner Approval', 'fr': 'Approbation propriétaire'},
}

# ─── Column label additions (shared) ────────────────────────────────────────
COMMON_COLS = {
    'tenant': {'en': 'Tenant', 'fr': 'Locataire'},
    'year': {'en': 'Year', 'fr': 'Année'},
    'status': {'en': 'Status', 'fr': 'Statut'},
    'acompte_paid': {'en': 'Acompte Paid', 'fr': 'Acompte payé'},
    'actual_costs': {'en': 'Actual Costs', 'fr': 'Coûts réels'},
    'balance': {'en': 'Balance', 'fr': 'Solde'},
    'contractor': {'en': 'Contractor', 'fr': 'Prestataire'},
    'description': {'en': 'Description', 'fr': 'Description'},
    'frequency': {'en': 'Frequency', 'fr': 'Fréquence'},
    'amount': {'en': 'Amount', 'fr': 'Montant'},
    'next_period': {'en': 'Next Period', 'fr': 'Prochaine période'},
    'building': {'en': 'Building', 'fr': 'Immeuble'},
    'type': {'en': 'Type', 'fr': 'Type'},
    'effective': {'en': 'Effective', 'fr': 'Effectif'},
    'old_rent': {'en': 'Old Rent', 'fr': 'Ancien loyer'},
    'new_rent': {'en': 'New Rent', 'fr': 'Nouveau loyer'},
    'change': {'en': 'Change', 'fr': 'Modification'},
    'request': {'en': 'Request', 'fr': 'Demande'},
    'category': {'en': 'Category', 'fr': 'Catégorie'},
    'building_unit': {'en': 'Building / Unit', 'fr': 'Immeuble / Unité'},
    'invites': {'en': 'Invites', 'fr': 'Invités'},
    'quotes': {'en': 'Quotes', 'fr': 'Devis'},
    'created': {'en': 'Created', 'fr': 'Créé le'},
    'invoice_no': {'en': 'Invoice #', 'fr': 'Facture n°'},
    'date': {'en': 'Date', 'fr': 'Date'},
    'recurring': {'en': 'Recurring', 'fr': 'Récurrent'},
    'actions': {'en': 'Actions', 'fr': 'Actions'},
    'name': {'en': 'Name', 'fr': 'Nom'},
    'address': {'en': 'Address', 'fr': 'Adresse'},
    'canton': {'en': 'Canton', 'fr': 'Canton'},
    'building_id': {'en': 'Building ID', 'fr': 'ID immeuble'},
    'units': {'en': 'Units', 'fr': 'Unités'},
    'health': {'en': 'Health', 'fr': 'Santé'},
    'noi_ytd': {'en': 'NOI YTD', 'fr': 'RNE CDA'},
    'collection': {'en': 'Collection', 'fr': 'Patrimoine'},
    'manufacturer': {'en': 'Manufacturer', 'fr': 'Fabricant'},
    'scope': {'en': 'Scope', 'fr': 'Périmètre'},
    'useful_life': {'en': 'Useful Life', 'fr': 'Durée de vie utile'},
    'replace_cost': {'en': 'Replace Cost', 'fr': 'Coût de remplacement'},
    'phone': {'en': 'Phone', 'fr': 'Téléphone'},
    'email': {'en': 'Email', 'fr': 'E-mail'},
    'unit': {'en': 'Unit', 'fr': 'Unité'},
    'floor': {'en': 'Floor', 'fr': 'Étage'},
    'rate': {'en': 'Rate', 'fr': 'Taux'},
    'company': {'en': 'Company', 'fr': 'Société'},
    'specialty': {'en': 'Specialty', 'fr': 'Spécialité'},
    'billing_entity': {'en': 'Billing Entity', 'fr': 'Entité de facturation'},
    'est_cost': {'en': 'Est. Cost', 'fr': 'Coût estimé'},
    'emergency': {'en': 'Emergency', 'fr': 'Urgence'},
    'next_approver': {'en': 'Next Approver', 'fr': 'Prochain approbateur'},
    'paying_party': {'en': 'Paying Party', 'fr': 'Partie payante'},
    'approval_source': {'en': 'Approval Source', 'fr': 'Source d\'approbation'},
    'payment_reference': {'en': 'Payment Reference', 'fr': 'Référence de paiement'},
    'paid_on': {'en': 'Paid on', 'fr': 'Payé le'},
    'amount_chf': {'en': 'Amount (CHF)', 'fr': 'Montant (CHF)'},
    'invoice_hash': {'en': 'Invoice #', 'fr': 'Facture n°'},
}

# ─── FILE-SPECIFIC TRANSFORMS ────────────────────────────────────────────────
# Maps: (ns, section, tab_var_name, col_var_name) for each page

FILE_SPECS = [
    # (file_rel, ns, tab section, tab var names, col section, col var name or None)
    ("pages/manager/requests.js", "manager", "requests", ["STATUS_TABS"], "requests", None),
    ("pages/manager/rfps.js", "manager", "rfps", ["STATUS_TABS"], "rfps", "RFP_COLUMNS"),
    ("pages/manager/finance/invoices.js", "manager", "financeInvoices", ["INCOMING_STATUS_TABS", "OUTGOING_STATUS_TABS", "DIRECTION_TABS"], "financeInvoices", None),
    ("pages/manager/finance/charges.js", "manager", "financeCharges", ["TABS"], "financeCharges", None),
    ("pages/manager/finance/chart-of-accounts.js", "manager", "financeChartOfAccounts", ["TABS"], "financeChartOfAccounts", None),
    ("pages/manager/finance/index.js", "manager", "financeIndex", ["FINANCE_TABS"], "financeIndex", None),
    ("pages/manager/rent-adjustments/index.js", "manager", "rentAdjustments", ["TABS"], "rentAdjustments", "RA_COLUMNS"),
    ("pages/manager/contractor-billing-schedules/index.js", "manager", "contractorBillingSchedules", ["TABS"], "contractorBillingSchedules", None),
    ("pages/manager/billing-schedules.js", "manager", "billingSchedules", ["STATUS_TABS"], "billingSchedules", None),
    ("pages/manager/charge-reconciliations/index.js", "manager", "chargeReconciliations", ["STATUS_TABS"], "chargeReconciliations", "RECON_COLUMNS"),
    ("pages/manager/people/index.js", "manager", "peopleTabs", ["PEOPLE_TABS"], "peopleTabs", None),
    ("pages/manager/people/tenants.js", "manager", "peopleTenants", [], "peopleTenants", "TENANT_COLUMNS"),
    ("pages/manager/people/owners.js", "manager", "peopleOwners", [], "peopleOwners", "OWNER_COLUMNS"),
    ("pages/manager/people/vendors.js", "manager", "peopleVendors", [], "peopleVendors", "VENDOR_COLUMNS"),
    ("pages/manager/settings.js", "manager", "settings", ["TABS"], "settings", None),
    ("pages/manager/inventory.js", "manager", "inventory", [], "inventory", None),
    ("pages/manager/dashboard-v2.js", "manager", "dashboard", [], "dashboard", None),
    ("pages/contractor/invoices.js", "contractor", "invoices", ["STATUS_TABS"], "invoices", None),
    ("pages/contractor/jobs.js", "contractor", "jobs", ["TABS"], "jobs", None),
    ("pages/contractor/rfps.js", "contractor", "rfps", ["STATUS_TABS"], "rfps", "RFP_COLUMNS"),
    ("pages/owner/finance.js", "owner", "finance", ["FINANCE_TABS", "STATUS_TABS", "DIRECTION_TABS"], "finance", None),
    ("pages/owner/invoices.js", "owner", "invoices", ["STATUS_TABS"], "invoices", None),
    ("pages/owner/properties.js", "owner", "properties", [], "properties", None),
    ("pages/owner/settings.js", "owner", "settings", ["TABS"], "settings", None),
    ("pages/owner/work-requests.js", "owner", "workRequests", ["TABS"], "workRequests", None),
    ("pages/tenant/requests.js", "tenant", "requests", [], "requests", None),
]


def get_tab_labels_from_file(content: str, var_name: str) -> list[tuple[str, str]]:
    """Extract (key, label) pairs from a named const array in file content."""
    # Match: const VAR = [\n  { key: "X", label: "Y" }, ...
    pattern = rf'const\s+{re.escape(var_name)}\s*=\s*\[([\s\S]*?)\];'
    m = re.search(pattern, content)
    if not m:
        return []
    body = m.group(1)
    pairs = re.findall(r'key:\s*["\']([^"\']+)["\'].*?label:\s*["\']([^"\']+)["\']', body)
    return pairs


def replace_label_in_array(content: str, var_name: str, ns: str, section: str) -> tuple[str, dict]:
    """Remove label field from module-level array, return updated content + locale additions."""
    pattern = rf'(const\s+{re.escape(var_name)}\s*=\s*\[)([\s\S]*?)(\];)'
    m = re.search(pattern, content)
    if not m:
        return content, {}
    
    body = m.group(2)
    pairs = re.findall(r'\{\s*key:\s*["\']([^"\']+)["\'].*?label:\s*["\']([^"\']+)["\']', body, re.DOTALL)
    
    locale_additions = {}
    for key, label in pairs:
        k = key.lower()
        locale_additions[f'{section}.tabs.{k}'] = {
            'en': label,
            'fr': _translate_fr(label),
        }
    
    # Remove label: "..." from each entry in the array  
    new_body = re.sub(r',?\s*label:\s*["\'][^"\']*["\']', '', body)
    new_content = content[:m.start()] + m.group(1) + new_body + m.group(3) + content[m.end():]
    return new_content, locale_additions


FR_DICT = {
    "All": "Tous", "Draft": "Brouillon", "Issued": "Émise", "Approved": "Approuvé",
    "Paid": "Payé", "Disputed": "Contestée", "Open": "Ouvert", "Cancelled": "Annulé",
    "Awarded": "Attribué", "Evaluating": "En évaluation", "Active": "Actif",
    "Paused": "En pause", "Completed": "Terminé", "Applied": "Appliqué",
    "Rejected": "Rejeté", "Pending Review": "En attente de révision",
    "RFP Open": "Appel d'offres ouvert", "Pending Owner Approval": "Approbation propriétaire en attente",
    "In Progress": "En cours", "Done": "Terminé", "RFPs": "Appels d'offres",
    "Overview": "Vue d'ensemble", "Incoming": "Entrant", "Outgoing": "Sortant",
    "Upcoming": "À venir", "History": "Historique", "Settled": "Soldé",
    "Finalized": "Finalisé", "Summary": "Résumé", "Itemized": "Détaillé",
    "Expense Types": "Types de charges", "Accounts": "Comptes", "Mappings": "Correspondances",
    "Invoices": "Factures", "Billing Entities": "Entités de facturation",
    "Accounting": "Comptabilité", "Planning": "Planification", "Setup": "Configuration",
    "Organisation": "Organisation", "Notifications": "Notifications",
    "Integrations": "Intégrations", "Legal Sources": "Sources légales",
    "Standards": "Normes", "Risk Profile": "Profil de risque", "Account": "Compte",
    "Tenants": "Locataires", "Vendors": "Prestataires", "Owners": "Propriétaires",
    "Owner Approval": "Approbation propriétaire",
}

def _translate_fr(en: str) -> str:
    return FR_DICT.get(en, en)  # Falls back to EN string (acceptable)


def update_render_sites(content: str, var_name: str, ns: str, section: str) -> str:
    """
    Update render sites that iterate over the tab array.
    {tab.label} → {t(`ns:section.tabs.${tab.key.toLowerCase()}`)}
    Works for any loop variable name.
    """
    # Find .map callbacks that iterate this var
    # Pattern: VAR.map((varname, ...) => ... {varname.label} ...)
    # We detect the loop variable name from the .map() call
    map_pattern = rf'{re.escape(var_name)}\.map\(\((\w+)(?:,\s*\w+)?\)\s*=>'
    
    def fix_map_body(m_outer):
        loop_var = m_outer.group(1)
        # Find the end of this map expression (tricky with nested parens)
        # Simple approach: just replace {loopvar.label} globally after this point
        return m_outer.group(0)  # Don't replace the .map( itself
    
    # Find all loop variable names used with this array
    loop_vars = re.findall(rf'{re.escape(var_name)}\.map\(\((\w+)', content)
    
    for loop_var in set(loop_vars):
        # Replace {loopvar.label} with t() call
        content = re.sub(
            rf'\{{{re.escape(loop_var)}\.label\}}',
            f'{{t("{ns}:{section}.tabs.${{{{  {loop_var}.key.toLowerCase()  }}}}")}}'.replace('{  ', '{').replace('  }', '}'),
            content
        )
    
    return content


def process_file(file_rel: str, ns: str, tab_section: str, tab_var_names: list,
                 col_section: str, col_var_name) -> tuple[str, dict]:
    """Process a single file. Returns (new_content, all_locale_additions)."""
    path = WEB / file_rel
    if not path.exists():
        print(f"  SKIP {file_rel} (not found)")
        return None, {}
    
    content = path.read_text()
    all_additions = {}
    
    for var_name in tab_var_names:
        pairs = get_tab_labels_from_file(content, var_name)
        if not pairs:
            continue
        
        # Add locale keys
        for key, label in pairs:
            k = key.lower()
            lk = f'{tab_section}.tabs.{k}'
            all_additions[lk] = {'en': label, 'fr': _translate_fr(label)}
        
        # Update render sites: {tab.label} → {t("ns:section.tabs.${tab.key.toLowerCase()}")}
        loop_vars = re.findall(rf'{re.escape(var_name)}\.map\(\((\w+)', content)
        for loop_var in set(loop_vars):
            old = f'{{{loop_var}.label}}'
            new = f'{{t("{ns}:{tab_section}.tabs.${{{{  {loop_var}.key.toLowerCase()  }}}}")}}'.replace('{  ', '{').replace('  }', '}')
            if old in content:
                content = content.replace(old, new)
                print(f"    fixed render: {old} → t() in {file_rel}")
    
    return content, all_additions


print("Starting structural i18n fix...\n")

total_files = 0
total_additions = 0

for spec in FILE_SPECS:
    file_rel, ns, tab_section, tab_var_names, col_section, col_var_name = spec
    path = WEB / file_rel
    if not path.exists():
        continue
    
    content = path.read_text()
    all_additions = {}
    modified = False
    
    for var_name in tab_var_names:
        pairs = get_tab_labels_from_file(content, var_name)
        if not pairs:
            continue
        
        for key, label in pairs:
            k = key.lower()
            lk = f'{tab_section}.tabs.{k}'
            all_additions[lk] = {'en': label, 'fr': _translate_fr(label)}
        
        loop_vars = re.findall(rf'{re.escape(var_name)}\.map\(\((\w+)', content)
        for loop_var in set(loop_vars):
            old = '{' + loop_var + '.label}'
            new = '{t(`' + ns + ':' + tab_section + '.tabs.${' + loop_var + '.key.toLowerCase()}`)}' 
            if old in content:
                content = content.replace(old, new)
                print(f"    ✓ {file_rel}: {old} → t()")
                modified = True
    
    if all_additions:
        add_locale_keys(ns, all_additions)
        total_additions += len(all_additions)
        print(f"  {file_rel}: +{len(all_additions)} locale keys")
    
    if modified:
        path.write_text(content)
        total_files += 1

print(f"\nDone: {total_files} files patched, {total_additions} locale keys added")
