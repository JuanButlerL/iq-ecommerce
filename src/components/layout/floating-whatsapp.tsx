import Link from "next/link";

import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";

type FloatingWhatsappProps = {
  phone: string;
  message: string;
};

export function FloatingWhatsapp({ phone, message }: FloatingWhatsappProps) {
  return (
    <Link
      href={buildWhatsappUrl(phone, message)}
      target="_blank"
      className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-soft"
      aria-label="Contactar por WhatsApp"
    >
      <WhatsappIcon className="h-7 w-7" />
    </Link>
  );
}
