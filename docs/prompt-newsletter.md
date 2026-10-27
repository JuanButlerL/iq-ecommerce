# Prompt de ejecucion: modulo Newsletter (web publica + admin + envio por email)

## Antes de tocar nada

1. Leer completos:
   - `docs/codex-contexto-operativo.md`
   - `docs/documentacion-web.md`
   - `docs/email-automations.md`
   - `docs/hotfix-post-compra.md` (patron de reserva anti-duplicado que hay que replicar)
   - `docs/deploy-produccion-digitalocean.md`
   - `prisma/schema.prisma`
   - `src/features/email/*` (provider, render, newsletter-service, automation-service)
   - `src/features/marketing/welcome-popup.ts`
   - `src/app/preguntas-frecuentes/page.tsx` y `src/features/faq/*` (ultimo modulo agregado; usarlo como referencia de estructura admin + publico)
2. Revisar el manual de marca: `[RUTA DEL MANUAL DE MARCA IQ KIDS — COMPLETAR]`. Tambien usar como referencia visual la identidad que ya tiene el sitio (ver seccion "Diseño y marca").
3. Antes de escribir codigo, devolver un plan corto con: modelo de datos propuesto, migracion, rutas nuevas, archivos a tocar y como se garantiza que no haya envios no deseados. Esperar aprobacion.
4. Trabajar en una rama nueva creada desde `feature/resideño-front`.

## Objetivo

Crear una seccion **Newsletter** que funcione como revista o blog de la marca:

- **Admin:** crear, editar, previsualizar, programar, enviar y ocultar newsletters con contenido flexible por bloques.
- **Web publica:** un archivo visual de todas las newsletters publicadas, con portada, titulo, foto y fecha, y una pagina de detalle linda y facil de compartir.
- **Email:** cada newsletter se puede enviar por mail a la lista de suscriptos que ya existe (`NewsletterSubscriber` con estado `SUBSCRIBED`, generada por el pop-up de bienvenida y por el checkout).

La prioridad numero uno es la seguridad operativa: **nunca puede salir un mail por error, nunca puede llegar dos veces la misma newsletter a la misma persona y no se puede perder ni modificar data existente.** Si hay que elegir entre "puede quedar un mail sin enviar" y "puede salir un mail de mas", siempre se elige lo primero, igual que en el hotfix de Post compra.

## Reglas que no se pueden romper

- No modificar el comportamiento de las automatizaciones existentes (`WELCOME_LEAD`, `CART_ABANDONED`, `ORDER_CREATED`, `POST_PURCHASE`), del pop-up, del checkout, de los pedidos, de los pagos, del tracking (Meta, GA, CAPI) ni de la sincronizacion externa.
- No modificar ni borrar registros de `newsletter_subscribers`, `email_send_logs`, `email_automations` ni de ninguna otra tabla existente.
- La migracion tiene que ser 100% aditiva: tablas, enums y columnas nuevas. Nada de `DROP`, `RENAME` ni cambios de tipo en columnas existentes. Si hay que agregar un valor a un enum existente (por ejemplo `NewsletterConsentSource`), hacerlo con `ALTER TYPE ... ADD VALUE` en una migracion aparte.
- No agregar datos al `seed` que creen newsletters programadas. El seed no se corre en produccion, pero igual no puede contener nada enviable.
- No usar `prisma db push` ni `migrate reset`. Solo `prisma migrate dev` en local y `prisma migrate deploy` en produccion, siguiendo el runbook (backup previo).
- La baja global (`isEmailUnsubscribed`) se respeta siempre y se chequea justo antes de cada envio individual, no solo al armar la lista.
- `npm run release:check` tiene que pasar sin errores.

## Modelo de datos sugerido (ajustar si hay una razon clara)

