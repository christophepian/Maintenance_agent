import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  await proxyToBackend(req, res, `/units/${req.query.id}/repair-replace-analysis`);
}
