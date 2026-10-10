const API_BASE = import.meta.env.VITE_API_URL || "https://cheapsk8-production.up.railway.app";

export async function fetchFreebies({ category = "samples", query = "", location = "", limit = 9 }) {
  const params = new URLSearchParams({ category, limit: String(limit) });
  if (query) params.set("query", query);
  if (location) params.set("location", location);
  const res = await fetch(`${API_BASE}/freebies?${params}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchCategories() {
  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
