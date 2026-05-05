#!/usr/bin/env python3
"""
i18n-pages-codemod.py
Extracts hardcoded strings from Next.js page files and replaces them with t() calls.
Generates locale JSON entries for en/ and fr/ simultaneously.

Usage:
  python3 scripts/i18n-pages-codemod.py [--dry-run]

Strategy:
  1. Scan each page file for user-visible string patterns
  2. Generate camelCase keys scoped to the page
  3. Replace with t("scope.key") calls
  4. Inject `const { t } = useTranslation("namespace")` if not present
  5. Merge keys into public/locales/{en,fr}/manager.json and owner.json
"""

import re, json, os, sys, copy
from pathlib import Path

DRY_RUN = "--dry-run" in sys.argv
WEB = Path("/Users/christophepian/Documents/Maintenance_Agent/apps/web")
LOCALES = WEB / "public/locales"

# ---------- helpers ----------

def slugify(s):
    """Convert 'My Label (text)' → 'myLabelText'"""
    s = re.sub(r'[^a-zA-Z0-9 ]', ' ', s)
    words = s.strip().split()
    if not words:
        return "unknown"
    return words[0][0].lower() + words[0][1:] + ''.join(w.capitalize() for w in words[1:])

def set_nested(d, dotkey, value):
    """Set d["a"]["b"]["c"] = value from dotkey "a.b.c"."""
    parts = dotkey.split(".")
    cur = d
    for part in parts[:-1]:
        cur = cur.setdefault(part, {})
    cur[parts[-1]] = value

def get_nested(d, dotkey):
    parts = dotkey.split(".")
    cur = d
    for p in parts:
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur

def load_json(path):
    if path.exists():
        return json.loads(path.read_text())
    return {}

def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

