import { proxyToBackend } from "../../../../../lib/proxy";

export default async function handler(req, res) {
  const { id, tenantId } = req.query;
  await proxyToBackend(req, res, `/units/${id}/tenants/${tenantId}`);
}
