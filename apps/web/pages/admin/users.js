/**
 * Admin — User Management
 *
 * Protected: ADMIN access level only (enforced by middleware + API route).
 *
 * Features:
 *  - List all Supabase users with their access level and app role
 *  - Invite new users (sends a single-use magic link via Mailgun/Supabase)
 *  - Update access level / app role for existing users
 *  - Revoke access (bans the user — no new sign-ins)
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { withTranslations } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { createClient } from "../../lib/supabase/client";
import { setAuthToken } from "../../lib/api";

const ACCESS_LEVELS = ["ADMIN", "APP_USER", "DOCS_INVESTOR"];
const APP_ROLES = ["MANAGER", "CONTRACTOR", "OWNER", "TENANT"];

const ACCESS_LABEL = {
  ADMIN: "Admin (full access)",
  APP_USER: "App only (prospect)",
  DOCS_INVESTOR: "Pitch deck + app (investor)",
};

const ROLE_LABEL = {
  MANAGER: "Manager",
  CONTRACTOR: "Contractor",
  OWNER: "Owner",
  TENANT: "Tenant",
};

function Badge({ level }) {
  const colors = {
    ADMIN: "bg-purple-100 text-purple-800",
    APP_USER: "bg-blue-100 text-blue-800",
    DOCS_INVESTOR: "bg-green-100 text-green-800",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", colors[level] ?? "bg-slate-100 text-slate-600")}>
      {ACCESS_LABEL[level] ?? level ?? "—"}
    </span>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLevel, setInviteLevel] = useState("APP_USER");
  const [inviteRole, setInviteRole] = useState("MANAGER");
  const [inviting, setInviting] = useState(false);

  // Edit state — { userId, accessLevel, appRole } or null
  const [editing, setEditing] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 401 || res.status === 403) {
        router.push("/manager");
        return;
      }
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setNotice({ type: "err", msg: "Failed to load users." });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Ensure the Supabase token is in localStorage before making API calls
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setAuthToken(session.access_token);
      fetchUsers();
    });
  }, [fetchUsers]);

  async function invite(e) {
    e.preventDefault();
    setInviting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users?action=invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          accessLevel: inviteLevel,
          appRole: inviteLevel === "DOCS_INVESTOR" ? null : inviteRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", msg: data.error || "Invite failed." });
      } else {
        setNotice({ type: "ok", msg: `Invite sent to ${inviteEmail}. The link is single-use and expires in 24h.` });
        setInviteEmail("");
        fetchUsers();
      }
    } catch {
      setNotice({ type: "err", msg: "Network error." });
    } finally {
      setInviting(false);
    }
  }

  async function revoke(userId, email) {
    if (!window.confirm(`Revoke access for ${email}? They will no longer be able to sign in.`)) return;
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users?action=revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setNotice({ type: "ok", msg: `Access revoked for ${email}.` });
        fetchUsers();
      } else {
        const data = await res.json();
        setNotice({ type: "err", msg: data.error || "Revoke failed." });
      }
    } catch {
      setNotice({ type: "err", msg: "Network error." });
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users?action=update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editing.userId,
          accessLevel: editing.accessLevel,
          appRole: editing.accessLevel === "DOCS_INVESTOR" ? null : editing.appRole,
          tenantId: editing.tenantId?.trim() || null,
          ownerId: editing.ownerId?.trim() || null,
        }),
      });
      if (res.ok) {
        setEditing(null);
        setNotice({ type: "ok", msg: "Access updated." });
        fetchUsers();
      } else {
        const data = await res.json();
        setNotice({ type: "err", msg: data.error || "Update failed." });
      }
    } catch {
      setNotice({ type: "err", msg: "Network error." });
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });
    setAuthToken(null);
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold text-lg">User Management</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Admin</span>
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {notice && (
          <div className={cn("notice", notice.type === "ok" ? "notice-ok" : "notice-err")}>
            {notice.msg}
          </div>
        )}

        {/* ── Invite new user ── */}
        <section className="card">
          <h2 className="font-semibold text-base mb-4">Invite a user</h2>
          <form onSubmit={invite} className="space-y-4">
            <label className="label">
              Email address
              <input
                className="input"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="investor@example.com"
                required
              />
            </label>

            <label className="label">
              Access level
              <select
                className="input"
                value={inviteLevel}
                onChange={(e) => setInviteLevel(e.target.value)}
              >
                {ACCESS_LEVELS.map((l) => (
                  <option key={l} value={l}>{ACCESS_LABEL[l]}</option>
                ))}
              </select>
            </label>

            {inviteLevel !== "DOCS_INVESTOR" && (
              <label className="label">
                App role
                <select
                  className="input"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  {APP_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </label>
            )}

            <p className="text-xs text-slate-500">
              A single-use sign-in link will be emailed to this address. It expires in 24 hours.
            </p>

            <button className="button-primary" type="submit" disabled={inviting}>
              {inviting ? "Sending…" : "Send invite"}
            </button>
          </form>
        </section>

        {/* ── User list ── */}
        <section>
          <h2 className="font-semibold text-base mb-3">
            All users {!loading && `(${users.length})`}
          </h2>

          {loading ? (
            <div className="text-slate-500 text-sm py-6 text-center">Loading…</div>
          ) : users.length === 0 ? (
            <div className="text-slate-500 text-sm py-6 text-center">No users yet.</div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={cn(
                    "card flex flex-col sm:flex-row sm:items-center gap-3",
                    u.banned && "opacity-50"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{u.email}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge level={u.accessLevel} />
                      {u.appRole && (
                        <span className="text-xs text-slate-500">{ROLE_LABEL[u.appRole] ?? u.appRole}</span>
                      )}
                      {u.tenantId && (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono" title="Tenant preview ID">
                          tenant:{u.tenantId.slice(0, 8)}…
                        </span>
                      )}
                      {u.ownerId && (
                        <span className="text-xs text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded font-mono" title="Owner preview ID">
                          owner:{u.ownerId.slice(0, 8)}…
                        </span>
                      )}
                      {u.banned && (
                        <span className="text-xs text-red-600 font-medium">Revoked</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Invited {new Date(u.createdAt).toLocaleDateString()}
                      {u.lastSignIn ? ` · Last sign-in ${new Date(u.lastSignIn).toLocaleDateString()}` : " · Never signed in"}
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {!u.banned && (
                      <>
                        <button
                          type="button"
                          className="button-secondary text-sm py-1 px-3"
                          onClick={() => setEditing({
                            userId: u.id,
                            email: u.email,
                            accessLevel: u.accessLevel ?? "APP_USER",
                            appRole: u.appRole ?? "MANAGER",
                            tenantId: u.tenantId ?? "",
                            ownerId: u.ownerId ?? "",
                          })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button-secondary text-sm py-1 px-3 text-red-600 hover:bg-red-50"
                          onClick={() => revoke(u.id, u.email)}
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Edit modal ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card max-w-sm w-full mx-4 space-y-4">
            <h3 className="font-semibold">Edit access — {editing.email}</h3>

            <label className="label">
              Access level
              <select
                className="input"
                value={editing.accessLevel}
                onChange={(e) => setEditing((s) => ({ ...s, accessLevel: e.target.value }))}
              >
                {ACCESS_LEVELS.map((l) => (
                  <option key={l} value={l}>{ACCESS_LABEL[l]}</option>
                ))}
              </select>
            </label>

            {editing.accessLevel !== "DOCS_INVESTOR" && (
              <label className="label">
                App role
                <select
                  className="input"
                  value={editing.appRole ?? "MANAGER"}
                  onChange={(e) => setEditing((s) => ({ ...s, appRole: e.target.value }))}
                >
                  {APP_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="label">
              Tenant preview ID
              <input
                className="input font-mono text-sm"
                type="text"
                value={editing.tenantId ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, tenantId: e.target.value }))}
                placeholder="UUID of the Tenant record (optional)"
              />
              <span className="text-xs text-slate-400 mt-0.5 block">
                Set this to let a non-TENANT account access the tenant portal for that tenant.
                Clear to remove access.
              </span>
            </label>

            <label className="label">
              Owner preview ID
              <input
                className="input font-mono text-sm"
                type="text"
                value={editing.ownerId ?? ""}
                onChange={(e) => setEditing((s) => ({ ...s, ownerId: e.target.value }))}
                placeholder="User.id of an OWNER account (optional)"
              />
              <span className="text-xs text-slate-400 mt-0.5 block">
                Set this to let a non-OWNER account access the owner portal for that owner.
                Clear to remove access.
              </span>
            </label>

            <div className="flex gap-3">
              <button className="button-primary flex-1" type="button" onClick={saveEdit}>
                Save
              </button>
              <button
                className="button-secondary flex-1"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const getStaticProps = withTranslations(["common"]);
