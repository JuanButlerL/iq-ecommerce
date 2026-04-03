import { cn } from "@/lib/utils/cn";

type MercadoPagoLogoProps = {
  className?: string;
};

/**
 * Mercado Pago official logo.
 * Uses the inline SVG from their public brand kit — blue wordmark on white.
 */
export function MercadoPagoLogo({ className }: MercadoPagoLogoProps) {
  return (
    <span className={cn("inline-flex items-center", className)} aria-label="Mercado Pago">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 180 48"
        className="h-8 w-auto"
        aria-hidden="true"
        fill="none"
      >
        {/* Blue circle with white smiley — MP mascot */}
        <circle cx="24" cy="24" r="24" fill="#009EE3" />
        {/* Left eye */}
        <ellipse cx="16.5" cy="21" rx="3" ry="3.5" fill="#fff" />
        {/* Right eye */}
        <ellipse cx="31.5" cy="21" rx="3" ry="3.5" fill="#fff" />
        {/* Smile arc */}
        <path
          d="M14.5 28.5 C17 33.5 31 33.5 33.5 28.5"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* "mercado" wordmark */}
        <text
          x="58"
          y="20"
          fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
          fontSize="14"
          fontWeight="700"
          fill="#009EE3"
          letterSpacing="-0.2"
        >
          mercado
        </text>
        {/* "pago" wordmark */}
        <text
          x="58"
          y="37"
          fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
          fontSize="14"
          fontWeight="700"
          fill="#009EE3"
          letterSpacing="-0.2"
        >
          pago
        </text>
      </svg>
    </span>
  );
}
