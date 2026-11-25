# Logística: Andreani, Correo Argentino y reparto propio

Rama `feature/logistica-andreani-correo`. Decisiones de Juan del 2026-11-23.

## Cómo funciona

1. **Checkout (tienda y mayoristas).** Con el CP cargado, la web pide `/api/shipping/options` y muestra cómo llega el pedido:
   - CP de una zona de reparto propio activa → solo **Reparto IQ Kids**, con el precio de la zona (precio mayorista aparte si se cargó).
   - Cliente mayorista con logística fija en el maestro → solo esa logística. Vacío = decide la tabla de CP. La logística fija solo se respeta si el navegador ya se identificó con ese cliente.
   - El resto → **Andreani** y **Correo Argentino**, a domicilio y retiro en sucursal (con buscador de sucursales).
   - Envío gratis, descuento parcial de envío, links de envío gratis y cupones se aplican igual que antes sobre el precio elegido.
   - Se muestra la fecha de despacho: mismo día hábil si se confirma antes de la hora de corte (13:00), si no el siguiente; sin sábados, domingos, feriados nacionales ni los días cargados en el admin.
2. **Precios.** Salen de la API del transportista y se guardan por transportista, tipo, CP y rango de peso (24 h por defecto). Si la API no responde, se usa la última cotización guardada aunque esté vieja; si nunca hubo, el precio de la tabla por provincia de antes (y no se ofrece sucursal). El checkout nunca se frena por una API caída. El servidor recalcula todo al crear el pedido: el precio nunca viene del navegador.
3. **Pedido creado.** Queda un `shipments` en `WAITING_PAYMENT` (uno por pedido, `order_id` único).
4. **Venta confirmada** → se genera la etiqueta:
   - Mercado Pago: al acreditarse el pago (webhook o retorno).
   - Transferencia / eCheq: cuando el equipo **aprueba el comprobante** en **Admin > Comprobantes**. Rechazar lo vuelve a "pendiente de pago" y le manda un mail al cliente con el link para subirlo de nuevo.
   - Pedido marcado PAID o PREPARING desde el admin (incluye mayoristas con pago diferido al aprobarlos). También hay botón "Generar etiqueta ahora".
5. **Etiqueta.** Andreani: se crea la orden y se guarda el PDF en el bucket privado (`labels/<pedido>/`). Correo (MiCorreo): se importa el envío; la etiqueta se imprime desde MiCorreo o se sube a mano. Reparto propio: el seguimiento es el número de pedido y la etiqueta la sigue generando el script de etiquetas de la app.
6. **Planilla / AppSheet.** El pedido se re-sincroniza con columnas nuevas: `logistica` (PROPIA/ANDREANI/CORREO), `tipo_entrega`, `sucursal`, `tracking`, `etiqueta_url`, `fecha_despacho`, `estado_envio`.
7. **Cliente.** Mail "Tu pedido está confirmado" con transportista, seguimiento, fecha de despacho y destino. La pantalla de confirmación (y la de mayoristas) muestra lo mismo y se actualiza sola mientras espera el pago de MP.

## Robustez

- Cotización: timeout 4 s y un reintento; caché y respaldo como arriba.
- Etiquetas: primer intento en el momento; si falla, reintentos a 1, 5, 15, 30, 60, 120 y 240 minutos y después cada 4 horas, **sin cambiar de transportista** (decisión de Juan). Desde el 4.º intento aparece en **Admin > Etiquetas y envíos > Para revisar**. Corre en el cron de `/api/cron/order-sync` (cada 5 minutos, ya está en el crontab del servidor).
- Idempotencia: un envío por pedido, lock por fila al procesar, y aprobar dos veces es rechazado. Si Andreani no responde después de mandar el alta (timeout o 500), puede haberla creado: el envío queda en **Revisar a mano** y no se reintenta solo, para no pagar dos etiquetas. Desde el pedido: "Reintentar" (si no existe en Andreani) o "Cargar seguimiento".
- 503/429 se reintentan solos (no se procesó). Un comprobante no se puede subir a un pedido ya pago o cancelado.
- Cancelar o vencer el pedido cancela el envío; si la etiqueta ya existía en el transportista, queda anotado para anularla desde su portal.
- Credenciales solo en `.env.production` del servidor; nunca en la base, los logs ni el repo. Lo que se guarda de cada pedido/respuesta pasa por `redact`.

## Referidos

