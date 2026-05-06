#!/usr/bin/env python3
"""
Comprehensive codemod: convert module-level column arrays to buildXxxColumns(t) functions.
Also updates inline useMemo column arrays to use t() for labels.
Adds all required locale keys to EN and FR JSON files.
"""
import json, re, os

BASE = "/Users/christophepian/Documents/Maintenance_Agent/apps/web"
LOCALES = f"{BASE}/public/locales"

# ──────────────────────────────────────────────────────────────────────────────
# FR translations for common column labels
# ──────────────────────────────────────────────────────────────────────────────
FR_MAP = {
    # generic
    "Status": "Statut",
    "Actions": "Actions",
    "Created": "Créé le",
    "Date": "Date",
    "Amount": "Montant",
    "Building": "Bâtiment",
    "Buildings": "Bâtiments",
    "Building / Unit": "Bâtiment / Unité",
    "Building · Unit": "Bâtiment · Unité",
    "Category": "Catégorie",
    "Description": "Description",
    "Name": "Nom",
    "Address": "Adresse",
    "Canton": "Canton",
    "Type": "Type",
    "Contractor": "Prestataire",
    "Tenant": "Locataire",
    "Issuer": "Émetteur",
    "Request": "Demande",
    "Location": "Localisation",
    # invoices
    "Invoice #": "N° de facture",
    "Invoice": "Facture",
    "Amount (CHF)": "Montant (CHF)",
    "Paid on": "Payé le",
    "Payment reference": "Référence de paiement",
    "Recurring": "Récurrent",
    # rfps
    "Invites": "Invitations",
    "Quotes": "Offres",
    "My Quote": "Mon offre",
    "Invited": "Invité(s)",
    # rent adjustments
    "Effective": "Date d'effet",
    "Old Rent": "Ancien loyer",
    "New Rent": "Nouveau loyer",
    "Change": "Variation",
    "Tenant": "Locataire",
    # charge reconciliations
    "Year": "Année",
    "Acompte Paid": "Acomptes versés",
    "Actual Costs": "Coûts réels",
    "Balance": "Solde",
    # contractor billing schedules
    "Frequency": "Fréquence",
    "Next Period": "Prochaine période",
    # inventory
    "Building ID": "ID de bâtiment",
    "Units": "Unités",
    "Health": "Santé",
    "NOI YTD": "RNE YADS",
    "Collection": "Recouvrement",
    "Manufacturer": "Fabricant",
    "Scope": "Portée",
    "Useful Life": "Durée de vie",
    "Replace Cost": "Coût de remplacement",
    # work requests / requests
    "Est. Cost": "Coût estimé",
    "Emergency": "Urgence",
    "Next Approver": "Prochain approbateur",
    "Paying Party": "Partie payante",
    "Approval Source": "Source d'approbation",
    # owner properties
    "Address": "Adresse",
    # misc
    "#": "#",
    "": "",
    "Tenant": "Locataire",
}


def slug(label):
    """Convert a label to a camelCase key slug."""
    label = label.strip()
    parts = re.split(r'[\s/·\-\(\)]+', label)
    parts = [p.strip("#").strip() for p in parts if p.strip().strip("#")]
    if not parts:
        return "col"
    result = parts[0].lower()
    for p in parts[1:]:
        result += p[0].upper() + p[1:].lower() if p else ""
    # clean up non-alphanumeric
    result = re.sub(r'[^a-zA-Z0-9]', '', result)
    return result or "col"


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def find_array_end(content, start_idx):
    """
    Given content and the index of '[' that starts an array,
    return the index of the matching ']' (inclusive).
    """
    depth = 0
    in_string = False
    string_char = None
    i = start_idx
    while i < len(content):
        c = content[i]
        if in_string:
            if c == '\\':
                i += 2
                continue
            if c == string_char:
                in_string = False
        else:
            if c in ('"', "'", '`'):
                in_string = True
                string_char = c
            elif c == '[':
                depth += 1
            elif c == ']':
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    return -1


