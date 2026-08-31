# Contexto Operativo Para Codex

## Objetivo de este documento

Este archivo existe para arrancar conversaciones nuevas con contexto acumulado del proyecto sin depender del historial del chat.

Uso sugerido al iniciar una conversacion nueva con Codex:

`Lee completo docs/codex-contexto-operativo.md antes de proponer o tocar nada. A partir de ahora, cada ajuste nuevo que hagamos agregalo al historial de ese documento.`

## Regla de mantenimiento

Cada vez que se haga un cambio relevante en la web, este documento debe actualizarse con:

- fecha del ajuste
- que se cambio
- por que se cambio
- archivos tocados
- si requirio o no deploy en DigitalOcean
- si implico o no riesgo de DB
- comandos seguros usados para publicarlo

No reemplaza a la documentacion tecnica detallada. La complementa.

## Documentos de referencia obligatorios

- `README.md`
- `docs/documentacion-web.md`
- `docs/deploy-produccion-digitalocean.md`
- `prisma/schema.prisma`

## Resumen ejecutivo del sistema

Proyecto: `IQ Kids Store`

Es un ecommerce propio montado con:

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Mercado Pago

Superficies principales:

- storefront publico
- checkout
- panel admin
- backend operativo via API routes + Prisma + servicios

Principio operativo mas importante:

- el pedido siempre se guarda primero en base de datos
- la sincronizacion externa ocurre despues
- si una integracion externa falla, el pedido no se pierde

## Lo que ya tiene la web

### Front publico

- Home custom rediseÃ±ada
- Catalogo de productos
- Detalle de producto
- Carrito persistido en `localStorage` con Zustand
- Checkout con transferencia y Mercado Pago
- Pantalla de transferencia con carga de comprobante
- Confirmacion de compra
- Contacto

### Admin

- Login admin con Supabase Auth
- opcion de auth local y bypass dev para entorno local
- Dashboard
- Gestion de productos
- Configuracion de tienda
- Gestion de cupones
- Gestion de envios
- Pedidos
- Sync externo
- Emails y auditoria de automatizaciones
- Usuarios admin

### Integraciones y operacion

- Supabase Auth
- Supabase Storage
- Mercado Pago Checkout Pro
- webhook idempotente de Mercado Pago
- Google Analytics
- Google Tag Manager
- Meta Pixel
- Meta Conversions API
- Microsoft Clarity
- Sync externo por `apps_script`, `mock` y estructura para `google_sheets`
- Recuperacion de carrito
- Automatizaciones de email

## Reglas de negocio que no se deben romper

- el checkout crea el pedido en DB antes de cualquier sync externo
- el webhook de Mercado Pago es la fuente final de verdad del pago
- transferencia y Mercado Pago conviven
- el panel admin depende de `store_settings`
- no hay que romper el upload de comprobantes
- no hay que romper el detalle de pedido admin
- no hay que romper la sincronizacion externa
- no hay que romper tracking de compra en Meta/GA

## Puntos sensibles del sistema

Si se toca algo en estas areas, revisar con mas cuidado:

- `src/features/orders/services/order-service.ts`
- `src/features/orders/services/mercado-pago-service.ts`
- `src/features/orders/services/sync-service.ts`
- `src/app/api/orders/route.ts`
- `src/app/api/payments/mercadopago/webhook/route.ts`
- `src/features/checkout/components/checkout-page.tsx`
- `src/features/admin/components/settings-form.tsx`
- `src/app/layout.tsx`
- `prisma/schema.prisma`

## Limitaciones conocidas al 18 de agosto de 2026

- `requireTaxId` existe en settings, pero hoy el backend sigue exigiendo DNI/documento siempre
- el provider `google_sheets` esta preparado pero no terminado de punta a punta
- la UI de envios no aprovecha completamente el soporte multi-regla del modelo
- hay textos heredados con problemas de encoding en algunos archivos

## Infra y despliegue actual

### Produccion

- entorno productivo montado en un DigitalOcean Droplet
- stack servido con Docker Compose
- servicios observados en produccion:
  - `app`
  - `caddy`
  - `postgres`

### Ruta de trabajo en el droplet

`/opt/iqkids/web`

### Importante sobre el checkout Git en produccion

En el droplet existen archivos locales de infraestructura no versionados en Git, por ejemplo:

- `.dockerignore`
- `.env.production`
- `Caddyfile`
- `Dockerfile`
- `docker-compose.yml`

Eso significa:

- no hay que borrarlos
- no hay que asumir que el repo productivo esta totalmente limpio
- antes de hacer `git pull` hay que inspeccionar que trae el remoto

## Politica de deploy seguro en DigitalOcean

