export const config = { api: { bodyParser: false } };
import { proxyToBackend } from "../../../../../../../lib/proxy";
export default async function handler(req, res) {
  const { id, itemId } = req.query;
  await proxyToBackend(req, res, `/condition-reports/${id}/items/${itemId}/photos`);
}
