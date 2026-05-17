/**
 * Base URL del backend (sin barra final).
 * - Desarrollo: REACT_APP_API_URL=http://localhost:5001 o vacío + proxy manual
 * - Producción con Nginx (docker-compose): vacío → peticiones a /api del mismo origen
 */
export function getApiBaseUrl() {
  const raw = process.env.REACT_APP_API_URL;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return '';
  }
  return String(raw).replace(/\/$/, '');
}

export function apiUrl(path) {
  const base = getApiBaseUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
