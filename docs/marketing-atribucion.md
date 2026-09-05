# Atribucion y trazabilidad de marketing

## Objetivo

Esta capa existe para responder tres preguntas de negocio:

- como llego una persona a la web
- en que punto dejo su email o compro
- que secuencia de impactos tuvo antes de comprar o recomprar

No reemplaza Google Analytics, Meta ni Mercado Pago. Los complementa con una trazabilidad propia dentro de la base de datos del e-commerce.

## Que registra la web

La web guarda dos piezas principales:

- `marketing_sessions`
  representa una sesion de navegacion con su origen
- `marketing_events`
  representa hitos del funnel dentro de esa sesion

Ademas, `orders` y `cart_recovery_leads` guardan referencia a la sesion y al visitante para no perder continuidad entre home, carrito y compra.

## Que datos de origen se guardan

Cuando una persona entra a la web, el sistema intenta guardar:

- categoria macro de origen
  ejemplo: `META`, `GOOGLE`, `ORGANIC`, `DIRECT`, `EMAIL`, `WHATSAPP`, `REFERRAL`
- plataforma
  ejemplo: `INSTAGRAM`, `FACEBOOK`, `THREADS`, `GOOGLE`, `YOUTUBE`, `TIKTOK`
- canal y etiqueta legible
  ejemplo: `Paid Social`, `Instagram Ads`, `Google Ads`, `Direct`
