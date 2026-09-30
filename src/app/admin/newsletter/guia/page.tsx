import Link from "next/link";
import { ArrowLeft, CalendarClock, FileUp, FlaskConical, ImagePlus, PenLine, Send, Settings2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { newsletterStatusMeta, type NewsletterStatusValue } from "@/features/newsletter/components/newsletter-admin-labels";
import { requireAdminSection } from "@/lib/auth/admin";
import { cn } from "@/lib/utils/cn";

const steps = [
  { icon: Settings2, title: "Configurar (una sola vez)", text: "En Newsletter → Configuración: remitente, casillas de prueba (hasta 5) y máximo de mails por día." },
  { icon: FileUp, title: "Crear o importar", text: "“Nueva newsletter” arranca un borrador vacío. “Importar HTML” precarga todo desde los archivos de la agencia." },
  { icon: PenLine, title: "Editar el contenido", text: "Título, resumen, categoría, asunto y bloques. Todo es editable. La vista previa muestra la web y el mail en vivo." },
  { icon: ImagePlus, title: "Subir las fotos", text: "Portada obligatoria y fotos en los bloques. Cada imagen necesita un texto alternativo que describa qué se ve." },
  { icon: FlaskConical, title: "Mandar la prueba", text: "Llega a las casillas de prueba con “[PRUEBA]” en el asunto. Si después se edita algo, hay que mandar otra." },
  { icon: CalendarClock, title: "Programar", text: "Elegís día y hora de Buenos Aires (o “Enviar ahora”), confirmás la cantidad y escribís ENVIAR." },
];

const blocks = [
  ["Título de sección", "Separa partes del texto. También sirve para la frase en negrita antes de una lista."],
  ["Párrafo", "Texto corrido. Admite **negrita**, *cursiva* y [links](https://…). Línea en blanco = párrafo nuevo."],
  ["Imagen / Imagen + texto / Galería", "Fotos con epígrafe opcional. La galería lleva 2 o 3 fotos."],
  ["Cita", "Frase de un profesional con nombre, cargo o credencial y color rosa o celeste."],
  ["Datos", "2 o 3 cifras grandes con su explicación (ej: “35% de las calorías…”)."],
  ["Lista de pasos", "Pasos numerados o con ✓ / ✗, cada uno con título y descripción."],
  ["Testimonio", "Frase de una familia con nombre, detalle y foto opcional. Se puede tomar de los testimonios cargados."],
  ["Caja destacada", "Un texto remarcado con fondo de color. El título es opcional."],
  ["Producto destacado", "Foto, nombre y precio actual del catálogo, con botón de compra."],
  ["Botón", "Llamado a la acción con link, color y una nota chica debajo."],
  ["Fuentes", "Nota al pie con las fuentes de los datos citados."],
  ["Separador", "Corte visual entre secciones."],
];

const faqs: Array<[string, ReactNode]> = [
  ["¿Importar un HTML manda mails?", "No. Importar solo crea borradores. Ningún mail sale sin prueba previa y sin que alguien escriba ENVIAR."],
  ["¿Puede llegarle dos veces la misma newsletter a alguien?", "No. El sistema lo impide en la base de datos, aunque se reenvíe a nuevos suscriptos o se reintente."],
  ["¿A quién le llega?", "A todas las personas suscriptas a la newsletter en ese momento (las que marcaron la casilla en el pop-up, el checkout o la página de newsletter). Quien se dio de baja no la recibe."],
  ["¿A qué hora sale exactamente?", "A la hora de Buenos Aires elegida, dentro de los 10 minutos siguientes. Si hay muchos suscriptos, sale por tandas y respeta el máximo diario."],
  ["Programé y quiero cambiar algo", "Podés editar hasta que empiece el envío. Al guardar cambios se cancela la programación: mandá una prueba nueva y volvé a programar."],
  ["¿Qué es “Requiere revisión”?", "El sistema frenó el envío por seguridad: se atrasó más de 12 horas (por ejemplo, el servidor estuvo caído) o creció mucho la lista. Revisá y decidí “Enviar igual” o “Cancelar envío”."],
  ["Hay mails con error", "En Envíos se pueden reintentar una sola vez. Si fallan 3 seguidos, el envío se pausa solo para no perder la lista."],
  ["¿Qué significa “A conciliar”?", "No se sabe si el proveedor aceptó ese mail (por ejemplo, un corte justo al enviar). Buscalo en el panel de Resend y marcalo como enviado o no enviado. Nunca se reintenta solo, para no duplicar."],
  ["¿Se ve en la web?", "Solo si activás “Mostrar en la web” en esa newsletter y la sección Newsletter está activa en Configuración. Una programada no aparece antes de enviarse."],
  ["¿Puedo editar una newsletter que ya salió?", "Sí, la versión web. El mail que ya se envió no cambia, y el asunto queda bloqueado."],
];

function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <Card className="p-6 md:p-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl text-brand-ink md:text-3xl">{title}</h2>
      <div className="mt-5 text-sm leading-6 text-brand-ink/75">{children}</div>
    </Card>
  );
}

