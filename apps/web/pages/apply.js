import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import ErrorBanner from "../components/ui/ErrorBanner";

import { cn } from "../lib/utils";
/**
 * Public Rental Application Wizard
 *
 * 3-step process:
 *   Step 1: Select vacant units + Upload & scan documents (drag-drop, auto-fill)
 *   Step 2: Applicant details (pre-filled from OCR) + household
 *   Step 3: Review + typed signature + submit
 *
 * No auth required — this is a public page.
 */

const DOC_TYPES = [
  { value: "IDENTITY", label: "Passport / ID card", required: true, icon: "🪪", hint: "We'll extract your name, date of birth, and nationality" },
  { value: "SALARY_PROOF", label: "Salary slip (last 3 months)", required: true, icon: "💰", hint: "We'll extract your employer, income, and job title" },
  { value: "DEBT_ENFORCEMENT_EXTRACT", label: "Debt enforcement extract", required: true, icon: "📋", hint: "We'll check if you have any outstanding debts" },
  { value: "PERMIT", label: "Residence permit (if non-CH)", required: false, icon: "🛂", hint: "We'll extract your permit type and validity" },
  { value: "HOUSEHOLD_INSURANCE", label: "Household insurance (RC)", required: false, icon: "🛡️", hint: "We'll extract your insurance company" },
  { value: "PARKING_DOCS", label: "Parking / vehicle registration", required: false, icon: "🚗", hint: "" },
];

const CIVIL_STATUSES = ["SINGLE", "MARRIED", "REGISTERED_PARTNERSHIP", "DIVORCED", "WIDOWED", "SEPARATED"];

function emptyApplicant(role = "PRIMARY") {
  return {
    role,
    firstName: "", lastName: "", dateOfBirth: "", nationality: "",
    civilStatus: "SINGLE", phone: "", email: "",
    employer: "", jobTitle: "", workLocation: "", employedSince: "",
    netMonthlyIncome: "",
    permitType: "", hasDebtEnforcement: false,
  };
}

const TOTAL_STEPS = 3;

/**
 * Normalizes a date string to YYYY-MM-DD (what the backend Zod schema accepts).
 * Handles:
 *   "1985-03-15"  → "1985-03-15"  (already correct)
 *   "15.03.1985"  → "1985-03-15"  (European DD.MM.YYYY from OCR)
 *   ""  / null    → undefined      (optional field — strip from payload)
 */
function normalizeBirthdate(raw) {
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw; // already YYYY-MM-DD
  // Try DD.MM.YYYY (common Swiss/European OCR output)
  const m = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return undefined; // unknown format — drop rather than send invalid value
}

