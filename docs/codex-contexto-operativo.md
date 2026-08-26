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

- Home custom rediseñada
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
- se normalizaron tildes y textos del checkout para mantener un español correcto y consistente en Argentina

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

- mostrar mensajes cortos en la pestaña del navegador cuando el usuario deja la web en segundo plano
- variar el mensaje segun donde quedo el usuario, por ejemplo home, productos, carrito y checkout
- dejar los textos faciles de editar desde codigo

Implementacion:

- se agrego un componente global cliente que escucha `document.visibilityState` y rota mensajes en la pestaña mientras la web queda en background
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

- entrar a home y cambiar de pestaña para confirmar rotacion de mensajes
- repetir prueba en productos, carrito y checkout
- probar carrito vacio y carrito con productos para validar copy dinamico
- volver a la pestaña y confirmar que el titulo original se restaura

Decision UX posterior del 20 de agosto de 2026:

- se elimino la ruta publica `\/politicas` porque no formaba parte de la navegacion real ni del flujo comercial
- se limpiaron referencias documentales y tecnicas a esa seccion para no dejar superficie muerta publicada
- para mobile se agrego un chip sutil de reenganche que aparece al volver a la pestaña despues de varios segundos fuera
- ese chip muestra un mensaje corto segun la etapa del usuario y un CTA `Seguir` que lo devuelve suavemente al contenido principal
- ese comportamiento mobile se limito solo a `carrito`, `checkout` y `checkout/transfer` para no meter recordatorios decorativos en paginas de baja intencion

Archivos adicionales tocados en esta iteracion:

- `src/lib/validations/short-link.ts`
- `docs/documentacion-web.md`

Nota posterior de cierre del 20 de agosto de 2026:

- luego de probarlo en produccion, se retiro el nudge mobile de reenganche porque no resulto confiable al volver desde Safari
- el comportamiento definitivo quedo solo para desktop mediante cambio dinamico del titulo de la pestaña
- en checkout tambien se ajusto el copy principal del formulario a: `Cargá tus datos, elegí el medio de pago y generamos tu pedido.`
- para Safari/iPhone se corrigio el icono del sitio para que use el logo real de IQ Kids en lugar del viejo `iQ` simplificado
- se declararon iconos explicitos en `metadata` para favicon y Apple touch icon, usando assets de `public/brand`
- hotfix posterior de desktop: se reforzo la restauracion del titulo con `visibilitychange`, `focus` y `pageshow`, mas una reaplicacion corta del `document.title` para evitar pestañas que quedaban mostrando `Volvé`

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
git log --oneline --decorate --max-count=8 HEAD origin/feature/resideño-front
git diff --stat HEAD..origin/feature/resideño-front
git diff HEAD..origin/feature/resideño-front -- src/app/layout.tsx
```

Comandos seguros recomendados para publicar este tipo de cambio:

```bash
cd /opt/iqkids/web
git pull origin feature/resideño-front
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


- se revirtio el favicon desktop para usar `public/brand/iq-kids-favicon.svg`, que rendia mejor en tamaño de pestaña
- se neutralizo temporalmente el favicon para evitar inconsistencias visuales y de cache entre navegadores