export default async function NewsletterGuidePage() {
  await requireAdminSection("newsletter");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/admin/newsletter" className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-pink">
          <ArrowLeft className="h-4 w-4" /> Newsletters
        </Link>
        <h1 className="mt-2 font-display text-3xl text-brand-ink md:text-5xl">Cómo funciona la newsletter</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-ink/65 md:text-base">Guía para el equipo: del borrador al envío, sin sorpresas.</p>
      </div>

      <Card className="flex items-start gap-4 bg-[linear-gradient(110deg,#fff2f3,#fffdfa)] p-6 ring-1 ring-brand-pink/20">
        <ShieldCheck className="mt-0.5 h-7 w-7 shrink-0 text-brand-pink" />
        <div className="text-sm leading-6 text-brand-ink/75">
          <p className="font-display text-xl text-brand-ink">Regla de oro</p>
          <p>
            Un mail de newsletter <strong>solo sale</strong> si: el envío está habilitado en el servidor, la newsletter tiene una <strong>prueba enviada con el contenido actual</strong>, y alguien la
            <strong> programó escribiendo ENVIAR</strong>. Crear, importar, editar o mostrar en la web nunca envía nada.
          </p>
        </div>
      </Card>

      <Section eyebrow="Paso a paso" title="De cero al envío">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-[1.5rem] bg-brand-ink/[0.03] p-5">
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-pink text-sm font-extrabold text-white">{index + 1}</span>
                <step.icon className="h-5 w-5 text-brand-pink" />
              </span>
              <p className="mt-3 font-bold text-brand-ink">{step.title}</p>
              <p className="mt-1 text-sm text-brand-ink/65">{step.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="Importar" title="Traer newsletters desde HTML">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            En Newsletter, tocá <strong>Importar HTML</strong> y arrastrá uno o varios archivos (o elegilos con el botón).
          </li>
          <li>
            Revisá la lista: a la derecha ves los campos que se van a precargar y la vista previa del contenido. Las que ya existen aparecen marcadas y desmarcadas, para no duplicarlas.
          </li>
          <li>
            Tocá <strong>Crear borradores</strong>. Se crean en estado Borrador, ocultas en la web y sin enviar nada.
          </li>
          <li>
            Abrí cada una: subí la portada (la foto sugerida está en <strong>Notas internas</strong>), revisá textos y links, y mandá la prueba.
          </li>
        </ol>
        <p className="mt-4 rounded-2xl bg-brand-yellow/20 p-4">
          Los botones que en el HTML original no tenían link quedan apuntando a <code>/productos</code>, con un aviso en las notas internas para revisarlos.
        </p>
      </Section>

      <Section eyebrow="Contenido" title="Bloques disponibles">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <tbody>
              {blocks.map(([name, description]) => (
                <tr key={name} className="border-t border-brand-ink/8 align-top first:border-t-0">
                  <td className="w-56 py-3 pr-4 font-bold text-brand-ink">{name}</td>
                  <td className="py-3">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          Los bloques se agregan con <strong>Agregar bloque</strong> y se ordenan con las flechas. El orden del editor es el orden de la web y del mail. Los cambios se guardan con el botón <strong>Guardar</strong> que aparece abajo cuando hay cambios.
        </p>
      </Section>

      <Section eyebrow="Envío" title="Programación, horario y seguimiento">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Todos los horarios son de <strong>Buenos Aires</strong>, aunque la computadora esté en otra zona. Antes de confirmar se muestra la fecha completa (“miércoles 1 de octubre, 09:00”).
          </li>
          <li>La newsletter sale dentro de los <strong>10 minutos</strong> siguientes a la hora elegida. “Enviar ahora” usa la hora del servidor.</li>
          <li>Se envía por tandas y respeta el máximo diario, que incluye los mails automáticos de pedidos. Si se llega al tope, sigue sola al día siguiente.</li>
          <li>
            Mientras se envía podés <strong>Pausar</strong>: se frena antes del siguiente mail. Después podés reanudar o cancelar los pendientes.
          </li>
          <li>
            Cuando termina, <strong>Enviar a N nuevos</strong> la manda solo a quienes se suscribieron después.
          </li>
          <li>
            En <strong>Envíos y auditoría</strong> ves cada destinatario, aperturas, clicks, errores y quién hizo cada acción. Se puede exportar a CSV.
          </li>
        </ul>
      </Section>

      <Section eyebrow="Estados" title="Qué significa cada estado">
        <ul className="space-y-3">
          {(Object.keys(newsletterStatusMeta) as NewsletterStatusValue[]).map((status) => (
            <li key={status} className="flex items-start gap-3">
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]", newsletterStatusMeta[status].className)}>{newsletterStatusMeta[status].label}</span>
              <span>{newsletterStatusMeta[status].description}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section eyebrow="Dudas frecuentes" title="Preguntas del equipo">
        <dl className="space-y-4">
          {faqs.map(([question, answer]) => (
            <div key={question} className="rounded-[1.25rem] bg-brand-ink/[0.03] p-4">
              <dt className="font-bold text-brand-ink">{question}</dt>
              <dd className="mt-1">{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <p className="flex items-center justify-center gap-2 pb-6 text-xs text-brand-ink/45">
        <Send className="h-3.5 w-3.5" /> Ante cualquier duda antes de enviar: pausá, preguntá, y recién después seguí.
      </p>
    </div>
  );
}
