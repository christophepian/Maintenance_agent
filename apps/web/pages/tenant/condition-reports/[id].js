import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import AppShell from "../../../components/AppShell";
import PageShell from "../../../components/layout/PageShell";
import PageHeader from "../../../components/layout/PageHeader";
import PageContent from "../../../components/layout/PageContent";
import { ResourceShell, Button, Badge, ErrorBanner } from "../../../components/ui";
import { tenantFetch, tenantHeaders } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { useDetailResource } from "../../../lib/hooks/useDetailResource";
import { useAction } from "../../../lib/hooks/useAction";
import { withServerTranslations } from "../../../lib/i18n";
import { useTranslation } from "next-i18next";
import { cn } from "../../../lib/utils";
import { Camera, Trash2, Image } from "lucide-react";

const CONDITIONS = ["GOOD", "FAIR", "POOR", "DAMAGED"];
const STATUS_VARIANT = { PENDING: "warning", SUBMITTED: "info", APPROVED: "success" };
const CONDITION_VARIANT = { GOOD: "success", FAIR: "warning", POOR: "warning", DAMAGED: "destructive" };

// ── Photo strip for a single item ─────────────────────────────────────────────

function PhotoStrip({ photos: initialPhotos, reportId, itemId, editable, t }) {
  const [photos, setPhotos] = useState(initialPhotos ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef(null);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected
    e.target.value = "";

    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("photo", file);

      // Use raw fetch — tenantFetch merges headers which would break multipart boundary
      const headers = tenantHeaders();
      const res = await fetch(`/api/tenant/condition-reports/${reportId}/items/${itemId}/photos`, {
        method: "POST",
        headers,
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Upload failed");
      setPhotos((prev) => [...prev, data.data]);
    } catch (err) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (photoId) => {
    try {
      await tenantFetch(
        `/api/tenant/condition-reports/${reportId}/items/${itemId}/photos/${photoId}`,
        { method: "DELETE" },
      );
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch {
      // best-effort
    }
  };

  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <a
                href={photo.url ?? `/api/condition-report-photos/${photo.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={photo.url ?? `/api/condition-report-photos/${photo.id}`}
                  alt={photo.caption || "Photo"}
                  className="h-20 w-20 object-cover rounded-lg border border-surface-border"
                />
              </a>
              {editable && (
                <button
                  onClick={() => remove(photo.id)}
                  aria-label="Delete photo"
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && (
        <>
          {uploadError && <p className="text-xs text-destructive-text">{uploadError}</p>}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs text-brand hover:underline disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
            {uploading ? t("conditionReport.uploadingPhoto") : t("conditionReport.addPhoto")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={upload}
          />
        </>
      )}

      {!editable && photos.length === 0 && (
        <span className="flex items-center gap-1 text-xs text-foreground-dim italic">
          <Image className="h-3.5 w-3.5" />
          {t("conditionReport.noPhotos")}
        </span>
      )}
    </div>
  );
}

// ── Add-item form ─────────────────────────────────────────────────────────────

function ItemForm({ reportId, onSaved, t }) {
  const [roomLabel, setRoomLabel] = useState("");
  const [itemLabel, setItemLabel] = useState("");
  const [condition, setCondition] = useState("GOOD");
  const [notes, setNotes] = useState("");
  const { pending, run } = useAction();
  const [error, setError] = useState("");

  const save = async () => {
    if (!roomLabel.trim() || !itemLabel.trim()) {
      setError(t("conditionReport.roomItemRequired"));
      return;
    }
    setError("");
    await run(async () => {
      const res = await tenantFetch(`/api/tenant/condition-reports/${reportId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomLabel, itemLabel, condition, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to save");
      setRoomLabel(""); setItemLabel(""); setCondition("GOOD"); setNotes("");
      onSaved();
    });
  };

  return (
    <div className="card border p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t("conditionReport.addItem")}</p>
      {error && <ErrorBanner error={error} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-dark mb-1">{t("conditionReport.roomLabel")}</label>
          <input type="text" value={roomLabel} onChange={(e) => setRoomLabel(e.target.value)}
            placeholder={t("conditionReport.roomPlaceholder")} className="input mb-0" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-dark mb-1">{t("conditionReport.itemLabel")}</label>
          <input type="text" value={itemLabel} onChange={(e) => setItemLabel(e.target.value)}
            placeholder={t("conditionReport.itemPlaceholder")} className="input mb-0" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-dark mb-1">{t("conditionReport.condition")}</label>
        <div className="flex gap-2 flex-wrap">
          {CONDITIONS.map((c) => (
            <button key={c} type="button" onClick={() => setCondition(c)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                condition === c ? "bg-brand text-white border-brand" : "border-surface-border text-foreground hover:bg-surface-subtle",
              )}>
              {t(`conditionReport.condition_${c}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-dark mb-1">{t("conditionReport.notes")}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder={t("conditionReport.notesPlaceholder")} className="input mb-0 resize-none" />
      </div>
      <Button variant="primary" onClick={save} disabled={pending} className="w-full sm:w-auto">
        {pending ? t("conditionReport.saving") : t("conditionReport.saveItem")}
      </Button>
    </div>
  );
}

// ── Item row ──────────────────────────────────────────────────────────────────

function ItemRow({ item, reportId, editable, onDeleted, onUpdated, t }) {
  const { pending, run } = useAction();
  const [expanded, setExpanded] = useState(false);
  const [editCondition, setEditCondition] = useState(item.condition);
  const [editNotes, setEditNotes] = useState(item.notes ?? "");
  const [error, setError] = useState("");

  // Flag: POOR or DAMAGED items should have photos
  const photosAdvisory = editable && (editCondition === "POOR" || editCondition === "DAMAGED");

  const del = () => run("del", async () => {
    const res = await tenantFetch(`/api/tenant/condition-reports/${reportId}/items/${item.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete");
    onDeleted(item.id);
  });

  const update = async () => {
    setError("");
    await run("update", async () => {
      const res = await tenantFetch(`/api/tenant/condition-reports/${reportId}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition: editCondition, notes: editNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to update");
      setExpanded(false);
      onUpdated({ ...item, condition: editCondition, notes: editNotes });
    });
  };

  return (
    <div className={cn(
      "card border p-3 space-y-2",
      (item.condition === "POOR" || item.condition === "DAMAGED") && "border-warning-ring",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-foreground-dim font-medium uppercase tracking-wide">{item.roomLabel}</span>
            <span className="text-sm font-medium text-foreground">{item.itemLabel}</span>
            <Badge variant={CONDITION_VARIANT[item.condition] || "neutral"} size="sm">
              {t(`conditionReport.condition_${item.condition}`)}
            </Badge>
          </div>
          {item.notes && <p className="text-xs text-foreground-dim mt-0.5">{item.notes}</p>}
        </div>
        {editable && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-brand hover:underline">
              {t("conditionReport.edit")}
            </button>
            <button onClick={del} disabled={pending === "del"}
              className="text-xs text-destructive-text hover:underline disabled:opacity-50">
              {t("conditionReport.deleteItem")}
            </button>
          </div>
        )}
      </div>

      {/* Photo strip — always visible */}
      <div className="pt-1">
        {photosAdvisory && (item.photos ?? []).length === 0 && (
          <p className="text-xs text-warning-text mb-1">{t("conditionReport.photoAdvisory")}</p>
        )}
        <PhotoStrip
          photos={item.photos ?? []}
          reportId={reportId}
          itemId={item.id}
          editable={editable}
          t={t}
        />
      </div>

      {expanded && editable && (
        <div className="space-y-2 pt-2 border-t border-surface-divider">
          {error && <ErrorBanner error={error} />}
          <div className="flex gap-2 flex-wrap">
            {CONDITIONS.map((c) => (
              <button key={c} type="button" onClick={() => setEditCondition(c)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium border transition-colors",
                  editCondition === c ? "bg-brand text-white border-brand" : "border-surface-border text-foreground hover:bg-surface-subtle",
                )}>
                {t(`conditionReport.condition_${c}`)}
              </button>
            ))}
          </div>
          <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2}
            placeholder={t("conditionReport.notesPlaceholder")} className="input mb-0 resize-none text-sm" />
          <div className="flex gap-2">
            <Button variant="primary" onClick={update} disabled={!!pending} className="text-xs">
              {pending === "update" ? t("conditionReport.saving") : t("conditionReport.saveItem")}
            </Button>
            <Button variant="ghost" onClick={() => setExpanded(false)} className="text-xs">
              {t("conditionReport.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TenantConditionReportDetail() {
  const { t } = useTranslation("tenant");
  const router = useRouter();
  const { id } = router.query;

  const { data, loading, error, refresh } = useDetailResource(
    id ? `/api/tenant/condition-reports/${id}` : null,
    tenantFetch,
  );

  const report = data?.data ?? null;
  const [items, setItems] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const { pending: submitting, run: runSubmit } = useAction();

  const displayItems = items ?? report?.items ?? [];
  const editable = report?.status === "PENDING";

  const handleItemSaved = useCallback(() => { refresh(); setItems(null); }, [refresh]);
  const handleItemDeleted = useCallback((itemId) => {
    setItems((prev) => (prev ?? report?.items ?? []).filter((i) => i.id !== itemId));
  }, [report]);
  const handleItemUpdated = useCallback((updated) => {
    setItems((prev) => (prev ?? report?.items ?? []).map((i) => i.id === updated.id ? updated : i));
  }, [report]);

  const submit = async () => {
    if (!confirm(t("conditionReport.submitConfirm"))) return;
    setSubmitError("");
    await runSubmit(async () => {
      const res = await tenantFetch(`/api/tenant/condition-reports/${id}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message || "Failed to submit";
        setSubmitError(msg);
        throw new Error(msg);
      }
      router.push("/tenant/condition-reports");
    });
  };

  return (
    <AppShell role="TENANT">
      <PageShell>
        <PageHeader
          title={report
            ? `${t(`conditionReport.type.${report.type}`)} — ${t(`conditionReport.status.${report.status}`)}`
            : t("conditionReport.title")}
          backLink={{ href: "/tenant/condition-reports", label: t("conditionReport.title") }}
          actions={editable ? (
            <Button variant="primary" onClick={submit} disabled={!!submitting}>
              {submitting ? t("conditionReport.submitting") : t("conditionReport.submit")}
            </Button>
          ) : null}
        />
        <PageContent>
          <ResourceShell loading={loading} error={error} notFound={!loading && !report}>
            {report && (
              <div className="space-y-6 max-w-2xl">
                {submitError && <ErrorBanner error={submitError} />}

                <div className="flex items-center gap-3 flex-wrap text-xs text-foreground-dim">
                  <Badge variant={STATUS_VARIANT[report.status] || "neutral"} size="sm">
                    {t(`conditionReport.status.${report.status}`)}
                  </Badge>
                  {report.dueAt && editable && (
                    <span>{t("conditionReport.dueIn", { days: Math.ceil((new Date(report.dueAt) - Date.now()) / 86400000) })}</span>
                  )}
                  {report.approvedAt && (
                    <span>{t("conditionReport.approvedOn", { date: formatDate(report.approvedAt) })}</span>
                  )}
                </div>

                {report.managerNotes && (
                  <div className="rounded-xl border border-brand-ring bg-brand-light p-4">
                    <p className="text-xs font-semibold text-brand mb-1">{t("conditionReport.managerNotes")}</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{report.managerNotes}</p>
                  </div>
                )}

                <div className="space-y-2">
                  {displayItems.map((item) => (
                    <ItemRow key={item.id} item={item} reportId={id} editable={editable}
                      onDeleted={handleItemDeleted} onUpdated={handleItemUpdated} t={t} />
                  ))}
                  {displayItems.length === 0 && (
                    <p className="text-sm text-foreground-dim italic py-4 text-center">
                      {t("conditionReport.noItems")}
                    </p>
                  )}
                </div>

                {editable && <ItemForm reportId={id} onSaved={handleItemSaved} t={t} />}
              </div>
            )}
          </ResourceShell>
        </PageContent>
      </PageShell>
    </AppShell>
  );
}

export const getServerSideProps = withServerTranslations(["common", "tenant"]);
