# IQ Kids Store

E-commerce propio para IQ Kids construido con Next.js App Router, TypeScript, Tailwind, Prisma y Supabase. El proyecto incluye storefront publico, panel admin protegido, persistencia de pedidos primero en DB, upload obligatorio de comprobante y capa desacoplada de sincronizacion hacia Google Sheets/AppSheet.

## Stack

- Next.js 15.5
- React 19
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Supabase Auth
- Supabase Storage
- Zod
- React Hook Form
- Zustand

## Arquitectura

- `src/app`: rutas App Router, API routes y layouts
- `src/components`: UI compartida y layout
- `src/features/catalog`: queries y componentes del catalogo
- `src/features/cart`: store persistido y logica de carrito
- `src/features/checkout`: formularios y flujo de transferencia
- `src/features/admin`: componentes del panel admin
- `src/features/orders`: servicios de pedidos, sync y consultas admin
- `src/features/settings`: settings de tienda y shipping
- `src/lib/db`: Prisma singleton
- `src/lib/auth`: clientes Supabase, guards y middleware
- `src/lib/storage`: upload de imagenes y comprobantes
- `src/lib/integrations`: proveedores de sync
- `src/lib/validations`: schemas Zod
- `prisma`: schema, seed y migracion inicial
- `public/placeholders`: assets locales iniciales

## Modulos implementados

- Front publico
  - Home
  - Catalogo
  - Detalle de producto
  - Carrito persistido localmente
  - Checkout
  - Pantalla de transferencia
  - Confirmacion
  - Contacto
  - Politicas
  - 404
- Admin
  - Login con Supabase Auth
  - Dashboard
  - Productos ABM base con upload
  - Configuracion de tienda
  - Reglas de envio
  - Pedidos
  - Logs de sync
  - Export CSV
- Operacion
  - Pedido persistido en DB antes de cualquier sync externo
  - Comprobante obligatorio
  - Storage para imagenes y comprobantes
  - Estados de pedido, pago y sync
  - Reintento manual de sync
  - Seed inicial con 3 productos, settings y provincias

## Variables de entorno

Copiá `.env.example` a `.env` y completá:

```env
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PRODUCT_BUCKET=
SUPABASE_PROOF_BUCKET=
SUPABASE_PRODUCT_BUCKET_PUBLIC=
SUPABASE_PROOF_SIGNED_URL_EXPIRES_IN=
ORDER_SYNC_PROVIDER=
ORDER_SYNC_SOURCE_LABEL=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
APPS_SCRIPT_WEBHOOK_URL=
APPS_SCRIPT_API_KEY=
ADMIN_BOOTSTRAP_EMAIL=
ENABLE_PROOF_PUBLIC_URL_SYNC=
```

## Setup local

1. Instalar dependencias:

```bash
npm install
```

2. Configurar `.env`.

3. Generar Prisma client:

```bash
npm run db:generate
```

4. Ejecutar migraciones:

```bash
npm run db:deploy
```

5. Cargar seed inicial:

```bash
npm run db:seed
```

6. Levantar el proyecto:

```bash
npm run dev
```

## Configurar Supabase

### 1. Proyecto y DB

- Crear proyecto en Supabase.
- Tomar `Project URL`, `anon key` y `service role key`.
- Copiar `DATABASE_URL` y `DIRECT_URL` desde la seccion de conexiones PostgreSQL.

### 2. Buckets

Crear dos buckets:

- `product-images`
  - publico
  - usado para imagenes de producto
- `payment-proofs`
  - privado recomendado
  - usado para comprobantes

Mapear ambos nombres en ENV si usas otros.

### 3. Auth admin

- Crear usuario admin en Supabase Auth con email/password.
- El seed ya crea un `admin_users.email = admin@iqkids.local`.
- Opciones:
  - usar ese mismo email como primer admin
  - o cambiar `ADMIN_BOOTSTRAP_EMAIL` y luego crear el registro correspondiente en `admin_users`

El acceso admin requiere:

- usuario autenticado en Supabase
- email presente en `admin_users`, salvo bootstrap email

