import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ManagerPropertiesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin-inventory");
  }, [router]);
  return null;
}
