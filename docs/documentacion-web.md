# Documentacion general de la web

## Objetivo del proyecto

`IQ Kids Store` es un e-commerce propio construido para vender productos de la marca IQ Kids. La plataforma incluye:

- storefront publico
- checkout con transferencia bancaria y Mercado Pago
- panel admin para operar catalogo, pedidos, configuracion, envios y cupones
- persistencia operativa en PostgreSQL
- integraciones externas para storage, auth, analitica y sincronizacion

La aplicacion esta pensada para que el pedido exista primero en base de datos y luego se sincronice hacia sistemas externos.

## Stack principal

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Zod
- React Hook Form
- Zustand
- Mercado Pago SDK

## Estructura general

- `src/app`
  rutas App Router, layouts y API routes
- `src/components`
  componentes UI compartidos, analytics y layout
- `src/features/catalog`
  consultas y componentes del catalogo publico
- `src/features/cart`
  store del carrito y pantalla de carrito
- `src/features/checkout`
  checkout, selector de pago y flujo post compra
- `src/features/admin`
  componentes del panel admin
- `src/features/orders`
  consultas, mutaciones y servicios de pedidos, pagos y sync
- `src/features/settings`
  configuracion de tienda y envios
- `src/features/products`
  consultas y mutaciones del catalogo para admin
- `src/features/coupons`
  cupones y validacion de descuentos
- `src/features/shipping`
  persistencia de reglas de envio
- `src/lib`
  db, auth, env, utils, integraciones, storage, validaciones y helpers
- `prisma`
  schema, migraciones y seed
- `public`
  logos, placeholders y uploads locales fallback
- `docs`
  documentacion operativa

## Arquitectura funcional

La web tiene dos grandes superficies:

1. storefront publico
2. panel admin

Ademas tiene una tercera capa transversal:

- backend operativo via API routes, Prisma, storage e integraciones

## Front publico

### Rutas principales

- `/`
  home
- `/productos`
  listado de productos
- `/productos/[slug]`
  detalle de producto
- `/carrito`
  carrito persistido localmente
- `/checkout`
  carga de datos del comprador y generacion del pedido
- `/checkout/transfer/[orderNumber]`
  instrucciones de transferencia y subida de comprobante
- `/checkout/mercado-pago/[orderNumber]`
  paso intermedio para checkout de Mercado Pago
- `/checkout/mercado-pago/[orderNumber]/retorno`
  retorno desde Mercado Pago
- `/checkout/confirmacion/[orderNumber]`
  confirmacion final
- `/contacto`

### Layout global

El layout raiz:

- carga `globals.css`
- inyecta Google Analytics, Microsoft Clarity, Meta Pixel y Web Vitals si estan configurados
- consulta `store_settings`
- monta `AppChrome` con header, footer y WhatsApp flotante

Comportamientos importantes:

- en `/admin` se ocultan header y footer publicos
- en `/checkout/transfer/...` tambien se ocultan para concentrar el flujo de pago

### Header y footer

El header:

- tiene logo IQ Kids
- navega a Inicio, Productos y Contacto
- muestra el badge del carrito
- tiene menu mobile

El footer:

- muestra marca
- mensaje de marca
- enlaces a Instagram, email y WhatsApp segun configuracion

### Catalogo y producto

Los productos visibles se toman de DB filtrando:

- `active = true`
- `visible = true`

Cada producto soporta:

- nombre
- slug
- descripcion corta
- descripcion larga
- precio en ARS
- tema de color
- flags de activo, visible, destacado y sin stock manual
- multiples imagenes con orden y principal

El PDP incluye:

- galeria de imagenes
- descripcion
- selector de cantidad
- boton de agregar al carrito
- productos similares
- tracking de analytics

### Carrito

El carrito esta implementado con Zustand y persistencia en `localStorage`.

Datos por item:

- `productId`
- `quantity`

Capacidades:

- agregar producto
- aumentar/disminuir cantidad
- borrar item
- vaciar carrito

La pantalla de carrito:

- reconstruye el detalle cruzando `productId` con productos visibles actuales
- permite estimar envio por provincia
- muestra subtotal, envio estimado y total estimado

## Checkout

### Campos actuales del checkout

El formulario de checkout hoy pide:

- nombre
- apellido
- documento o DNI
- email
- telefono
- provincia
- localidad
- codigo postal
- direccion
- piso / depto
- observaciones
- cupon
- metodo de pago

Tambien envia:

- `checkoutRequestKey`
- `items`

### Reglas actuales

