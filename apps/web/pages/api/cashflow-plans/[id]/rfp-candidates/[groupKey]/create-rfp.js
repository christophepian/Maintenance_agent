import { proxyToBackend } from "../../../../../../lib/proxy";

export default async function handler(req, res) {
  const { id, groupKey } = req.query;
  await proxyToBackend(
    req,
    res,
    `/cashflow-plans/${id}/rfp-candidates/${encodeURIComponent(groupKey)}/create-rfp`,
  );
}