### Caso A: cambio solo de frontend o metadata, sin schema ni DB

Ejemplos:

- meta tags
- copy
- estilos
- componentes visuales
- cambios en layout sin impacto en schema

Secuencia segura:

```bash
cd /opt/iqkids/web
git fetch origin
git log --oneline --decorate --max-count=8 HEAD origin/<rama>
git diff --stat HEAD..origin/<rama>
git pull origin <rama>
docker compose build app
docker compose up -d app
docker compose ps
docker compose logs --tail=150 app
```

Verificacion:

```bash
curl -I https://iqkids.com.ar
curl -fsS https://iqkids.com.ar/
```

### Caso B: cambio con migraciones o riesgo sobre DB

En este caso seguir el runbook completo de `docs/deploy-produccion-digitalocean.md`.

Reglas obligatorias:

- backup antes de migrar
- ejecutar `prisma migrate deploy` solo cuando realmente hay migraciones nuevas
- nunca correr `prisma db seed` ni `npm run db:seed` en produccion
- build de la nueva revision antes de migrar
- comparar conteos pre y post deploy

## Comandos que no hay que correr en produccion a ciegas

- `npm run db:seed`
- `prisma db seed`
- borrados manuales de tablas o columnas
- `git reset --hard` sin entender el estado real del repo
- `git clean -fd` porque puede borrar archivos locales de infraestructura
- `docker compose down -v` porque puede tener impacto destructivo en volumenes

## Flujo recomendado antes de cualquier deploy

```bash
cd /opt/iqkids/web
git status --short
docker compose ps
git branch --show-current
git rev-parse HEAD
```

Si `git status --short` muestra archivos locales no versionados:

- no borrarlos
- primero verificar si son parte de la infraestructura local del droplet

Si se va a hacer `git pull`:

- primero revisar `git diff --stat HEAD..origin/<rama>`
- confirmar que el remoto no traiga cambios inesperados

## Historial de ajustes relevantes

### 2026-08-20 - Validacion avanzada de direccion y vista previa del destino en checkout

Pedido:

- endurecer la validacion de direccion del checkout sin cambiar los campos existentes
- mostrar mensajes claros por campo
- sumar una forma visual de revisar el destino antes de continuar

Implementacion:

- se reforzaron validaciones de nombre, apellido, email, telefono, provincia, localidad, codigo postal, direccion y observaciones en `src/lib/validations/checkout.ts`
- el codigo postal ahora exige formato numerico
- la direccion ahora exige calle + numero y muestra mensajes concretos de correccion
- el checkout paso a validar en `onBlur` y revalidar en `onChange`
- se agrego una UX nueva para cada campo con label limpio y error visible solo cuando corresponde
- se agrego una tarjeta de vista previa del destino con:
  - resumen de direccion interpretada
  - mapa embebido para revisar rapidamente si el pin cae donde corresponde
  - sin botones propios extra para no cargar la interfaz
  - instruccion corta para corregir calle, numero, localidad o codigo postal si el pin no coincide

Decision UX posterior del 20 de agosto de 2026:

- se removieron los botones propios de copiar direccion, abrir Google Maps y mostrar u ocultar mapa
- el mapa quedo siempre visible y navegable dentro del embed
- el unico boton visible restante pertenece al propio embed de Google y no es controlable desde el codigo del sitio
- la accion sugerida al usuario cuando el pin cae mal es modificar la direccion o dejar una aclaracion breve en observaciones
- la direccion interpretada paso a mostrarse en formato mas compacto para no contaminar visualmente el checkout
- se normalizaron tildes y textos del checkout para mantener un espaÃ±ol correcto y consistente en Argentina

Archivos tocados:

- `src/lib/validations/checkout.ts`
- `src/features/checkout/components/checkout-page.tsx`

Impacto:

- cambio de frontend + validacion
- sin cambios de schema
- sin impacto en Prisma
- sin impacto en PostgreSQL
- sin migraciones

Validacion local:

- `npx tsc --noEmit`: OK

Comandos recomendados para revisar localmente:

```bash
npm run dev
```

Abrir:

- `http://localhost:3000/checkout`

Chequeos sugeridos:

- probar nombre y apellido con caracteres invalidos
- probar telefono corto o con pocos digitos
- probar codigo postal con letras
- probar direccion sin numero
- completar direccion valida y revisar la tarjeta con mapa
- cambiar calle, localidad o codigo postal y confirmar que el preview se actualiza
- verificar que el mapa no tenga botones propios del sitio y funcione solo como referencia visual

### 2026-08-20 - Mensajes dinamicos en la pestana del navegador

Pedido:

- mostrar mensajes cortos en la pestaÃ±a del navegador cuando el usuario deja la web en segundo plano
- variar el mensaje segun donde quedo el usuario, por ejemplo home, productos, carrito y checkout
- dejar los textos faciles de editar desde codigo

Implementacion:

- se agrego un componente global cliente que escucha `document.visibilityState` y rota mensajes en la pestaÃ±a mientras la web queda en background
- los mensajes se resuelven segun la ruta actual y tambien contemplan el estado del carrito para empujar mejor el regreso
- la configuracion editable de los copies quedo centralizada en un unico archivo para poder ajustar textos sin tocar la logica
- se excluyo el panel admin para no meter este comportamiento en la operacion interna

Archivos tocados:

- `src/components/layout/app-chrome.tsx`
- `src/components/layout/tab-title-nudge.tsx`
- `src/lib/marketing/tab-title-messages.ts`

Impacto:

- cambio solo de frontend y UX
- sin cambios de schema
- sin impacto en Prisma
- sin impacto en PostgreSQL
- sin migraciones

Validacion local:

- `npx tsc --noEmit`: OK

Comandos recomendados para revisar localmente:

```bash
npm run dev
```

Abrir:

- `http://localhost:3000/`
- `http://localhost:3000/carrito`
- `http://localhost:3000/checkout`

Chequeos sugeridos:

- entrar a home y cambiar de pestaÃ±a para confirmar rotacion de mensajes
- repetir prueba en productos, carrito y checkout
- probar carrito vacio y carrito con productos para validar copy dinamico
- volver a la pestaÃ±a y confirmar que el titulo original se restaura

Decision UX posterior del 20 de agosto de 2026:

- se elimino la ruta publica `\/politicas` porque no formaba parte de la navegacion real ni del flujo comercial
- se limpiaron referencias documentales y tecnicas a esa seccion para no dejar superficie muerta publicada
- para mobile se agrego un chip sutil de reenganche que aparece al volver a la pestaÃ±a despues de varios segundos fuera
- ese chip muestra un mensaje corto segun la etapa del usuario y un CTA `Seguir` que lo devuelve suavemente al contenido principal
- ese comportamiento mobile se limito solo a `carrito`, `checkout` y `checkout/transfer` para no meter recordatorios decorativos en paginas de baja intencion

Archivos adicionales tocados en esta iteracion:

- `src/lib/validations/short-link.ts`
- `docs/documentacion-web.md`

Nota posterior de cierre del 20 de agosto de 2026:

- luego de probarlo en produccion, se retiro el nudge mobile de reenganche porque no resulto confiable al volver desde Safari
- el comportamiento definitivo quedo solo para desktop mediante cambio dinamico del titulo de la pestaÃ±a
- en checkout tambien se ajusto el copy principal del formulario a: `CargÃ¡ tus datos, elegÃ­ el medio de pago y generamos tu pedido.`
- para Safari/iPhone se corrigio el icono del sitio para que use el logo real de IQ Kids en lugar del viejo `iQ` simplificado
- se declararon iconos explicitos en `metadata` para favicon y Apple touch icon, usando assets de `public/brand`
- hotfix posterior de desktop: se reforzo la restauracion del titulo con `visibilitychange`, `focus` y `pageshow`, mas una reaplicacion corta del `document.title` para evitar pestaÃ±as que quedaban mostrando `VolvÃ©`

Nota posterior de cierre del 20 de agosto de 2026 - Ajustes finales pre prod:

- en checkout se bloqueo la interaccion sobre el mapa embebido para evitar mover el pin
- en el ticker superior se agrando sutilmente la tipografia para mejorar legibilidad
- en carrito se reforzo el error de email con foco al campo y alerta visual mas clara junto al CTA

### 2026-08-18 - Meta tag de verificacion de dominio de Facebook

Pedido:

- agregar `<meta name="facebook-domain-verification" content="uxoukek4qpm1l9lb4w8fjzgr1rm43c" />`
- sin cambiar nada mas

Implementacion:

- se agrego la meta tag global en el `<head>` de `src/app/layout.tsx`

Archivo tocado:

- `src/app/layout.tsx`

Impacto:

- cambio solo de frontend y metadata
- sin impacto en Prisma
- sin impacto en PostgreSQL
- sin impacto en pedidos, pagos ni admin

Validacion local:

- `npx tsc --noEmit`: OK

Hallazgo importante en produccion:

- el droplet tenia archivos locales no versionados de infraestructura
- antes de hacer deploy se verifico que el remoto tuviera exactamente un commit nuevo y que el unico diff fuera la meta tag

Comandos seguros usados para inspeccion en el droplet:

```bash
cd /opt/iqkids/web
git status --short
docker compose ps
git branch --show-current
git rev-parse HEAD
git fetch origin
git log --oneline --decorate --max-count=8 HEAD origin/feature/resideÃ±o-front
git diff --stat HEAD..origin/feature/resideÃ±o-front
git diff HEAD..origin/feature/resideÃ±o-front -- src/app/layout.tsx
```

Comandos seguros recomendados para publicar este tipo de cambio:

```bash
cd /opt/iqkids/web
git pull origin feature/resideÃ±o-front
docker compose build app
docker compose up -d app
docker compose ps
docker compose logs --tail=150 app
curl -fsS https://iqkids.com.ar/ | grep "facebook-domain-verification"
```

Motivo de seguridad:

- no se ejecuto ninguna migracion
- no se toco la base
- no se corrio seed
- solo se recompilo y recreo el servicio web

## Instruccion futura para Codex

Cuando se arranque una conversacion nueva y se vaya a trabajar sobre este proyecto:

1. leer este archivo completo
2. leer `docs/documentacion-web.md` si el cambio toca negocio o arquitectura
3. leer `docs/deploy-produccion-digitalocean.md` si el cambio puede llegar a prod
4. antes de proponer deploys, distinguir si el cambio toca solo frontend o tambien DB/migraciones
5. despues de cada ajuste relevante, agregar una nueva entrada al historial de este documento


- se revirtio el favicon desktop para usar `public/brand/iq-kids-favicon.svg`, que rendia mejor en tamaÃ±o de pestaÃ±a
- se neutralizo temporalmente el favicon para evitar inconsistencias visuales y de cache entre navegadores

### 2026-08-28 - Popup de bienvenida en home con captura temprana de email y cupón editable desde admin

Pedido:

- adelantar la captura del email al primer ingreso al home
- mostrar un popup de bienvenida solo la primera vez y volver a habilitarlo a los 30 dias
- reutilizar el HTML base `docs/IQ_Kids_Popup_2.html` respetando desktop, mobile, colores y success state
- mostrar el cupón al enviar el email y disparar tambien un email con ese beneficio
- permitir que marketing gestione el cupón desde `/admin/cupones`
- no abrir una migracion nueva si podia resolverse reutilizando la estructura operativa actual

Implementacion:

- se agrego un popup global montado desde `AppChrome` pero visible solo en `/`
- el popup espera 800 ms antes de abrir, se cierra por overlay o `Escape` y se vuelve a mostrar recien despues de 30 dias usando `localStorage`
- el cupón del popup ahora se marca desde `/admin/cupones` con una opcion explicita `Usar este cupón en el popup de bienvenida`
- internamente esa marca reutiliza `description` del cupón con un marcador tecnico controlado para evitar una migracion nueva
- el backend garantiza que solo exista un cupón activo marcado para el popup a la vez
- se agrego `GET/POST /api/welcome-popup` para resolver configuracion del popup y capturar el email apenas entra el usuario
- esa captura temprana crea o reaprovecha registros en `cart_recovery_leads` usando el estado operativo `WELCOME_CAPTURED`, sin tocar schema
- cuando mas tarde ese mismo email deja carrito, la API de recuperacion reutiliza el lead temprano y lo lleva al ciclo existente `CAPTURED -> CHECKOUT_STARTED -> CONVERTED`
- despues de capturar el email se muestra el estado exito con el codigo visible en pantalla y ademas se intenta enviar el email del beneficio usando el proveedor actual de emails
- si el proveedor de email no esta configurado o falla, el popup igual entrega el codigo en pantalla para no romper la conversion local
- el email capturado se guarda tambien en `localStorage` y se precarga despues en carrito para no volver a pedirselo al usuario
- se completaron los mapeos operativos del trigger `WELCOME_LEAD` dentro del modulo admin de emails y en el motor de automatizaciones para dejar consistente la etapa nueva previa al carrito

Archivos tocados:

- `src/components/layout/app-chrome.tsx`
- `src/app/api/welcome-popup/route.ts`
- `src/app/api/cart-recovery/route.ts`
- `src/features/marketing/components/welcome-popup.tsx`
- `src/features/marketing/welcome-popup.ts`
- `src/lib/marketing/welcome-popup-copy.ts`
- `src/features/cart/components/cart-page.tsx`
- `src/features/coupons/lib/welcome-popup-coupon.ts`
- `src/features/coupons/mutations.ts`
- `src/lib/validations/coupon.ts`
- `src/features/admin/components/coupons-admin-panel.tsx`
- `src/features/admin/components/email-automations-panel.tsx`
- `src/features/admin/components/email-audit-panel.tsx`
- `src/features/email/automation-service.ts`

Impacto:

