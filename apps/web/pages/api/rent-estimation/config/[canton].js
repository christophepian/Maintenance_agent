import { proxyToBackend } from "../../../../lib/proxy";

export default async function handler(req, res) {
  const { canton } = req.query;
  await proxyToBackend(req, res, `/rent-estimation/config/${canton}`);
}