# ---------- FR translation stubs (auto-generated, human can refine) ----------
# Common English → French mappings for strings we'll encounter
FR_MAP = {
    # Dashboard
    "Portfolio overview": "Aperçu du portefeuille",
    "Refresh dashboard": "Actualiser le tableau de bord",
    "NOI YTD": "RNE depuis le début de l'année",
    "Spend MTD": "Dépenses du mois",
    "Collection rate": "Taux de recouvrement",
    "Buildings in red": "Immeubles en déficit",
    "Portfolio": "Portefeuille",
    "Open requests": "Demandes ouvertes",
    "Open jobs": "Travaux en cours",
    "Job avg. duration": "Durée moy. des travaux",
    "Pending invoices": "Factures en attente",
    "Everything looks good — no items need attention right now.": "Tout va bien — aucun élément ne nécessite d'attention.",
    "1 item needs your attention today.": "1 élément nécessite votre attention aujourd'hui.",
    "All clear — no items need action": "Tout est en ordre — aucune action requise",
    "Check back after new requests or invoices arrive.": "Revenez après l'arrivée de nouvelles demandes ou factures.",
    "No items match the selected filter.": "Aucun élément ne correspond au filtre sélectionné.",
    "Show less ↑": "Afficher moins ↑",
    "More tools": "Plus d'outils",
    "Deeper views for finance, strategy, and tenant portal.": "Vues détaillées pour la finance, la stratégie et le portail locataire.",
    "Finance overview": "Aperçu financier",
    "Ledger": "Grand livre",
    "Settings": "Paramètres",
    "All requests": "Toutes les demandes",
    # Category chips
    "Pending review": "En attente de révision",
    "Owner approval": "Approbation du propriétaire",
    "Disputed invoice": "Facture contestée",
    "Stale job": "Travail en retard",
    "RFP routed": "Appel d'offres transmis",
    "Needs approval": "Approbation requise",
    "Invoice pending": "Facture en attente",
    "RFP to review": "Appel d'offres à examiner",
    "Vacant unit": "Unité vacante",
    # Sort / filter labels
    "All": "Tous",
    "Disputed": "Contesté",
    "Stale jobs": "Travaux en retard",
    "RFPs": "Appels d'offres",
    "Urgency": "Urgence",
    "Building": "Immeuble",
    "Date": "Date",
    "Category": "Catégorie",
    "Status": "Statut",
    "Type": "Type",
    "Priority": "Priorité",
    "Assignee": "Responsable",
    # Common table headers
    "Name": "Nom",
    "Address": "Adresse",
    "Actions": "Actions",
    "Unit": "Unité",
    "Tenant": "Locataire",
    "Contractor": "Prestataire",
    "Amount": "Montant",
    "Due date": "Échéance",
    "Created": "Créé le",
    "Updated": "Mis à jour",
    "Description": "Description",
    "Property": "Propriété",
    "Reference": "Référence",
    "Invoice": "Facture",
    "Total": "Total",
    "Balance": "Solde",
    "Rent": "Loyer",
    "Start date": "Date de début",
    "End date": "Date de fin",
    "Duration": "Durée",
    "Notes": "Notes",
    "Email": "E-mail",
    "Phone": "Téléphone",
    "Role": "Rôle",
    # Common actions
    "Save": "Enregistrer",
    "Cancel": "Annuler",
    "Delete": "Supprimer",
    "Edit": "Modifier",
    "Add": "Ajouter",
    "Create": "Créer",
    "Search": "Rechercher",
    "Filter": "Filtrer",
    "Export": "Exporter",
    "Download": "Télécharger",
    "Upload": "Téléverser",
    "Submit": "Soumettre",
    "Approve": "Approuver",
    "Reject": "Rejeter",
    "Close": "Fermer",
    "View": "Voir",
    "Back": "Retour",
    "Next": "Suivant",
    "Previous": "Précédent",
    "Confirm": "Confirmer",
    "Reset": "Réinitialiser",
    # Requests page
    "New request": "Nouvelle demande",
    "Work requests": "Demandes de travaux",
    "All requests": "Toutes les demandes",
    "Active jobs": "Travaux actifs",
    "Search requests…": "Rechercher des demandes…",
    "Search…": "Rechercher…",
    "No requests found.": "Aucune demande trouvée.",
    "No jobs found.": "Aucun travail trouvé.",
    "No invoices found.": "Aucune facture trouvée.",
    "No results found.": "Aucun résultat trouvé.",
    # Leases
    "Leases": "Baux",
    "New lease": "Nouveau bail",
    "Active leases": "Baux actifs",
    "Expired leases": "Baux expirés",
    "Pending leases": "Baux en attente",
    "All leases": "Tous les baux",
    "No leases found.": "Aucun bail trouvé.",
    # Finance
    "Finance": "Finance",
    "Invoices": "Factures",
    "Income": "Revenus",
    "Expenses": "Dépenses",
    "Payments": "Paiements",
    "Charges": "Frais",
    "Ledger": "Grand livre",
    "Chart of accounts": "Plan comptable",
    # People
    "People": "Personnes",
    "Tenants": "Locataires",
    "Vendors": "Prestataires",
    "Owners": "Propriétaires",
    "Add tenant": "Ajouter un locataire",
    "Add vendor": "Ajouter un prestataire",
    # Properties
    "Properties": "Propriétés",
    "Buildings": "Immeubles",
    "Units": "Unités",
    # Owner pages
    "Dashboard": "Tableau de bord",
    "Approvals": "Approbations",
    "Reporting": "Rapports",
    "Strategy": "Stratégie",
    "No items need your attention": "Aucun élément ne nécessite votre attention",
    "Portfolio summary": "Résumé du portefeuille",
    "Net income": "Revenu net",
    "Occupancy rate": "Taux d'occupation",
    "Vacancy rate": "Taux de vacance",
    "Approve": "Approuver",
    "Reject": "Rejeter",
    "Pending approval": "En attente d'approbation",
    # Settings
    "General": "Général",
    "Account": "Compte",
    "Notifications": "Notifications",
    "Security": "Sécurité",
    "Integrations": "Intégrations",
    "Billing": "Facturation",
    "Save changes": "Enregistrer les modifications",
    # Common empty states
    "No data available.": "Aucune donnée disponible.",
    "Loading…": "Chargement…",
    "Error loading data.": "Erreur lors du chargement des données.",
}

