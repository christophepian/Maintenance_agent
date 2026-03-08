import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ManagerInventoryPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin-inventory");
  }, [router]);
  return null;
}