- requiere deploy de app para llegar a produccion
- no agrega migraciones nuevas
- no cambia `prisma/schema.prisma`
- no implica riesgo estructural de DB, pero si cambia el uso operativo de `cart_recovery_leads` al incorporar la etapa `WELCOME_CAPTURED`
- no toca pedidos, pagos, webhook de Mercado Pago ni upload de comprobantes

Validacion local:

- `npx tsc --noEmit`: OK

Como probar localmente:

1. entrar a `/admin/cupones`
2. crear o editar un cupón activo y marcar `Usar este cupón en el popup de bienvenida`
3. abrir `http://localhost:3000/` en modo incognito o limpiando `localStorage`
4. confirmar que el popup aparece luego de ~800 ms y que respeta desktop o mobile segun viewport
5. cerrar el popup y verificar que no reaparece dentro de los siguientes 30 dias en ese navegador
6. volver a limpiar `localStorage`, cargar un email valido y confirmar el estado exito con codigo visible
7. confirmar que el email queda precargado luego en `/carrito`
8. agregar productos al carrito y avanzar para verificar que el lead temprano pase a recuperacion de carrito sin romper el flujo actual

### 2026-08-28 - Ajuste visual del popup de bienvenida segun maqueta base

Pedido:

- ocultar el codigo de cupon hasta que la persona deje su email
- corregir proporcion del popup en desktop para que no quede tan angosto y alto
- sumar el saludo visual en el titulo `Bienvenida a IQ Kids 👋`
- rehacer la composicion mobile para que respete mejor la maqueta de `docs/IQ_Kids_Popup_2.html`, con menos altura visual y copy mas liviano

Implementacion:

- se retiro la caja visible del cupon en el estado inicial del popup y el beneficio queda sugerido solo desde el circulo lateral o superior
- en desktop se rebalanceo el ancho general del modal y la proporcion entre columna rosa y bloque de formulario
- el titulo principal ahora incluye el gesto de saludo
- en mobile se simplifico la cabecera rosa con wave, se redujo la altura ocupada y se separo el copy para que quede mas cercano a la maqueta original
- se mantuvo sin cambios la logica de captura, persistencia local a 30 dias y envio de email posterior al submit

Archivos tocados:

- `src/features/marketing/components/welcome-popup.tsx`
- `src/lib/marketing/welcome-popup-copy.ts`

Impacto:

- cambio solo de frontend y copy
- sin cambios de schema
- sin impacto adicional de DB
- requiere redeploy de app si se quiere llevar a produccion

### 2026-08-28 - Correccion fina de copy y composicion del popup mobile

Pedido:

- usar `10% OFF` en el badge del popup en lugar de `10% beneficio`
- corregir el copy mobile para que siga la maqueta base y no muestre la composicion desktop
- dejar el estado exito con los textos exactos de la referencia visual entregada
- mejorar el CTA de cierre `Ahora no, gracias` para que no quede como texto crudo plano

Implementacion:

- el badge visual del popup paso a mostrar `OFF` tanto en desktop como en mobile
- en mobile se recupero el claim corto del bloque rosa y el cuerpo reducido de una sola idea principal antes del input
- el estado exito ahora usa el texto `Te mandamos el código a tu email. Usalo en tu primera caja IQ Kids:` y la leyenda `Válido para tu primera caja · Sin mínimo de compra`
- el cierre inferior se centro y se estilizo como accion liviana en lugar de texto suelto

Archivos tocados:

- `src/features/marketing/components/welcome-popup.tsx`
- `src/lib/marketing/welcome-popup-copy.ts`

### 2026-08-28 - Hardening pre produccion del flujo WELCOME_LEAD

Pedido:

- revisar el flujo completo antes de publicar para evitar sorpresas en produccion
- asegurar que el alta temprana desde popup quede conectada con carrito, compra y automatizaciones posteriores
- resolver los riesgos detectados en la salida a prod

Hallazgos y correcciones aplicadas:

- se detecto que `WELCOME_LEAD` estaba en codigo pero faltaba la migracion del enum real de PostgreSQL; se agrego `prisma/migrations/202608281930_add_welcome_lead_trigger/migration.sql`
- se endurecio el envio inmediato del popup para que deje auditoria en `email_send_logs` con trigger `WELCOME_LEAD`, sin bloquear los recordatorios automaticos posteriores del mismo lead
- se agrego una automatizacion tecnica interna del sistema para registrar ese envio inmediato, oculta del listado normal de automatizaciones admin
- el click del email inmediato ahora tambien queda trackeable mediante `click_token`, por lo que una compra posterior puede atribuirse igual que en las demas automatizaciones
- la vista operativa de `/admin/emails` ahora contempla tambien leads `WELCOME_CAPTURED`, diferenciando bienvenida temprana de carrito abandonado y usando la demora correcta segun el trigger