- el pedido se crea solo si la tienda esta abierta
- el backend hoy exige DNI para continuar
- solo se pueden comprar productos activos, visibles y no marcados como sin stock manual
- el metodo de pago disponible depende de `store_settings`
- el descuento por transferencia depende de `store_settings`
- el descuento por cupon aplica sobre subtotal, no sobre envio

### Pricing

En el total intervienen:

- subtotal de items
- descuento por cupon
- envio
- descuento por transferencia

Campos persistidos en orden:

- `subtotal_ars`
- `discount_ars`
- `shipping_ars`
- `payment_method_discount_ars`
- `total_ars`

### Metodos de pago

#### Transferencia bancaria

Flujo:

1. cliente completa checkout
2. se crea el pedido
3. se redirige a `/checkout/transfer/[orderNumber]`
4. ve monto y alias bancario
5. sube comprobante
6. el pedido pasa a `PROOF_UPLOADED`

El formulario actual de comprobante es simple:

- archivo JPG, PNG o PDF

Aunque el schema soporta mas datos, hoy desde UI no se envian:

- fecha de transferencia
- referencia
- nota del cliente
- nombre del emisor

#### Mercado Pago

Flujo:

1. cliente completa checkout
2. se crea el pedido
3. se crea una preferencia server-side
4. se redirige a Checkout Pro
5. el retorno acelera feedback al usuario
6. el webhook confirma el estado real del pago

Se persisten:

- preferencia
- pagos informados por MP
- eventos de webhook
- estado provider
- referencia de pago

## Panel admin

El panel admin es una parte central del sistema. Desde ahi el cliente opera la tienda.

### Navegacion principal

- `/admin`
  dashboard
- `/admin/productos`
  catalogo
- `/admin/configuracion`
  configuracion general
- `/admin/cupones`
  cupones
- `/admin/envios`
  envios
- `/admin/pedidos`
  pedidos
- `/admin/sync`
  sincronizacion externa

### Acceso admin

El acceso puede funcionar por:

- Supabase Auth
- auth local
- bypass local de desarrollo

El middleware protege `/admin/*` salvo `/admin/login`.

### Dashboard

El dashboard muestra:

- pedidos totales
- pedidos pendientes
- sync pendiente o con error
- productos activos
- ultimos pedidos

Es una vista rapida de operacion.

### Productos

El cliente puede:

- listar productos
- crear producto
- editar producto
- desactivar producto
- subir imagenes
- marcar imagen principal
- editar `alt text`
- ordenar imagenes segun su posicion en la lista cargada

Campos editables:

- nombre
- slug
- precio
- color theme
- orden
- activo
- visible
- sin stock manual
- destacado
- descripcion corta
- descripcion larga
- imagenes

La desactivacion no borra el producto. Solo fuerza:

- `active = false`
- `visible = false`

### Configuracion

Desde configuracion el cliente puede editar:

- nombre de tienda
- WhatsApp
- Instagram
- email
- alias bancario
- CBU
- banco
- titular
- CUIT
- monto minimo
- envio gratis desde
- costo fijo de envio
- modo de envio
- regla activa de envio
- horas de reserva del pedido
- solicitar DNI / CUIT
- mostrar WhatsApp flotante
- tienda abierta
- mensaje del checkout
- instrucciones de transferencia
- medios de pago habilitados
- descuento por transferencia
- banner institucional
- mensaje final de compra confirmada

Esto impacta de forma directa en storefront y checkout.

### Envios

La seccion de envios permite editar una regla de envio.

Capacidades:

- nombre
- descripcion
- modo
- precio fijo
- activa / por defecto
- precio por provincia
- activar o desactivar cada provincia

Observacion importante:

- el modelo soporta multiples reglas de envio
- la UI actual trabaja efectivamente sobre la primera regla disponible
- no hay aun una UX completa para administrar muchas reglas de manera avanzada

### Cupones

El cliente puede:

- crear cupon
- editar cupon
- activar o pausar cupon
- eliminar cupon

Campos:

- codigo
- descripcion interna
- porcentaje de descuento
- activo

### Pedidos

La lista de pedidos permite:

- ver pedidos
- filtrar por fecha desde / hasta
- exportar

Cada fila muestra:

- numero de pedido
- cliente
- estado del pedido
- estado del pago
- medio de pago
- estado provider
- comprobante cargado o pendiente
- sync
- total

### Detalle de pedido

Es una de las pantallas mas importantes del backoffice.

El cliente puede ver:

- datos completos del cliente
- documento / DNI
- direccion
- items del pedido
- subtotal, descuentos, envio y total
- estado del pedido
- estado del pago
- sync status
- metodo de pago y provider
- referencia del provider
- comprobante
- datos de Mercado Pago
- historial de estados