### 4. Bypass local de admin

Para desarrollo local sin Supabase real:

```env
DEV_ADMIN_BYPASS=true
```

Con eso:

- `/admin` queda accesible sin login real
- `/admin/login` muestra acceso local
- no debe usarse en produccion

## Prisma

- Schema: `prisma/schema.prisma`
- Migracion inicial: `prisma/migrations/202603150001_init/migration.sql`
- Seed: `prisma/seed.ts`

Comandos utiles:

```bash
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
```

## Storage

### Imagenes de producto

- Upload admin via `/api/admin/upload/product-image`
- Guarda en `products/{slug}/...`
- El producto almacena `file_path` y `public_url`

### Comprobantes

- Upload cliente via `/api/orders/[orderNumber]/proof`
- Guarda en `proofs/{orderNumber}/...`
- Si el bucket es privado, admin consume signed URLs
- Si necesitás URL publica para integraciones externas, usar `ENABLE_PROOF_PUBLIC_URL_SYNC=true`

### Fallback local sin Supabase

Si no hay credenciales reales de Supabase admin:

- imagenes y comprobantes se guardan en `public/uploads`
- esto permite seguir desarrollando el flujo localmente
- en cuanto configures Supabase real, el proyecto vuelve a usar Storage automaticamente

## Sync Google Sheets / AppSheet

Proveedor configurable por ENV:

- `mock`
- `apps_script`
- `google_sheets`

### Apps Script Web App

Es la opcion operativa lista para usar hoy.

Configurar:

```env
ORDER_SYNC_PROVIDER=apps_script
APPS_SCRIPT_WEBHOOK_URL=https://script.google.com/macros/s/...
APPS_SCRIPT_API_KEY=opcional
```

Payload enviado:

- `order`
- `items`

### Google Sheets API

La abstraccion y el provider estan creados, pero la implementacion concreta de escritura directa a Sheets quedo como placeholder tecnico documentado en:

- `src/lib/integrations/sheets/providers/google-sheets.ts`

Si querés usarlo en la siguiente iteracion, lo correcto es completarlo con autenticacion de service account y append a las hojas `pedidos` y `pedidos_items`.

## Deploy en Vercel

1. Crear proyecto en Vercel.
2. Configurar todas las ENV del `.env.example`.
3. Conectar repo.
4. En Supabase, permitir el dominio de produccion si usas Auth con redirect URLs.
5. En build/deploy:
   - `npm install`
   - `npm run build`
   - `npm run db:deploy`

## Flujo funcional esperado

1. Cliente agrega productos al carrito.
2. Checkout crea pedido en DB.
3. Cliente pasa a pantalla de transferencia.
4. Cliente sube comprobante.
5. Se guarda comprobante en Storage.
6. Se actualiza estado del pedido.
7. Se intenta sync externo.
8. Si falla sync:
   - pedido sigue persistido
   - queda `sync_status = error`
   - se guarda `sync_last_error`
   - admin puede reintentar

## Como probar end-to-end

1. Correr migraciones y seed.
2. Entrar a `/productos` y agregar items.
3. Ir a `/carrito`.
4. Completar `/checkout`.
5. Confirmar que se genere `public_order_number`.
6. En `/checkout/transfer/[orderNumber]`, subir un PDF o imagen.
7. Revisar en DB:
   - `orders`
   - `order_items`
   - `payment_proofs`
   - `order_status_history`
   - `sync_jobs`
   - `sync_logs`
8. Entrar a `/admin/pedidos` y `/admin/sync`.
9. Reintentar sync desde admin si usás `mock` o `apps_script`.

## Placeholders tecnicos explicitados

- El provider `google_sheets` quedo preparado pero no finalizado.
- Los assets visuales iniciales son placeholders locales en `public/placeholders`.
- Los datos bancarios y contactos del seed son de ejemplo y deben ajustarse desde admin.

## Estado de verificacion

- `npm run build`: OK
- `npx prisma validate`: OK
- Migracion inicial generada: OK
