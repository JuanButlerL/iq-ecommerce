# Emails automaticos

La seccion `/admin/emails` permite configurar automatizaciones de email sin enviar nada por defecto.

## Variables de entorno

Para habilitar envios reales en produccion hay dos opciones soportadas.

### Opcion A: Resend

```env
EMAIL_SENDING_ENABLED=true
EMAIL_PROVIDER=resend
EMAIL_FROM_DEFAULT=no-reply@iqkids.com.ar
EMAIL_REPLY_TO_DEFAULT=hola@iqkids.com.ar
EMAIL_CRON_SECRET=<token-largo-seguro>
RESEND_API_KEY=<api-key-resend>
```

### Opcion B: SMTP generico

```env
EMAIL_SENDING_ENABLED=true
EMAIL_PROVIDER=smtp
EMAIL_FROM_DEFAULT=no-reply@iqkids.com.ar
EMAIL_REPLY_TO_DEFAULT=hola@iqkids.com.ar
EMAIL_CRON_SECRET=<token-largo-seguro>
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<usuario-smtp>
SMTP_PASSWORD=<password-smtp>
```

Para usar `no-reply@iqkids.com.ar`, el dominio tiene que estar autorizado en el proveedor elegido y con DNS configurado: SPF, DKIM y DMARC. No hace falta Google ni Zoho, pero si hace falta un proveedor de envio real.

## Cron

El endpoint protegido es:

```bash
curl -X POST https://iqkids.com.ar/api/cron/email-automations \
  -H "Authorization: Bearer $EMAIL_CRON_SECRET"
```

Puede ejecutarse cada 15 o 30 minutos. Si `EMAIL_SENDING_ENABLED=false`, el admin permite configurar plantillas pero no enviar.

## Auditoria y copia oculta

En `/admin/emails` hay una tabla de auditoria con filtros por fecha. Muestra envios, omitidos y errores con fecha y hora Argentina, email destinatario, automatizacion, disparador, fecha de inicio del evento y detalle del objetivo.

Cada automatizacion puede tener una copia oculta (`BCC`) desde `Remitente avanzado`. Sirve para monitorear los primeros envios sin exponer esa casilla al cliente.

## Automatizaciones iniciales

La migracion crea tres plantillas pausadas:

- Recuperacion sin compra: usa `{{recoveryUrl}}` para volver al carrito.
- Pedido recibido: usa `{{orderUrl}}`.
- Recompra 15 dias: usa `{{siteUrl}}/#productos`.

El sistema evita duplicados por automatizacion y objetivo.

## Como funciona cada disparador

- Recuperacion sin compra: empieza cuando una persona deja su email en el carrito. Si avanza a checkout o genera pedido pero no paga ni sube comprobante, sigue entrando en esta recuperacion. Espera la demora configurada y antes de enviar revisa si ese mismo email tuvo una compra confirmada posterior; si compro, omite el email.
- Pedido recibido: empieza cuando se genera el pedido al finalizar el checkout. Sirve para confirmar recepcion del pedido, aunque el pago todavia pueda estar pendiente.
- Post compra: empieza solo cuando hay compra real, es decir pago aprobado por Mercado Pago o comprobante de transferencia subido. La demora corre desde ese momento.

## CTA dinamico de carrito

En automatizaciones de `Carrito abandonado`, el CTA debe usar:

```text
{{recoveryUrl}}
```

Esa variable se reemplaza en cada envio por una URL unica del tipo:

```text
https://iqkids.com.ar/carrito?recuperar=<token>
```

Cuando el cliente abre ese link, el carrito se reconstruye con los mismos productos y cantidades guardadas.

## Actualizacion 2026-08-28 - Trigger WELCOME_LEAD

Se agrego soporte operativo para una etapa anterior al carrito:

- `WELCOME_LEAD`
  nace cuando una persona deja su email en el popup del home

Variables utiles para este trigger:

- `{{siteUrl}}`
- `{{email}}`

Este trigger convive con:

- `CART_ABANDONED`
- `ORDER_CREATED`
- `POST_PURCHASE`

Importante:

- el email inmediato del popup puede salir sin esperar cron
- `WELCOME_LEAD` queda disponible para automatizaciones futuras o recordatorios tempranos desde admin
- cuando ese mismo email luego deja carrito, el caso puede pasar al ciclo normal de recuperacion