### `Newsletter`
- `id`, `slug` (unico, editable mientras no este publicada; despues de publicada, si cambia, guardar el slug anterior para redirigir)
- `title`, `subtitle`, `excerpt` (resumen para la tarjeta del listado y el preview del mail)
- `coverImageUrl`, `coverImageAlt` (el alt es obligatorio)
- `blocks` (`Json`): contenido por bloques, validado con Zod (ver "Editor de contenido")
- `emailSubject`, `emailPreviewText` (por defecto se completan con el titulo y el resumen, pero se pueden editar)
- `status`: `DRAFT` | `SCHEDULED` | `SENDING` | `SENT` | `PAUSED` | `CANCELLED` | `NEEDS_REVIEW`
- `webVisible` (boolean, default `false`) y `publishedAt`: mostrar u ocultar en la web es **independiente** del envio por mail
- `scheduledAt` (UTC; en el admin se muestra y se carga siempre en hora Argentina)
- `approvedAt`, `approvedBy`: quien confirmo el envio y cuando
- `contentLockedAt`: momento en que se congelo el contenido del mail (al iniciar el envio)
- `emailSnapshot` (`Json` o `Text`): el HTML, el texto y el asunto exactos que se enviaron, para que editar la version web despues no cambie lo que ya se mando
- `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `archivedAt` (no hay borrado fisico si ya tiene envios)

### `NewsletterDelivery` (un registro por destinatario y por newsletter)
- `newsletterId`, `subscriberId`, `recipientEmail` (normalizado en minusculas)
- **`@@unique([newsletterId, recipientEmail])`**: es la garantia a nivel base de datos de maximo un envio por persona por newsletter
- `status`: `PENDING` | `RESERVED` | `SENT` | `SKIPPED` | `ERROR`
- `skipReason` (dado de baja, email invalido, etc.), `errorMessage`, `providerMessageId`
- `wave` (1 = envio original, 2+ = envios complementarios)
- tokens de apertura, click y baja (mismo criterio que `EmailSendLog`), mas contadores de aperturas y clicks
- `reservedAt`, `sentAt`, `createdAt`
- Relaciones con `onDelete: Restrict`. Los envios nunca se borran.

### `NewsletterAuditEvent`
- Registro de acciones del admin: creo, edito, programo, cancelo, pauso, reanudo, envio de prueba, envio complementario, oculto, publico. Guarda quien, cuando y los datos relevantes (por ejemplo, cantidad de destinatarios al confirmar).

## Flujo de envio (lo mas critico)

### Llaves de seguridad (todas tienen que estar habilitadas para que salga un mail)
1. `EMAIL_SENDING_ENABLED=true` (la que ya existe).
2. Nueva variable `NEWSLETTER_SENDING_ENABLED`, con `false` por defecto. Si esta en `false`, el admin puede crear, previsualizar y mandar pruebas a las casillas internas, pero no puede programar envios reales. Mostrarlo con un aviso claro en el admin.
3. La newsletter tiene que estar en `SCHEDULED`, con `approvedAt` cargado y `scheduledAt <= now`.

### Pasos
1. **Envio de prueba obligatorio:** antes de poder programar, hay que mandar al menos una prueba a una lista de casillas internas configurable. Las pruebas no crean registros `NewsletterDelivery` ni cuentan como envio. Si se edita el contenido despues de la prueba, hay que volver a mandar otra antes de programar.
2. **Programar:** un modal de confirmacion muestra fecha y hora (en hora Argentina), cantidad exacta de destinatarios en ese momento, asunto, preview del mail y una advertencia de que la accion no se puede deshacer una vez iniciado el envio. Para confirmar hay que escribir el numero de destinatarios o la palabra `ENVIAR`. El boton queda deshabilitado mientras se procesa, para evitar el doble clic.
3. **Mientras esta programada:** se puede cancelar o reprogramar, y editar el contenido (en ese caso se exige una nueva prueba y una nueva confirmacion).
4. **Inicio del envio (cron):**
   - Un endpoint nuevo protegido, `/api/cron/newsletters`, con el mismo esquema de `Bearer EMAIL_CRON_SECRET`. Separado de `email-automations` para que un problema en uno no afecte al otro.
   - Toma la newsletter con un lock (transaccion con `SELECT ... FOR UPDATE SKIP LOCKED` o una actualizacion condicional de estado `SCHEDULED` → `SENDING`). Dos ejecuciones simultaneas del cron no pueden procesar la misma newsletter.
   - Congela el contenido (`contentLockedAt`, `emailSnapshot`).
   - Crea en una transaccion los `NewsletterDelivery` en `PENDING` para los suscriptos elegibles en ese momento. Es la foto de la audiencia: quien se suscriba despues no entra en esta tanda.
5. **Envio por lotes:**
   - Cada ejecucion toma un lote limitado (configurable, por ejemplo 50) de registros en `PENDING`, respetando el limite de velocidad del proveedor (Resend tiene limite por segundo y el plan tiene cupo diario y mensual: verificar el plan contratado y dejarlo configurable).
   - Por cada destinatario: vuelve a chequear la baja → reserva (`PENDING` → `RESERVED` con una actualizacion condicional) → envia → marca `SENT` o `ERROR`.
   - **Sin reintentos automaticos.** Un `ERROR` o un `RESERVED` que se queda trabado va a conciliacion manual desde el admin, igual que en Post compra. El admin puede reintentar un destinatario puntual en `ERROR` con confirmacion, y solo despues de revisarlo.
   - Cuando no quedan `PENDING`, la newsletter pasa a `SENT`.
6. **Pausa de emergencia:** un boton "Pausar envio" en el admin que corta el procesamiento de los lotes siguientes de inmediato. Reanudar requiere confirmacion.
7. **Envio atrasado:** si el cron detecta una newsletter con `scheduledAt` vencida hace mas de un margen configurable (por ejemplo 12 horas, porque el servidor estuvo caido o el cron no corrio), **no la envia**: la pasa a `NEEDS_REVIEW` y el admin decide si enviarla o no.
8. **Envio complementario ("volver a enviar"):**
   - Solo disponible cuando la newsletter esta en `SENT` y ya paso su `scheduledAt`.
   - Crea una nueva tanda (`wave` + 1) **solo** para los suscriptos actuales que no tienen ningun `NewsletterDelivery` para esa newsletter. El indice unico lo garantiza aunque haya un error en la logica.
   - Pasa por la misma confirmacion con cantidad exacta. Si la cantidad es 0, el boton queda deshabilitado con el texto "Todos los suscriptos ya la recibieron".
   - Tambien se puede programar con fecha.

### Mail
- Se genera a partir de los mismos bloques del contenido web, con HTML compatible con clientes de mail (tablas, estilos inline, ancho maximo de 600px, imagenes con URL absoluta y `alt`, y version de texto plano).
- Link "Ver en la web" a `/newsletter/[slug]` si la newsletter esta visible en la web.
- Link individual de baja (reutilizar el sistema de tokens de baja existente) y encabezados `List-Unsubscribe` y `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, que Gmail y Yahoo exigen a remitentes masivos. Para esto, extender `sendEmail` en `provider.ts` con un parametro opcional `headers`, sin cambiar el comportamiento actual cuando no se pasa.
- Todos los links salientes con UTM: `utm_source=newsletter&utm_medium=email&utm_campaign=<slug>`. Tienen que ser compatibles con el modulo de atribucion de marketing que ya existe.
- Pixel de apertura y tracking de clicks, con el mismo criterio que las automatizaciones.
- Unificar la paleta de colores de los mails con la del sitio: `render.ts` hoy usa `#f47f8d` y `#2d2142`, y el sitio usa `#F48991` y `#2c2241`.

