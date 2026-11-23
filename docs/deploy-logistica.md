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

## Deploy (Caso B: con migración)

Migración `202611241200_add_logistics`: **solo agrega** tablas, tipos y columnas nullable; marca como aprobados los comprobantes de pedidos ya pagos y crea la fila de configuración con la integración **apagada**. Con la integración apagada el checkout cobra como hoy y no se generan etiquetas. Lo único que cambia sin prenderla es la revisión de comprobantes (y referidos al aprobar).

1. Backup de la base (ver `deploy-produccion-digitalocean.md`).
2. Agregar las variables a `/opt/iqkids/web/.env.production` (las carga Juan):
   ```
   ANDREANI_USER=
   ANDREANI_PASSWORD=
   ANDREANI_CLIENT_NUMBER=
   ANDREANI_CONTRACT_DOMICILIO=
   ANDREANI_CONTRACT_SUCURSAL=
   # opcional: ANDREANI_ORIGIN_BRANCH= (sucursal de origen si el contrato la pide para cotizar)
   CORREO_AR_USER=
   CORREO_AR_PASSWORD=
   CORREO_AR_CUSTOMER_ID=
   # o, si no se tiene el customerId: CORREO_AR_ACCOUNT_EMAIL= y CORREO_AR_ACCOUNT_PASSWORD=
   ```
3. `git fetch origin` + `git checkout <commit>`.
4. `docker compose build app`.
5. `docker compose run --rm app npx prisma migrate deploy`.
6. `docker compose up -d app`.
7. Apps Script de la planilla de pedidos: agregar las columnas nuevas a `ORDER_COLUMNS` (copia en `docs/apps-script-pedidos.gs`) y que el "envío app" copie `logistica`, `tracking` y la etiqueta a `movements` / `movements_docs`. Script de etiquetas propias: versión que respeta `logistica` (en `C:\dev\WebIQKids\apps-scripts\etiquetas`, sin publicar).
8. En Admin > Logística: depósito, importar CP, precios de zonas y activarlas, cargar medidas de productos, revisar el estado de las credenciales. Prender transportistas y por último "Integración logística activa".

Para volver atrás: apagar "Integración logística activa" (no hace falta redeploy).

## Pendiente de validar con las credenciales reales

Los adaptadores siguen la documentación pública; antes de prender hay que probar contra las cuentas reales: login y tarifas de Andreani (nombres de campos y contrato), alta y etiqueta (con permiso de Juan: crear una y anularla), sucursales; token, `customerId`, rates, agencies e import de MiCorreo (MiCorreo no devuelve etiqueta ni seguimiento al importar; si el contrato es Paq.ar hay que adaptar).

## Prueba hecha (local, 2026-11-23)

- 172 tests unitarios OK (fecha de despacho y feriados, paquete, parsers de Andreani/Correo, payloads, mails).
- Script de punta a punta contra `next start` y un Andreani/Correo simulados, **48 de 48 OK**: opciones por CP propio e interior, precio de la API, caché, API caída con y sin cotización guardada, sucursales, sucursal inventada rechazada, comprobante → aprobar → etiqueta + planilla + confirmación, aprobar dos veces, comprobante sobre pedido pago, Andreani caído → error → cron lo resuelve sin cambiar de transportista, timeout → revisar a mano sin duplicar + seguimiento manual, rechazo y nuevo comprobante, Correo importado, reparto propio, cancelación, pago desde el admin, precio mayorista de zona, logística fija ignorada sin identificarse, integración apagada igual que antes, admin de logística (CSV, feriado, validación, permisos).
- Checkout mirado en Chrome: opciones, sucursales, precio en el resumen y fecha de despacho.
