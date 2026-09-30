# Emails automaticos

## Hotfix Post compra 2026-09-22

Post compra requiere un corte adicional explícito `EMAIL_POST_PURCHASE_SEND_FROM`
en UTC. Sin él queda bloqueado; no libera pendientes históricos al desplegar.
Los pedidos con cualquier log previo de esa automatización se excluyen antes del
límite. Errores y reservas persistentes requieren conciliación manual, sin reintento
automático. Ver [diagnóstico y publicación segura](hotfix-post-compra.md).

La seccion `/admin/emails` permite configurar automatizaciones de email sin enviar nada por defecto.

## Newsletter y consentimiento

La lista de newsletter es independiente de los leads de carrito y de los pedidos. Solo incluye emails que marcaron de forma opcional el consentimiento explícito en checkout o en el popup de bienvenida.

- los contactos históricos no se agregan automáticamente;
- no marcar la casilla no modifica una suscripción existente;
- el consentimiento guarda fecha, origen y versión del texto aceptado;
- desde `/admin/emails` se puede descargar `suscriptos` para revisión operativa;
- la lista no participa de `Procesar activos`; los envíos masivos se hacen solo desde el módulo Newsletter (ver abajo).

Cada email real incluye un enlace individual de baja. Al usarlo, la dirección queda bloqueada globalmente para las automatizaciones y para el email inmediato del popup. La baja no borra pedidos ni datos del cliente y se puede aplicar también desde el bloque `Baja manual` de `/admin/emails`.

La baja se consulta antes de enviar al proveedor. En Auditoría queda un registro `OMITIDO` con el motivo, por lo que es verificable y no depende de pausar una automatización.

## Newsletter

Desde `/admin/newsletter` se crean ediciones por bloques que se publican en `/newsletter` y se envían por mail a la lista de suscriptos (`newsletter_subscribers` en estado `SUBSCRIBED`: consentimiento explícito del pop-up, del checkout o de la página de newsletter). Mostrar en la web y enviar por mail son independientes.

### Contenido editorial

Cada edición se arma con bloques: título de sección, párrafo (con **negrita**, *cursiva* y [links](https://...)), imagen, imagen + texto, galería, cita (con cargo y color), botón (con nota y color), producto destacado, caja destacada, datos (2 o 3 cifras), lista de pasos (número, ✓ o ✗), testimonio (con foto opcional o tomado de los testimonios cargados), fuentes y separador. No se admite HTML libre: todo se valida y se renderiza igual en la web y en el mail, con la identidad de la tienda.

Campos por edición: categoría (arriba del título), frase del encabezado del mail y notas internas (solo admin, nunca se publican ni envían, y editarlas no invalida la prueba).

**Importar HTML**: en `/admin/newsletter`, el botón "Importar HTML" lee archivos con el formato de secuencia de la agencia (un `.email-view` por email) y crea cada email como borrador. Las fotos sugeridas, links `#` reemplazados y notas de implementación quedan en las notas internas. No publica ni programa nada.

### Llaves de seguridad

Un mail de newsletter sale solo si se cumplen todas:

1. `NEWSLETTER_SENDING_ENABLED=true` (por defecto `false`).
2. `EMAIL_SENDING_ENABLED=true` y un proveedor configurado.
3. La newsletter tiene una prueba enviada con el contenido exacto actual (si se edita, hay que volver a probar).
4. Un admin la aprobó escribiendo `ENVIAR`, viendo la cantidad de destinatarios.
5. Fuera de producción solo la reciben las casillas de prueba; el resto queda `OMITIDO`.

### Cómo se envía

- El cron `POST /api/cron/newsletters` (mismo `EMAIL_CRON_SECRET`, separado del de automatizaciones) toma las newsletters programadas vencidas.
- Al empezar congela el mail (asunto, HTML, links) y crea una fila por destinatario. El índice único `newsletter + email` impide que alguien reciba la misma newsletter dos veces, incluso si se reenvía o hay dos crons en paralelo.
- Cada fila se reserva (`PENDIENTE` → `A CONCILIAR`) con una actualización condicional antes de llamar al proveedor; al terminar queda `ENVIADO` o `ERROR`.
- Envía por tandas (`NEWSLETTER_BATCH_SIZE`, 40 por defecto) a ~2 mails por segundo, respetando el máximo diario configurado en el admin. Ese máximo cuenta también los mails automáticos, porque comparten el cupo del proveedor (Resend gratis: 100 por día).
- Se chequea la baja antes de cada mail.

### Frenos automáticos (quedan en "Requiere revisión", sin enviar)

- La fecha programada se pasó por más de `NEWSLETTER_LATE_MARGIN_HOURS` (12 h por defecto), por ejemplo si el servidor o el cron estuvieron caídos.
- La audiencia actual supera en más de 20% (+5) a la cantidad aprobada.
- No hay destinatarios pendientes.

### Errores y conciliación

No hay reintentos automáticos. Un `ERROR` se puede reintentar una sola vez desde `/admin/newsletter/<id>/envios`. Un envío "A conciliar" significa que no se sabe si el proveedor lo aceptó: buscarlo en Resend y marcarlo como enviado o no enviado. Nunca borrar filas ni cambiar estados por SQL.

### Envío a nuevos suscriptos

Cuando una newsletter terminó, "Enviar a N nuevos" la manda solo a quienes todavía no tienen una fila para esa newsletter, con el mismo mail congelado.

### Tracking y baja

Rutas propias: `/api/newsletter/open/<token>`, `/api/newsletter/click/<token>?l=N` (solo redirige a links del mail enviado) y `/api/newsletter/unsubscribe/<token>` (GET y POST de un clic con `List-Unsubscribe`). La baja es la misma baja global de las automatizaciones. Los links al sitio llevan `utm_source=newsletter&utm_medium=email&utm_campaign=<slug>`, así las ventas se ven en la atribución de marketing.

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

## Corte de activacion

Al activar una automatizacion, el sistema guarda su fecha y hora de activacion. Solo procesa eventos ocurridos desde ese momento: nunca recorre pedidos, compras, carritos o capturas historicas al encender una plantilla.

Pausar y volver a activar una automatizacion crea un corte nuevo. Editar una automatizacion que ya esta activa conserva su corte actual.

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
