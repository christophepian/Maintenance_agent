import { proxyToBackend } from "../../../../../lib/proxy";

export default async function handler(req, res) {
  const action = Array.isArray(req.query.action) ? req.query.action.join("/") : req.query.action;
  await proxyToBackend(req, res, `/tenant-portal/notifications/${req.query.id}/${action}`);
}