def fr(en_str):
    """Return French translation or a stub."""
    return FR_MAP.get(en_str, en_str + " [FR]")

# ---------- string patterns to find in source ----------

# Strings we SKIP (not user-visible or already translated)
SKIP_PATTERNS = [
    re.compile(r'^[a-z_][a-zA-Z0-9_]*$'),          # variable names
    re.compile(r'^https?://'),                        # URLs
    re.compile(r'^/[a-z]'),                           # paths
    re.compile(r'^\d'),                               # numbers
    re.compile(r'^[A-Z_]+$'),                         # ALL_CAPS constants
    re.compile(r'^#[0-9a-fA-F]{3,6}$'),              # hex colors
    re.compile(r'^\d{4}-\d{2}-\d{2}'),               # dates
]

def should_skip(s):
    s = s.strip()
    if len(s) < 2: return True
    if len(s) > 120: return True
    for p in SKIP_PATTERNS:
        if p.match(s): return True
    return False

# ---------- per-page extraction rules ----------
# We define explicit string maps per page rather than pure regex
# to avoid false positives. Each entry: (original, key, fr_translation)

PAGE_STRINGS = {
    # manager/index.js: module-scope strings (CATEGORY_CHIP, heroHeadline)
    # are handled via targeted manual edits — NOT via codemod to avoid
    # invalid t() calls at module scope. Only JSX-scope strings here.
    "pages/manager/index.js": [
        ("Portfolio overview", "dashboard.portfolioOverview", "Aperçu du portefeuille"),
        ("NOI YTD", "dashboard.kpi.noiYtd", "RNE (cumul annuel)"),
        ("Spend MTD", "dashboard.kpi.spendMtd", "Dépenses du mois"),
        ("Collection rate", "dashboard.kpi.collectionRate", "Taux de recouvrement"),
        ("Buildings in red", "dashboard.kpi.buildingsInRed", "Immeubles en déficit"),
        ("Open requests", "dashboard.kpi.openRequests", "Demandes ouvertes"),
        ("Open jobs", "dashboard.kpi.openJobs", "Travaux en cours"),
        ("Job avg. duration", "dashboard.kpi.jobAvgDuration", "Durée moy. des travaux"),
        ("Pending invoices", "dashboard.kpi.pendingInvoices", "Factures en attente"),
        ("All clear — no items need action", "dashboard.feed.allClearTitle", "Tout est en ordre"),
        ("Check back after new requests or invoices arrive.", "dashboard.feed.allClearSub", "Revenez après l'arrivée de nouvelles demandes ou factures."),
        ("No items match the selected filter.", "dashboard.feed.noMatch", "Aucun élément ne correspond au filtre sélectionné."),
        ("Show less ↑", "dashboard.feed.showLess", "Afficher moins ↑"),
        ("All", "dashboard.filter.all", "Tous"),
        ("Disputed", "dashboard.filter.disputed", "Contesté"),
        ("Stale jobs", "dashboard.filter.stale", "Travaux en retard"),
        ("RFPs", "dashboard.filter.rfps", "Appels d'offres"),
        ("Urgency", "dashboard.sort.urgency", "Urgence"),
        ("Building", "dashboard.sort.building", "Immeuble"),
        ("Date", "dashboard.sort.date", "Date"),
        ("Category", "dashboard.sort.category", "Catégorie"),
        ("More tools", "dashboard.moreTools.title", "Plus d'outils"),
        ("Deeper views for finance, strategy, and tenant portal.", "dashboard.moreTools.sub", "Vues détaillées pour la finance, la stratégie et le portail locataire."),
        ("Finance overview", "dashboard.moreTools.finance", "Aperçu financier"),
        ("Settings", "dashboard.moreTools.settings", "Paramètres"),
        ("All requests", "dashboard.moreTools.allRequests", "Toutes les demandes"),
        ("In progress > 7 days", "dashboard.feed.inProgressStale", "En cours depuis plus de 7 jours"),
    ],
    # owner/index.js: same treatment — module-scope chip/hero strings handled manually
    "pages/owner/index.js": [
        ("No items match the selected filter.", "dashboard.feed.noMatch", "Aucun élément ne correspond au filtre."),
        ("Show less ↑", "dashboard.feed.showLess", "Afficher moins ↑"),
        ("Portfolio summary", "dashboard.kpi.title", "Résumé du portefeuille"),
        ("Net income YTD", "dashboard.kpi.netIncomeYtd", "Revenu net (cumul annuel)"),
        ("Occupancy", "dashboard.kpi.occupancy", "Occupation"),
        ("Vacancies", "dashboard.kpi.vacancies", "Vacances"),
        ("Buildings", "dashboard.kpi.buildings", "Immeubles"),
        ("All", "dashboard.filter.all", "Tous"),
        ("Approvals", "dashboard.filter.approval", "Approbations"),
        ("Invoices", "dashboard.filter.invoice", "Factures"),
        ("Urgency", "dashboard.sort.urgency", "Urgence"),
        ("Building", "dashboard.sort.building", "Immeuble"),
        ("Date", "dashboard.sort.date", "Date"),
        ("Category", "dashboard.sort.category", "Catégorie"),
        ("More tools", "dashboard.moreTools.title", "Plus d'outils"),
        ("Finance", "dashboard.moreTools.finance", "Finance"),
        ("Properties", "dashboard.moreTools.properties", "Propriétés"),
        ("Settings", "dashboard.moreTools.settings", "Paramètres"),
    ],
}