## Editor de contenido por bloques (admin)

Nada de HTML libre (riesgo de XSS y de romper el diseño). Contenido por bloques tipados y validados con Zod:

- Titulo de seccion (H2)
- Parrafo, con formato basico: negrita, italica y link. Guardarlo como texto con marcado minimo y sanitizado.
- Imagen (subida, alt obligatorio, epigrafe opcional)
- Imagen + texto (imagen a la izquierda o a la derecha)
- Galeria de 2 o 3 imagenes
- Cita o frase destacada
- Boton o CTA (texto + URL; si la URL es interna, se valida)
- Producto destacado: se elige un producto de la base y muestra foto, nombre, precio actual y boton de compra. El precio siempre sale de la base, no se escribe a mano.
- Tip o dato destacado (caja de color de la marca, con icono)
- Separador

Funciones del editor:
- Agregar, duplicar, eliminar y reordenar bloques (con flechas arriba/abajo o drag & drop, sin sumar dependencias pesadas).
- **Vista previa en vivo** en paralelo, con pestañas "Web" y "Mail", y selector de escritorio o celular.
- Subida de imagenes reutilizando el storage actual de Supabase (mismo patron que `product-images.ts`), con validacion de tipo y tamaño y compresion o redimensionado razonable.
- Aviso de "cambios sin guardar" al salir de la pagina.
- Contador de caracteres en asunto y preview text, con el largo recomendado.
- Checklist antes de programar: portada con alt, asunto, preview text, al menos un bloque, prueba enviada, todas las imagenes con alt y links validos.
- Boton "Duplicar newsletter" para usarla como plantilla de la siguiente.

