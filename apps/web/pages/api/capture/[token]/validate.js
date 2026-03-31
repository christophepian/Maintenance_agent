import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const { token } = req.query;
  await proxyToBackend(req, res, `/capture-sessions/validate/${token}`);
}