Tambien puede ejecutar acciones:

- cambiar estado manual del pedido
- guardar nota interna junto al cambio de estado
- reintentar sync externo

Si el pedido es por transferencia:

- puede abrir y previsualizar el comprobante

Si el pedido es por Mercado Pago:

- ve preferencia
- ultimo pago registrado
- ultimo webhook registrado

### Sync

La seccion sync muestra:

- jobs de sincronizacion
- provider
- estado
- cantidad de intentos
- ultimo error
- ultimos logs

Sirve para soporte operativo y debugging.

## Base de datos

### Entidades principales

- `admin_users`
- `products`
- `product_images`
- `shipping_rules`
- `shipping_rule_provinces`
- `store_settings`
- `coupons`
- `orders`
- `order_items`
- `order_status_history`
- `payment_proofs`
- `sync_jobs`
- `sync_logs`
- `mercado_pago_preferences`
- `mercado_pago_payments`
- `payment_webhook_events`

### Productos

`products` guarda:

- nombre
- slug unico
- descripciones
- precio
- color theme
- flags operativos
- orden

`product_images` guarda:

- path de storage
- URL publica
- `alt_text`
- orden
- principal o no

### Configuracion

`store_settings` es un registro singleton con id `default`.

Contiene:

- branding y contacto
- datos bancarios
- configuracion de envio
- mensajes de checkout
- toggles de pago
- descuento por transferencia
- reserva de pedidos
- banner institucional
- mensaje de compra
- flags de tienda abierta, WhatsApp flotante y requerimiento de DNI

### Pedidos

`orders` guarda snapshot del checkout y del estado operativo:

- numero publico de pedido
- datos del cliente
- direccion
- cupon y descuentos
- subtotal, envio y total
- medio de pago
- provider de pago
- estado de pago
- estado del pedido
- estado de sync
- referencia de pago
- fecha de pago
- expiracion de reserva

`order_items` guarda:

- producto referenciado si sigue existiendo
- snapshot de nombre
- precio unitario
- cantidad
- subtotal por linea

`order_status_history` registra:

- status
- nota
- quien lo cambio
- fecha

### Comprobantes

`payment_proofs` guarda:

- storage path
- URL publica opcional
- nombre de archivo
- peso
- MIME type
- datos de transferencia si existen

### Integracion con Mercado Pago

`mercado_pago_preferences` guarda:

- preference id
- external reference
- URLs de inicio
- vencimiento

`mercado_pago_payments` guarda:

- payment id
- merchant order id
- preference id
- status y status detail
- monto
- payer email
- fechas
- raw data

`payment_webhook_events` guarda:

- webhook event id
- topic
- action
- resource id
- request id
- firma
- payload
- estado de procesamiento
- error si fallo

### Sync externo

`sync_jobs` guarda:

- provider
- estado
- intentos
- proximo retry
- ultimo error
- snapshot del payload

`sync_logs` guarda:

- intento
- request payload
- response payload
- resultado
- error

## Integraciones externas

### Supabase Auth

Uso:

- autenticar admin
- resolver sesion server-side

Modos soportados:

- Supabase real
- auth local
- bypass dev

### Supabase Storage

Uso:

- imagenes de producto
- comprobantes de pago

Buckets esperados:

- productos
- comprobantes

Fallback:

- si no hay credenciales admin reales, se escribe en `public/uploads`

### Mercado Pago

Uso:

- Checkout Pro
- confirmacion de pago por webhook

Consideraciones:

- el retorno del navegador no es la fuente final de verdad
- el webhook es el cierre real del pago

### Sync a sistemas externos

Providers disponibles:

- `mock`
- `apps_script`
- `google_sheets`

Estado actual:

- `apps_script` esta operativo
- `google_sheets` esta preparado pero no implementado de punta a punta

### Analitica

Integraciones actuales:

- Google Analytics
- Microsoft Clarity
- Meta Pixel
- Meta Conversions API

Eventos relevantes:

- vista de producto
- view cart
- begin checkout
- add payment info
- purchase

## API routes principales

### Publicas

- `POST /api/orders`
  crea pedido desde checkout
- `POST /api/orders/[orderNumber]/proof`
  sube comprobante
- `POST /api/orders/[orderNumber]/sync`
  reintenta sync
- `POST /api/coupons/validate`
  valida cupon
- `POST /api/payments/mercadopago/webhook`
  procesa webhook de MP

### Admin

- `POST /api/admin/products`
  crea producto
