import { proxyToBackend } from "../../lib/proxy";

export const config = {
  api: {
    bodyParser: false, // Required for multipart/form-data
  },
};

export default async function handler(req, res) {
  await proxyToBackend(req, res, "/document-scan");
}
