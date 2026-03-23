import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Container className="py-16">
      <Card className="mx-auto max-w-2xl space-y-5 p-8 text-center">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">404</p>
        <h1 className="font-display text-5xl text-brand-ink">No encontramos esa pagina</h1>
        <p className="text-brand-ink/70">Volvé al inicio o explorá las barritas disponibles.</p>
        <Link href="/">
          <Button>Ir al inicio</Button>
        </Link>
      </Card>
    </Container>
  );
}