- `PATCH /api/admin/products/[id]`
  edita producto
- `DELETE /api/admin/products/[id]`
  desactiva producto
- `POST /api/admin/upload/product-image`
  sube imagen de producto
- `PATCH /api/admin/settings`
  actualiza configuracion de tienda
- `PATCH /api/admin/shipping-rules/[id]`
  actualiza regla de envio
- `POST /api/admin/coupons`
  crea cupon
- `PATCH /api/admin/coupons/[id]`
  edita cupon
- `DELETE /api/admin/coupons/[id]`
  elimina cupon
- `PATCH /api/admin/orders/[id]/status`
  cambia estado del pedido
- `GET /api/admin/export/orders`
  exporta pedidos

## Reglas de negocio importantes

- el pedido siempre se guarda primero en DB
- sync externo puede fallar sin perder el pedido
- transferencia y Mercado Pago conviven
- el webhook de Mercado Pago es idempotente
- la tienda puede cerrarse desde admin
- el checkout depende de `store_settings`
- el panel admin es el punto central de configuracion del negocio

## Limitaciones y observaciones actuales

- el schema de comprobante soporta mas metadata que la UI actual no pide
- la opcion `requireTaxId` existe en settings, pero hoy el backend pide DNI de todas maneras
- la UI de envios no explota completamente el soporte multi-regla del modelo
- el provider `google_sheets` aun no esta implementado
- varios textos tienen artefactos de encoding heredados en algunos archivos ya existentes

## Impacto para futuros ajustes de front

Si se hace un rediseÃ±o grande, hay que pensar al menos en tres bloques separados:

1. storefront publico
2. checkout y post-checkout
3. panel admin operativo

Los puntos mas sensibles para no romper operacion son:

- checkout
- pantalla de transferencia
- configuracion
- productos
- detalle de pedido
- sync

## Archivos de referencia clave

- [README.md](/abs/path/c:/dev/WebCodigo/README.md)
- [prisma/schema.prisma](/abs/path/c:/dev/WebCodigo/prisma/schema.prisma)
- [src/app/layout.tsx](/abs/path/c:/dev/WebCodigo/src/app/layout.tsx)
- [src/app/checkout/page.tsx](/abs/path/c:/dev/WebCodigo/src/app/checkout/page.tsx)
- [src/features/orders/services/order-service.ts](/abs/path/c:/dev/WebCodigo/src/features/orders/services/order-service.ts)
- [src/features/orders/services/mercado-pago-service.ts](/abs/path/c:/dev/WebCodigo/src/features/orders/services/mercado-pago-service.ts)
- [src/app/admin/page.tsx](/abs/path/c:/dev/WebCodigo/src/app/admin/page.tsx)
- [src/app/admin/pedidos/[id]/page.tsx](/abs/path/c:/dev/WebCodigo/src/app/admin/pedidos/[id]/page.tsx)
- [src/features/admin/components/settings-form.tsx](/abs/path/c:/dev/WebCodigo/src/features/admin/components/settings-form.tsx)
- [src/features/admin/components/product-form.tsx](/abs/path/c:/dev/WebCodigo/src/features/admin/components/product-form.tsx)

## Actualizacion 2026-08-28 - Popup de bienvenida y captura temprana de email

### Home y captacion temprana

- el home ahora puede mostrar un popup de bienvenida con delay de 800 ms
- el popup se muestra solo en `/`
- si la persona ya lo vio o ya dejo su email, no vuelve a mostrarse por 30 dias en ese navegador
- el estado del popup y el email capturado se guardan en `localStorage`

### Cupón de bienvenida

- el cupón del popup se administra desde `/admin/cupones`
- solo un cupón activo puede quedar marcado para el popup de bienvenida a la vez
- esa marca se resuelve sin migracion nueva, reutilizando la descripcion interna del cupón con un marcador tecnico controlado desde la UI admin

### Lead previo al carrito

- cuando una persona deja su email en el popup, se crea o reaprovecha un `cart_recovery_lead` con estado `WELCOME_CAPTURED`
- ese estado representa una etapa anterior al carrito
- si luego la misma persona deja email en carrito, el lead temprano puede evolucionar al flujo existente `CAPTURED`, `CHECKOUT_STARTED` y `CONVERTED`

### Email inmediato y automatizaciones

- al capturar el email desde home se intenta enviar de inmediato un email con el cupón usando el proveedor actual configurado
- si el proveedor no esta listo, el popup igual muestra el codigo en pantalla para no cortar la UX
- el modulo de emails admin y el motor de automatizaciones contemplan tambien el trigger `WELCOME_LEAD`
