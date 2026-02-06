export const config = {
  api: { bodyParser: false },
};

async function safeReadJsonResponse(r) {
  const text = await r.text();
  try {
    return { json: text ? JSON.parse(text) : {} };
  } catch {
    return {
      json: {
        error: {
          code: "UPSTREAM_NOT_JSON",
          message: "Upstream did not return JSON",
          details: {
            status: r.status,
            contentType: r.headers.get("content-type"),
            bodyPreview: text.slice(0, 200),
          },
        },
      },
    };
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!id || typeof id !== "string") {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Missing query param: id" },
      });
    }

    const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:3001";
    const authHeader = req.headers["authorization"];

    const r = await fetch(`${baseUrl}/requests/${id}/status`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body: JSON.stringify({ status: "APPROVED" }),
    });

    const parsed = await safeReadJsonResponse(r);
    return res.status(r.status).json(parsed.json);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
