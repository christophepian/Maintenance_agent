import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const path = Array.isArray(req.query.path) ? req.query.path.join("/") : req.query.path;
  await proxyToBackend(req, res, `/people/owners/${path}`);
}
