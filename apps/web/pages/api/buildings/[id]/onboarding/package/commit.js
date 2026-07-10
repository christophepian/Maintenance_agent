import { proxyToBackend } from "../../../../../../lib/proxy";

export const config = {
  api: {
    bodyParser: false, // Required for multipart/form-data (multiple package CSVs)
  },
};

export default async function handler(req, res) {
  await proxyToBackend(req, res, `/buildings/${req.query.id}/onboarding/package/commit`);
}
