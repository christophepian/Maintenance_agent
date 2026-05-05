import { useEffect } from "react";
import { useRouter } from "next/router";
import { withTranslations } from "../../lib/i18n";

/**
 * status-updates.js was an identical clone of jobs.js.
 * Redirect to the canonical jobs page instead.
 */
export default function ContractorStatusUpdatesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/contractor/jobs");
  }, [router]);
  return null;
}

export const getStaticProps = withTranslations(["common","contractor"]);
