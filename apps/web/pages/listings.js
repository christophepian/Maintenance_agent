import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Head from "next/head";

/**
 * Public Rental Listings Page
 *
 * Shows all vacant units as listing cards with:
 *  - Wireframe photo placeholder
 *  - Address (building name + street)
 *  - Monthly rent & charges
 *  - Available-from date (placeholder for now)
 *  - "Apply" CTA linking to /apply?unitId=…
 *
 * No auth required — standalone public page.
 */

function formatChf(amount) {
  if (amount == null) return "—";
  const str = Number(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${str}`;
}

function PhotoPlaceholder({ seed }) {
  // Deterministic soft colour from seed string
  const hue = [...(seed || "a")].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="w-full aspect-[4/3] rounded-t-xl flex flex-col items-center justify-center select-none"
      style={{ background: `hsl(${hue}, 30%, 92%)` }}
    >
      {/* Simple wireframe house icon via SVG */}
      <svg
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        className="w-16 h-16 text-slate-400"
        strokeWidth={2}
      >
        <path d="M8 32 L32 12 L56 32" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="16" y="32" width="32" height="22" rx="1" />
        <rect x="26" y="40" width="12" height="14" rx="1" />
        <rect x="20" y="36" width="6" height="6" rx="0.5" />
        <rect x="38" y="36" width="6" height="6" rx="0.5" />
      </svg>
      <span className="text-xs text-slate-400 mt-2 tracking-wide">Photo coming soon</span>
    </div>
  );
}

export default function ListingsPage() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadListings();
  }, []);

  async function loadListings() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vacant-units");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.message || "Failed to load listings");
      setUnits(data.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return units;
    const q = search.toLowerCase();
    return units.filter(
      (u) =>
        (u.building?.name || "").toLowerCase().includes(q) ||
        (u.building?.address || "").toLowerCase().includes(q) ||
        (u.unitNumber || "").toLowerCase().includes(q)
    );
  }, [units, search]);

  return (
    <>
      <Head>
        <title>Available Rentals | Listings</title>
      </Head>

      {/* Minimal standalone header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏠</span>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Rental Listings</h1>
          </div>
          <Link
            href="/apply"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Apply directly →
          </Link>
        </div>
      </header>

      <main className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {/* Hero / intro */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Find your next home</h2>
            <p className="text-slate-500 text-lg">
              Browse available apartments and apply online in minutes.
            </p>
          </div>

          {/* Search bar */}
          <div className="mb-6">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by address, building name, or unit…"
              className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-6">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-16 text-slate-400">
              <div className="inline-block w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin mb-3" />
              <p>Loading listings…</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16">
              <span className="text-5xl mb-4 block">🏗️</span>
              <h3 className="text-lg font-semibold text-slate-700 mb-1">
                {search ? "No listings match your search" : "No listings available right now"}
              </h3>
              <p className="text-slate-400 text-sm">
                {search
                  ? "Try a different search term."
                  : "Check back soon — new apartments are added regularly."}
              </p>
            </div>
          )}

          {/* Listing grid */}
          {!loading && filtered.length > 0 && (
            <>
              <p className="text-sm text-slate-500 mb-4">
                {filtered.length} {filtered.length === 1 ? "listing" : "listings"} available
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((unit) => (
                  <ListingCard key={unit.id} unit={unit} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function ListingCard({ unit }) {
  const building = unit.building || {};
  const totalRent =
    (unit.monthlyRentChf || 0) + (unit.monthlyChargesChf || 0);

  // Placeholder available-from date: 1st of next month
  const availableFrom = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  })();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Photo placeholder */}
      <PhotoPlaceholder seed={unit.id} />

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        {/* Address */}
        <h3 className="font-semibold text-slate-900 text-lg leading-tight mb-1">
          {building.address || "Address TBD"}
        </h3>
        <p className="text-sm text-slate-500 mb-3">
          {building.name} · {unit.unitNumber}
          {unit.floor ? ` · ${unit.floor}` : ""}
        </p>

        {/* Key facts */}
        <div className="space-y-2 text-sm mb-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-5 text-center">💰</span>
            <span className="text-slate-700">
              <span className="font-semibold">{formatChf(unit.monthlyRentChf)}</span>
              <span className="text-slate-400"> /month net</span>
            </span>
          </div>
          {unit.monthlyChargesChf != null && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 w-5 text-center">📋</span>
              <span className="text-slate-500">
                + {formatChf(unit.monthlyChargesChf)} charges
                <span className="text-slate-400">
                  {" "}
                  ({formatChf(totalRent)} total)
                </span>
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-5 text-center">📅</span>
            <span className="text-slate-600">Available from {availableFrom}</span>
          </div>
        </div>

        {/* Spacer + CTA */}
        <div className="mt-auto pt-3 border-t border-slate-100">
          <Link
            href={`/apply?unitId=${unit.id}`}
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg py-2.5 transition-colors"
          >
            Apply for this unit →
          </Link>
        </div>
      </div>
    </div>
  );
}