# ---------- generic patterns applied to ALL pages ----------

# These patterns are applied to every file. The regex finds the string,
# and we generate a key from the page scope + slugified string.
# Format: (regex_pattern, key_prefix_from_match_group, capture_group)
GENERIC_PATTERNS = [
    # <th>Text</th> — table headers
    (re.compile(r'<th\b[^>]*>\s*([A-Z][^{<\n]{1,60})\s*</th>'), "col"),
    # <h1>, <h2>, <h3> text
    (re.compile(r'<h[123]\b[^>]*>\s*([A-Z][^{<\n]{1,80})\s*</h[123]>'), "heading"),
    # placeholder="..."
    (re.compile(r'placeholder="([^"]{3,80})"'), "placeholder"),
    # title="..." (on buttons/links, not page <title>)
    (re.compile(r'\btitle="([A-Z][^"]{2,60})"'), "title"),
    # aria-label="..."
    (re.compile(r'aria-label="([^"]{3,80})"'), "ariaLabel"),
]

def page_scope(rel_path):
    """Convert 'pages/manager/finance/invoices.js' → 'financeInvoices'"""
    p = Path(rel_path)
    parts = list(p.parts[2:])  # strip 'pages/manager' or 'pages/owner'
    parts[-1] = parts[-1].replace(".js", "").replace("[", "").replace("]", "")
    combined = "_".join(parts)
    words = re.split(r'[_\-]', combined)
    return words[0] + ''.join(w.capitalize() for w in words[1:])

def namespace_for(rel_path):
    if "pages/manager" in rel_path or "pages/admin-inventory" in rel_path:
        return "manager"
    if "pages/owner" in rel_path:
        return "owner"
    if "pages/contractor" in rel_path:
        return "contractor"
    return "tenant"

# ---------- main processing ----------

