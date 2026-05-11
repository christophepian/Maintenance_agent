import { proxyToBackend } from "../../../../../../lib/proxy";

export default async function handler(req, res) {
  const { id, balanceId } = req.query;
  await proxyToBackend(req, res, `/imported-statements/${id}/balances/${balanceId}`);
}
