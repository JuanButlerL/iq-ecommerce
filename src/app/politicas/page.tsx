import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";

export default function PoliciesPage() {
  return (
    <Container className="py-12 md:py-16">
      <Card className="mx-auto max-w-4xl space-y-6 p-8">
        <h1 className="font-display text-5xl leading-none text-brand-ink">Politicas y terminos</h1>
        <div className="space-y-4 text-brand-ink/70">
          <p>Los pedidos quedan registrados en base de datos antes de cualquier sincronizacion externa.</p>
          <p>La compra se considera completada cuando el comprobante fue subido correctamente.</p>
          <p>El equipo de IQ Kids valida manualmente la transferencia antes de marcar el pedido como pagado.</p>
          <p>Los costos de envio y mensajes comerciales dependen de la configuracion vigente en admin.</p>
        </div>
      </Card>
    </Container>
  );
}
