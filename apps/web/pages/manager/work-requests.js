import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * /manager/work-requests redirects to /manager/requests (canonical location).
 * Preserves any query params (e.g. ?filter=PENDING_REVIEW).
 */
export default function ManagerWorkRequestsRedirect() {
  const router = useRouter();
  useEffect(() => {
    const qs = window.location.search || "";
    router.replace(`/manager/requests${qs}`);
  }, [router]);
  return <p>Redirecting…</p>;
}