## Admin: listado y seguimiento

- Nueva seccion `newsletter` en `ADMIN_SECTIONS` (`src/lib/auth/admin-permissions.ts`), con el mismo esquema de permisos que las demas.
- Listado con: portada chica, titulo, estado (chip de color), visible en la web si o no, fecha programada o de envio, y metricas (destinatarios, enviados, omitidos, errores, aperturas, clicks y ventas atribuidas si se puede reutilizar la atribucion existente).
- Filtros por estado y buscador por titulo.
- Detalle de envio: tabla de destinatarios filtrable por estado, con exportacion a CSV y bloque de conciliacion para `ERROR` y `RESERVED`.
- Resumen de la audiencia: suscriptos activos, altas del ultimo mes y bajas.
- Historial de auditoria de cada newsletter.
- Todo con fechas en hora Argentina.

## Web publica

### `/newsletter` (archivo)
- Hero de la seccion con titulo y bajada, con el estilo del home.
- La ultima newsletter destacada grande arriba y el resto en una grilla de tarjetas (portada, fecha, titulo y resumen), ordenadas de la mas nueva a la mas vieja.
- Solo se muestran las que tienen `webVisible = true` y `publishedAt <= now`. Una newsletter programada que todavia no salio no aparece aunque este marcada como visible (evita adelantar contenido).
- Paginacion o "cargar mas" cuando haya muchas.
- Bloque de suscripcion con consentimiento explicito (misma logica que el pop-up: casilla opcional, se guarda la version del consentimiento). Agregar un origen nuevo, `NEWSLETTER_PAGE`, a `NewsletterConsentSource`.
- Estado vacio lindo mientras no haya ninguna publicada.

### `/newsletter/[slug]` (detalle)
- Portada grande, titulo, subtitulo, fecha y tiempo de lectura estimado.
- Bloques renderizados con buen ritmo tipografico y ancho de lectura comodo.
- Botones para compartir: WhatsApp (el principal en Argentina), copiar link, Facebook y X. En celular, usar `navigator.share` si esta disponible.
- Bloque de suscripcion al final.
- Navegacion a la anterior y la siguiente, y "otras newsletters".
- Si se oculta una newsletter que ya se envio por mail, su URL devuelve 404 real (asegurarse de que la respuesta sea status 404 y no 200).
- Si cambio el slug, redirigir 301 desde el anterior.

### SEO y GEO (esta seccion tambien suma para la estrategia GEO)
- `generateMetadata` por newsletter: title, description, canonical, Open Graph con la imagen de portada y `twitter:card`.
- JSON-LD `Article` o `BlogPosting` con autor u organizacion IQ Kids, fecha de publicacion y de modificacion, e imagen.
- Incluir las newsletters publicadas en el sitemap si ya existe `app/sitemap.ts`. Si todavia no existe, dejar una funcion exportada lista para sumarlas.
- HTML semantico (`article`, `header`, `time`, jerarquia correcta de encabezados) y el contenido renderizado del lado del servidor.

