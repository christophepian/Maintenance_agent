import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;
  // proxyToBackend forwards the query string (from/to) from req.url.
  await proxyToBackend(req, res, `/buildings/${id}/unit-profitability`);
}
