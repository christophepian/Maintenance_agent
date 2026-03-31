import { proxyToBackend } from "../../lib/proxy";

export default async function handler(req, res) {
  // GET ?category=... is a contractor match query → forward to /contractors/match
  // All other requests → /contractors (list or create)
  if (req.method === "GET" && req.query.category) {
    await proxyToBackend(req, res, "/contractors/match");
  } else {
    await proxyToBackend(req, res, "/contractors");
  }
}
