import { cn } from "@/lib/utils/cn";

// La animación corre un tercio del ancho: con 9 copias avanza 3 textos exactos y el bucle no salta.
const COPIES = 9;

type AnnouncementMarqueeProps = {
  text: string;
  className?: string;
};

// Franja de anuncios en movimiento, compartida por la tienda y el canal mayorista.
export function AnnouncementMarquee({ text, className }: AnnouncementMarqueeProps) {
  return (
    <div className={cn("overflow-hidden text-[10px] font-extrabold uppercase tracking-[0.15em] text-white md:text-[12px] md:tracking-[0.17em]", className)}>
      <div className="flex w-max min-w-full shrink-0 animate-[marquee_26s_linear_infinite] whitespace-nowrap">
        {Array.from({ length: COPIES }).map((_, index) => (
          <span key={index} aria-hidden={index > 0} className="inline-flex items-center px-6 md:px-10">
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
