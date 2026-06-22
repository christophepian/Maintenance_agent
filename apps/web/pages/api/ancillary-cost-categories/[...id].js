import { proxyToBackend } from "../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;
  const parts = Array.isArray(id) ? id : [id];
  const path = parts.join("/");
  await proxyToBackend(req, res, `/ancillary-cost-categories/${path}`);
}
