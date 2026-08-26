# Prompt de ejecucion para rediseño del home y ampliaciones de admin

## Objetivo

Implementar el nuevo home basado en `RediseñoWeb/IQ_Kids_Sitio_Completo_2.html`, adaptandolo al proyecto real de IQ Kids, manteniendo intactas todas las funcionalidades productivas existentes y ampliando el backoffice para que ciertos contenidos del nuevo diseño sean administrables.

## Contexto del proyecto actual

Este repo ya tiene en produccion:

- storefront publico con home, catalogo, PDP, carrito y checkout
- checkout con transferencia bancaria y Mercado Pago
- panel admin operativo
- Prisma + PostgreSQL
- Supabase Auth
- Supabase Storage
- integraciones de analytics:
  - Google Analytics
  - Microsoft Clarity
  - Meta Pixel
  - Meta Conversions API
- integracion de sync externo:
  - Apps Script / Google Sheets provider / mock

El sistema actual ya funciona y no puede romperse.

## Fuente de diseño a migrar

Tomar como referencia principal:

- `RediseñoWeb/IQ_Kids_Sitio_Completo_2.html`

Y usar como assets base las imagenes de:

- `RediseñoWeb/foto header ppal`
- `RediseñoWeb/foto quienes somos`
- `RediseñoWeb/foto producto`
- `RediseñoWeb/una decicion menos todos los dias`

## Aclaraciones de negocio importantes

1. El archivo HTML es referencia visual y estructural del nuevo home.
2. No copiar los colores del HTML original.
3. Usar los colores reales de la marca ya existentes en el proyecto:
   - rosa principal: `#F48991`
   - celeste: `#7bd8f7`
   - amarillo: `#ffd35c`
4. El color principal visual de la marca debe ser el rosa.
5. El menu del nuevo home no debe navegar entre paginas del home:
   - debe hacer scroll a secciones de una misma landing
6. No eliminar ni romper las rutas actuales:
   - `/productos`
   - `/productos/[slug]`
   - `/carrito`
   - `/checkout`
   - `/checkout/transfer/[orderNumber]`
   - `/checkout/mercado-pago/[orderNumber]`
   - `/checkout/confirmacion/[orderNumber]`
   - `/admin/*`
7. No romper ni modificar negativamente:
   - Mercado Pago
   - Google Analytics
   - Clarity
   - Meta Pixel
   - Meta Conversions API
   - sync por Apps Script / Google
   - storage de imagenes ya publicadas
   - pedidos existentes
8. La implementacion debe poder levantarse y probarse correctamente en local durante toda la iteracion.
9. El HTML de referencia ya contempla mobile y eso debe respetarse como requisito prioritario.

## Alcance funcional exacto

### 1. Rediseñar el home publico

Reemplazar el home actual por una landing de una sola pagina inspirada en el HTML de `RediseñoWeb`, usando componentes React/Next reales del proyecto.

La nueva home debe incluir al menos estas secciones, adaptadas al contenido real:

- hero principal
- bloque "Una decision menos todos los dias"
- bloque de beneficios / simplicidad / ingredientes
- seccion de productos
- seccion "quienes somos"
- seccion de testimonios de clientes
- seccion final tipo newsletter / coming soon / institucional
- footer

Regla visual y funcional de productos en home y PDP:

- en la seccion de productos del home debe mostrarse solo una foto por producto
- esa foto debe ser la imagen principal del producto o, si no existe principal, la primera disponible
- dentro de la pagina de detalle de producto deben seguir mostrandose todas las fotos del producto
- no reducir la PDP a una sola imagen

### 2. Navegacion one-page en el home

El header del home debe navegar por scroll interno hacia anchors o secciones del landing, no por cambios de pagina entre secciones del home.

Pero esto no debe romper:

- acceso al carrito
- acceso a productos si sigue existiendo la ruta independiente
- acceso a checkout
- deep links actuales

### 3. Cartel superior dinamico tipo marquee / ticker

El texto tipo:

`🚚 Envío gratis en compras mayores a $X — 48/72hs a todo el país`

debe:

- desplazarse horizontalmente estilo ticker / marquee
- ser editable desde admin
- poder activarse o desactivarse desde admin

Este cartel debe convivir con la configuracion actual de la tienda sin romperla.

### 4. Testimonios dinamicos administrables

