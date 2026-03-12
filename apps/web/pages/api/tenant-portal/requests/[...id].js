import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const segments = Array.isArray(req.query.id) ? req.query.id.join("/") : req.query.id;
  await proxyToBackend(req, res, `/tenant-portal/requests/${segments}`);
}
