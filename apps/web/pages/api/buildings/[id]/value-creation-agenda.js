import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const { id } = req.query;
  // proxyToBackend forwards the query string (incl. ?mandate=) from req.url — do not
  // rebuild it here or params get doubled.
  await proxyToBackend(req, res, `/buildings/${id}/value-creation-agenda`);
}
