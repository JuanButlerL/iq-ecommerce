# Pase a produccion en DigitalOcean

Este documento cubre el reemplazo seguro de la version actual por el rediseno. El objetivo es conservar productos, imagenes, pedidos, comprobantes, costos de envio y configuracion operativa.

## Principios del despliegue

- Desplegar un commit o tag exacto, nunca un working tree con cambios sin subir.
- Hacer y verificar un backup de PostgreSQL antes de ejecutar migraciones.
- Ejecutar solamente `prisma migrate deploy`. **No ejecutar `prisma db seed` ni `npm run db:seed` en produccion.** El seed contiene datos de ejemplo y puede modificar configuracion, productos e imagenes.
- Construir la nueva imagen antes de migrar. Ejecutar las migraciones con esa imagen y recien despues reemplazar el contenedor web.
- No borrar columnas o tablas manualmente. Las migraciones del rediseno son compatibles con los datos existentes.

## Alcance de base de datos

Las migraciones nuevas agregan controles de contenido del home, testimonios, slots de productos, etiqueta de variedad, configuracion de suscripcion y eliminan el campo de avatar de testimonios que no se usaba. No modifican ni eliminan registros de:

- `products` y `product_images`
- `orders`, `order_items`, comprobantes e historial
- reglas y precios de envio
- preferencias, pagos y webhooks de Mercado Pago
- trabajos y logs de sincronizacion

La suscripcion queda desactivada por defecto cuando no tiene contenido configurado. La seccion de testimonios no se muestra si todavia no hay testimonios activos.

## Variables que deben existir en produccion

Conservar los valores productivos actuales y verificar, sin copiarlos a Git:

```env
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SITE_URL=https://iqkids.com.ar

NEXT_PUBLIC_GTM_ID=GTM-NGKTHTNF
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_MICROSOFT_CLARITY_ID=
NEXT_PUBLIC_FB_PIXEL_ID=
META_CONVERSIONS_API_ACCESS_TOKEN=
META_CONVERSIONS_API_TEST_EVENT_CODE=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PRODUCT_BUCKET=
SUPABASE_PROOF_BUCKET=
SUPABASE_PRODUCT_BUCKET_PUBLIC=
SUPABASE_PROOF_SIGNED_URL_EXPIRES_IN=

ORDER_SYNC_PROVIDER=
ORDER_SYNC_SOURCE_LABEL=
APPS_SCRIPT_WEBHOOK_URL=
APPS_SCRIPT_API_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=

MERCADO_PAGO_ENABLED=true
MERCADO_PAGO_ENVIRONMENT=production
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
MERCADO_PAGO_STATEMENT_DESCRIPTOR=IQKIDS

ADMIN_BOOTSTRAP_EMAIL=
ADMIN_LOCAL_EMAIL=
ADMIN_LOCAL_PASSWORD=
ADMIN_SESSION_SECRET=
ENABLE_PROOF_PUBLIC_URL_SYNC=
DEV_ADMIN_BYPASS=false
```

Las variables `NEXT_PUBLIC_*` deben estar disponibles durante `docker compose build`, no solamente al iniciar el contenedor.

GTM convive con las integraciones directas existentes de Analytics, Clarity y Meta. No configurar dentro de GTM tags duplicados de GA, Meta Pixel o Clarity mientras sigan cargandose directamente desde la aplicacion, porque duplicaria eventos.

## 1. Preparar el release

En local:

```bash
npm ci
npx prisma generate
npx prisma validate
npx tsc --noEmit
npm run lint
npm run build
git status --short
```

Todos los assets nuevos de `public/redesign` deben estar versionados. Crear un commit y un tag identificables:

```bash
git add .
git commit -m "Prepare production redesign release"
git tag redesign-prod-YYYYMMDD-HHMM
git push origin HEAD --tags
```

## 2. Preflight en el Droplet

```bash
cd /opt/iqkids/web
docker compose ps
docker compose config --services
git status --short
git rev-parse HEAD
df -h
```

Si `git status` no esta limpio, no hacer `pull` ni borrar cambios: identificar primero por que existen.

Registrar cantidades antes del pase usando el cliente PostgreSQL disponible:

```sql
SELECT 'products' AS entity, COUNT(*) FROM products
UNION ALL SELECT 'product_images', COUNT(*) FROM product_images
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'shipping_rules', COUNT(*) FROM shipping_rules
UNION ALL SELECT 'shipping_rule_provinces', COUNT(*) FROM shipping_rule_provinces
UNION ALL SELECT 'store_settings', COUNT(*) FROM store_settings;
```

