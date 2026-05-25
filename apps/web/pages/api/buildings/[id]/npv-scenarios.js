import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;
  // proxyToBackend already forwards the query string from req.url — do not
  // rebuild it here or params get doubled and the last one becomes NaN.
  await proxyToBackend(req, res, `/buildings/${id}/npv-scenarios`);
}