- UTM
  `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- click ids si existen
  `gclid`, `fbclid`, `ttclid`, `msclkid`
- pagina de entrada, querystring y referrer

## Como clasifica el origen

La clasificacion sigue esta idea:

1. si hay UTMs o click ids confiables, se prioriza esa informacion. `fbclid` solo no alcanza para asumir pauta Meta.
2. si no hay UTMs, se analiza el referrer
3. si no hay referrer util, queda como `DIRECT`

Ejemplos:

- `utm_source=meta` con `utm_medium=paid_social`
  se clasifica como `META`
- `utm_source=google` con `utm_medium=cpc` o `gclid`
  se clasifica como `GOOGLE`
- entrada desde resultados organicos de Google sin UTMs
  se clasifica como `ORGANIC`
- entrada desde Instagram bio o link sin UTMs de pauta
  se clasifica como tráfico orgánico de Instagram
- entrada sin UTMs ni referrer
  queda como `DIRECT`

## Guia rapida de categorias, canales y etiquetas

### Categorias macro de origen

- `META`
  agrupa tráfico pago del ecosistema Meta con señal explícita de pauta.
  Ejemplo: anuncio de Instagram Ads con `utm_source=meta&utm_medium=paid_social`.
- `GOOGLE`
  agrupa tráfico pago proveniente de Google con señal explícita de pauta.
  Ejemplo: campaña de Search o Performance Max con `utm_source=google` o `gclid`.
- `ORGANIC`
  agrupa trafico no pago detectado desde buscadores o descubrimiento organico.
  Ejemplo: una persona entra desde resultados organicos de Google sin UTMs.
- `DIRECT`
  agrupa entradas sin UTMs ni referrer util.
  Ejemplo: alguien escribe `iqkids.com.ar` directo, entra desde favoritos o desde una app que no pasa referrer.
- `EMAIL`
  agrupa trafico proveniente de emails de marketing o automatizaciones bien etiquetadas.
  Ejemplo: newsletter con `utm_source=email`.
- `WHATSAPP`
  agrupa trafico que llega desde WhatsApp o links compartidos por ese canal.
  Ejemplo: link enviado por difusión o atención comercial con UTMs o referrer de WhatsApp.
- `REFERRAL`
  agrupa trafico desde otros sitios o redes cuando no entra mejor en otra categoria.
  Ejemplo: un blog, una nota, un link en bio o una colaboración externa.
- `TIKTOK`
  agrupa trafico etiquetado o detectado desde TikTok.
  Ejemplo: campaña con `utm_source=tiktok` o click id asociado.
- `OTHER`
  queda como cajón de sastre cuando hay una señal valida pero no entra en una regla más clara.

### Plataformas y que significan

- `INSTAGRAM`
  trafico detectado o etiquetado desde Instagram.
- `FACEBOOK`
  trafico detectado o etiquetado desde Facebook.
- `THREADS`
  trafico detectado o etiquetado desde Threads.
- `GOOGLE`
  trafico detectado o etiquetado desde Google.
- `YOUTUBE`
  trafico detectado o etiquetado desde YouTube.
- `TIKTOK`
  trafico detectado o etiquetado desde TikTok.
- `WHATSAPP`
  trafico detectado o etiquetado desde WhatsApp.
- `EMAIL`
  trafico detectado o etiquetado desde email.
- `REFERRAL`
  trafico desde otro sitio sin plataforma mas especifica.
- `DIRECT`
  sin plataforma identificable.
- `OTHER`
  plataforma detectada pero no normalizada todavia.

### Canal y etiqueta legible

`sourceChannel` es una version operativa del tipo de trafico. `sourceLabel` es la forma mas amigable de mostrarlo en admin o export.

Ejemplos tipicos:

- canal `Paid Social`
  etiqueta legible: `Instagram Ads` o `Facebook Ads`
  cuando hace sentido: campañas pagas de Meta
- canal `Paid Search`
  etiqueta legible: `Google Ads`
  cuando hace sentido: Search, Shopping o Performance Max etiquetado como Google pago
- canal `Organic Search`
  etiqueta legible: `Google Organic`
  cuando hace sentido: trafico organico desde buscador
- canal `Email`
  etiqueta legible: `Email Marketing`
  cuando hace sentido: newsletter, flows o automatizaciones con UTM correcta
- canal `Referral`
  etiqueta legible: `Instagram Referral`, `WhatsApp Referral` o el host detectado
  cuando hace sentido: links compartidos o trafico desde otras webs sin mejor clasificacion
- canal `Direct`
  etiqueta legible: `Direct`
  cuando hace sentido: no hay rastro de origen mas preciso

### Casos que suelen generar dudas

- `META` no significa siempre Instagram.
  Puede ser Instagram, Facebook o Threads segun la plataforma detectada.
- `REFERRAL` no significa necesariamente organico.
  Solo indica que llego desde otro sitio o app y no hubo una senal mas fuerte de campaña.
- `DIRECT` no siempre es trafico “puro”.
  A veces es una visita desde apps o entornos que no comparten referrer.
- `ORGANIC` y `GOOGLE` no son lo mismo.
  `ORGANIC` es busqueda no paga; `GOOGLE` suele reservarse para trafico pago o etiquetado directamente como tal.
- `EMAIL` conviene usarlo solo cuando las campañas salen con UTM consistente.
  Si no, parte de ese trafico puede caer como `DIRECT` o `REFERRAL`.

## Eventos del funnel

Hoy se registran estos hitos:

- `SESSION_STARTED`
  inicio de sesion
- `POPUP_CAPTURED`
  el usuario dejo su email en el popup de bienvenida
- `CART_CAPTURED`
  el usuario dejo su email en carrito
- `ORDER_CREATED`
  se genero el pedido
- `ORDER_CONFIRMED`
  el pedido quedo pago o confirmado

## Logica de continuidad

### 1. Sesion anonima

La persona puede navegar sin dejar email. En ese momento igual queda registrada la sesion con su origen y un `visitorId`.

### 2. Captura de email

Cuando el usuario deja su email en popup o carrito, esa sesion queda asociada al email.

Ademas, el sistema retrovincula al mismo email las sesiones anonimas previas del mismo `visitorId`. Esto evita perder la primera visita si el usuario se identifica mas tarde.

### 3. Pedido y compra

Cuando se crea un pedido o luego se confirma el pago, el pedido conserva referencia a la sesion de marketing y al visitante. Eso permite reconstruir el camino entre ingreso, captura y conversion.

## Como se interpreta la trazabilidad

### First touch

Es la primera sesion conocida asociada a ese email.

Sirve para responder:

- de donde llego por primera vez
- que campaña lo capto originalmente

### Last touch

Es la ultima sesion conocida antes del evento que se esta mirando.

Sirve para responder:

- que origen empujo la conversion mas reciente
- que campaña fue la ultima influencia detectada

### First paid touch

Es la primera sesion paga detectada para ese email.

Sirve para diferenciar captacion paga contra entrada organica o directa.

### Last paid touch

Es la ultima sesion paga detectada antes de la compra o del recorte analizado.

Sirve para saber cual fue la ultima campaña paga que participo.

### Assisted campaigns

Son las campañas intermedias o complementarias que aparecieron en la historia del usuario.

No significan necesariamente que cerraron la venta, pero si que participaron en el recorrido.

### Journey summary

Es un resumen textual de la secuencia de sesiones conocidas.

Ejemplo conceptual:

`Meta / Campaña A -> Direct -> Email -> Google / Brand`

## Como analiza una compra

Para cada pedido, el sistema toma solo las sesiones del mismo email ocurridas hasta la fecha de ese pedido.

Con eso arma:

- primer touch de esa compra
- ultimo touch de esa compra
- primer paid touch
- ultimo paid touch
- campañas asistidas
- touchpoints totales
- journey hasta ese pedido

Esto es importante porque evita contaminar un pedido viejo con sesiones que ocurrieron despues.

## Recompra

La recompra se mide sobre clientes con mas de una compra confirmada.

La vista de marketing muestra:

- clientes unicos
- clientes con recompra
- porcentaje de recompra
- facturacion asociada a recompra

## Que ve marketing en admin

Ruta:

- `/admin/marketing`

La pantalla muestra:

- resumen ejecutivo
- rendimiento por origen
- top de campañas
- base accionable de contactos
- ultimos pedidos con primer y ultimo touch

Tambien permite filtrar por:

- fecha
- categoria
- plataforma
- texto libre
- solo recompra

## Que se puede exportar

### Export de atribucion de marketing

Ruta:

- `/api/admin/export/marketing-attribution`

Sirve para descargar la base filtrada de contactos, eventos y compras para trabajo analitico.

### Export de pedidos

Ruta:

- `/api/admin/export/orders`

Ahora agrega columnas de trazabilidad como:

- origen ultimo
- UTM source, medium, campaign, term y content
- primer touch
- ultimo touch
- primer paid touch
- ultimo paid touch
- campañas asistidas
- plataformas asistidas
- origenes asistidos
- touchpoints
- primer ingreso y ultimo ingreso
- journey marketing

## Alcance y limites

Este sistema ayuda mucho a leer la historia comercial real dentro de la web, pero tiene limites:

- si el usuario cambia de navegador o dispositivo y no deja email, la continuidad puede perderse
- si una plataforma no envia UTMs ni referrer util, la clasificacion puede quedar mas generica
- no reemplaza la atribucion propia de Meta, Google o GA4; la complementa
- la calidad del analisis mejora mucho cuando las campañas salen con UTMs consistentes

## Recomendacion operativa para marketing

Usar siempre UTMs consistentes, por ejemplo:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`