export default function ApplyPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1: vacant units + documents
  const [vacantUnits, setVacantUnits] = useState([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(true);

  // Listing filters (INT-009)
  const [filterCity, setFilterCity] = useState("");
  const [filterPostalCode, setFilterPostalCode] = useState("");
  const [filterMinRooms, setFilterMinRooms] = useState("");
  const [sortPrice, setSortPrice] = useState(""); // "" | "asc" | "desc"

  // Document uploads (held in memory before application draft creation)
  // { docType, file, fileName, scanResult, status: 'pending'|'scanning'|'scanned'|'error' }
  const [docUploads, setDocUploads] = useState([]);
  const [scanResults, setScanResults] = useState({}); // { docType: ScanResult }

  // Step 2: applicants + household
  const [applicants, setApplicants] = useState([emptyApplicant("PRIMARY")]);
  const [household, setHousehold] = useState({
    currentLandlordName: "", currentLandlordAddress: "", currentLandlordPhone: "",
    reasonForLeaving: "", desiredMoveInDate: "",
    householdSize: 1, hasPets: false, petsDescription: "",
    hasRcInsurance: false, rcInsuranceCompany: "",
    hasVehicle: false, vehicleDescription: "", needsParking: false,
    remarks: "",
  });

  // Validation state — tracks whether user attempted to submit so we can highlight missing fields
  const [validationAttempted, setValidationAttempted] = useState(false);

  // Step 3 state (post-draft)
  const [applicationId, setApplicationId] = useState(null);
  const [applicantIds, setApplicantIds] = useState([]);
  const [signedName, setSignedName] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);

  // Pre-select unit from query param (?unitId=…)
  const [pendingUnitId, setPendingUnitId] = useState(null);

  useEffect(() => {
    loadVacantUnits();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const qUnit = router.query.unitId;
    if (qUnit && typeof qUnit === "string") {
      setPendingUnitId(qUnit);
    }
  }, [router.isReady, router.query.unitId]);

  // Once vacant units are loaded, validate the pending unitId
  useEffect(() => {
    if (!pendingUnitId || unitsLoading) return;
    const vacantIds = new Set(vacantUnits.map((u) => u.id));
    if (vacantIds.has(pendingUnitId)) {
      setSelectedUnitIds((prev) => (prev.includes(pendingUnitId) ? prev : [...prev, pendingUnitId]));
    } else {
      setError("The unit you selected is no longer available. Please choose from the available units below.");
    }
    setPendingUnitId(null);
  }, [pendingUnitId, unitsLoading, vacantUnits]);

  /**
   * Apply OCR scan results to the primary applicant and household fields.
   * Called directly from handleDocUpload (not via useEffect) to guarantee
   * the extracted data is applied immediately and not lost to stale closures.
   */
  function applyOcrToApplicant(detectedType, scanResult) {
    const f = scanResult?.fields || {};
    if (Object.keys(f).length === 0) return; // nothing extracted

    setApplicants((prev) => {
      const updated = [...prev];
      const primary = { ...updated[0] };
      let changed = false;

      // Helper: set field if OCR value exists and field is empty/default
      const fill = (key, value) => {
        if (value != null && value !== "" && !primary[key]) {
          primary[key] = typeof value === "number" ? String(value) : value;
          changed = true;
        }
      };

      if (detectedType === "IDENTITY") {
        fill("firstName", f.firstName);
        fill("lastName", f.lastName);
        fill("dateOfBirth", f.dateOfBirth);
        fill("nationality", f.nationality);
      }

      if (detectedType === "SALARY_PROOF") {
        fill("firstName", f.firstName);
        fill("lastName", f.lastName);
        fill("employer", f.employer);
        fill("jobTitle", f.jobTitle);
        fill("netMonthlyIncome", f.netMonthlyIncome);
      }

      if (detectedType === "DEBT_ENFORCEMENT_EXTRACT") {
        // Only auto-fill when the scanner is confident (true or false).
        // null means ambiguous/unknown — leave for manual review.
        if (f.hasDebtEnforcement === true || f.hasDebtEnforcement === false) {
          primary.hasDebtEnforcement = f.hasDebtEnforcement;
          changed = true;
        }
        fill("firstName", f.firstName);
        fill("lastName", f.lastName);
      }

      if (detectedType === "PERMIT") {
        fill("permitType", f.permitType);
        fill("nationality", f.nationality);
      }

      if (changed) {
        updated[0] = primary;
        return updated;
      }
      return prev; // no change — avoid re-render
    });

    // Household fields (insurance)
    if (detectedType === "HOUSEHOLD_INSURANCE" && f.hasRcInsurance) {
      setHousehold((h) => ({
        ...h,
        hasRcInsurance: true,
        rcInsuranceCompany: f.rcInsuranceCompany || h.rcInsuranceCompany,
      }));
    }
  }

  async function api(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Request failed (${res.status})`);
    }
    return data;
  }

  async function loadVacantUnits() {
    setUnitsLoading(true);
    try {
      const data = await api("/vacant-units");
      setVacantUnits(data.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setUnitsLoading(false);
    }
  }

  function toggleUnit(unitId) {
    setSelectedUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  }

  function updateApplicant(index, field, value) {
    setApplicants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function addCoApplicant() {
    setApplicants((prev) => [...prev, emptyApplicant("CO_APPLICANT")]);
  }

  function removeCoApplicant(index) {
    if (index === 0) return;
    setApplicants((prev) => prev.filter((_, i) => i !== index));
  }

  // --- Document scanning ---
  async function scanFile(file, hintDocType) {
    const formData = new FormData();
    formData.append("file", file);
    if (hintDocType) formData.append("hintDocType", hintDocType);

    const res = await fetch("/api/document-scan", {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || "Scan failed");
    return data.data;
  }

  async function handleDocUpload(file, hintDocType) {
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const entry = {
      id: tempId,
      file,
      fileName: file.name,
      hintDocType: hintDocType || null,
      status: "scanning",
      scanResult: null,
      detectedDocType: null,
      error: null,
    };

    setDocUploads((prev) => [...prev, entry]);

    try {
      const result = await scanFile(file, hintDocType);
      const detectedType = result.docType || hintDocType || "UNKNOWN";

      setDocUploads((prev) =>
        prev.map((d) =>
          d.id === tempId
            ? { ...d, status: "scanned", scanResult: result, detectedDocType: detectedType }
            : d
        )
      );

      // Store scan result keyed by detected doc type
      setScanResults((prev) => ({ ...prev, [detectedType]: result }));

      // Apply extracted fields directly to applicant form
      applyOcrToApplicant(detectedType, result);
    } catch (e) {
      setDocUploads((prev) =>
        prev.map((d) =>
          d.id === tempId ? { ...d, status: "error", error: e.message } : d
        )
      );
    }
  }

  function removeDoc(docId) {
    setDocUploads((prev) => {
      const doc = prev.find((d) => d.id === docId);
      if (doc?.detectedDocType) {
        setScanResults((sr) => {
          const copy = { ...sr };
          delete copy[doc.detectedDocType];
          return copy;
        });
      }
      return prev.filter((d) => d.id !== docId);
    });
  }

  // Step 1 → Step 2
  function goToStep2() {
    if (selectedUnitIds.length === 0) {
      setError("Please select at least one unit.");
      return;
    }
    // Prune any phantom selections (unitIds not in the loaded vacant list)
    const vacantIds = new Set(vacantUnits.map((u) => u.id));
    const valid = selectedUnitIds.filter((id) => vacantIds.has(id));
    if (valid.length === 0) {
      setSelectedUnitIds([]);
      setError("The selected unit(s) are no longer available. Please choose from the list below.");
      return;
    }
    if (valid.length !== selectedUnitIds.length) {
      setSelectedUnitIds(valid);
    }
    setError("");
    setStep(2);
  }

  // Step 2 → Step 3: Create draft + upload attachments + go to review
  async function goToStep3() {
    setError("");
    setValidationAttempted(true);

    const primary = applicants[0];
    const missing = [];
    if (!primary.firstName) missing.push("First name");
    if (!primary.lastName) missing.push("Last name");
    if (!primary.email) missing.push("Email");
    if (!primary.phone) missing.push("Phone");
    if (!primary.netMonthlyIncome || Number(primary.netMonthlyIncome) <= 0) missing.push("Net monthly income");
    if (!household.currentLandlordName) missing.push("Current landlord name");
    if (!household.desiredMoveInDate) missing.push("Desired move-in date");
    if (missing.length > 0) {
      setError(`Please fill in the required fields: ${missing.join(", ")}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setLoading(true);
    try {
      // Final validation — only send unitIds the server will accept
      const vacantIds = new Set(vacantUnits.map((u) => u.id));
      const validUnitIds = selectedUnitIds.filter((id) => vacantIds.has(id));
      if (validUnitIds.length === 0) {
        setSelectedUnitIds([]);
        setError("The selected unit(s) are no longer available. Please go back and choose from the list.");
        setLoading(false);
        return;
      }

      const payload = {
        unitIds: validUnitIds,
        applicants: applicants.map((a) => ({
          ...a,
          // Backend expects "birthdate" not "dateOfBirth", must be YYYY-MM-DD
          birthdate: normalizeBirthdate(a.dateOfBirth),
          dateOfBirth: undefined,
          // Backend requires integer income (Zod .int()); round OCR floats
          netMonthlyIncome: Math.round(Number(a.netMonthlyIncome)) || 0,
          employedSince: a.employedSince || undefined,
          permitType: a.permitType || undefined,
          // Strip empty strings for fields with strict Zod validators
          email: a.email || undefined,
          phone: a.phone || undefined,
        })),
        ...household,
        householdSize: Math.round(Number(household.householdSize)) || 1,
        desiredMoveInDate: household.desiredMoveInDate || undefined,
      };

      const result = await api("/rental-applications", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const app = result.data;
      setApplicationId(app.id);
      const appIds = app.applicants?.map((a) => ({ id: a.id, role: a.role, name: `${a.firstName} ${a.lastName}` })) || [];
      setApplicantIds(appIds);

      // Upload held documents to the created application
      const primaryApplicantId = appIds[0]?.id;
      if (primaryApplicantId && docUploads.length > 0) {
        for (const doc of docUploads) {
          if (!doc.file) continue;
          try {
            const formData = new FormData();
            formData.append("meta", JSON.stringify({
              applicantId: primaryApplicantId,
              docType: doc.detectedDocType || doc.hintDocType || "IDENTITY",
            }));
            formData.append("file", doc.file);
            await fetch(`/api/rental-applications/${app.id}/attachments`, {
              method: "POST",
              body: formData,
            });
          } catch { /* non-blocking — docs already scanned */ }
        }
      }

      setStep(3);
      setValidationAttempted(false);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("404") || msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("not vacant")) {
        setError("One or more selected units are no longer available. Please go back and update your unit selection.");
      } else {
        setError(msg);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Submit application
  async function handleSubmit() {
    setError("");
    if (!signedName.trim()) {
      setError("Please type your full legal name as signature.");
      return;
    }
    if (!consentChecked) {
      setError("Please confirm consent to process your data.");
      return;
    }
    setLoading(true);
    try {
      await api(`/rental-applications/${applicationId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          signedName: signedName.trim(),
          consent: true,
        }),
      });
      setSuccess("Your application has been submitted successfully! You will receive a confirmation email.");
      setStep(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // When deep-linked via ?unitId=, only show that unit (hide others)
  const linkedUnitId = router.query.unitId || null;

  // Derive unique cities and postal codes for filter dropdowns
  const availableCities = useMemo(() => {
    const set = new Set();
    vacantUnits.forEach((u) => { if (u.building?.city) set.add(u.building.city); });
    return Array.from(set).sort();
  }, [vacantUnits]);

  const availablePostalCodes = useMemo(() => {
    const set = new Set();
    vacantUnits.forEach((u) => { if (u.building?.postalCode) set.add(u.building.postalCode); });
    return Array.from(set).sort();
  }, [vacantUnits]);

  // Filtered + sorted units
  const filteredUnits = useMemo(() => {
    let list = linkedUnitId
      ? vacantUnits.filter((u) => u.id === linkedUnitId)
      : [...vacantUnits];

    if (filterCity) list = list.filter((u) => u.building?.city === filterCity);
    if (filterPostalCode) list = list.filter((u) => u.building?.postalCode === filterPostalCode);
    if (filterMinRooms) list = list.filter((u) => u.rooms != null && u.rooms >= parseFloat(filterMinRooms));
    if (sortPrice === "asc") list.sort((a, b) => (a.monthlyRentChf ?? 0) - (b.monthlyRentChf ?? 0));
    if (sortPrice === "desc") list.sort((a, b) => (b.monthlyRentChf ?? 0) - (a.monthlyRentChf ?? 0));

    return list;
  }, [vacantUnits, linkedUnitId, filterCity, filterPostalCode, filterMinRooms, sortPrice]);

  const unitsByBuilding = useMemo(() => {
    const map = new Map();
    filteredUnits.forEach((u) => {
      const bName = u.building?.name || "Unknown building";
      if (!map.has(bName)) map.set(bName, []);
      map.get(bName).push(u);
    });
    return map;
  }, [filteredUnits]);

  // Count extracted fields across all scans
  const extractedFieldCount = useMemo(() => {
    let count = 0;
    for (const r of Object.values(scanResults)) {
      count += Object.keys(r.fields || {}).filter((k) => !k.startsWith("_")).length;
    }
    return count;
  }, [scanResults]);

  return (
    <>
      <Head>
        <title>Apply for a Rental Unit</title>
      </Head>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-xl font-semibold text-slate-900">Rental Application</h1>
            <p className="text-sm text-slate-500 mt-1">
              {step <= TOTAL_STEPS ? `Step ${step} of ${TOTAL_STEPS}` : "Complete"}
            </p>
            {/* Progress bar */}
            <div className="mt-3 flex gap-1">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
                <div
                  key={s}
                  className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-indigo-600" : "bg-slate-200")}
                />
              ))}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <ErrorBanner error={error} onDismiss={() => setError("")} className="mb-4 text-sm" />

          {/* ── Step 1: Select Units + Upload Documents ──────── */}
          {step === 1 && (
            <div className="space-y-8">
              {/* Unit selection */}
              <section>
                <h2 className="text-lg font-semibold text-slate-900">Select units to apply for</h2>
                <p className="text-sm text-slate-600 mt-1">
                  You can apply to multiple units with a single dossier.
                </p>

                {/* Filters (INT-009) */}
                {!linkedUnitId && vacantUnits.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                    {availableCities.length > 0 && (
                      <label className="flex flex-col text-xs text-slate-600">
                        City
                        <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="filter-select mt-1">
                          <option value="">All cities</option>
                          {availableCities.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                    )}
                    {availablePostalCodes.length > 0 && (
                      <label className="flex flex-col text-xs text-slate-600">
                        Postal code
                        <select value={filterPostalCode} onChange={(e) => setFilterPostalCode(e.target.value)} className="filter-select mt-1">
                          <option value="">All codes</option>
                          {availablePostalCodes.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                    )}
                    <label className="flex flex-col text-xs text-slate-600">
                      Min. rooms
                      <select value={filterMinRooms} onChange={(e) => setFilterMinRooms(e.target.value)} className="filter-select mt-1">
                        <option value="">Any</option>
                        <option value="1">1+</option>
                        <option value="1.5">1.5+</option>
                        <option value="2">2+</option>
                        <option value="2.5">2.5+</option>
                        <option value="3">3+</option>
                        <option value="3.5">3.5+</option>
                        <option value="4">4+</option>
                        <option value="4.5">4.5+</option>
                        <option value="5">5+</option>
                      </select>
                    </label>
                    <label className="flex flex-col text-xs text-slate-600">
                      Sort by price
                      <select value={sortPrice} onChange={(e) => setSortPrice(e.target.value)} className="filter-select mt-1">
                        <option value="">Default</option>
                        <option value="asc">Low → High</option>
                        <option value="desc">High → Low</option>
                      </select>
                    </label>
                    {(filterCity || filterPostalCode || filterMinRooms || sortPrice) && (
                      <button
                        onClick={() => { setFilterCity(""); setFilterPostalCode(""); setFilterMinRooms(""); setSortPrice(""); }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 underline self-end pb-1.5"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {unitsLoading && <p className="text-sm text-slate-500">Loading available units…</p>}

                  {!unitsLoading && vacantUnits.length === 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-600">
                      No vacant units available at this time.
                    </div>
                  )}

                  {!unitsLoading && vacantUnits.length > 0 && filteredUnits.length === 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-600">
                      No units match the selected filters. Try adjusting your criteria.
                    </div>
                  )}

                  {!unitsLoading && Array.from(unitsByBuilding.entries()).map(([bName, units]) => (
                    <div key={bName} className="rounded-xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-900">{bName}</h3>
                        <p className="text-xs text-slate-500">
                          {[units[0]?.building?.address, units[0]?.building?.postalCode, units[0]?.building?.city].filter(Boolean).join(", ")}
                        </p>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {units.map((u) => (
                          <label
                            key={u.id}
                            className={cn("flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors", selectedUnitIds.includes(u.id) ? "bg-indigo-50 ring-1 ring-inset ring-blue-200" : "hover:bg-slate-50")}
                          >
                            <input
                              type="checkbox"
                              checked={selectedUnitIds.includes(u.id)}
                              onChange={() => toggleUnit(u.id)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                            />
                            <div className="flex-1">
                              <span className="text-sm font-medium text-slate-900">
                                Unit {u.unitNumber}
                              </span>
                              {u.floor && <span className="text-xs text-slate-500 ml-2">Floor {u.floor}</span>}
                              {u.rooms != null && <span className="text-xs text-slate-500 ml-2">{u.rooms} rooms</span>}
                            </div>
                            <div className="text-right text-xs text-slate-600">
                              {u.monthlyRentChf != null && <div>CHF {u.monthlyRentChf}/mo</div>}
                              {u.monthlyChargesChf != null && (
                                <div className="text-slate-400">+ CHF {u.monthlyChargesChf} charges</div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  {selectedUnitIds.length > 0 && (
                    <div className="text-sm text-indigo-600 font-medium">
                      ✓ {selectedUnitIds.length} unit{selectedUnitIds.length > 1 ? "s" : ""} selected
                    </div>
                  )}
                </div>
              </section>

              {/* Document upload zone */}
              <section>
                <h2 className="text-lg font-semibold text-slate-900">Upload your documents</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Drop your files here — we'll scan them automatically and pre-fill your application.
                  You can also upload them one-by-one to a specific category.
                </p>

                {/* Selected-units summary — only shows units the applicant has chosen */}
                {selectedUnitIds.length > 0 && (
                  <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <p className="text-xs font-medium text-indigo-700 mb-1">
                      {selectedUnitIds.length === 1 ? "Applying for:" : `Applying for ${selectedUnitIds.length} units:`}
                    </p>
                    <ul className="space-y-0.5">
                      {selectedUnitIds.map((id) => {
                        const u = vacantUnits.find((u) => u.id === id);
                        if (!u) return null;
                        return (
                          <li key={id} className="text-xs text-indigo-700">
                            {u.building?.name} — Unit {u.unitNumber}
                            {u.monthlyRentChf != null && ` · CHF ${u.monthlyRentChf}/mo`}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-xs text-indigo-500 mt-1.5">
                      Your documents will be attached to {selectedUnitIds.length === 1 ? "this application" : "all selected units"}.
                    </p>
                  </div>
                )}

                {/* Drag-and-drop zone */}
                <DropZone onFiles={(files) => {
                  for (const f of files) handleDocUpload(f, null);
                }} />

                {/* Per-category upload buttons */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DOC_TYPES.map((dt) => {
                    const uploaded = docUploads.find(
                      (d) => d.hintDocType === dt.value || d.detectedDocType === dt.value
                    );
                    return (
                      <DocTypeSlot
                        key={dt.value}
                        docType={dt}
                        upload={uploaded}
                        onUpload={(file) => handleDocUpload(file, dt.value)}
                        onRemove={uploaded ? () => removeDoc(uploaded.id) : null}
                      />
                    );
                  })}
                </div>

                {/* Uploaded files list */}
                {docUploads.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-sm font-medium text-slate-700">
                      Uploaded files ({docUploads.length})
                    </h3>
                    {docUploads.map((doc) => (
                      <UploadedDocRow key={doc.id} doc={doc} onRemove={() => removeDoc(doc.id)} />
                    ))}
                  </div>
                )}

                {/* Extraction summary */}
                {extractedFieldCount > 0 && (
                  <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <p className="text-sm font-medium text-green-700">
                      ✨ Extracted {extractedFieldCount} field{extractedFieldCount !== 1 ? "s" : ""} from your documents
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      These will be pre-filled in the next step. You can review and correct them.
                    </p>
                  </div>
                )}
              </section>

              <button
                onClick={goToStep2}
                disabled={selectedUnitIds.length === 0}
                className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Continue to applicant details
              </button>
            </div>
          )}

          {/* ── Step 2: Applicant Details ─────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Applicant Details</h2>
                <p className="text-sm text-slate-600 mt-1">
                  {extractedFieldCount > 0
                    ? "We've pre-filled some fields from your documents. Please review and complete the rest."
                    : "All fields marked with * are mandatory."}
                </p>
              </div>

              {applicants.map((applicant, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {idx === 0 ? "Primary Applicant" : `Co-Applicant ${idx}`}
                    </h3>
                    {idx > 0 && (
                      <button
                        onClick={() => removeCoApplicant(idx)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                    <AutoField label="First name *" value={applicant.firstName} onChange={(v) => updateApplicant(idx, "firstName", v)} autoFilled={idx === 0 && !!(scanResults.IDENTITY?.fields?.firstName || scanResults.SALARY_PROOF?.fields?.firstName)} showMissing={validationAttempted} />
                    <AutoField label="Last name *" value={applicant.lastName} onChange={(v) => updateApplicant(idx, "lastName", v)} autoFilled={idx === 0 && !!(scanResults.IDENTITY?.fields?.lastName || scanResults.SALARY_PROOF?.fields?.lastName)} showMissing={validationAttempted} />
                    <AutoField label="Date of birth" type="date" value={applicant.dateOfBirth} onChange={(v) => updateApplicant(idx, "dateOfBirth", v)} autoFilled={idx === 0 && !!scanResults.IDENTITY?.fields?.dateOfBirth} />
                    <AutoField label="Nationality" value={applicant.nationality} onChange={(v) => updateApplicant(idx, "nationality", v)} autoFilled={idx === 0 && !!scanResults.IDENTITY?.fields?.nationality} placeholder="e.g. CH, FR, DE" />
                    <SelectField label="Civil status" value={applicant.civilStatus} options={CIVIL_STATUSES} onChange={(v) => updateApplicant(idx, "civilStatus", v)} />
                    <Field label="Phone *" type="tel" value={applicant.phone} onChange={(v) => updateApplicant(idx, "phone", v)} showMissing={validationAttempted} />
                    <Field label="Email *" type="email" value={applicant.email} onChange={(v) => updateApplicant(idx, "email", v)} className="sm:col-span-2" showMissing={validationAttempted} />
                    <AutoField label="Employer" value={applicant.employer} onChange={(v) => updateApplicant(idx, "employer", v)} autoFilled={idx === 0 && !!scanResults.SALARY_PROOF?.fields?.employer} />
                    <AutoField label="Job title" value={applicant.jobTitle} onChange={(v) => updateApplicant(idx, "jobTitle", v)} autoFilled={idx === 0 && !!scanResults.SALARY_PROOF?.fields?.jobTitle} />
                    <Field label="Work location" value={applicant.workLocation} onChange={(v) => updateApplicant(idx, "workLocation", v)} />
                    <Field label="Employed since" type="date" value={applicant.employedSince} onChange={(v) => updateApplicant(idx, "employedSince", v)} />
                    <AutoField label="Net monthly income (CHF) *" type="number" value={applicant.netMonthlyIncome} onChange={(v) => updateApplicant(idx, "netMonthlyIncome", v)} autoFilled={idx === 0 && !!scanResults.SALARY_PROOF?.fields?.netMonthlyIncome} showMissing={validationAttempted} />
                    <AutoField label="Permit type (if non-CH)" value={applicant.permitType} onChange={(v) => updateApplicant(idx, "permitType", v)} autoFilled={idx === 0 && !!scanResults.PERMIT?.fields?.permitType} />
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={applicant.hasDebtEnforcement}
                        onChange={(e) => updateApplicant(idx, "hasDebtEnforcement", e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                      <label className="text-sm text-slate-700">Has debt enforcement proceedings</label>
                      {idx === 0 && scanResults.DEBT_ENFORCEMENT_EXTRACT?.fields?.hasDebtEnforcement === false && (
                        <span className="text-xs text-green-600 ml-1">✓ Clean record detected</span>
                      )}
                      {idx === 0 && scanResults.DEBT_ENFORCEMENT_EXTRACT?.fields?.hasDebtEnforcement === null && (
                        <span className="text-xs text-amber-600 ml-1">⚠ Could not determine — please verify manually</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addCoApplicant}
                className="w-full rounded-lg border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                + Add Co-Applicant
              </button>

              {/* Household & current housing */}
              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">Current Housing & Household</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  <Field label="Current landlord name *" value={household.currentLandlordName} onChange={(v) => setHousehold((h) => ({ ...h, currentLandlordName: v }))} showMissing={validationAttempted} />
                  <Field label="Current landlord address" value={household.currentLandlordAddress} onChange={(v) => setHousehold((h) => ({ ...h, currentLandlordAddress: v }))} />
                  <Field label="Current landlord phone" type="tel" value={household.currentLandlordPhone} onChange={(v) => setHousehold((h) => ({ ...h, currentLandlordPhone: v }))} />
                  <Field label="Reason for leaving" value={household.reasonForLeaving} onChange={(v) => setHousehold((h) => ({ ...h, reasonForLeaving: v }))} />
                  <Field label="Desired move-in date *" type="date" value={household.desiredMoveInDate} onChange={(v) => setHousehold((h) => ({ ...h, desiredMoveInDate: v }))} showMissing={validationAttempted} />
                  <Field label="Household size" type="number" value={household.householdSize} onChange={(v) => setHousehold((h) => ({ ...h, householdSize: v }))} />
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={household.hasPets} onChange={(e) => setHousehold((h) => ({ ...h, hasPets: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                    <label className="text-sm text-slate-700">Pets</label>
                  </div>
                  {household.hasPets && (
                    <Field label="Pets description" value={household.petsDescription} onChange={(v) => setHousehold((h) => ({ ...h, petsDescription: v }))} />
                  )}
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={household.hasRcInsurance} onChange={(e) => setHousehold((h) => ({ ...h, hasRcInsurance: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                    <label className="text-sm text-slate-700">RC insurance (liability)</label>
                    {scanResults.HOUSEHOLD_INSURANCE?.fields?.hasRcInsurance && (
                      <span className="text-xs text-green-600 ml-1">✓ Detected from document</span>
                    )}
                  </div>
                  {household.hasRcInsurance && (
                    <AutoField label="Insurance company" value={household.rcInsuranceCompany} onChange={(v) => setHousehold((h) => ({ ...h, rcInsuranceCompany: v }))} autoFilled={!!scanResults.HOUSEHOLD_INSURANCE?.fields?.rcInsuranceCompany} />
                  )}
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={household.hasVehicle} onChange={(e) => setHousehold((h) => ({ ...h, hasVehicle: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                    <label className="text-sm text-slate-700">Vehicle</label>
                  </div>
                  {household.hasVehicle && (
                    <>
                      <Field label="Vehicle description" value={household.vehicleDescription} onChange={(v) => setHousehold((h) => ({ ...h, vehicleDescription: v }))} />
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={household.needsParking} onChange={(e) => setHousehold((h) => ({ ...h, needsParking: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                        <label className="text-sm text-slate-700">Needs parking</label>
                      </div>
                    </>
                  )}
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Remarks</label>
                    <textarea
                      value={household.remarks}
                      onChange={(e) => setHousehold((h) => ({ ...h, remarks: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Back
                </button>
                <button onClick={goToStep3} disabled={loading} className="button-primary flex-1 py-3 text-sm font-semibold disabled:bg-slate-300">
                  {loading ? "Saving…" : "Continue to review"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Review + Submit ───────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Review & Submit</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Please review your application and sign below.
                </p>
              </div>

              {/* Summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Units Applied For</h3>
                  <ul className="mt-1 space-y-1">
                    {selectedUnitIds.map((id) => {
                      const u = vacantUnits.find((u) => u.id === id);
                      return (
                        <li key={id} className="text-sm text-slate-600">
                          {u?.building?.name} — Unit {u?.unitNumber} (CHF {u?.monthlyRentChf}/mo)
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Applicants</h3>
                  <ul className="mt-1 space-y-1">
                    {applicants.map((a, i) => (
                      <li key={i} className="text-sm text-slate-600">
                        {a.firstName} {a.lastName} — {a.role === "PRIMARY" ? "Primary" : "Co-applicant"}
                        {a.netMonthlyIncome && ` — CHF ${a.netMonthlyIncome}/mo`}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Documents</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {docUploads.filter((d) => d.status === "scanned").length} document(s) uploaded & scanned
                  </p>
                  {extractedFieldCount > 0 && (
                    <p className="text-xs text-green-600 mt-0.5">
                      ✨ {extractedFieldCount} fields auto-filled from documents
                    </p>
                  )}
                </div>
              </div>

              {/* Signature */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">Electronic Signature</h3>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Type your full legal name *
                  </label>
                  <input
                    type="text"
                    value={signedName}
                    onChange={(e) => setSignedName(e.target.value)}
                    placeholder="e.g. Jean Dupont"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-serif italic"
                  />
                </div>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <span className="text-xs text-slate-600">
                    I certify that all information provided is accurate and complete. I consent
                    to the processing of my personal data for the purpose of this rental application.
                  </span>
                </label>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 rounded-lg border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !signedName.trim() || !consentChecked}
                  className="flex-1 rounded-lg bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {loading ? "Submitting…" : "Submit Application"}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Confirmation ──────────────────────────── */}
          {step === 4 && (
            <div className="text-center space-y-4 py-12">
              <div className="text-5xl">✅</div>
              <h2 className="text-xl font-semibold text-slate-900">Application Submitted</h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">{success}</p>
              <button
                onClick={() => router.push("/listings")}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Back to Listings
              </button>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   Components
   ══════════════════════════════════════════════════════════════ */

/* ── Drag-and-drop zone ────────────────────────────────── */

function DropZone({ onFiles }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;
    const files = Array.from(e.dataTransfer?.files || []);
    const valid = files.filter((f) =>
      ["application/pdf", "image/jpeg", "image/png", "image/jpg"].includes(f.type)
    );
    if (valid.length > 0) onFiles(valid);
  }, [onFiles]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn("mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all py-10 px-6", dragging ? "border-indigo-400 bg-indigo-50 scale-[1.01]" : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50")}
    >
      <div className="text-4xl mb-3">{dragging ? "📥" : "📄"}</div>
      <p className="text-sm font-medium text-slate-700">
        {dragging ? "Drop files here…" : "Drag & drop your documents here"}
      </p>
      <p className="text-xs text-slate-400 mt-1">
        or click to browse · PDF, JPG, PNG · max 5MB each
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ── Document type slot (per-category upload) ──────────── */

function DocTypeSlot({ docType, upload, onUpload, onRemove }) {
  const isUploaded = upload?.status === "scanned";
  const isScanning = upload?.status === "scanning";

  return (
    <div
      className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors", isUploaded ? "border-green-200 bg-green-50" : isScanning ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white hover:bg-slate-50")}
    >
      <span className="text-lg flex-shrink-0">{docType.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">
          <span>{docType.label}{docType.required ? <span className="text-red-500 ml-0.5"> *</span> : null}</span>
        </div>
        {isUploaded && (
          <div className="text-xs text-green-600 truncate">
            ✓ {upload.fileName}
          </div>
        )}
        {isScanning && (
          <div className="text-xs text-amber-600">
            Scanning…
          </div>
        )}
        {!isUploaded && !isScanning && docType.hint && (
          <div className="text-xs text-slate-400 truncate">{docType.hint}</div>
        )}
      </div>
      <div className="flex-shrink-0 flex items-center gap-1">
        {isUploaded && onRemove && (
          <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700 px-1" aria-label="Remove document">✕</button>
        )}
        {!isScanning && (
          <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
            {isUploaded ? "Replace" : "Upload"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

/* ── Uploaded document row ─────────────────────────────── */

function UploadedDocRow({ doc, onRemove }) {
  const [showDebug, setShowDebug] = useState(false);
  const docLabel = DOC_TYPES.find((dt) => dt.value === doc.detectedDocType)?.label || doc.detectedDocType || "Unknown";
  const fields = doc.scanResult?.fields || {};
  const fieldEntries = Object.entries(fields).filter(([k]) => !k.startsWith("_"));
  const fieldCount = fieldEntries.length;
  const rawText = fields._rawTextPreview || "";

  // Expected fields per doc type so we can show what's MISSING
  const EXPECTED_FIELDS = {
    IDENTITY: ["firstName", "lastName", "dateOfBirth", "nationality", "documentNumber", "sex"],
    SALARY_PROOF: ["firstName", "lastName", "employer", "jobTitle", "netMonthlyIncome", "salaryPeriod"],
    DEBT_ENFORCEMENT_EXTRACT: ["hasDebtEnforcement", "extractStatus", "firstName", "lastName"],
    PERMIT: ["permitType", "firstName", "lastName", "nationality"],
    HOUSEHOLD_INSURANCE: ["hasRcInsurance", "rcInsuranceCompany"],
  };
  const expected = EXPECTED_FIELDS[doc.detectedDocType] || [];
  const missingFields = expected.filter((k) => !fields[k] && fields[k] !== false && fields[k] !== 0);

  return (
    <div
      className={cn("rounded-lg border text-sm", doc.status === "scanning" ? "border-amber-200 bg-amber-50" : doc.status === "error" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50")}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="flex-shrink-0">
          {doc.status === "scanning" && (
            <div className="w-5 h-5 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
          )}
          {doc.status === "scanned" && <span className="text-green-600">✓</span>}
          {doc.status === "error" && <span className="text-red-500">✗</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-800 truncate">{doc.fileName}</div>
          <div className="text-xs text-slate-500 truncate">
            {doc.status === "scanning" && "Analysing document…"}
            {doc.status === "scanned" && (
              <>
                Detected: {docLabel}
                {fieldCount > 0 && (
                  <span className="text-green-600 ml-1">
                    · {fieldCount} field{fieldCount !== 1 ? "s" : ""} extracted
                  </span>
                )}
                {missingFields.length > 0 && (
                  <span className="text-amber-600 ml-1">
                    · {missingFields.length} missing
                  </span>
                )}
                {doc.scanResult?.confidence && (
                  <span className="text-slate-400 ml-1">
                    · {doc.scanResult.confidence}% confidence
                  </span>
                )}
              </>
            )}
            {doc.status === "error" && (
              <span className="text-red-600">{doc.error}</span>
            )}
          </div>
        </div>
        {doc.status === "scanned" && (
          <button
            onClick={() => setShowDebug((v) => !v)}
            className="text-xs text-indigo-500 hover:text-indigo-700 flex-shrink-0 px-1 font-medium"
            title="Show extraction debug info"
          >
            {showDebug ? "▼ Debug" : "► Debug"}
          </button>
        )}
        <button onClick={onRemove} className="text-xs text-slate-400 hover:text-red-600 flex-shrink-0 px-1">
          ✕
        </button>
      </div>

      {/* ── Debug / diagnostic panel ── */}
      {showDebug && doc.status === "scanned" && (
        <div className="border-t border-slate-200 bg-white px-3 py-3 space-y-3 rounded-b-lg">
          {/* Extracted fields */}
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">✅ Extracted fields</div>
            {fieldEntries.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {fieldEntries.map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <span className="text-slate-500">{k}:</span>{" "}
                    <span className="font-medium text-slate-800">{String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">No fields extracted</div>
            )}
          </div>

          {/* Missing fields */}
          {missingFields.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-amber-700 mb-1">⚠️ Missing fields</div>
              <div className="text-xs text-amber-600">
                {missingFields.join(", ")}
              </div>
            </div>
          )}

          {/* Raw text preview */}
          {rawText && (
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">📄 Raw extracted text</div>
              <pre className="text-[11px] leading-relaxed text-slate-600 bg-slate-50 border border-slate-200 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono">
                {rawText}
              </pre>
            </div>
          )}

          {/* Confidence */}
          <div className="text-[10px] text-slate-400">
            docType: {doc.detectedDocType} · confidence: {doc.scanResult?.confidence}%
            {doc.scanResult?.summary && ` · ${doc.scanResult.summary}`}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Form field with auto-fill indicator ───────────────── */

function AutoField({ label, type = "text", value, onChange, className = "", autoFilled = false, placeholder = "", showMissing = false }) {
  const isRequired = label.includes("*");
  const isEmpty = !value && value !== 0;
  const highlightMissing = isRequired && isEmpty && showMissing;

  // Split label to render * in red
  const labelText = label.replace(" *", "").replace("*", "");

  return (
    <div className={className}>
      <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-700">
        <span>{labelText}{isRequired ? <span className="text-red-500"> *</span> : null}</span>
        {autoFilled && value ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 text-green-700 px-1.5 py-0 text-[10px] font-medium">
            ✨ auto-filled
          </span>
        ) : null}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("w-full rounded-lg border px-3 py-2 text-sm", highlightMissing
            ? "border-red-400 bg-red-50 ring-1 ring-red-300"
            : autoFilled && value
              ? "border-green-300 bg-green-50 focus:border-blue-500 focus:bg-white"
              : "border-slate-200")}
      />
      {highlightMissing && <p className="mt-0.5 text-xs text-red-500">This field is required</p>}
    </div>
  );
}

/* ── Basic form field ──────────────────────────────────── */

function Field({ label, type = "text", value, onChange, className = "", showMissing = false }) {
  const isRequired = label.includes("*");
  const isEmpty = !value && value !== 0;
  const highlightMissing = isRequired && isEmpty && showMissing;

  // Split label to render * in red
  const labelText = label.replace(" *", "").replace("*", "");

  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-slate-700">
        <span>{labelText}{isRequired ? <span className="text-red-500"> *</span> : null}</span>
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("w-full rounded-lg border px-3 py-2 text-sm", highlightMissing
            ? "border-red-400 bg-red-50 ring-1 ring-red-300"
            : "border-slate-200")}
      />
      {highlightMissing && <p className="mt-0.5 text-xs text-red-500">This field is required</p>}
    </div>
  );
}

function SelectField({ label, value, options, onChange, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
          </option>
        ))}
      </select>
    </div>
  );
}
