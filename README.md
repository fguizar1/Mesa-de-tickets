# Mesa de tickets

API REST y una interfaz web sencilla para reportar problemas (tickets). Los usuarios crean tickets y los administradores los asignan, cambian su estado y revisan su historial.

Proyecto de práctica con TypeScript, Express, PostgreSQL y JWT.

## Funcionalidades

- Inicio de sesión con correo y contraseña, y token JWT.
- Los usuarios solo ven los tickets que reportaron. Los administradores ven todos.
- Solo los administradores pueden asignar responsables y cambiar el estado.
- Un ticket cerrado no admite más cambios.
- Historial de cambios de estado y de responsable, con quién lo hizo y cuándo.
- Filtros por prioridad, estado y responsable, con paginación y orden.
- Interfaz web en `/` con diseño adaptable a móvil.

## Tecnologías

- Node.js y TypeScript
- Express 5
- PostgreSQL con `pg`
- Zod para validación
- JWT (`jsonwebtoken`) y `bcryptjs` para contraseñas
- Vitest y Supertest para pruebas

## Requisitos

- Node.js 20 o superior
- PostgreSQL 14 o superior

## Instalación

```bash
git clone https://github.com/TU_USUARIO/tickets.git
cd tickets
npm install
```

### Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión a la base de desarrollo, por ejemplo `postgresql://postgres:clave@localhost:5432/tickets` |
| `DATABASE_URL_TEST` | Conexión a una base distinta para las pruebas. Su nombre debe contener `test` |
| `JWT_SECRET` | Secreto para firmar los tokens. Mínimo 32 caracteres |
| `JWT_EXPIRES_IN` | Duración del token. Por defecto `8h` |
| `SEED_PASSWORD` | Contraseña de los usuarios de ejemplo. Mínimo 8 caracteres |
| `PORT` | Puerto del servidor. Por defecto `3000` |

Para generar un `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Base de datos

Crea las bases de desarrollo y de pruebas, carga el esquema y crea los usuarios de ejemplo:

```bash
createdb tickets
createdb tickets_test
psql "$DATABASE_URL" -f src/schema.sql
npm run seed
```

> **Advertencia:** `src/schema.sql` borra las tablas existentes antes de crearlas. No lo ejecutes sobre datos que quieras conservar.

El seed crea estos usuarios, todos con la contraseña definida en `SEED_PASSWORD`:

| Correo | Rol |
|---|---|
| `ana@example.com` | usuario |
| `carlos@example.com` | admin |
| `lucia@example.com` | admin |

Para agregar usuarios, edita el arreglo `users` en `src/seed.ts` y vuelve a ejecutar `npm run seed`.

## Ejecución

Modo desarrollo, con recarga automática:

```bash
npm run dev
```

Modo normal:

```bash
npm start
```

Después abre `http://localhost:3000` en el navegador. Verifica que la API esté activa en `http://localhost:3000/health`.

## Pruebas

```bash
npm test
```

Las pruebas usan `DATABASE_URL_TEST` y se niegan a correr si el nombre de la base no contiene `test`, para no borrar datos de desarrollo. Cubren autenticación, validación, visibilidad por usuario, permisos, transiciones de estado, historial, filtros, paginación y atomicidad de las transacciones.

## Endpoints

Todas las rutas de `/api/tickets` y `/api/users` requieren el header `Authorization: Bearer <token>`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/login` | Público | Inicia sesión y devuelve un token |
| `GET` | `/health` | Público | Verifica la conexión con la base de datos |
| `POST` | `/api/tickets` | Autenticado | Crea un ticket |
| `GET` | `/api/tickets` | Autenticado | Lista tickets con filtros, orden y paginación |
| `GET` | `/api/tickets/:id` | Autenticado | Consulta un ticket |
| `PATCH` | `/api/tickets/:id/status` | Admin | Cambia el estado |
| `PATCH` | `/api/tickets/:id/assign` | Admin | Asigna un responsable |
| `GET` | `/api/tickets/:id/history` | Autenticado | Consulta el historial |
| `GET` | `/api/users` | Admin | Lista los usuarios |

### Ejemplos

Iniciar sesión:

```bash
curl -X POST localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"carlos@example.com","password":"TU_SEED_PASSWORD"}'
```

Crear un ticket:

```bash
curl -X POST localhost:3000/api/tickets \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"No carga el reporte","description":"Error 500 al exportar","priority":"alta"}'
```

Listar tickets alta prioridad, ordenados por prioridad, con paginación:

```bash
curl "localhost:3000/api/tickets?priority=alta&sortBy=priority&order=desc&limit=10&offset=0" \
  -H "Authorization: Bearer TOKEN"
```

### Parámetros de `GET /api/tickets`

| Parámetro | Valores | Por defecto |
|---|---|---|
| `priority` | `baja`, `media`, `alta`, `critica` | — |
| `status` | `abierto`, `en_progreso`, `resuelto`, `cerrado` | — |
| `assigneeId` | ID de un administrador | — |
| `limit` | 1 a 100 | 20 |
| `offset` | 0 o mayor | 0 |
| `sortBy` | `created_at`, `updated_at`, `priority` | `created_at` |
| `order` | `asc`, `desc` | `desc` |

## Reglas de negocio

- **Estados:** `abierto` → `en_progreso` → `resuelto` → `cerrado`. Un ticket `cerrado` no puede cambiar de estado, y no se puede cerrar dos veces.
- **Asignación:** solo administradores asignan. El responsable debe tener rol `admin`. No se asigna un ticket cerrado.
- **Visibilidad:** un usuario solo ve sus propios tickets. Si pide un ticket ajeno, recibe `404`, para no revelar que existe.
- **Historial:** cada cambio de estado o de responsable se guarda en la misma transacción que la modificación, con el usuario que lo hizo y la fecha.

## Estructura

```
tickets/
├── src/
│   ├── app.ts                 # Configuración de Express
│   ├── server.ts              # Arranque y cierre ordenado
│   ├── config.ts              # Variables de entorno
│   ├── db.ts                  # Pool de PostgreSQL
│   ├── errors.ts              # Errores HTTP y constantes
│   ├── schema.sql             # Tablas e índices
│   ├── seed.ts                # Usuarios de ejemplo
│   ├── middleware/auth.ts     # Autenticación y roles
│   ├── routes/                # Rutas de auth, users y tickets
│   ├── services/              # Lógica de negocio y consultas
│   └── public/index.html      # Interfaz web
└── test/                      # Pruebas de integración
```

## Próximos pasos

- Límite de intentos en el inicio de sesión.
- Registro y cambio de contraseña.
- Guardar el token en una cookie `HttpOnly`.
- Documentación con Swagger.

## Licencia

Uso educativo.