def convert_column_array_to_fn(content, const_name, fn_name, ns, section):
    """
    Convert `const XXXX_COLUMNS = [...]` to `function buildXxxColumns(t) { return [...]; }`
    Also replaces label: "..." with label: t("ns:section.col.slug").
    Returns (new_content, col_keys) where col_keys is {key: {en, fr}}.
    """
    # Find the const declaration
    pattern = rf'const {re.escape(const_name)}\s*=\s*\['
    m = re.search(pattern, content)
    if not m:
        return content, {}

    bracket_start = m.end() - 1  # index of '['
    bracket_end = find_array_end(content, bracket_start)
    if bracket_end == -1:
        return content, {}

    array_content = content[bracket_start:bracket_end + 1]

    # Collect all label: "..." inside this array and build col_keys
    col_keys = {}
    label_pattern = re.compile(r'''label:\s*["']([^"']*)["']''')

    def replace_label(lm):
        label_val = lm.group(1)
        if not label_val.strip():
            return lm.group(0)  # keep empty labels as-is
        k = slug(label_val)
        col_keys[k] = {"en": label_val, "fr": FR_MAP.get(label_val, label_val)}
        return f'label: t("{ns}:{section}.col.{k}")'

    new_array_content = label_pattern.sub(replace_label, array_content)

    # Build the function
    fn_body = f'function {fn_name}(t) {{\n  return {new_array_content};\n}}'

    # Replace the const declaration + array
    before = content[:m.start()]
    after = content[bracket_end + 1:]
    # Remove trailing semicolon after array if present
    after_stripped = after.lstrip()
    if after_stripped.startswith(';'):
        after = after_stripped[1:]

    new_content = before + fn_body + after

    return new_content, col_keys


def add_usememo_after_t_hook(content, fn_name, var_name, extra_deps=""):
    """
    After `const { t } = useTranslation(...)`, add:
    `const <var_name> = useMemo(() => <fn_name>(t), [t<extra_deps>]);`
    Only adds if not already present.
    """
    if f'useMemo(() => {fn_name}(t)' in content:
        return content  # already added

    pattern = r'const \{ t \} = useTranslation\([^)]*\);'
    m = re.search(pattern, content)
    if not m:
        return content

    dep_str = f"t{extra_deps}"
    memo_line = f'\n  const {var_name} = useMemo(() => {fn_name}(t), [{dep_str}]);'
    insert_pos = m.end()
    return content[:insert_pos] + memo_line + content[insert_pos:]


def replace_columns_prop(content, old_const_name, new_var_name):
    """Replace columns={OLD_CONST} with columns={newVar}."""
    return re.sub(
        rf'columns=\{{{re.escape(old_const_name)}\}}',
        f'columns={{{new_var_name}}}',
        content
    )


def add_locale_keys(ns, section, col_keys):
    """Add col_keys to EN and FR locale JSONs under section.col.*"""
    for lang, fr_flag in [("en", False), ("fr", True)]:
        path = f"{LOCALES}/{lang}/{ns}.json"
        data = load_json(path)
        if section not in data:
            data[section] = {}
        if "col" not in data[section]:
            data[section]["col"] = {}
        for k, vals in col_keys.items():
            val = vals["fr"] if fr_flag else vals["en"]
            if k not in data[section]["col"]:
                data[section]["col"][k] = val
        save_json(path, data)
    print(f"  → Added {len(col_keys)} col keys to {ns}.{section}.col in EN+FR")


def patch_inline_usememo_labels(content, ns, section, t_prefix="t"):
    """
    For inline useMemo column arrays already inside components,
    replace label: "..." with label: t("ns:section.col.slug").
    Returns (new_content, col_keys).
    """
    col_keys = {}

    label_pattern = re.compile(r'''label:\s*["']([^"']*)["']''')

    def replace_label(lm):
        label_val = lm.group(1)
        if not label_val.strip():
            return lm.group(0)
        if label_val.startswith(t_prefix + "("):
            return lm.group(0)  # already using t()
        k = slug(label_val)
        col_keys[k] = {"en": label_val, "fr": FR_MAP.get(label_val, label_val)}
        return f'label: t("{ns}:{section}.col.{k}")'

    new_content = label_pattern.sub(replace_label, content)
    return new_content, col_keys


