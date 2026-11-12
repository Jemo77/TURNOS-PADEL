# Turnos Padel

Aplicación web para que un club de pádel publique sus canchas, reciba reservas online y administre turnos, pagos y métricas desde un panel privado.

**Estado:** MVP funcional. El frontend compila y el backend pasa la validación de sintaxis; todavía no hay tests automatizados.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933)
![Express](https://img.shields.io/badge/Express-4-000000)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748)
![React](https://img.shields.io/badge/React-18-61DAFB)
![Vite](https://img.shields.io/badge/Vite-5-646CFF)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4)

---

## Qué resuelve

El club necesita dos cosas que suelen resolverse con planillas y mensajes sueltos: que los clientes puedan ver la disponibilidad real y reservar sin llamar, y que el administrador pueda cobrar, controlar la ocupación y detectar pagos pendientes sin revisar conversaciones una por una.

Turnos Padel concentra ese flujo en una sola aplicación:

- **Clientes:** eligen cancha, día y uno o más turnos contiguos, dejan sus datos, eligen el medio de pago y siguen el estado de la reserva.
- **Administrador:** gestiona canchas, turnos, comprobantes, cuenta bancaria y métricas de ocupación e ingresos.
- **Cobros:** transferencia bancaria con comprobante, efectivo en el club y tarjeta virtual. El backend incluye la estructura para conectar la cuenta de Mercado Pago del club vía OAuth y generar pagos con Checkout Pro.

## Funcionalidades

### Reservas públicas

- Home con las canchas activas, precios y acceso al detalle.
- Búsqueda de reservas por teléfono para retomar un pago o cancelar.
- Calendario por cancha con los turnos disponibles, en proceso y reservados.
- Selección de varios turnos **contiguos**; el sistema impide dejar huecos intermedios para no bloquear horas que nadie pagó.
- Hold temporal de 10 minutos mientras el cliente completa el checkout.
- Confirmación con nombre, teléfono, email y método de pago.
- Subida de comprobante en PDF o imagen para transferencias.
- Cancelación con validación del teléfono y política de anticipación configurable (24 horas por defecto).
- Página de checkout con el estado de la reserva, la cuenta de transferencia y el comprobante.

### Panel de administración

- Login con JWT en cookie `HttpOnly` y contraseña hasheada con bcrypt.
- Dashboard con cuatro secciones: **Turnos**, **Finanzas**, **Canchas** y **Config. Mercado Pago**.
- Filtros por fecha y cancha, vista de reservas pendientes de confirmación y orden por fecha o creación.
- Alta manual de reservas para turnos tomados por teléfono o en el club.
- Aprobación y rechazo de comprobantes con motivo.
- Métricas de ingresos, ocupación, medios de pago, demanda por franja horaria y reservas sin acreditar.
- CRUD de canchas con precio, horarios, duración del turno, días disponibles e imagen.
- Conversión automática de imágenes de canchas a WebP con Sharp.
- Configuración de la cuenta bancaria del club (CBU, alias y banco).
- Conexión de la cuenta de Mercado Pago del club mediante OAuth, con QR de autorización.

### Cobros y comprobantes

- **Transferencia bancaria:** el cliente sube un PDF o una imagen; el backend extrae texto, detecta si parece un comprobante de Mercado Pago, compara el importe con la reserva, verifica el CVU destino y revisa la coherencia de la fecha.
- **Efectivo en el club:** la reserva queda pendiente hasta que el administrador la marca como pagada.
- **Tarjeta virtual:** el flujo público actual confirma la reserva en el momento. Los endpoints de Checkout Pro, webhook y OAuth existen en el backend; conectar ese circuito al checkout público y conciliar los pagos automáticamente es el siguiente paso.
- **Comprobantes:** el PDF no se guarda; se procesa en memoria y solo se persisten los datos extraídos y el texto plano. Las imágenes se convierten a WebP y se guardan en disco.
- **Mercado Pago:** los tokens de la cuenta del club se guardan cifrados con AES-256-GCM y se refrescan antes de vencer. El webhook confirma pagos aprobados y rechaza pagos rechazados o cancelados.

### Operación

- Expiración automática de holds vencidos.
- Conciliación de Mercado Pago programable.
- Scheduler interno opcional (`CRON_INTERNO=true`) o cron externo autenticado con `x-cron-secret`.
- Rate limit de 60 solicitudes por minuto en endpoints públicos.
- Validación de requests con Zod.
- CORS restringido al frontend configurado y a túneles `*.trycloudflare.com` en desarrollo.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18, Vite 5, React Router 6, Tailwind CSS 3, Axios |
| Backend | Node.js 20+, Express 4, Prisma 5 |
| Base de datos | PostgreSQL 15+ |
| Autenticación | JWT + bcryptjs |
| Validación | Zod |
| Archivos | Multer, PDFParse, Sharp |
| Pagos | Mercado Pago Checkout Pro + OAuth |
| Gráficos | Componentes SVG propios |

## Arquitectura

```text
┌──────────────────────────────────────────────┐
│  Frontend React + Vite (:5173)               │
│  · reservas públicas                         │
│  · panel de administración                   │
│  · gráficos y métricas                       │
└──────────────────────┬───────────────────────┘
                       │ /api (proxy de Vite en dev)
┌──────────────────────▼───────────────────────┐
│  API REST Express (:4000)                    │
│  · auth + JWT                                │
│  · canchas, reservas y comprobantes          │
│  · jobs de expiración y conciliación         │
│  · OAuth y webhook de Mercado Pago           │
└───────────┬──────────────────────┬───────────┘
            │                      │
┌───────────▼──────────┐  ┌────────▼──────────┐
│ PostgreSQL (Prisma)  │  │ Disco local       │
│ reservas, pagos,     │  │ imágenes y        │
│ cuentas y usuarios   │  │ comprobantes      │
└──────────────────────┘  └───────────────────┘
            │
┌───────────▼──────────────────────────────────┐
│ Mercado Pago                                 │
│ OAuth del club + Checkout Pro + webhook      │
└──────────────────────────────────────────────┘
```

El frontend usa el proxy de Vite en desarrollo para que las llamadas a `/api` salgan por la misma origin. En producción se puede definir `VITE_API_URL` con la URL pública de la API.

## Estructura

```text
TURNOS-PADEL/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # usuarios, canchas, reservas, comprobantes y cuentas
│   │   └── migrations/            # migraciones SQL
│   ├── scripts/
│   │   ├── seed-admin.js          # crea o actualiza el administrador inicial
│   │   └── seed-demo.js           # canchas, cuenta y reservas de demostración
│   └── src/
│       ├── config/                # entorno y cliente Prisma
│       ├── controllers/           # auth, canchas, reservas, admin y Mercado Pago
│       ├── jobs/                  # expiración de holds, conciliación y scheduler
│       ├── middlewares/           # auth, errores, rate limit y uploads
│       ├── parsers/               # extracción de datos de comprobantes PDF
│       ├── routes/                # API REST
│       ├── services/              # reglas de negocio y servicios externos
│       ├── utils/                 # fechas, horarios, errores y cifrado
│       └── server.js              # arranque de Express
└── frontend/
    ├── src/
    │   ├── pages/                 # home, detalle de cancha, checkout y panel admin
    │   ├── components/            # UI, layout, tarjetas y gráficos
    │   ├── context/               # autenticación
    │   ├── services/              # cliente Axios
    │   └── utils/                 # fechas, métricas y formato
    └── vite.config.js
```

## Puesta en marcha

### Requisitos

- Node.js 20 o superior.
- PostgreSQL 15 o superior, local o en un proveedor compatible (Neon, Supabase, Railway).
- Una cuenta de Mercado Pago si se quiere probar el circuito de OAuth y Checkout Pro.

### 1. Backend

```bash
cd backend
cp .env.example .env
# Completar DATABASE_URL, JWT_SECRET, CRON_SECRET y MP_TOKEN_ENCRYPTION_KEY
npm install
npx prisma migrate dev
npm run seed:admin
npm run dev
```

La API queda disponible en `http://localhost:4000/api`.

Para generar secretos:

```bash
openssl rand -base64 48   # JWT_SECRET y CRON_SECRET
openssl rand -base64 32   # MP_TOKEN_ENCRYPTION_KEY
```

### 2. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`. En desarrollo, Vite redirige `/api` al backend en el puerto 4000.

### 3. Datos de demostración

```bash
cd backend
npm run seed:demo
```

El seed crea tres canchas, una cuenta bancaria y reservas repartidas en distintas fechas. Para borrar las reservas y volver a cargar todo:

```bash
npm run seed:demo:reset
```

### 4. Panel de administración

Ingresar a `http://localhost:5173/admin/login` con el `ADMIN_EMAIL` y `ADMIN_PASSWORD` configurados en `backend/.env`. La contraseña debe tener al menos 12 caracteres.

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Cadena de conexión de PostgreSQL. En Neon agregar `sslmode=require`. |
| `JWT_SECRET` | Sí | Secreto para firmar los tokens de sesión. |
| `CRON_SECRET` | Sí | Secreto que deben enviar los endpoints de cron en `x-cron-secret`. |
| `MP_TOKEN_ENCRYPTION_KEY` | Sí | Clave para cifrar los tokens de Mercado Pago. |
| `PORT` | No | Puerto de la API. Por defecto `4000`. |
| `FRONTEND_URL` | No | URL del frontend para CORS y redirects. Por defecto `http://localhost:5173`. |
| `BACKEND_URL` | No | URL pública del backend para el webhook de Mercado Pago. Por defecto `http://localhost:4000`. |
| `ADMIN_EMAIL` | Sí (seed) | Email del administrador inicial. |
| `ADMIN_PASSWORD` | Sí (seed) | Contraseña del administrador inicial, mínimo 12 caracteres. |
| `MP_CLIENT_ID` | No | Client ID de la aplicación de Mercado Pago para OAuth. |
| `MP_CLIENT_SECRET` | No | Client Secret de la aplicación de Mercado Pago para OAuth. |
| `MP_OAUTH_REDIRECT_URI` | No | URL de callback registrada en Mercado Pago. |
| `HOLD_MINUTOS_CHECKOUT` | No | Minutos que dura el hold mientras se completa el checkout. Por defecto `10`. |
| `HOLD_MINUTOS_COMPROBANTE` | No | Minutos para subir el comprobante de una transferencia. Por defecto `30`. |
| `CANCELACION_HORAS_MIN` | No | Anticipación mínima para cancelar online. Por defecto `24`. |
| `CRON_INTERNO` | No | `true` para ejecutar los jobs dentro del proceso. Por defecto `false`. |
| `IMAGENES_DIR` | No | Directorio donde se guardan las imágenes de las canchas. |
| `COMPROBANTES_DIR` | No | Directorio donde se guardan las imágenes de comprobantes. |

### Frontend (`frontend/.env`)

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `VITE_API_URL` | No | URL pública de la API, incluyendo `/api`. En desarrollo se puede omitir y usar el proxy de Vite. |

> `backend/.env` y `frontend/.env` están ignorados por Git. No commitear credenciales reales.

## API principal

### Públicas

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/health` | Estado del servicio. |
| `GET` | `/api/canchas` | Canchas activas. |
| `GET` | `/api/canchas/:id` | Detalle de una cancha. |
| `GET` | `/api/canchas/:id/turnos?fecha=YYYY-MM-DD` | Disponibilidad de una fecha. |
| `POST` | `/api/reservas/hold` | Crea un hold temporal. |
| `PUT` | `/api/reservas/:id/confirmar` | Confirma datos y método de pago. |
| `GET` | `/api/reservas/buscar?telefono=` | Busca reservas por teléfono. |
| `GET` | `/api/reservas/:id` | Consulta una reserva. |
| `POST` | `/api/reservas/:id/comprobante` | Sube un comprobante PDF. |
| `POST` | `/api/reservas/:id/comprobante-imagen` | Sube un comprobante en imagen. |
| `POST` | `/api/reservas/:id/mp/preferencia` | Genera una preferencia de Checkout Pro. |
| `PUT` | `/api/reservas/:id/cancelar` | Cancela una reserva con validación de teléfono. |
| `GET` | `/api/transferencia` | Datos públicos de la cuenta bancaria del club. |
| `POST` | `/api/mp/webhook` | Webhook de Mercado Pago. |

### Administración

Todas requieren sesión iniciada con `POST /api/auth/login`; la cookie `token` se envía automáticamente.

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Inicia sesión. |
| `POST` | `/api/auth/logout` | Cierra sesión. |
| `GET` | `/api/auth/me` | Devuelve el usuario autenticado. |
| `GET` | `/api/admin/reservas` | Lista reservas con filtros. |
| `POST` | `/api/admin/reservas` | Crea una reserva manual. |
| `PUT` | `/api/admin/reservas/:id/marcar-pagado` | Marca una reserva como pagada. |
| `PUT` | `/api/admin/reservas/:id/cancelar` | Cancela una reserva. |
| `GET` | `/api/admin/pagos/pendientes` | Comprobantes pendientes de revisión. |
| `PUT` | `/api/admin/pagos/:comprobanteId/aprobar` | Aprueba un comprobante. |
| `PUT` | `/api/admin/pagos/:comprobanteId/rechazar` | Rechaza un comprobante. |
| `GET` | `/api/admin/canchas` | Lista canchas. |
| `POST` | `/api/admin/canchas` | Crea una cancha. |
| `PUT` | `/api/admin/canchas/:id` | Edita una cancha. |
| `POST` | `/api/admin/canchas/:id/imagen` | Sube o reemplaza la imagen. |
| `DELETE` | `/api/admin/canchas/:id` | Elimina una cancha. |
| `GET` | `/api/admin/config/transferencia` | Consulta la cuenta bancaria. |
| `PUT` | `/api/admin/config/transferencia` | Guarda la cuenta bancaria. |
| `POST` | `/api/admin/mp/conectar` | Genera la URL y el QR de OAuth. |
| `GET` | `/api/admin/mp/estado` | Estado de la conexión con Mercado Pago. |
| `GET` | `/api/admin/mp/oauth/callback` | Callback de OAuth. |

### Cron

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/cron/expirar-reservas` | Marca como expirados los holds vencidos. |
| `POST` | `/api/cron/conciliar-mp` | Ejecuta la conciliación de Mercado Pago. |

Ambos requieren el header `x-cron-secret` con el valor de `CRON_SECRET`.

## Modelo de datos

- `Usuario`: cuenta administrativa con rol `ADMIN` o `SUPERADMIN`.
- `Cancha`: nombre, precio por hora, horarios, duración del turno, días disponibles e imagen.
- `Reserva`: fecha, rango horario, estado, método y estado de pago, datos del cliente y vencimiento del hold.
- `Comprobante`: datos extraídos del PDF o imagen, validaciones, coincidencia con Mercado Pago y estado de revisión.
- `CuentaTransferencia`: CBU, alias y banco del club.
- `CuentaMercadoPago`: tokens cifrados de la cuenta conectada por OAuth.
- `ReporteMpProcesado`: registro de reportes de Mercado Pago procesados.
- `OAuthEstadoPendiente`: estados temporales de OAuth, de un solo uso.

Estados de reserva: `1` en proceso, `2` confirmada, `3` expirada, `4` cancelada o rechazada.

## Seguridad

- Contraseñas con bcrypt (12 rondas).
- JWT con vencimiento de 8 horas en cookie `HttpOnly`, `SameSite=Lax` y `Secure` en producción.
- Validación de entrada con Zod en los endpoints principales.
- Rate limit de 60 solicitudes por minuto en rutas públicas.
- CORS restringido a `FRONTEND_URL`; en desarrollo se permiten túneles `*.trycloudflare.com`.
- Tokens de Mercado Pago cifrados con AES-256-GCM y clave derivada con scrypt.
- OAuth con `state` de un solo uso y vencimiento de 10 minutos.
- Comprobantes PDF procesados en memoria; no se guarda el archivo original.
- Límite de 10 MB para PDFs y 15 MB para imágenes.
- Variables obligatorias validadas al arrancar el backend.
- `.env` excluido del repositorio.

## Limitaciones y próximos pasos

- **Sin tests automatizados.** La verificación actual es manual y por build/sintaxis.
- **Checkout Pro no está conectado al flujo público de tarjeta virtual.** El backend tiene los endpoints de preferencia, webhook y OAuth, pero el checkout actual confirma la reserva en el momento.
- **La conciliación de Mercado Pago es un stub.** `conciliarConMp` cuenta los comprobantes pendientes, pero todavía no cruza los pagos contra un reporte real.
- **Un solo club.** El modelo no es multi-tenant; está pensado para una institución.
- **Notificaciones pendientes.** No hay envío automático de emails ni WhatsApp.
- **Almacenamiento local.** Las imágenes de canchas y comprobantes se guardan en disco; para producción conviene usar S3, R2 u otro almacenamiento de objetos.
- **Sin Docker ni manifiestos de despliegue.** Se puede publicar en Railway, Render, Fly.io o un VPS con Node y PostgreSQL.
- **Sin refresh tokens.** La sesión dura 8 horas y luego hay que volver a iniciar sesión.

Roadmap sugerido:

1. Conectar Checkout Pro al checkout público y probar el webhook de punta a punta.
2. Implementar la conciliación real contra los reportes de Mercado Pago.
3. Agregar tests de integración con Vitest y Supertest.
4. Sumar notificaciones por email o WhatsApp.
5. Mover imágenes y comprobantes a almacenamiento de objetos.
6. Agregar Docker y un pipeline de despliegue.

## Autoría

Proyecto personal de **Jorge Martín** ([Jemo77](https://github.com/Jemo77)).