Archivos tocados:

- `prisma/migrations/202608281930_add_welcome_lead_trigger/migration.sql`
- `src/features/marketing/welcome-popup.ts`
- `src/features/email/automation-service.ts`
- `src/features/email/system-automations.ts`
- `src/features/admin/components/email-automations-panel.tsx`

Impacto:

- si requiere migracion en DB para prod
- requiere deploy de app
- no altera tablas nuevas ni columnas nuevas
- agrega trazabilidad operativa y reduce riesgo de comportamiento silencioso en emails

Validacion local:

- `npx prisma validate`: OK
- `npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/202608281930_add_welcome_lead_trigger/migration.sql`: OK local
- `npx prisma generate`: OK
- `npx tsc --noEmit`: OK

### 2026-08-28 - CTA de copiado rapido y limpieza del mail de bienvenida

Pedido:

- sumar un boton rapido para copiar el cupon desde el estado exito del popup
- eliminar del email de bienvenida la frase que mencionaba guardar el email para retomar el carrito mas adelante

Implementacion:

- se agrego un CTA secundario `Copiar codigo` en el success state del popup con feedback inmediato `Codigo copiado`
- se mantuvo el CTA principal `Ver productos` sin cambiar el flujo de conversion
- se limpio el cuerpo del email de bienvenida para que quede enfocado solo en reservar el beneficio de primera compra, sin mezclar el mensaje con recuperacion de carrito
- se verifico que la frase removida ya no quede referenciada en el codigo del proyecto

Archivos tocados:

- `src/features/marketing/components/welcome-popup.tsx`
- `src/lib/marketing/welcome-popup-copy.ts`
- `docs/codex-contexto-operativo.md`

Impacto:

- cambio de frontend y copy de email
- sin cambios de schema
- sin impacto adicional de DB
- requiere redeploy de app para produccion

Validacion local:

- `npx tsc --noEmit`: OK

### 2026-08-28 - Export operativo de mails CRM desde admin emails

Pedido:

- permitir que marketing descargue todos los mails registrados con su estado operativo para trabajar acciones por fuera del sistema
- no romper ni mezclar esa necesidad con el flujo automatico ya existente de emails

Implementacion:

- se agrego un export directo desde `/admin/emails` con CTA `Descargar mails CRM`
- el archivo descargable sale desde `/api/admin/export/email-leads` protegido con permisos de la seccion `emails`
- el export toma `cart_recovery_leads` como fuente operativa y entrega por fila: email, estado operativo, fechas clave, pedido asociado si existe, subtotal, y ultimo contexto de email enviado
- se incluyeron columnas de trigger, estado, automatizacion, asunto, fecha, clicks y venta atribuida del ultimo email para que marketing pueda segmentar afuera con mejor contexto
- intencionalmente no se exportan tokens de recuperacion ni datos innecesariamente sensibles
- no se toco la logica de captura, de conversion, ni de procesamiento automatico de emails

Archivos tocados:

- `src/app/api/admin/export/email-leads/route.ts`
- `src/features/admin/components/email-automations-panel.tsx`
- `docs/codex-contexto-operativo.md`

Impacto:

- cambio de backend admin + UI admin
- sin cambios de schema
- sin impacto de DB estructural
- requiere redeploy de app para produccion

Validacion local:

- `npx tsc --noEmit`: OK

### 2026-08-28 - Rediseño visual del popup de bienvenida según IQ_Kids_Popup_4.html

Pedido:

- reemplazar el diseño visual del popup por la nueva maqueta `docs/IQ_Kids_Popup_4.html`
- mantener sin cambios la lógica existente de apertura, captura, localStorage, API, success state y email

Implementacion:

- se rehizo la composición visual completa del popup para replicar la nueva maqueta en desktop, mobile y estado de éxito
- el popup volvió a una versión más compacta, centrada y sin columna lateral decorativa
- se alinearon tipografías, espaciados, divider, CTA principal, CTA de cierre y success state con la referencia nueva
- no se tocó la lógica de trigger, submit, persistencia a 30 días, ni el reemplazo interno del contenido al entrar en éxito

Archivos tocados:

- `src/features/marketing/components/welcome-popup.tsx`
- `src/lib/marketing/welcome-popup-copy.ts`
- `docs/codex-contexto-operativo.md`

Impacto:

- cambio solo de frontend y copy visual
- sin cambios de schema
- sin impacto adicional de DB
- requiere redeploy de app para producción

Validación local:

- `npx tsc --noEmit`: OK

### 2026-08-28 - Agrupación operativa del listado de cupones para cargas masivas

