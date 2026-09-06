# Emails automaticos

La seccion `/admin/emails` permite configurar automatizaciones de email sin enviar nada por defecto.

## Newsletter y consentimiento

La lista de newsletter es independiente de los leads de carrito y de los pedidos. Solo incluye emails que marcaron de forma opcional el consentimiento explícito en checkout o en el popup de bienvenida.

- los contactos históricos no se agregan automáticamente;
- no marcar la casilla no modifica una suscripción existente;
- el consentimiento guarda fecha, origen y versión del texto aceptado;
- desde `/admin/emails` se puede descargar `suscriptos` para revisión operativa;
- la lista no participa de `Procesar activos` ni dispara emails masivos todavía.

Antes de habilitar una automatización de newsletter se debe implementar una baja accesible dentro de cada email y mantener la lista de envíos limitada a `newsletter_subscribers` con estado `SUBSCRIBED`.

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

## Actualizacion 2026-09-05 - Aperturas y envio bonificado de recuperacion

### Aperturas detectadas

- Cada email real enviado por una automatizacion o por el popup de bienvenida recibe un pixel individual de 1x1.
- La ruta `/api/email/open/<token>` actualiza cantidad, primera y ultima apertura del envio y siempre responde una imagen transparente.
- `/admin/emails` y la auditoria muestran `Aperturas detectadas` junto a clicks y ventas atribuidas.
- Una apertura no equivale a lectura garantizada: algunos clientes bloquean imagenes y otros las precargan mediante proxy. Por eso no se usa para disparar descuentos, cobros ni cambios de estado.
- Los envios historicos conservan sus datos: no tienen token de apertura y no se inventan aperturas retroactivamente.

### Envio bonificado para recuperacion de carrito

- Se activa desde la automatizacion `CART_ABANDONED` con la opcion `Ofrecer envío bonificado`; inicia apagada para no cambiar emails existentes.
- Al activarla, se configura un mensaje propio que se muestra destacado en el email y requiere que el CTA sea exactamente `{{recoveryUrl}}`.
- Para una persona elegible el email ofrece envio bonificado y no muestra cupon. Si no califica, recibe el email normal con el cupon configurado.
- Aplica a un carrito guardado con una unica linea de producto y a un email sin compras confirmadas previas.
- El beneficio dura 72 horas y se vincula a un token aleatorio distinto del link de recuperacion.
- Antes de mostrarlo y nuevamente al crear el pedido, el servidor valida token, vencimiento, email, historial de compra y productos/cantidades exactos del carrito recuperado.
- El token se consume dentro de la misma transaccion que crea el pedido. Si ya se uso, vencio o el carrito cambio, no se crea un pedido con envio bonificado.
- No se modifica ninguna regla global de envio ni se confia en un descuento enviado por el navegador.
- Al publicar esta configuracion se invalidan unicamente beneficios no usados de la version anterior, que se otorgaban sin ser comunicados en el email. Los canjeados se conservan como auditoria.

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