El crédito de la amiga ahora se libera con el pago confirmado (MP pagado o comprobante aprobado). Un comprobante subido espera la revisión sin vencer. Las demás reglas (amiga nueva, saldo reservado) siguen contando el comprobante subido.

## Admin

- **Sistema > Logística** (sección `shipping`): prender/apagar la integración y cada transportista, retiro en sucursal, hora de corte, días de preparación, horas de caché, paquete por defecto, depósito de origen (remitente), zonas de reparto propio (precio, precio mayorista, días), importar CSV de `codigos_postales_db` y asignar CP a zonas, feriados extra.
- **Ventas > Comprobantes** y **Ventas > Etiquetas y envíos** (sección `orders`).
- Pedido: tarjeta "Envío" con estado, seguimiento, etiqueta, historial y acciones.
- Productos: peso y medidas del paquete. Clientes mayoristas: logística fija.

## Deploy (Caso B: con migración) — paso a paso

Migraciones `202611241200_add_logistics`, `202611250600_logistics_surcharges`, `202611250610_price_source_customer` y `202611250620_carrier_pricing_mode`: **solo agregan** tablas, tipos y columnas nullable; marca como aprobados los comprobantes de pedidos ya pagos y crea la configuración con la integración **apagada**. Apagada, el checkout cobra como hoy y no se generan etiquetas. Lo único que cambia desde el primer minuto: los comprobantes se aprueban en Admin > Comprobantes y el crédito de referidos se libera al aprobar.

### Antes (sin tocar producción)
1. Juan carga en `/opt/iqkids/web/.env.production` (nunca en el repo ni en el chat):
   ```
   ANDREANI_ENV=prod
   ANDREANI_USER=
   ANDREANI_PASSWORD=
   ANDREANI_CLIENT_NUMBER=0012013100
   ANDREANI_CONTRACT_DOMICILIO=400043954
   ANDREANI_CONTRACT_SUCURSAL=400043956
   CORREO_AR_USER=
   CORREO_AR_PASSWORD=
   CORREO_AR_CUSTOMER_ID=
   ```
   (`NEXT_PUBLIC_SITE_URL` está repetida en ese archivo con el mismo valor: dejar una sola.)
2. Planilla `ecommerce_propio_iq`: **hecho el 2026-11-24.** El script de la planilla (ID `1QVFozj...`, copia en `apps-scripts/ecommerce-pedidos`) suma las columnas de logística a `ORDER_COLUMNS`; publicado como versión 10 de la implementación que usa la web (la URL no cambia). Las columnas aparecen en la hoja con el próximo pedido. Probado: el webhook responde.
3. Script de etiquetas (`apps-scripts/etiquetas`): `clasp push` el día del deploy (ver abajo).

### Deploy (en el Droplet, horario de poco tráfico)
1. Backup de la base y de los archivos subidos (comprobantes y etiquetas viven en `/opt/iqkids/data/uploads`):
   ```
   cd /opt/iqkids/web
   docker compose exec -T postgres pg_dump -U postgres -d postgres -Fc > /opt/iqkids/backups/pre-logistica-$(date +%Y%m%d-%H%M).dump
   pg_restore --list /opt/iqkids/backups/pre-logistica-*.dump | head
   tar czf /opt/iqkids/backups/uploads-pre-logistica-$(date +%Y%m%d-%H%M).tgz -C /opt/iqkids/data uploads
   ```
2. Código: `git fetch origin` y `git checkout <commit de main con la rama mergeada>`.
3. `docker compose build app`
4. `docker compose run --rm app npx prisma migrate deploy`
5. `docker compose run --rm app npx tsx prisma/data/seed-logistics.ts` — carga los 2.352 CP de la app, las zonas "CABA" ($5.000) y "GBA Norte" ($7.500) y el peso de cada producto (360 g por cajita, 1.080 g la de 3). Se puede repetir sin duplicar.
6. `docker compose up -d app`
7. Verificar: la home y el checkout abren; Admin > Logística muestra las conexiones en verde, 2.352 CP y 460 de reparto propio; Admin > Comprobantes abre.

### Activación (después del deploy, desde el admin)
1. Admin > Logística: cargar el **depósito de origen** (remitente real de las etiquetas), revisar precios y días de las zonas, cargar feriados extra si hay.
2. Admin > Productos: peso y medidas del paquete de cada producto (si no, se usan los valores por defecto de Logística).
3. Prender "Reparto propio" y "Andreani" (Correo cuando esté Paq.ar) y por último **"Integración logística activa"**.
4. Probar un pedido real chico con transferencia: aprobarlo en Admin > Comprobantes y verificar etiqueta, mail, planilla y que la etiqueta aparezca en la app.