Pedido:

- resolver que el listado de cupones en admin no quede eterno e inmanejable después de cargas masivas
- mejorar revisión y edición sin cambiar la lógica de cupones ni de carga masiva

Implementación:

- el listado de `/admin/cupones` ahora agrupa cupones por descripción interna + beneficio + tipo de uso + estado, que es la forma operativa más útil para campañas masivas
- cada grupo muestra cantidad de cupones, usos confirmados, preview de códigos y estado del grupo
- se agregó búsqueda por código, descripción o beneficio para encontrar campañas o cupones puntuales rápido
- la edición y eliminación individual siguen disponibles dentro de cada grupo expandido
- no se tocó la lógica de creación, validación, usos, popup de bienvenida ni carga masiva de cupones

Archivos tocados:

- `src/features/admin/components/coupons-admin-panel.tsx`
- `docs/codex-contexto-operativo.md`

Impacto:

- cambio solo de UX admin
- sin cambios de schema
- sin impacto adicional de DB
- requiere redeploy de app para producción

Validación local:

- `npx tsc --noEmit`: OK

### 2026-08-29 - Popup de bienvenida visible una vez por sesion hasta capturar email

Pedido:

- cambiar la persistencia visual del popup para que se muestre una vez por sesion mientras la persona no deje su email
- si navega dentro de la misma sesion, no volver a abrirlo
- si vuelve en una sesion nueva sin haber dejado email, volver a mostrarlo
- si ya dejo su email, no volver a mostrarlo en sesiones futuras

Implementacion:

- se elimino la logica anterior de reshow a 30 dias para la apertura visual del popup
- el estado de visualizacion ahora se guarda en `sessionStorage` con una clave exclusiva de sesion
- el email capturado se sigue guardando en `localStorage`, y pasa a ser la condicion persistente que desactiva el popup en visitas futuras
- el popup solo consulta configuracion remota si no hay email guardado y si todavia no fue mostrado en la sesion actual
- se mantuvo intacta la logica de API, captura de lead, cupon editable desde admin, envio de email y success state

Archivos tocados:

- `src/features/marketing/components/welcome-popup.tsx`
- `src/lib/marketing/welcome-popup-copy.ts`
- `docs/codex-contexto-operativo.md`

Impacto:

- cambio de frontend y persistencia cliente
- sin cambios de schema
- sin impacto estructural de DB
- requiere redeploy de app para produccion

Validacion local:

- `npx tsc --noEmit`: OK

### 2026-08-30 - Trazabilidad completa de marketing, recompra y panel admin de atribucion

Pedido:

- registrar como llega cada usuario desde su primera sesion hasta la compra
- guardar categoria macro de origen, plataforma, campana y datos UTM o click ids cuando existan
- conectar popup, captura temprana de email, carrito, checkout y compra confirmada dentro de una misma historia comercial
- medir clientes con recompra y facturacion asociada
- crear una seccion nueva en admin con lectura clara para marketing y exportacion a Excel con filtros base

Implementacion:

- se agrego un modelo nuevo de atribucion compuesto por `marketing_sessions` y `marketing_events`
- `marketing_sessions` guarda primera entrada, referrer, UTM, click ids (`gclid`, `fbclid`, `ttclid`, `msclkid`), clasificacion de categoria/plataforma/canal y vinculacion opcional con email
- `marketing_events` registra hitos operativos del funnel: `SESSION_STARTED`, `POPUP_CAPTURED`, `CART_CAPTURED`, `ORDER_CREATED` y `ORDER_CONFIRMED`
- `orders` y `cart_recovery_leads` ahora referencian `marketingSessionId` y `marketingVisitorId` para no perder continuidad entre home, carrito y compra
- se agrego un tracker cliente global que registra una sesion por browser-session y publica el contexto a `POST /api/marketing/session`
- el popup de bienvenida, la captura de carrito y el checkout ahora mandan tambien el contexto de atribucion al backend
- al crear pedido o confirmar pago, el backend persiste y completa la trazabilidad para poder medir conversion y recompra sin depender solo de herramientas externas
- se agrego `/admin/marketing` con filtros por fecha, categoria, plataforma, busqueda libre y modo solo recompra
- la nueva vista muestra resumen ejecutivo, rendimiento por origen, top de campanas, base accionable de contactos y ultimos pedidos filtrados
- se agrego `/api/admin/export/marketing-attribution` para descargar la base filtrada en formato Excel compatible
- la nueva seccion `marketing` quedo incorporada a permisos y navegacion del panel admin

Archivos tocados:

