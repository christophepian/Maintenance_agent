import { proxyToBackend } from "../../../../../lib/proxy";

export const config = {
  api: {
    bodyParser: false, // Required for multipart/form-data (rent-roll CSV + billingMode)
  },
};

export default async function handler(req, res) {
  await proxyToBackend(req, res, `/buildings/${req.query.id}/onboarding/commit`);
}
