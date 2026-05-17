# Despliegue multiplataforma y PDF

## Resumen

| Objetivo | Cómo |
|----------|------|
| **Aplicación web pública** | Docker Compose, o frontend en Vercel/Netlify + API en Render/Railway/Fly.io |
| **“App móvil”** | **PWA** (instalar desde el navegador: *Añadir a pantalla de inicio*) usando el mismo sitio web |
| **URL pública** | Dominio del proveedor (p. ej. `*.vercel.app`, `*.render.com`) o tu dominio apuntando al hosting |
| **PDF** | Botón **Exportar tablas (PDF)** en resultados (reglas, ACTION/GOTO o tabla LL(1), FIRST/FOLLOW, traza) |

---

## 1. Docker (una sola URL para web + API)

Desde la carpeta **`PextraE2_2`**:

```bash
docker compose up --build
```

- **Web (Nginx + React):** http://localhost:8080  
- **API directa (opcional):** http://localhost:5001  

Nginx reenvía **`/api/*`** al contenedor Flask, así el frontend usa rutas relativas (`REACT_APP_API_URL` vacío en el build) y no hay problemas de CORS entre orígenes.

Para producción en un VPS: instala Docker, abre el puerto 80/443, pone un proxy TLS (Caddy, Traefik) delante del servicio `web`.

---

## 2. Despliegue separado (URL pública típica)

### Frontend (estático)

1. Build local: `cd frontend && npm run build`
2. Variable **`REACT_APP_API_URL`**: URL absoluta de tu API, **sin** barra final.  
   Ejemplo: `https://tu-api.onrender.com`
3. Subir la carpeta `build/` a **Vercel**, **Netlify**, **Cloudflare Pages**, etc.

### Backend (Flask)

1. Servicio **Render**, **Railway**, **Fly.io**, etc.
2. Comando de arranque sugerido:  
   `gunicorn --bind 0.0.0.0:$PORT --workers 2 lr1_backend:app`  
   (ajusta `$PORT` según el proveedor.)
3. **CORS:** con `Flask-CORS` en modo permisivo la API acepta peticiones desde otro origen; en producción puedes restringir orígenes a tu dominio del frontend.

---

## 3. App móvil (PWA)

No hace falta tienda de apps para una demo académica:

1. Despliega la web con HTTPS.
2. En Android (Chrome): menú → **Instalar aplicación** o **Añadir a la pantalla de inicio**.
3. En iOS (Safari): **Compartir** → **Añadir a inicio**.

El archivo `public/manifest.json` y `theme-color` en `index.html` describen nombre, iconos y modo `standalone`.

### App nativa (opcional, más trabajo)

Si necesitas paquete `.apk`/`.ipa`, puedes envolver el `build/` con **Capacitor** o **TWA**; no está automatizado en este repositorio.

---

## 4. Exportación PDF

- Tras analizar, usa **Exportar tablas (PDF)** junto al título de resultados.
- En **comparación** se generan **dos PDF** (uno por algoritmo).
- Incluye: reglas, matriz ACTION+GOTO (LR) o tabla M (LL), FIRST/FOLLOW si existen, y hasta 80 pasos de traza.

---

## 5. Variables útiles

| Variable | Uso |
|----------|-----|
| `REACT_APP_API_URL` | Vacío = mismo origen (Docker/Nginx). En hosting estático: URL absoluta del backend. |
| `PORT` | Muchos PaaS definen el puerto del proceso; usar con gunicorn. |

---

## 6. Desarrollo local (sin Docker)

- Backend: `python lr1_backend.py` (puerto 5001).
- Frontend: `npm start` en `frontend`.  
  El **`proxy`** en `package.json` reenvía `/api` al backend en `127.0.0.1:5001`.
