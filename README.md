# KinderFounds 🎒

App web para administrar las finanzas del curso Kinder.

## Stack
- **Frontend**: React + Vite + TailwindCSS → Netlify
- **Backend**: Node.js + Express → Render
- **Base de datos**: MongoDB Atlas

## Correr localmente

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env
# Edita .env: agrega MONGODB_URI, JWT_SECRET, ADMIN_USER y ADMIN_PASSWORD
node dev.js

# 2. Frontend (otra terminal)
cd frontend
npm install
cp .env.example .env
# Edita .env: VITE_API_URL=http://localhost:5000/api
npm run dev
```

## Variables de entorno necesarias

Copia `backend/.env.example` a `backend/.env` y completa los valores.
Las credenciales del administrador se configuran en el archivo `.env` — nunca en el código.

## Deploy
- **Backend** → [Render](https://render.com): conecta este repo, carpeta `backend`
- **Frontend** → [Netlify](https://netlify.com): conecta este repo, carpeta `frontend`

## Auditoría automatizada

```bash
cd backend
npm run qa
```

Levanta el servidor real contra una MongoDB limpia en memoria y ejecuta 208
verificaciones: autenticación y roles, simulación de 10 meses de cuotas con
19 alumnos, cuadratura de todos los saldos contra un libro contable
independiente, doble click, casos hostiles, inyección NoSQL, integridad
referencial en la base y el contrato exacto que envía cada pantalla.
No toca Atlas ni ninguna base real.

## Respaldos

```bash
cd backend
npm run backup                 # respalda a ../backups/<fecha>/, conserva 14
npm run backup -- --keep 30    # conserva 30
npm run restore -- --from ../backups/<fecha> --yes
```

Requiere `MONGODB_URI`. La base en memoria no es respaldable porque no persiste.