### Apps Script (con clasp, sin publicar hasta este paso)
- Script de etiquetas (carpeta `apps-scripts/etiquetas` al lado del repo, en la máquina de Juan): respeta la logística que elige la web y baja a la app las etiquetas de Andreani/Correo (`EtiquetasWeb.js`). Prueba local: `node test-etiquetas-web.cjs`. Publicar: `clasp push` y, si el lote de impresión es Web App, nueva versión de la implementación. Corre dentro del trigger de 15 minutos que ya existe.
- Sin la integración prendida, el script se comporta igual que hoy (la columna `logistica` viene vacía y decide la tabla de CP del sheet).

### Vuelta atrás
- **Rápida (sin deploy):** apagar "Integración logística activa" en Admin > Logística. El checkout vuelve a cobrar por provincia y no se generan etiquetas nuevas. Los envíos ya creados quedan como están.
- **Código:** `git checkout <commit anterior>`, `docker compose build app`, `docker compose up -d app`. La migración es solo aditiva: el código anterior funciona con la base nueva, no hace falta revertirla.
- **Apps Script:** en el editor, Implementaciones > versión anterior, o `git checkout` del commit "Copia original (clasp clone)" en la carpeta del script y `clasp push`.

## Estado de la validación con las cuentas reales

- **Andreani (producción, 2026-11-24):** login, sucursales, cotización con contrato (sin número de cliente) y alta con etiqueta PDF 10x15 probadas con la cuenta real. Envío de prueba 360003272906250, a anular desde el portal.
- **Correo Argentino:** token probado. MiCorreo no devuelve rótulo ni seguimiento por API: se pidió a Correo el alta en Paq.ar. Hasta entonces dejar Correo apagado o imprimir desde MiCorreo y subir la etiqueta al pedido. Falta el `customerId`.

## Pruebas hechas (local)

- 172 tests unitarios OK (fecha de despacho y feriados, paquete, parsers de Andreani/Correo, payloads, mails).
- Script de punta a punta contra `next start` y un Andreani/Correo simulados, **48 de 48 OK**: opciones por CP propio e interior, precio de la API, caché, API caída con y sin cotización guardada, sucursales, sucursal inventada rechazada, comprobante → aprobar → etiqueta + planilla + confirmación, aprobar dos veces, comprobante sobre pedido pago, Andreani caído → error → cron lo resuelve sin cambiar de transportista, timeout → revisar a mano sin duplicar + seguimiento manual, rechazo y nuevo comprobante, Correo importado, reparto propio, cancelación, pago desde el admin, precio mayorista de zona, logística fija ignorada sin identificarse, integración apagada igual que antes, admin de logística (CSV, feriado, validación, permisos).
- Checkout mirado en Chrome: opciones, sucursales, precio en el resumen y fecha de despacho.
- 2026-11-24: misma prueba ampliada, **54 de 54 OK**: suma URL completa de la etiqueta en la planilla y descarga del PDF, admin desde otro origen rechazado, etiqueta falsa (HTML con nombre .pdf) rechazada, tabla inicial de CP y zonas cargada, CP de zona norte (Olivos) por reparto propio. Script de la app probado con `test-etiquetas-web.cjs` (solo copia etiquetas de la web, rechaza dominios ajenos, no duplica, la logística de la web manda sobre el CP del sheet).

## Bultos y precios (2026-11-24)

- Bultos según la tabla de logística: 1 a 10 displays en cajas de 10x12x7 hasta 20x12x35 (360 g por display); cada 10 una caja madre; cada 100 un bulto mayorista de 40x60x35 y 36 kg. Andreani recibe un bulto por caja.
- Reparto propio: CABA $5.000, GBA Norte $7.500 (editable en Admin > Logística).
- Andreani y Correo: tarifa del transportista + recargo por llevarlo ($2.500 cada uno, editable). El precio de respaldo (tabla por provincia) no lleva recargo.
- Cliente mayorista con "Precio de envío fijo" en el maestro: ese precio reemplaza al calculado (ej. $25.000 por bulto en CABA).
- Precio de Andreani / Correo al cliente: selector en Admin > Logística. **Tabla actual por provincia** (por defecto, el cliente paga lo mismo que hoy) o **tarifa real + recargo**. Cotización real a Rosario (24/11): 1 display $15.317 domicilio / $11.343 sucursal, sin recargo.

