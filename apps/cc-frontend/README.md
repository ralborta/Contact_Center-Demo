# Contact Center - Frontend

Frontend Next.js para el Centro de Gestión - Contact Center Bancario.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Deploy**: Vercel

## Configuración

### Variables de Entorno

Crea un archivo `.env.local`:

```bash
NEXT_PUBLIC_API_URL=https://tu-backend-railway.up.railway.app
```

### Desarrollo Local

```bash
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:3001`

### Build

```bash
npm run build
npm start
```

## Deploy en Vercel

1. Conecta tu repositorio GitHub a Vercel
2. Selecciona el directorio `apps/cc-frontend`
3. Configura la variable de entorno:
   - `NEXT_PUBLIC_API_URL`: URL de tu backend en Railway
4. Deploy automático

## Estructura

```
src/
  app/              # App Router de Next.js
  components/       # Componentes React
  lib/              # Utilidades y API client
  types/            # TypeScript types
```
