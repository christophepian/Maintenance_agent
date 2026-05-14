-- Seed a test Swiss QR-IBAN for staging so QR-bill generation can be tested.
--
-- What this does:
--   1. Finds the ORG-type BillingEntity for the org (creates one if missing).
--   2. Sets a test QR-IBAN on that BillingEntity.
--   3. Updates all invoices in the org that have no IBAN, pointing them at the
--      BillingEntity as issuer and stamping the IBAN directly on the row.
--
-- Test IBAN used: CH5631000123456789012
--   • Format: CH + 2 check digits + IID 31000 (QR-IBAN range 30000-31999) + 12-digit account
--   • Triggers QRR reference type in the QR-bill generator (standard for Swiss rent)
--   • Safe to use on staging — not a real account
--
-- Run in: Supabase SQL editor → staging project
-- Safe to re-run: uses DO block with upsert logic

DO $$
DECLARE
  v_test_iban   TEXT := 'CH5631000123456789012';
  v_org_id      TEXT;
  v_be_id       UUID;
BEGIN

  -- ── 1. Resolve org ────────────────────────────────────────────────────────
  -- Pick the first (and typically only) org in staging.
  SELECT id INTO v_org_id FROM "Org" ORDER BY "createdAt" LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No Org found in database — is this the right project?';
  END IF;

  RAISE NOTICE 'Using org: %', v_org_id;

  -- ── 2. Upsert ORG-type BillingEntity ─────────────────────────────────────
  SELECT id INTO v_be_id
  FROM "BillingEntity"
  WHERE "orgId" = v_org_id AND type = 'ORG'
  LIMIT 1;

  IF v_be_id IS NULL THEN
    INSERT INTO "BillingEntity" (
      id, "orgId", type, name,
      "addressLine1", "postalCode", city, country,
      iban, "defaultVatRate", "nextInvoiceSequence",
      "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), v_org_id, 'ORG', 'Staging Property Management SA',
      'Teststrasse 1', '8001', 'Zürich', 'CH',
      v_test_iban, 0, 1,
      NOW(), NOW()
    )
    RETURNING id INTO v_be_id;
    RAISE NOTICE 'Created BillingEntity: %', v_be_id;
  ELSE
    UPDATE "BillingEntity"
    SET iban = v_test_iban, "updatedAt" = NOW()
    WHERE id = v_be_id;
    RAISE NOTICE 'Updated existing BillingEntity: %', v_be_id;
  END IF;

  -- ── 3. Patch all invoices in the org that have no IBAN ───────────────────
  UPDATE "Invoice"
  SET
    iban                  = v_test_iban,
    "issuerBillingEntityId" = v_be_id,
    "updatedAt"           = NOW()
  WHERE
    "orgId" = v_org_id
    AND (iban IS NULL OR iban = '');

  RAISE NOTICE 'Invoice rows updated: %', (
    SELECT COUNT(*) FROM "Invoice"
    WHERE "orgId" = v_org_id AND iban = v_test_iban
  );

END $$;
