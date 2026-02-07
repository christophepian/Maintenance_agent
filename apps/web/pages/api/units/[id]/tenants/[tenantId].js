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
    const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:3001";
    const authHeader = req.headers["authorization"];
    const { id, tenantId } = req.query;

    if (req.method === "DELETE") {
      const r = await fetch(`${baseUrl}/units/${id}/tenants/${tenantId}`, {
        method: "DELETE",
        headers: authHeader ? { authorization: authHeader } : undefined,
      });

      const j = await safeJson(r);
      return res.status(r.status).json(j);
    }

    res.setHeader("Allow", ["DELETE"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    return res.status(500).json({
      error: String(e),
      hint: "Next.js API route could not reach backend. Is API running on 3001?",
    });
  }
}