La seccion "comentarios de clientes" no debe quedar hardcodeada.

Debe permitir desde admin:

- crear testimonio
- editar testimonio
- eliminar testimonio
- activar / desactivar testimonio
- definir orden de aparicion

Cada testimonio deberia soportar como minimo:

- nombre visible
- texto
- metadata opcional corta
  - ejemplo: `mamá de Mateo (7) · Buenos Aires`
- avatar simple o inicial opcional
- imagen opcional futura si se decide soportarla
- activo
- orden

No hace falta forzar upload de imagen de testimonio en esta iteracion si complica estabilidad. Se puede dejar preparado para evolucion futura, pero el CRUD textual debe quedar completo.

### 5. Color visual editable por producto desde admin

Hoy `Product.colorTheme` es un enum cerrado y mezcla sabor con tema visual. La nueva implementacion debe permitir que desde admin se pueda elegir el color visual del producto sin romper el sistema actual.

Requisito clave:

- mantener compatibilidad con los productos y pantallas actuales

Implementacion segura recomendada:

- no eliminar `colorTheme`
- mantenerlo para backward compatibility
- agregar nuevos campos visuales opcionales por producto, por ejemplo:
  - `brandAccentHex`
  - `brandSurfaceHex`
  - `brandTextHex`
  - o una variante equivalente bien diseñada

Reglas:

- si el producto no tiene colores custom, usar el comportamiento actual como fallback
- admin debe poder editar estos colores
- el catalogo y la nueva home deben consumir esta configuracion de forma segura

### 6. Uso de assets nuevos

Las fotos de `RediseñoWeb` deben integrarse correctamente al proyecto real.

Recomendacion:

- mover/copiar assets relevantes a una ubicacion estable del proyecto, preferiblemente `public/...`
- no depender en runtime de la carpeta `RediseñoWeb`
- mantener nombres y estructura razonables

No romper:

- imagenes de productos ya existentes
- uploads admin actuales
- placeholders actuales

## Restricciones tecnicas duras

1. No romper Prisma ni datos existentes.
2. Si hay migraciones, deben ser aditivas y backward compatible.
3. No borrar columnas o enums existentes que hoy use produccion.
4. No cambiar contratos de APIs criticas salvo que sea estrictamente necesario y compatible.
5. No romper el flujo de:
   - crear pedido
   - subir comprobante
   - confirmar Mercado Pago
   - sync de pedidos
6. No romper tracking ya instrumentado.
7. No reemplazar el sistema actual por HTML estatico.
8. El resultado debe quedar integrado con App Router, componentes y datos reales.
9. Mantener mobile y desktop funcionales.
10. Conservar el lenguaje visual de la marca real, no el del HTML original.
11. El entorno local de desarrollo debe seguir funcionando para testear el rediseño sin afectar produccion.
12. Si hay diferencias de priorizacion, primero asegurar una experiencia mobile correcta y luego pulir desktop.

## Estrategia de implementacion esperada

Implementar en fases seguras y verificables:

### Fase 1. Mapeo y preparacion

- revisar componentes actuales del home, header y footer
- identificar que partes del HTML son solo referencia visual
- definir que contenido quedara:
  - estatico
  - dinamico por `store_settings`
  - dinamico por nueva tabla de testimonios
  - dinamico por productos

### Fase 2. Modelo de datos aditivo

Agregar solo lo necesario:

- nuevos campos en `store_settings` para banner/ticker superior
- nueva tabla para testimonios administrables
- nuevos campos opcionales de color visual en `products` o una estructura equivalente compatible

Importante:

- mantener `store_settings` actual funcionando
- mantener `Product.colorTheme` actual funcionando

### Fase 3. Admin

Extender admin con:

- configuracion del ticker superior
- CRUD de testimonios
- edicion de color visual de producto

Esto debe integrarse con:

- validaciones Zod
- queries
- mutations
- API routes
- UI admin

### Fase 4. Home nueva

Reemplazar el home actual por la nueva landing usando:

- assets reales
- productos reales desde DB
- testimonios reales desde DB
- ticker superior configurable
- navegación por scroll

La seccion de productos debe usar datos reales del catalogo.

Reglas de imagenes:

- en home renderizar solo una imagen por producto
- preferir imagen principal
- fallback a primera imagen disponible
- si no hay imagen valida, usar el fallback actual del sistema
- en PDP mantener la galeria completa y el comportamiento multi-imagen

