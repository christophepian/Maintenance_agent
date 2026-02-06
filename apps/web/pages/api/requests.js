export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

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
    // Keep identical behavior to org-config route
    const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:3001";
    const authHeader = req.headers["authorization"];

    // Build querystring explicitly (do NOT reuse req.url)
    const { limit, offset, order } = req.query;
    const params = new URLSearchParams();
    if (typeof limit === "string") params.set("limit", limit);
    if (typeof offset === "string") params.set("offset", offset);
    if (typeof order === "string") params.set("order", order);
    const qs = params.toString() ? `?${params.toString()}` : "";

    if (req.method === "GET") {
      const r = await fetch(`${baseUrl}/requests${qs}`, {
        headers: authHeader ? { authorization: authHeader } : undefined,
      });
      const j = await safeJson(r);
      return res.status(r.status).json(j);
    }

    if (req.method === "POST") {
      const raw = await readRawBody(req);

      let payload = {};
      if (raw && raw.trim()) {
        try {
          payload = JSON.parse(raw);
        } catch {
          return res.status(400).json({
            error: { code: "INVALID_JSON", message: "Invalid JSON" },
          });
        }
      }

      if (payload?.text && !payload?.description) payload.description = payload.text;

      const r = await fetch(`${baseUrl}/requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authHeader ? { authorization: authHeader } : {}),
        },
        body: JSON.stringify(payload),
      });

      const j = await safeJson(r);
      return res.status(r.status).json(j);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    // IMPORTANT: expose a little more info for debugging
    return res.status(500).json({
      error: String(e),
      hint: "Next.js API route could not reach backend. Is API running on 3001?",
    });
  }
}
