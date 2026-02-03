import { useEffect, useMemo, useState } from "react";

const ALLOWED_CATEGORIES = ["stove", "oven", "dishwasher", "bathroom", "lighting"];

function normalizeDescription(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}

function validate({ category, description }) {
  const errors = {};

  if (category && !ALLOWED_CATEGORIES.includes(category)) {
    errors.category = `Category must be one of: ${ALLOWED_CATEGORIES.join(", ")}`;
  }

  const desc = normalizeDescription(description);

  if (!desc) {
    errors.description = "Description is required.";
    return { ok: false, errors, normalized: { category, description: desc } };
  }

  if (desc.length < 10) {
    errors.description = "Description must be at least 10 characters.";
  } else if (desc.length > 2000) {
    errors.description = "Description must be at most 2000 characters.";
  }

  // must contain at least one letter or digit (incl. common Latin accents)
  if (!/[A-Za-z0-9À-ÖØ-öø-ÿ]/.test(desc)) {
    errors.description = errors.description
      ? errors.description + " Also, it must contain meaningful text."
      : "Description must contain meaningful text.";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    normalized: { category, description: desc },
  };
}

export default function Home() {
  const [category, setCategory] = useState("oven");
  const [description, setDescription] = useState("");
  const [submitResult, setSubmitResult] = useState(null);
  const [allRequests, setAllRequests] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // UI errors (typically set from backend response or on submit)
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");

  // Track if the user interacted with a field so we can show live validation nicely
  const [touched, setTouched] = useState({ category: false, description: false });

  const currentValidation = useMemo(
    () => validate({ category, description }),
    [category, description]
  );

  // Prefer backend errors if present, otherwise show live validation after touch
  const liveCategoryError =
    fieldErrors.category || (touched.category ? currentValidation.errors.category : "");
  const liveDescriptionError =
    fieldErrors.description || (touched.description ? currentValidation.errors.description : "");

  async function refreshRequests() {
    const r = await fetch("/api/requests");
    const j = await r.json();
    setAllRequests(j);
  }

  useEffect(() => {
    refreshRequests().catch(() => {});
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSubmitResult(null);

    // Mark fields as touched so errors show if invalid
    setTouched({ category: true, description: true });

    // Client-side validation first
    const v = validate({ category, description });
    if (!v.ok) {
      setFieldErrors(v.errors);
      return;
    }

    // Clear any stale backend errors
    setFieldErrors({});
    setSubmitting(true);

    try {
      const r = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: v.normalized.category,
          description: v.normalized.description,
        }),
      });

      const j = await r.json();

      if (!r.ok) {
        // Backend validation: map errors into UI
        if (j?.error?.code === "VALIDATION_ERROR") {
          const fe = j?.error?.details?.fieldErrors || {};
          const mapped = {};
          if (fe.category?.length) mapped.category = fe.category.join(" ");
          if (fe.description?.length) mapped.description = fe.description.join(" ");
          setFieldErrors(mapped);
          setFormError(j?.error?.message || "Invalid input.");
        } else {
          setFormError(j?.error?.message || "Request failed.");
        }
        setSubmitResult(j);
        return;
      }

      setSubmitResult(j);
      setDescription(""); // reset on success
      setTouched((t) => ({ ...t, description: false })); // optional: reset touched for description
      await refreshRequests();
    } catch (err) {
      setFormError("Network error. Is the API running?");
    } finally {
      setSubmitting(false);
    }
  }

  const descNormalized = currentValidation.normalized.description;
  const descChars = descNormalized.length;

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 8 }}>Maintenance Request</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Submit a repair request. We’ll route it automatically in most cases.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 600 }}>Category</div>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setTouched((t) => ({ ...t, category: true }));
              // clear backend error as user edits
              setFieldErrors((fe) => ({ ...fe, category: undefined }));
            }}
          >
            {ALLOWED_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {liveCategoryError ? (
            <div style={{ color: "crimson", fontSize: 13 }}>{liveCategoryError}</div>
          ) : null}
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 600 }}>Describe the issue</div>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setTouched((t) => ({ ...t, description: true }));
              // clear backend error as user edits
              setFieldErrors((fe) => ({ ...fe, description: undefined }));
            }}
            placeholder="Tell us what’s broken, where it is, and anything you’ve tried…"
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#666",
            }}
          >
            <span>Min 10 chars • Max 2000</span>
            <span>{descChars}/2000</span>
          </div>

          {liveDescriptionError ? (
            <div style={{ color: "crimson", fontSize: 13 }}>{liveDescriptionError}</div>
          ) : null}
        </label>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button type="submit" disabled={submitting || !currentValidation.ok}>
            {submitting ? "Submitting…" : "Submit request"}
          </button>

          {!currentValidation.ok ? (
            <span style={{ fontSize: 13, color: "#666" }}>
              {currentValidation.errors.description ||
                currentValidation.errors.category ||
                "Fix validation errors to submit."}
            </span>
          ) : null}
        </div>

        {formError ? (
          <div style={{ padding: 12, background: "#ffecec", border: "1px solid #ffb3b3" }}>
            <strong style={{ color: "crimson" }}>Error:</strong> {formError}
          </div>
        ) : null}
      </form>

      <hr style={{ margin: "24px 0" }} />

      <h2 style={{ marginBottom: 8 }}>Debug</h2>

      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Raw submit response</div>
          <pre style={{ background: "#f6f6f6", padding: 12, overflowX: "auto" }}>
            {submitResult ? JSON.stringify(submitResult, null, 2) : "(none yet)"}
          </pre>
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>All requests (GET /requests)</div>
          <pre style={{ background: "#f6f6f6", padding: 12, overflowX: "auto" }}>
            {allRequests ? JSON.stringify(allRequests, null, 2) : "(loading)"}
          </pre>
        </div>
      </div>
    </div>
  );
}