Ejemplo de Meta:

`utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}`

Cuanto mejor salga etiquetado el trafico, mejor va a quedar la lectura en admin y export.

## Reglas vigentes de lectura

- `fbclid` por sí solo no prueba que una visita sea pauta: Meta también lo agrega a enlaces orgánicos. Para clasificar Meta como pago se exige un `utm_medium` pago, como `paid_social`, o una fuente explícitamente marcada como ads/paga.
- el panel abre por defecto en los últimos 30 días para que la lectura sea ágil y comparable. El equipo puede ampliar el período desde los filtros.
- cada compra se atribuye solo con las sesiones registradas hasta la creación de ese pedido. Una visita posterior no puede cambiar su atribución histórica.
- una venta atribuida no equivale a ROAS o CPA. Para esos indicadores hay que cruzar este reporte con el gasto real de cada plataforma.

## Lectura recomendada del panel

La pantalla `/admin/marketing` prioriza cuatro decisiones:

1. embudo: sesiones, emails captados, pedidos creados y compras confirmadas;
2. canales: comparar Meta, Google y el resto por volumen, conversión e ingreso atribuido;
3. campañas para escalar: campañas con compras e ingreso atribuido;
4. campañas para revisar: campañas con al menos cinco sesiones y ninguna compra atribuida.

Los detalles completos no se fuerzan en pantalla móvil. Se descargan desde:

- `Ventas atribuidas`: una fila por compra confirmada con la atribución, first/last touch, canales pagos, asistencias y recorrido previo;
- `Contactos y embudo`: una fila por email con su historia de captación, compras y eventos relevantes.

## Convención UTM obligatoria para pauta

Meta:

`utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}`

Google:

`utm_source=google&utm_medium=cpc&utm_campaign={{campaignname}}&utm_term={{keyword}}&utm_content={{creative}}`

Sin esas etiquetas, el sistema conserva lo que detecta, pero no puede asegurar campaña, conjunto, anuncio ni separar con fiabilidad una visita orgánica de una paga sin señal explícita.

## Conciliacion con Google Ads y GA4

No se deben comparar directamente las compras confirmadas totales de IQ Kids con las conversiones atribuidas a Google Ads:

- `Compras confirmadas` de la web incluye todas las fuentes: Google, Meta, organico, directo, email y referidos.
- `Google Ads` solo debe mostrar conversiones a las que Google atribuye un contacto publicitario segun su propia ventana y modelo de atribucion.
- Para contrastar correctamente, usar el mismo rango horario, zona horaria, definicion de conversion y moneda; luego comparar el subconjunto `GOOGLE / Google Ads` del export de ventas atribuidas contra Google Ads, no el total de la tienda.

La web envia `purchase` de navegador para pagos `PAID` y transferencias con comprobante `PROOF_UPLOADED`, usando el numero publico del pedido como `transaction_id`.

Para no perder pagos confirmados por webhook cuando la persona no vuelve a la pantalla final, existe soporte opcional para GA4 Measurement Protocol:

- variable privada: `GA_MEASUREMENT_PROTOCOL_API_SECRET`
- requiere que `NEXT_PUBLIC_GA_MEASUREMENT_ID` corresponda al mismo stream
- se asocia al `client_id` real de GA4 capturado durante checkout
- usa el mismo `transaction_id`, por lo que GA4 deduplica la version de navegador y la version servidor
- no altera pedidos ni pagos si la variable no esta configurada; simplemente no envia el evento servidor
