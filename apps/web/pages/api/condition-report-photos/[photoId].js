import { proxyToBackend } from "../../../lib/proxy";
export default async function handler(req, res) {
  const { photoId } = req.query;
  await proxyToBackend(req, res, `/condition-report-photos/${photoId}`, { binary: true });
}