### Navegacion
- Link "Newsletter" en el header y el footer, con un toggle en el admin (Configuracion) para mostrarlo u ocultarlo. Viene apagado por defecto, asi no aparece hasta que exista contenido.

## Diseño y marca

- Seguir el manual de marca indicado arriba. Si algo del manual contradice lo que ya esta en el sitio, preguntar antes de cambiarlo.
- Usar los tokens que ya existen en `tailwind.config.ts` y `globals.css`: rosa principal `#F48991` (color dominante), rosa suave `#FAD5D8`, amarillo `#ffd35c`, celeste `#7bd8f7`, menta `#dff5df`, tinta `#2c2241`; tipografia display "Watermelon" (`font-display`) y DM Sans para el cuerpo; bordes muy redondeados (`rounded-4xl`) y sombras `soft` y `card`.
- Referencias visuales: el home actual, la pagina `/preguntas-frecuentes` y `RediseñoWeb/IQ_Kids_Sitio_Completo_2.html`.
- El tono es calido, cercano y claro, pensado para madres y padres. Mobile first: la mayoria del trafico llega desde el celular y desde WhatsApp e Instagram.
- Accesibilidad: contraste AA, foco visible, `alt` en todas las imagenes y botones con texto claro.
- Nada de colores ni tipografias nuevos fuera de la paleta.

## Tests obligatorios

Siguiendo el estilo de `tests/post-purchase.test.cjs` (sin red, sin base real y sin proveedor real):

- Con `NEWSLETTER_SENDING_ENABLED=false` no se envia nada.
- Una newsletter en `DRAFT`, `CANCELLED`, `PAUSED` o sin `approvedAt` no se envia nunca.
- Con `scheduledAt` en el futuro no se envia; vencida hace mas del margen pasa a `NEEDS_REVIEW` sin enviar.
- Dos ejecuciones concurrentes del cron no envian dos veces al mismo destinatario.
- El envio complementario solo alcanza a quienes no tienen registro previo, y con 0 elegibles no hace nada.
- Un suscripto que se da de baja entre la creacion de la tanda y el envio queda `SKIPPED`, no enviado.
- Un error del proveedor deja el registro en `ERROR` y no se reintenta solo.
- Los envios de prueba no crean registros `NewsletterDelivery`.
- Validacion de bloques: se rechazan bloques invalidos o con HTML y URLs peligrosas (`javascript:`).
- La web solo lista newsletters visibles y publicadas.

## Entregables

1. Migracion aditiva y su explicacion (que crea y confirmacion de que no toca datos existentes).
2. Codigo del admin, de la web publica, del servicio de envio y del endpoint de cron.
3. Tests pasando y `npm run release:check` en verde.
4. Documentacion actualizada:
   - `docs/email-automations.md`: seccion Newsletter (flujo, llaves de seguridad, conciliacion).
   - `docs/codex-contexto-operativo.md`: entrada en el historial.
   - `docs/deploy-produccion-digitalocean.md`: pasos de publicacion (backup, `migrate deploy`, nada de seed, deploy con `NEWSLETTER_SENDING_ENABLED=false`, prueba interna y recien despues habilitar), configuracion del cron nuevo y como pausar en una emergencia.
5. Un checklist de prueba manual en local, paso a paso, antes de subir.
6. Un resumen final con los riesgos conocidos y las decisiones que se tomaron.

## Preguntas para hacer antes de implementar si no estan resueltas

- Plan y limites del proveedor de mail (Resend o SMTP): envios por segundo, por dia y por mes, y cantidad actual de suscriptos.
- Remitente de la newsletter: nombre visible y casilla (`no-reply@` o una casilla que reciba respuestas).
- Lista de casillas internas para las pruebas.
- Si los suscriptos del checkout reciben la newsletter igual que los del pop-up (por defecto si: los dos dieron consentimiento explicito).
