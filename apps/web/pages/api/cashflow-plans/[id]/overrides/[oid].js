import { proxyToBackend } from "../../../../../lib/proxy";

export default async function handler(req, res) {
  const { id, oid } = req.query;
  await proxyToBackend(req, res, `/cashflow-plans/${id}/overrides/${oid}`);
}