def patch_file(filepath, transforms):
    """Apply a list of transform functions to a file."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    for transform in transforms:
        content = transform(content)

    if content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  ✓ Patched {filepath.replace(BASE + '/', '')}")
    else:
        print(f"  ∅ No changes in {filepath.replace(BASE + '/', '')}")

    return content


# ──────────────────────────────────────────────────────────────────────────────
# Also handle the isOutgoing dynamic label case
# ──────────────────────────────────────────────────────────────────────────────

def patch_invoices_dynamic_label(content, ns, section):
    """
    Special handler for `label: isOutgoing ? "Tenant" : "Issuer"` type patterns.
    → `label: isOutgoing ? t("ns:section.col.tenant") : t("ns:section.col.issuer")`
    """
    pattern = re.compile(
        r'label:\s*isOutgoing\s*\?\s*"([^"]+)"\s*:\s*"([^"]+)"'
    )
    def repl(m):
        a, b = m.group(1), m.group(2)
        ka, kb = slug(a), slug(b)
        return f'label: isOutgoing ? t("{ns}:{section}.col.{ka}") : t("{ns}:{section}.col.{kb}")'
    new_content = pattern.sub(repl, content)
    extra_keys = {}
    for m in pattern.finditer(content):
        a, b = m.group(1), m.group(2)
        extra_keys[slug(a)] = {"en": a, "fr": FR_MAP.get(a, a)}
        extra_keys[slug(b)] = {"en": b, "fr": FR_MAP.get(b, b)}
    return new_content, extra_keys


# ──────────────────────────────────────────────────────────────────────────────
# Main: process each file
# ──────────────────────────────────────────────────────────────────────────────

def main():
    # ── 1. manager/rfps.js ──────────────────────────────────────────────────
    print("\n[1] manager/rfps.js")
    path = f"{BASE}/pages/manager/rfps.js"
    with open(path) as f:
        content = f.read()
    content, col_keys = convert_column_array_to_fn(
        content, "RFP_COLUMNS", "buildRfpColumns", "manager", "rfps"
    )
    content = add_usememo_after_t_hook(content, "buildRfpColumns", "rfpColumns")
    content = replace_columns_prop(content, "RFP_COLUMNS", "rfpColumns")
    # Also fix the t reference bug inside render (was referencing t at module scope)
    with open(path, "w") as f:
        f.write(content)
    if col_keys:
        add_locale_keys("manager", "rfps", col_keys)
    print(f"  → {len(col_keys)} column keys")

    # ── 2. manager/inventory.js ─────────────────────────────────────────────
    print("\n[2] manager/inventory.js")
    path = f"{BASE}/pages/manager/inventory.js"
    with open(path) as f:
        content = f.read()
    content, k1 = convert_column_array_to_fn(
        content, "BUILDING_COLUMNS", "buildBuildingColumns", "manager", "inventory"
    )
    content, k2 = convert_column_array_to_fn(
        content, "ASSET_MODEL_COLUMNS", "buildAssetModelColumns", "manager", "inventory"
    )
    # Add two useMemo calls after t hook
    content = add_usememo_after_t_hook(content, "buildBuildingColumns", "buildingColumns")
    content = add_usememo_after_t_hook(content, "buildAssetModelColumns", "assetModelColumns")
    content = replace_columns_prop(content, "BUILDING_COLUMNS", "buildingColumns")
    # ASSET_MODEL_COLUMNS usage
    content = re.sub(r'columns=\{ASSET_MODEL_COLUMNS\}', 'columns={assetModelColumns}', content)
    with open(path, "w") as f:
        f.write(content)
    all_inv = {**k1, **k2}
    if all_inv:
        add_locale_keys("manager", "inventory", all_inv)
    print(f"  → {len(all_inv)} column keys")

    # ── 3. manager/finance/payments.js ──────────────────────────────────────
    print("\n[3] manager/finance/payments.js")
    path = f"{BASE}/pages/manager/finance/payments.js"
    with open(path) as f:
        content = f.read()
    content, col_keys = convert_column_array_to_fn(
        content, "PAYMENT_COLUMNS", "buildPaymentColumns", "manager", "financePayments"
    )
    content = add_usememo_after_t_hook(content, "buildPaymentColumns", "paymentColumns")
    content = replace_columns_prop(content, "PAYMENT_COLUMNS", "paymentColumns")
    with open(path, "w") as f:
        f.write(content)
    if col_keys:
        add_locale_keys("manager", "financePayments", col_keys)
    print(f"  → {len(col_keys)} column keys")

    # ── 4. manager/rent-adjustments/index.js ────────────────────────────────
    print("\n[4] manager/rent-adjustments/index.js")
    path = f"{BASE}/pages/manager/rent-adjustments/index.js"
    with open(path) as f:
        content = f.read()
    content, col_keys = convert_column_array_to_fn(
        content, "RA_COLUMNS", "buildRaColumns", "manager", "rentAdjustments"
    )
    content = add_usememo_after_t_hook(content, "buildRaColumns", "raColumns")
    content = replace_columns_prop(content, "RA_COLUMNS", "raColumns")
    with open(path, "w") as f:
        f.write(content)
    if col_keys:
        add_locale_keys("manager", "rentAdjustments", col_keys)
    print(f"  → {len(col_keys)} column keys")

    # ── 5. manager/charge-reconciliations/index.js ──────────────────────────
    print("\n[5] manager/charge-reconciliations/index.js")
    path = f"{BASE}/pages/manager/charge-reconciliations/index.js"
    with open(path) as f:
        content = f.read()
    content, col_keys = convert_column_array_to_fn(
        content, "RECON_COLUMNS", "buildReconColumns", "manager", "chargeRecons"
    )
    content = add_usememo_after_t_hook(content, "buildReconColumns", "reconColumns")
    content = replace_columns_prop(content, "RECON_COLUMNS", "reconColumns")
    with open(path, "w") as f:
        f.write(content)
    if col_keys:
        add_locale_keys("manager", "chargeRecons", col_keys)
    print(f"  → {len(col_keys)} column keys")

    # ── 6. manager/contractor-billing-schedules/index.js ────────────────────
    print("\n[6] manager/contractor-billing-schedules/index.js")
    path = f"{BASE}/pages/manager/contractor-billing-schedules/index.js"
    with open(path) as f:
        content = f.read()
    content, col_keys = convert_column_array_to_fn(
        content, "CBS_COLUMNS", "buildCbsColumns", "manager", "contractorBillingSchedulesIndex"
    )
    content = add_usememo_after_t_hook(content, "buildCbsColumns", "cbsColumns")
    content = replace_columns_prop(content, "CBS_COLUMNS", "cbsColumns")
    with open(path, "w") as f:
        f.write(content)
    if col_keys:
        add_locale_keys("manager", "contractorBillingSchedulesIndex", col_keys)
    print(f"  → {len(col_keys)} column keys")

    # ── 7. owner/work-requests.js ───────────────────────────────────────────
    print("\n[7] owner/work-requests.js")
    path = f"{BASE}/pages/owner/work-requests.js"
    with open(path) as f:
        content = f.read()
    content, col_keys = convert_column_array_to_fn(
        content, "WR_COLUMNS", "buildWrColumns", "owner", "workRequests"
    )
    content = add_usememo_after_t_hook(content, "buildWrColumns", "wrColumns")
    content = replace_columns_prop(content, "WR_COLUMNS", "wrColumns")
    with open(path, "w") as f:
        f.write(content)
    if col_keys:
        add_locale_keys("owner", "workRequests", col_keys)
    print(f"  → {len(col_keys)} column keys")

    # ── 8. owner/properties.js ──────────────────────────────────────────────
    print("\n[8] owner/properties.js")
    path = f"{BASE}/pages/owner/properties.js"
    with open(path) as f:
        content = f.read()
    content, col_keys = convert_column_array_to_fn(
        content, "OWNER_BUILDING_COLUMNS", "buildOwnerBuildingColumns", "owner", "properties"
    )
    content = add_usememo_after_t_hook(content, "buildOwnerBuildingColumns", "ownerBuildingColumns")
    content = replace_columns_prop(content, "OWNER_BUILDING_COLUMNS", "ownerBuildingColumns")
    with open(path, "w") as f:
        f.write(content)
    if col_keys:
        add_locale_keys("owner", "properties", col_keys)
    print(f"  → {len(col_keys)} column keys")

    # ── 9. contractor/rfps.js ───────────────────────────────────────────────
    print("\n[9] contractor/rfps.js")
    path = f"{BASE}/pages/contractor/rfps.js"
    with open(path) as f:
        content = f.read()
    content, col_keys = convert_column_array_to_fn(
        content, "CRFP_COLUMNS", "buildCrfpColumns", "contractor", "rfps"
    )
    content = add_usememo_after_t_hook(content, "buildCrfpColumns", "crfpColumns")
    content = replace_columns_prop(content, "CRFP_COLUMNS", "crfpColumns")
    with open(path, "w") as f:
        f.write(content)
    if col_keys:
        add_locale_keys("contractor", "rfps", col_keys)
    print(f"  → {len(col_keys)} column keys")

    # ── 10. manager/finance/invoices.js — inline useMemo labels ─────────────
    print("\n[10] manager/finance/invoices.js (inline useMemo)")
    path = f"{BASE}/pages/manager/finance/invoices.js"
    with open(path) as f:
        content = f.read()
    # Handle dynamic label first
    content, extra_keys = patch_invoices_dynamic_label(content, "manager", "financeInvoices")
    # Then handle static labels in useMemo
    # We only want to patch the invoiceColumns useMemo, not the entire file
    # Find useMemo start
    memo_match = re.search(r'const invoiceColumns = useMemo\(\(\) => \[', content)
    if memo_match:
        array_start = memo_match.end() - 1
        array_end = find_array_end(content, array_start)
        if array_end != -1:
            inside = content[array_start:array_end + 1]
            patched, col_keys = patch_inline_usememo_labels(inside, "manager", "financeInvoices")
            content = content[:array_start] + patched + content[array_end + 1:]
            all_keys = {**col_keys, **extra_keys}
            if all_keys:
                add_locale_keys("manager", "financeInvoices", all_keys)
            print(f"  → {len(all_keys)} column keys")
    # Also fix INV_SORT_CYCLE labels
    sort_cycle_labels = re.findall(r'\{ field: "[^"]+", label: "([^"]+)" \}', content)
    for lbl in sort_cycle_labels:
        k = slug(lbl)
        fr_val = FR_MAP.get(lbl, lbl)
        content = content.replace(
            f'label: "{lbl}"',
            f'label: t("manager:financeInvoices.col.{k}")',
            1  # only first occurrence per label to avoid over-replacing
        )
    with open(path, "w") as f:
        f.write(content)

    # ── 11. owner/finance.js — inline useMemo labels ─────────────────────────
    print("\n[11] owner/finance.js (inline useMemo)")
    path = f"{BASE}/pages/owner/finance.js"
    with open(path) as f:
        content = f.read()
    content, extra_keys = patch_invoices_dynamic_label(content, "owner", "finance")
    memo_match = re.search(r'const invoiceColumns = useMemo\(\(\) => \[', content)
    if memo_match:
        array_start = memo_match.end() - 1
        array_end = find_array_end(content, array_start)
        if array_end != -1:
            inside = content[array_start:array_end + 1]
            patched, col_keys = patch_inline_usememo_labels(inside, "owner", "finance")
            content = content[:array_start] + patched + content[array_end + 1:]
            all_keys = {**col_keys, **extra_keys}
            if all_keys:
                add_locale_keys("owner", "finance", all_keys)
            print(f"  → {len(all_keys)} column keys")
    with open(path, "w") as f:
        f.write(content)

    # ── 12. owner/invoices.js — inline useMemo labels ─────────────────────────
    print("\n[12] owner/invoices.js (inline useMemo)")
    path = f"{BASE}/pages/owner/invoices.js"
    with open(path) as f:
        content = f.read()
    content, extra_keys = patch_invoices_dynamic_label(content, "owner", "invoices")
    memo_match = re.search(r'const invoiceColumns = useMemo\(\(\) => \[', content)
    if memo_match:
        array_start = memo_match.end() - 1
        array_end = find_array_end(content, array_start)
        if array_end != -1:
            inside = content[array_start:array_end + 1]
            patched, col_keys = patch_inline_usememo_labels(inside, "owner", "invoices")
            content = content[:array_start] + patched + content[array_end + 1:]
            all_keys = {**col_keys, **extra_keys}
            if all_keys:
                add_locale_keys("owner", "invoices", all_keys)
            print(f"  → {len(all_keys)} column keys")
    with open(path, "w") as f:
        f.write(content)

    # ── 13. manager/requests.js — add t to buildRequestColumns ──────────────
    print("\n[13] manager/requests.js (add t to buildRequestColumns)")
    path = f"{BASE}/pages/manager/requests.js"
    with open(path) as f:
        content = f.read()
    # Find the function definition
    fn_match = re.search(r'function buildRequestColumns\(\{([^}]+)\}\)', content)
    if fn_match:
        old_params = fn_match.group(0)
        params_inner = fn_match.group(1)
        if 't,' not in params_inner and ' t ' not in params_inner:
            new_params = old_params.replace(
                'function buildRequestColumns({',
                'function buildRequestColumns({ t,'
            )
            content = content.replace(old_params, new_params, 1)
    # Find where buildRequestColumns is called and add t
    call_match = re.search(r'buildRequestColumns\(\{([^}]+)\}\)', content)
    if call_match:
        old_call = call_match.group(0)
        if ' t,' not in old_call and 't,' not in old_call:
            new_call = old_call.replace('buildRequestColumns({', 'buildRequestColumns({ t,')
            content = content.replace(old_call, new_call, 1)
    # Replace hardcoded labels inside buildRequestColumns
    # Find the function body
    fn_body_match = re.search(r'function buildRequestColumns\([^)]*\)\s*\{', content)
    if fn_body_match:
        # Find the matching closing brace of the function
        brace_start = fn_body_match.end() - 1
        depth = 0
        i = brace_start
        while i < len(content):
            c = content[i]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    fn_end = i
                    break
            i += 1
        else:
            fn_end = len(content)
        fn_body = content[fn_body_match.start():fn_end + 1]
        col_keys = {}
        label_pattern = re.compile(r'''label:\s*["']([^"']*)["']''')

        def replace_req_label(lm):
            lv = lm.group(1)
            k = slug(lv)
            col_keys[k] = {"en": lv, "fr": FR_MAP.get(lv, lv)}
            return f'label: t("manager:requests.col.{k}")'

        new_fn_body = label_pattern.sub(replace_req_label, fn_body)
        content = content[:fn_body_match.start()] + new_fn_body + content[fn_end + 1:]
        if col_keys:
            add_locale_keys("manager", "requests", col_keys)
        print(f"  → {len(col_keys)} column keys")
    with open(path, "w") as f:
        f.write(content)

    # ── 14. manager/finance/invoices.js — also fix INCOMING/OUTGOING tab labels (if still needed)
    # Already handled by previous session's fix_tabs2.py, but let's verify

    print("\n✅ All column arrays patched.")
    print("\nNext: run `npx tsc --noEmit` to check for errors.")


if __name__ == "__main__":
    main()
