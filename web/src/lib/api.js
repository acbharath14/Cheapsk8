const API_BASE = import.meta.env.VITE_API_URL || "https://cheapsk8-production.up.railway.app";

/**
 * Wrapper that distinguishes network failures from HTTP errors,
 * and handles malformed JSON responses gracefully.
 */
async function apiFetch(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    // Network failure: DNS, CORS, offline, connection refused.
    throw new Error(
      "Cannot reach the Cheapsk8 API. Check your connection and try again."
    );
  }
  if (!res.ok) {
    let detail = `API error: ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody.detail) detail = errBody.detail;
    } catch {
      // Response wasn't JSON — keep the status-based message.
    }
    throw new Error(detail);
  }
  try {
    return await res.json();
  } catch {
    throw new Error("API returned an unreadable response. Try again.");
  }
}

export async function fetchFreebies({ category = "samples", query = "", location = "", limit = 9 }) {
  const params = new URLSearchParams({ category, limit: String(limit) });
  if (query) params.set("query", query);
  if (location) params.set("location", location);
  return apiFetch(`${API_BASE}/freebies?${params}`);
}

export async function fetchCategories() {
  return apiFetch(`${API_BASE}/categories`);
}

export async function sendNotification(email, freebies) {
  return apiFetch(`${API_BASE}/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, freebies }),
  });
}

export async function subscribeDigest(email, categories = ["samples"]) {
  return apiFetch(`${API_BASE}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, categories }),
  });
}

export async function createAlert(email, keyword) {
  return apiFetch(`${API_BASE}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, keyword }),
  });
}

export async function listAlerts(email) {
  return apiFetch(`${API_BASE}/alerts?email=${encodeURIComponent(email)}`);
}

export async function deleteAlert(email, keyword) {
  return apiFetch(`${API_BASE}/alerts`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, keyword }),
  });
}