def process_file(rel_path, src, locale_en, locale_fr):
    """Apply all transformations to src, update locale dicts, return new src."""
    ns = namespace_for(rel_path)
    scope = page_scope(rel_path)
    modified = src
    keys_added = 0

    # 1. Apply explicit per-page strings
    explicit = PAGE_STRINGS.get(rel_path, [])
    for (original, dotkey, fr_val) in explicit:
        if original not in modified:
            continue
        en_val = original
        # Determine replacement: is it a JSX text node or inside a prop?
        # We'll use context: if preceded by > or {, it's JSX text; if inside "", it's a prop
        # For simplicity, escape and replace the string literal
        key_path = f"{ns}:{dotkey}" if "." in dotkey else dotkey
        t_call = f'{{t("{ns}:{dotkey}")}}'
        # Try JSX text replacement: >String< or >String\n
        # Also handle inside JSX expressions
        escaped = re.escape(original)
        # Replace when it appears as a JSX text node
        modified = re.sub(
            r'(>)\s*' + escaped + r'\s*(<)',
            lambda m: m.group(1) + t_call + m.group(2),
            modified
        )
        # Replace string literal in label/value props: "original" → {t(...)}
        # But only in JSX context (surrounded by = or , or { )
        modified = modified.replace(f'"{original}"', f't("{ns}:{dotkey}")')
        # Update locale dicts
        if get_nested(locale_en, dotkey) is None:
            set_nested(locale_en, dotkey, en_val)
            set_nested(locale_fr, dotkey, fr_val)
            keys_added += 1

    # 2. Apply generic patterns for common structures
    generic_keys = {}  # track to avoid duplicates
    for (pattern, prefix) in GENERIC_PATTERNS:
        for match in pattern.finditer(src):
            text = match.group(1).strip()
            if should_skip(text):
                continue
            slug = slugify(text)
            dotkey = f"{scope}.{prefix}.{slug}"
            if dotkey in generic_keys:
                continue
            generic_keys[dotkey] = text
            t_call = f't("{ns}:{dotkey}")'
            # Replace in JSX: >text< → >{t(...)}<
            modified = re.sub(
                r'(>)\s*' + re.escape(text) + r'\s*(<)',
                lambda m, tc=t_call: m.group(1) + '{' + tc + '}' + m.group(2),
                modified
            )
            # Replace in attributes: ="text" → ={t(...)}
            t_call2 = '{t("' + ns + ':' + dotkey + '")}'
            modified = modified.replace(f'="{text}"', '=' + t_call2)
            if get_nested(locale_en, dotkey) is None:
                set_nested(locale_en, dotkey, text)
                set_nested(locale_fr, dotkey, fr(text))
                keys_added += 1

    # 3. Inject useTranslation if we made changes and it's not already there
    if keys_added > 0 and "useTranslation" not in modified:
        # Add import after last import statement
        lines = modified.split("\n")
        last_import = -1
        for i, line in enumerate(lines):
            if line.startswith("import "):
                last_import = i
        import_line = 'import { useTranslation } from "next-i18next";'
        if last_import >= 0:
            lines.insert(last_import + 1, import_line)
        modified = "\n".join(lines)

        # Inject hook into default export function body
        modified = re.sub(
            r'(export default function \w+\([^)]*\)\s*\{)',
            r'\1\n  const { t } = useTranslation("' + ns + '");',
            modified, count=1
        )

    return modified, keys_added

# ---------- entry point ----------

def main():
    pages_dir = WEB / "pages"
    manager_ns = ["manager", "owner", "contractor", "tenant"]

    # Collect all page files to process
    targets = []
    for root, dirs, files in os.walk(pages_dir):
        for f in files:
            if not f.endswith(".js"): continue
            if f.startswith("_"): continue
            full = Path(root) / f
            rel = str(full.relative_to(WEB))
            ns = namespace_for(rel)
            if ns not in ["manager", "owner"]: continue
            if "api/" in rel: continue
            targets.append((rel, full))

    print(f"Processing {len(targets)} pages...")

    total_keys = 0
    for rel, full in sorted(targets):
        src = full.read_text()
        ns = namespace_for(rel)
        en_path = LOCALES / "en" / f"{ns}.json"
        fr_path = LOCALES / "fr" / f"{ns}.json"
        locale_en = load_json(en_path)
        locale_fr = load_json(fr_path)

        new_src, keys_added = process_file(rel, src, locale_en, locale_fr)

        if keys_added > 0:
            total_keys += keys_added
            print(f"  ✓ {rel}  (+{keys_added} keys)")
            if not DRY_RUN:
                full.write_text(new_src)
                save_json(en_path, locale_en)
                save_json(fr_path, locale_fr)
        else:
            print(f"  - {rel}  (no changes)")

    print(f"\nTotal new keys: {total_keys}")
    if DRY_RUN:
        print("DRY RUN — no files written")

if __name__ == "__main__":
    main()
