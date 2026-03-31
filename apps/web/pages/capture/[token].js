import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

/* ─── Constants ───────────────────────────────────────────── */

const MAX_PHOTOS = 5;

/* ─── States ──────────────────────────────────────────────── */
// LOADING → READY | EXPIRED | ERROR
// READY → UPLOADING → SUCCESS | ERROR

/* ─── Main Page ───────────────────────────────────────────── */

export default function MobileCapturePage() {
  const router = useRouter();
  const { token } = router.query;

  const [state, setState] = useState("LOADING"); // LOADING | READY | UPLOADING | SUCCESS | EXPIRED | ERROR
  const [errorMsg, setErrorMsg] = useState("");
  const [photos, setPhotos] = useState([]); // { file: File, preview: string }[]
  const [uploadProgress, setUploadProgress] = useState(0); // 0 .. photos.length
  const fileInputRef = useRef(null);

  /* ─── Validate session on mount ───── */

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function validate() {
      try {
        const res = await fetch(`/api/capture/${token}/validate`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const code = data?.error?.code;
          if (code === "SESSION_EXPIRED" || code === "SESSION_COMPLETED" || res.status === 410) {
            if (!cancelled) setState("EXPIRED");
          } else {
            if (!cancelled) {
              setState("ERROR");
              setErrorMsg(data?.error?.message || "Invalid capture session");
            }
          }
          return;
        }
        if (!cancelled) setState("READY");
      } catch (err) {
        if (!cancelled) {
          setState("ERROR");
          setErrorMsg("Unable to connect. Check your internet connection.");
        }
      }
    }

    validate();
    return () => { cancelled = true; };
  }, [token]);

  /* ─── Photo management ───── */

  function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = files.slice(0, remaining);

    const newPhotos = toAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...newPhotos]);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index) {
    setPhotos((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      photos.forEach((p) => { if (p.preview) URL.revokeObjectURL(p.preview); });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Upload & complete ───── */

  const handleSubmit = useCallback(async () => {
    if (photos.length === 0 || !token) return;
    setState("UPLOADING");
    setUploadProgress(0);

    try {
      // Upload each photo sequentially
      for (let i = 0; i < photos.length; i++) {
        const formData = new FormData();
        formData.append("file", photos[i].file);

        const res = await fetch(`/api/capture/${token}/upload`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message || `Upload failed for photo ${i + 1}`);
        }

        setUploadProgress(i + 1);
      }

      // Complete the session
      const completeRes = await fetch(`/api/capture/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!completeRes.ok) {
        const data = await completeRes.json().catch(() => ({}));
        throw new Error(data?.error?.message || "Failed to complete session");
      }

      setState("SUCCESS");
    } catch (err) {
      setState("ERROR");
      setErrorMsg(err.message || "Upload failed. Please try again.");
    }
  }, [photos, token]);

  /* ─── Render ───── */

  return (
    <>
      <Head>
        <title>Capture Invoice</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#1e40af" />
      </Head>

      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Header */}
        <header className="bg-blue-700 text-white px-4 py-3 flex items-center gap-3 shadow-md">
          <span className="text-xl">📷</span>
          <h1 className="text-base font-semibold m-0">Invoice Capture</h1>
        </header>

        {/* Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          {/* ─── LOADING ───── */}
          {state === "LOADING" && (
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-slate-500">Validating session…</p>
            </div>
          )}

          {/* ─── EXPIRED ───── */}
          {state === "EXPIRED" && (
            <div className="text-center max-w-xs">
              <div className="text-4xl mb-3">⏰</div>
              <h2 className="text-lg font-semibold text-slate-800 mt-0 mb-2">This link has expired</h2>
              <p className="text-sm text-slate-500 m-0">
                Capture sessions are valid for 15 minutes. Please scan a new QR code from the invoice hub.
              </p>
            </div>
          )}

          {/* ─── ERROR ───── */}
          {state === "ERROR" && (
            <div className="text-center max-w-xs">
              <div className="text-4xl mb-3">❌</div>
              <h2 className="text-lg font-semibold text-slate-800 mt-0 mb-2">Something went wrong</h2>
              <p className="text-sm text-red-600 m-0">{errorMsg}</p>
            </div>
          )}

          {/* ─── READY (capture UI) ───── */}
          {state === "READY" && (
            <div className="w-full max-w-md">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
                <h2 className="text-base font-semibold text-slate-800 mt-0 mb-1">Take photos of your invoice</h2>
                <p className="text-xs text-slate-500 mt-0 mb-4">
                  Capture up to {MAX_PHOTOS} photos. Make sure the text is clear and well-lit.
                </p>

                {/* Photo grid */}
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {photos.map((photo, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                        <img
                          src={photo.preview}
                          alt={`Photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80 transition"
                          aria-label={`Remove photo ${idx + 1}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Camera / file input */}
                {photos.length < MAX_PHOTOS && (
                  <div className="space-y-2">
                    {/* Camera button (primary) */}
                    <label className="flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer">
                      <span className="text-lg">📸</span>
                      {photos.length === 0 ? "Take Photo" : "Take Another Photo"}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {/* Gallery fallback */}
                    <label className="flex items-center justify-center gap-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer">
                      <span className="text-lg">🖼</span>
                      Choose from Gallery
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {photos.length >= MAX_PHOTOS && (
                  <p className="text-xs text-amber-600 text-center m-0">
                    Maximum {MAX_PHOTOS} photos reached.
                  </p>
                )}
              </div>

              {/* Submit */}
              {photos.length > 0 && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-4 text-base font-semibold text-white hover:bg-emerald-700 transition shadow-md"
                >
                  Submit {photos.length} {photos.length === 1 ? "Photo" : "Photos"}
                </button>
              )}
            </div>
          )}

          {/* ─── UPLOADING ───── */}
          {state === "UPLOADING" && (
            <div className="w-full max-w-xs text-center">
              <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
              <h2 className="text-base font-semibold text-slate-800 mt-0 mb-2">Uploading…</h2>
              <p className="text-sm text-slate-500 mb-3">
                {uploadProgress} of {photos.length} {photos.length === 1 ? "photo" : "photos"}
              </p>
              {/* Progress bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${photos.length > 0 ? (uploadProgress / photos.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* ─── SUCCESS ───── */}
          {state === "SUCCESS" && (
            <div className="text-center max-w-xs">
              <div className="text-5xl mb-3">✅</div>
              <h2 className="text-lg font-semibold text-emerald-700 mt-0 mb-2">Photos submitted!</h2>
              <p className="text-sm text-slate-500 m-0">
                Your invoice is being processed. You can close this page now.
              </p>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="px-4 py-3 text-center">
          <p className="text-[10px] text-slate-400 m-0">Secure invoice capture session</p>
        </footer>
      </div>
    </>
  );
}
