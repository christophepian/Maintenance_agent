/**
 * /owner/rfps — canonical RFP list for owners.
 * The full RFP list + filter UI lives inside /owner/approvals (RFPs tab).
 * This page performs a client-side redirect so that any deep-link or back-button
 * navigation to /owner/rfps lands on the correct tab without 404-ing.
 */
import { useEffect } from "react";
import { useRouter } from "next/router";
import { withServerTranslations } from "../../../lib/i18n";

export default function OwnerRfpsIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/owner/approvals?tab=rfps");
  }, [router]);
  return null;
}

export const getStaticProps = withServerTranslations(["common", "owner"]);
