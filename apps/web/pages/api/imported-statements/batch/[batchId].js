import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const { batchId } = req.query;
  await proxyToBackend(req, res, `/imported-statements/batch/${batchId}`);
}
