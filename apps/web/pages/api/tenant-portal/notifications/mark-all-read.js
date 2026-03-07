import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  await proxyToBackend(req, res, "/tenant-portal/notifications/mark-all-read");
}
