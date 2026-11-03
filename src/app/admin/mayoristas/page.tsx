import { redirect } from "next/navigation";

// La portada del grupo Mayorista es el maestro de clientes; el contenido de la página vive en /admin/mayoristas/landing.
export default function AdminWholesaleIndexPage() {
  redirect("/admin/mayoristas/clientes");
}