## 3. Backup obligatorio

Crear una carpeta fuera del checkout de Git:

```bash
sudo mkdir -p /opt/iqkids/backups
sudo chmod 700 /opt/iqkids/backups
```

Si PostgreSQL corre en Docker, reemplazar `db`, usuario y base por los nombres reales del compose:

```bash
docker compose exec -T db pg_dump -U postgres -d postgres -Fc > /opt/iqkids/backups/pre-redesign-YYYYMMDD-HHMM.dump
pg_restore --list /opt/iqkids/backups/pre-redesign-YYYYMMDD-HHMM.dump | head
```

Si la base es externa, ejecutar `pg_dump` con `DIRECT_URL` desde un entorno seguro. No pegar credenciales en comandos que queden en el historial. Copiar el backup fuera del Droplet o al storage privado habitual.

El backup no esta validado hasta que `pg_restore --list` termina correctamente y el archivo tiene un tamano razonable.

## 4. Desplegar sin ventana inconsistente

Reemplazar `<TAG_O_COMMIT>` y confirmar el nombre real del servicio web; en este proyecto se espera `app`:

```bash
cd /opt/iqkids/web
git fetch --all --tags
git checkout <TAG_O_COMMIT>
docker compose build app
docker compose run --rm app npx prisma migrate deploy
docker compose up -d app
docker compose ps
docker compose logs --tail=150 app
```

No usar `docker compose exec app npx prisma migrate deploy` despues de levantar la nueva app: eso deja una ventana donde codigo nuevo puede consultar un schema viejo.

## 5. Verificacion inmediata

```bash
curl -fsS https://iqkids.com.ar/ > /dev/null
curl -I https://iqkids.com.ar
docker compose logs --since=10m app
```

Repetir la consulta de cantidades y compararla con el preflight. Los conteos de productos, imagenes, pedidos, items y costos de envio deben conservarse.

### Smoke test funcional

1. Abrir home en desktop y mobile; verificar hero, imagenes y navegacion por anclas.
2. Verificar los cuatro productos del home y el orden de su imagen principal.
3. Agregar y quitar unidades; comprobar carrito persistido y feedback visual.
4. Seleccionar provincia en carrito y confirmar que llegue preseleccionada al checkout.
5. Crear un pedido por transferencia, subir comprobante y verificar DB, Storage y Apps Script/AppSheet.
6. Crear un pedido de prueba por Mercado Pago y confirmar preferencia, retorno y webhook `PAID`.
7. Entrar al admin y probar lectura/guardado de productos, configuracion, testimonios, suscripcion, envios y pedidos.
8. Confirmar que las imagenes existentes de Supabase sigan accesibles.

### Smoke test de medicion

- GTM Preview: el contenedor `GTM-NGKTHTNF` carga una sola vez.
- GA DebugView: page views y compra paga sin duplicados.
- Meta Pixel Helper/Test Events: `Purchase` en confirmacion de transferencia y al quedar `PAID` en Mercado Pago.
- Meta CAPI: confirmar deduplicacion browser/server mediante el mismo `event_id`.
- Clarity: confirmar nueva sesion.

## 6. Configuracion nueva desde admin

- Testimonios: cargarlos, ordenarlos y activarlos. Sin activos, la seccion queda oculta.
- Productos destacados: verificar los cuatro slots y que apunten a productos productivos existentes.
- Productos: revisar etiqueta corta del home, colores y orden de imagenes; la primera imagen es la que se usa en el home.
- Suscripcion: completar link, nota del hero y tres beneficios antes de activarla.
- Barra de anuncio: revisar texto, estado y umbral de envio gratis.

## Rollback

Para un problema de aplicacion, volver al commit o imagen anterior y recrear solo el servicio `app`. Las migraciones nuevas son mayormente aditivas y el codigo anterior ignorara las columnas nuevas.

```bash
git checkout <COMMIT_ANTERIOR>
docker compose build app
docker compose up -d app
```

No revertir migraciones ni borrar tablas manualmente durante un rollback normal. Si hubo corrupcion de datos, detener escrituras y restaurar en conjunto el backup de PostgreSQL y la version de codigo correspondiente. Una restauracion completa reemplaza pedidos creados despues del backup y requiere una decision operativa explicita.

## Evidencia del release

Guardar junto al ticket o documento operativo:

- tag/commit desplegado
- fecha y operador
- ruta y checksum del backup
- conteos pre y post migracion
- salida de `prisma migrate deploy`
- resultado del smoke test funcional y de medicion
- captura de `docker compose ps`
