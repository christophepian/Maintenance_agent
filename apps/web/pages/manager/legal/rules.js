import { useEffect, useState, useCallback } from "react";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import Panel from "../../../components/layout/Panel";
import { authHeaders } from "../../../lib/api";

export default function LegalRulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/legal/rules", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load rules");
      setRules(data?.data || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <AppShell role="MANAGER">
      <PageShell>
        <PageHeader
          title="Legal Rules"
          subtitle="Statutory and custom rules evaluated by the legal decision engine"
          actions={
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => setShowCreate(!showCreate)}
            >
              {showCreate ? "Cancel" : "+ Add Rule"}
            </button>
          }
        />
        <PageContent>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {showCreate && (
            <CreateRuleForm
              onCreated={() => { setShowCreate(false); loadData(); }}
              onError={setError}
            />
          )}

          <Panel title={`Rules (${rules.length})`}>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : rules.length === 0 ? (
              <p className="text-sm text-slate-500">No legal rules configured yet.</p>
            ) : (
              <div className="space-y-4">
                {rules.map((rule) => (
                  <RuleCard key={rule.id} rule={rule} onRefresh={loadData} />
                ))}
              </div>
            )}
          </Panel>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

function RuleCard({ rule, onRefresh }) {
  const [showAddVersion, setShowAddVersion] = useState(false);
  const activeVersion = rule.versions?.find((v) => v.isActive);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{rule.name}</h3>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>Type: <strong>{rule.ruleType}</strong></span>
            <span>•</span>
            <span>Jurisdiction: <strong>{rule.jurisdiction || "CH"}</strong></span>
            {rule.canton && <><span>•</span><span>Canton: <strong>{rule.canton}</strong></span></>}
            <span>•</span>
            <span>Versions: <strong>{rule.versions?.length || 0}</strong></span>
          </div>
        </div>
        <button
          className="text-xs text-blue-600 hover:underline"
          onClick={() => setShowAddVersion(!showAddVersion)}
        >
          {showAddVersion ? "Cancel" : "+ Version"}
        </button>
      </div>

      {activeVersion && (
        <div className="mt-3 rounded border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium text-slate-600">Active version (v{activeVersion.version})</p>
          <pre className="mt-1 overflow-x-auto text-xs text-slate-700 whitespace-pre-wrap">
            {JSON.stringify(activeVersion.conditionDsl, null, 2)}
          </pre>
          <p className="mt-1 text-xs text-slate-500">
            Obligation: <strong>{activeVersion.obligation}</strong> · Confidence: <strong>{activeVersion.confidence}</strong>
          </p>
        </div>
      )}

      {showAddVersion && (
        <AddVersionForm
          ruleId={rule.id}
          nextVersion={(rule.versions?.length || 0) + 1}
          onCreated={() => { setShowAddVersion(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

function CreateRuleForm({ onCreated, onError }) {
  const [form, setForm] = useState({
    name: "",
    ruleType: "STATUTORY",
    jurisdiction: "CH",
    canton: "",
    legalSourceId: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      const body = { ...form };
      if (!body.canton) delete body.canton;
      if (!body.legalSourceId) delete body.legalSourceId;

      const res = await fetch("/api/legal/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to create rule");
      }
      onCreated();
    } catch (e) {
      onError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="New Rule">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Name</span>
          <input
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Rule Type</span>
          <select
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.ruleType}
            onChange={(e) => setForm({ ...form, ruleType: e.target.value })}
          >
            <option value="STATUTORY">Statutory</option>
            <option value="CANTONAL">Cantonal</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Jurisdiction</span>
          <input
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.jurisdiction}
            onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Canton (optional)</span>
          <input
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
            value={form.canton}
            onChange={(e) => setForm({ ...form, canton: e.target.value })}
            placeholder="e.g. ZH, BE, VD"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Rule"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function AddVersionForm({ ruleId, nextVersion, onCreated }) {
  const [form, setForm] = useState({
    version: nextVersion,
    conditionDsl: '{ "type": "always_true" }',
    obligation: "OBLIGATED",
    confidence: 0.8,
    reasoning: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let conditionDsl;
      try {
        conditionDsl = JSON.parse(form.conditionDsl);
      } catch {
        throw new Error("conditionDsl must be valid JSON");
      }

      const body = {
        version: form.version,
        conditionDsl,
        obligation: form.obligation,
        confidence: form.confidence,
        reasoning: form.reasoning || undefined,
        isActive: true,
      };

      const res = await fetch(`/api/legal/rules/${ruleId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Failed to add version");
      }
      onCreated();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Condition DSL (JSON)</span>
        <textarea
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-xs font-mono"
          rows={3}
          value={form.conditionDsl}
          onChange={(e) => setForm({ ...form, conditionDsl: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Obligation</span>
          <select
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
            value={form.obligation}
            onChange={(e) => setForm({ ...form, obligation: e.target.value })}
          >
            <option value="OBLIGATED">Obligated</option>
            <option value="RECOMMENDED">Recommended</option>
            <option value="DISCRETIONARY">Discretionary</option>
            <option value="NOT_APPLICABLE">Not Applicable</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Confidence</span>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
            value={form.confidence}
            onChange={(e) => setForm({ ...form, confidence: parseFloat(e.target.value) })}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Version</span>
          <input
            type="number"
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
            value={form.version}
            onChange={(e) => setForm({ ...form, version: parseInt(e.target.value) })}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Add Version"}
      </button>
    </form>
  );
}
