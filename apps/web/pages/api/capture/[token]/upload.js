import { proxyToBackend } from "../../../../lib/proxy";

export const config = {
  api: {
    bodyParser: false, // Required for multipart/form-data
  },
};

export default async function handler(req, res) {
  const { token } = req.query;
  await proxyToBackend(req, res, `/capture-sessions/${token}/upload`);
}
