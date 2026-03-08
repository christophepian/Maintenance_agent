import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ManagerTenantsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/manager/people/tenants");
  }, [router]);
  return null;
}
