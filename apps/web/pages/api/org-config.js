export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

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
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3001";
    const url = `${baseUrl}/org-config`;
    const authHeader = req.headers["authorization"];

    if (req.method === "GET") {
      const r = await fetch(url, {
        headers: authHeader ? { authorization: authHeader } : undefined,
      });
      const parsed = await safeReadJsonResponse(r);
      return res.status(r.status).json(parsed.json);
    }

    if (req.method === "PUT") {
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

      const headers = {
        "content-type": "application/json",
        ...(authHeader ? { authorization: authHeader } : {}),
      };

      const r = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });

      const parsed = await safeReadJsonResponse(r);
      return res.status(r.status).json(parsed.json);
    }

    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
