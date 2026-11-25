const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function getStoredToken() {
  return localStorage.getItem('clinicaweb_token');
}

export function setStoredAuth(token, user) {
  localStorage.setItem('clinicaweb_token', token);
  localStorage.setItem('clinicaweb_user', JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem('clinicaweb_token');
  localStorage.removeItem('clinicaweb_user');
}

export async function apiRequest(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (options.rawResponse) {
    if (!response.ok) {
      throw new Error('Descărcarea fișierului a eșuat.');
    }
    return response;
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text ? { message: text } : null;
  }

  if (!response.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `Eroare server (HTTP ${response.status}).`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function downloadCsv(path, filename = 'raport-clinicaweb.csv') {
  const response = await apiRequest(path, { method: 'GET', rawResponse: true });
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