### Fase 5. Compatibilidad y regresion

Verificar que sigan funcionando:

- catalogo
- PDP
- carrito
- checkout transferencia
- checkout Mercado Pago
- admin productos
- admin pedidos
- admin sync
- export de pedidos
- analytics

## Decisiones de diseño esperadas

### Sobre colores

- usar `brand.pink` como dominante
- celeste y amarillo como soporte
- evitar palette salmon/teal del HTML de referencia
- mantener coherencia con `tailwind.config.ts`

### Sobre tipografia

No es obligatorio copiar las fuentes del HTML si compromete consistencia o performance. Se puede:

- conservar la familia tipografica actual del proyecto
- o introducir una mejora controlada si queda bien integrada y no genera riesgo innecesario

### Sobre navegacion

El header del home debe tener enlaces de scroll hacia secciones como:

- inicio
- productos
- quienes somos
- testimonios
- contacto o cierre institucional

Pero fuera del home, el resto del sitio debe seguir navegando normalmente.

## Requisitos de compatibilidad

### Productos existentes

- los productos ya cargados deben seguir viendose
- las imagenes publicadas actuales deben seguir funcionando
- si no se configuran nuevos colores, debe verse bien igual
- en home deben verse con una sola imagen
- en PDP deben seguir viendose con todas sus imagenes

### Integraciones

Debe preservarse exactamente:

- Meta Pixel events
- Meta Conversions API
- Google Analytics events
- Clarity
- webhook y retorno de Mercado Pago
- sync por Apps Script

No eliminar ni mover hooks/eventos sin reemplazo equivalente.

### Admin

No degradar:

- configuracion actual
- edicion de productos
- gestion de pedidos
- export
- sync

## Criterios de aceptacion

La tarea se considera bien hecha solo si:

1. La home nueva refleja la estructura del HTML de referencia, pero con branding real IQ Kids.
2. El menu del home navega por scroll interno.
3. El ticker superior existe, se mueve horizontalmente y es editable/activable desde admin.
4. Los testimonios son dinamicos y administrables desde admin.
5. El color visual de producto puede editarse desde admin sin romper el modelo actual.
6. Los productos existentes siguen funcionando.
7. En home cada producto muestra solo una imagen y en PDP conserva su galeria completa.
8. Checkout, Mercado Pago, tracking y sync no se rompen.
9. La experiencia mobile queda correctamente implementada y alineada con el HTML de referencia.
10. El flujo local de desarrollo permite probar toda la migracion sin romper compatibilidad con produccion.
11. El proyecto compila y pasa verificaciones basicas.

## Verificaciones minimas obligatorias al terminar

Ejecutar y validar:

- `npm run build`
- `npx prisma validate`
- `npm run dev`

Y probar manualmente:

- home
- home mobile
- scroll del menu
- carrito
- checkout transferencia
- checkout Mercado Pago
- PDP con galeria completa
- admin productos
- admin configuracion
- admin pedidos
- admin sync
- testimonios admin
- ticker admin
- seccion de productos del home mostrando una sola imagen por producto

## Entregables esperados

1. migraciones Prisma aditivas
2. cambios de schema y validaciones
3. nuevos componentes/admin para testimonios y ticker
4. home rediseñada integrada al proyecto real
5. assets integrados correctamente
6. resumen final de cambios
7. lista de riesgos residuales si quedara alguno

## Advertencias explicitas

- No hacer un reemplazo bruto del home con el HTML tal cual.
- No romper compatibilidad con datos existentes.
- No hardcodear testimonios si se pidio CRUD admin.
- No usar colores del HTML original; usar los del proyecto.
- No tocar la logica de pagos ni analytics salvo para preservarla dentro del nuevo layout.
- Si alguna parte del rediseño del HTML entra en conflicto con la arquitectura actual, priorizar estabilidad productiva y compatibilidad.
- No asumir que por verse bien en desktop ya esta resuelto; mobile es critico.
- No romper el entorno local de desarrollo porque este trabajo se va a iterar y testear ahi.

## Resultado esperado

Un nuevo home visualmente alineado al mock de `RediseñoWeb`, implementado sobre la arquitectura real de Next/Prisma/admin existente, con ampliacion segura de base de datos y panel admin, sin romper ninguna funcionalidad de produccion.
