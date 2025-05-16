// hpc-marketplace-ui/src/api.js
const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export async function post(path, body) {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return resp.json();
}

export async function get(path) {
  const resp = await fetch(`${BASE}${path}`);
  return resp.json();
}