export const config = {
  api: {
    bodyParser: false,
  },
};

async function safeJson(r) {
  const text = await r.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      error: {
        code: "UPSTREAM_NOT_JSON",
        message: "Upstream did not return JSON",
        details: {
          status: r.status,
          contentType: r.headers.get("content-type"),
          bodyPreview: text.slice(0, 200),
        },
      },
    };
  }
}

export default async function handler(req, res) {
  try {
    const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:3001";
    const authHeader = req.headers["authorization"];
    const devHeaders = {
      "x-dev-role": req.headers["x-dev-role"],
      "x-dev-org-id": req.headers["x-dev-org-id"],
      "x-dev-user-id": req.headers["x-dev-user-id"],
      "x-dev-email": req.headers["x-dev-email"],
    };

    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const r = await fetch(`${baseUrl}/people/vendors`, {
      headers: {
        ...(authHeader ? { authorization: authHeader } : {}),
        ...devHeaders,
      },
    });
    const j = await safeJson(r);
    return res.status(r.status).json(j);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
