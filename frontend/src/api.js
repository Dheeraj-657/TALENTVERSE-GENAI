// Backend base URL: set VITE_API_URL at build time (e.g. https://talentverse-api.onrender.com).
// In local dev, Vite proxies /api to localhost:5000, so the default "" works.
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(status, error) {
    super(error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = error?.code || "NETWORK_ERROR";
    this.details = error?.details || [];
  }
}

async function request(path, opts = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, opts);
  } catch {
    throw new ApiError(0, { code: "NETWORK_ERROR", message: "Cannot reach the TalentVerse API. If it was asleep, wait ~30 s and retry." });
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) throw new ApiError(res.status, body?.error);
  return body;
}

const json = (method, data) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(data) });

export const api = {
  health: () => request("/health"),
  features: () => request("/features"),
  list: (feature, params = {}) => request(`/${feature}?${new URLSearchParams(params)}`),
  get: (feature, id) => request(`/${feature}/${id}`),

  extract(feature, { text, file, profileId }) {
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      if (profileId) fd.append("profile_id", profileId);
      return request(`/${feature}/extract`, { method: "POST", body: fd });
    }
    return request(`/${feature}/extract`, json("POST", { text, ...(profileId ? { profile_id: profileId } : {}) }));
  },

  confirm: (feature, payload) => request(`/${feature}/confirm`, json("POST", payload)),
  update: (feature, id, data) => request(`/${feature}/${id}`, json("PUT", { data })),
  remove: (feature, id) => request(`/${feature}/${id}?confirm=true`, { method: "DELETE" }),
};
