/* KasiBook — API client. Every request to the backend goes through here.
   Change KB_API_BASE if your backend runs somewhere other than localhost:4000. */

const KB_API_BASE = "http://localhost:4000";

async function kbApi(path, { method = "GET", body, token, isForm = false } = {}) {
  const headers = {};
  if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(KB_API_BASE + path, {
    method,
    headers,
    body: isForm ? body : (body !== undefined ? JSON.stringify(body) : undefined)
  });

  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body, e.g. some DELETEs */ }

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}

/* Uploaded photos come back as relative paths like "/uploads/xyz.jpg" —
   prefix them with the backend's origin so <img> tags actually load. */
function kbPhotoUrl(path) {
  if (!path) return null;
  return path.startsWith("/") ? KB_API_BASE + path : path;
}