- `prisma/schema.prisma`
- `prisma/migrations/202608301015_add_marketing_attribution/migration.sql`
- `src/lib/marketing/attribution.ts`
- `src/lib/marketing/client.ts`
- `src/features/marketing/attribution-service.ts`
- `src/features/marketing/admin-analytics.ts`
- `src/app/api/marketing/session/route.ts`
- `src/components/analytics/marketing-session-tracker.tsx`
- `src/components/layout/app-chrome.tsx`
- `src/features/marketing/components/welcome-popup.tsx`
- `src/features/marketing/welcome-popup.ts`
- `src/app/api/cart-recovery/route.ts`
- `src/features/cart/components/cart-page.tsx`
- `src/lib/validations/checkout.ts`
- `src/features/checkout/components/checkout-page.tsx`
- `src/features/orders/services/order-service.ts`
- `src/features/orders/services/mercado-pago-service.ts`
- `src/lib/auth/admin-permissions.ts`
- `src/app/admin/layout.tsx`
- `src/app/admin/marketing/page.tsx`
- `src/app/api/admin/export/marketing-attribution/route.ts`

Impacto:

- requiere deploy de app y migracion en DB
- la migracion es aditiva: crea tablas, enums, indices y foreign keys nuevas, y agrega columnas nuevas en `orders` y `cart_recovery_leads`
- no elimina tablas, no elimina columnas y no reescribe registros existentes
- igual debe tratarse como cambio con riesgo de DB y seguir backup previo obligatorio antes de `prisma migrate deploy`
- no cambia la logica base de confirmacion de pagos de Mercado Pago ni de transferencia, pero si amplia la informacion persistida alrededor del funnel

Validacion local:

- `npx prisma validate`: OK
- `npx prisma generate`: OK
- `npx tsc --noEmit`: OK
- `npm run build`: OK

Comandos seguros recomendados para publicarlo:

```bash
cd /opt/iqkids/web
git status --short
docker compose ps
git branch --show-current
git fetch origin
git log --oneline --decorate --max-count=8 HEAD origin/<rama>
git diff --stat HEAD..origin/<rama>
cp .env.production .env.production.backup-2026-08-30
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > /root/iqkids-backup-2026-08-30-marketing.dump
git pull origin <rama>
docker compose build app
docker compose run --rm app npx prisma migrate deploy
docker compose up -d app
docker compose ps
docker compose logs --tail=150 app
curl -fsS https://iqkids.com.ar/admin/marketing >/dev/null
```

## 2026-08-31 - Iteracion extra de atribucion multi-touch y export operativa

Objetivo:

- ir mas alla del pedido base de marketing sobre UTM persistente y dejar trazabilidad comercial mas rica para lectura en admin y export de pedidos
- conservar el historial previo a la captura de email para no perder la primera visita anonima cuando el lead se identifica despues
- dar a marketing una lectura util de primer touch, ultimo touch, asistencias y secuencia de impactos sin cambiar la logica comercial ni de checkout

Implementacion:

- se tomo como referencia el enfoque de persistencia first seen / last seen del archivo `UTM PERSIST SNIPPET.docx`, pero se adapto al modelo actual con sesiones y eventos propios
- `ensureMarketingSession` ahora retrovincula al email todas las sesiones anonimas previas del mismo `marketingVisitorId`, preservando la historia completa desde la primera entrada
- el armado de analitica en `admin-analytics` ahora calcula por contacto y por pedido:
  - primer touch y ultimo touch
  - primer touch pago y ultimo touch pago
  - campanas, plataformas y origenes asistidos
  - cantidad de touchpoints y resumen del journey
- el export de pedidos suma columnas de trazabilidad comercial para cruce externo:
  - ultimo origen y ultima UTM
  - primer touch y ultimo touch
  - primer y ultimo touch pago
  - campanas/plataformas/origenes asistidos
  - touchpoints, primer ingreso, ultimo ingreso y journey completo
- la vista `/admin/marketing` ahora expone mejor esta lectura para el equipo de marketing sin depender solo del Excel
- `ordersInclude` y `getOrderDetail` quedaron alineados para soportar estos datos sin romper el admin de pedidos

Archivos ajustados en esta iteracion:

- `src/features/marketing/attribution-service.ts`
- `src/features/marketing/admin-analytics.ts`
- `src/app/api/admin/export/orders/route.ts`
- `src/features/orders/queries.ts`
- `src/app/admin/marketing/page.tsx`

Validacion local:

- `npx tsc --noEmit`: OK
- `npm run build`: OK

Notas operativas:

- el modelo sigue siendo aditivo y no elimina informacion existente
- el valor extra de esta iteracion es que una compra ya no queda atribuida solo a la ultima visita identificada, sino que puede reconstruirse la cadena de impactos anterior si el usuario navego anonimo antes de dejar su email
