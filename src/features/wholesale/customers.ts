import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { normalizeCuit } from "@/lib/utils/cuit";
import { wholesaleCustomerSchema } from "@/lib/validations/wholesale-customer";

export const WHOLESALE_CUSTOMER_FILTERS = {
  todos: "Todos",
  activos: "Activos",
  "pago-diferido": "Con pago diferido",
  "descuento-especial": "Con descuento especial",
  inactivos: "Inactivos",
} as const;

export type WholesaleCustomerFilter = keyof typeof WHOLESALE_CUSTOMER_FILTERS;

const filterWhere: Record<WholesaleCustomerFilter, Prisma.WholesaleCustomerWhereInput> = {
  todos: {},
  activos: { active: true },
  "pago-diferido": { allowDeferredPayment: true },
  "descuento-especial": { extraDiscountPercentage: { gt: 0 } },
  inactivos: { active: false },
};

export async function getWholesaleCustomers({ search, filter }: { search?: string; filter: WholesaleCustomerFilter }) {
  const term = search?.trim();
  const cuitTerm = term ? normalizeCuit(term) : "";
  const searchWhere: Prisma.WholesaleCustomerWhereInput | undefined = term
    ? {
        OR: [
          { email: { contains: term, mode: "insensitive" } },
          { contactName: { contains: term, mode: "insensitive" } },
          { businessName: { contains: term, mode: "insensitive" } },
          { legalName: { contains: term, mode: "insensitive" } },
          { city: { contains: term, mode: "insensitive" } },
          ...(cuitTerm.length >= 3 ? [{ cuit: { contains: cuitTerm } }] : []),
        ],
      }
    : undefined;

  return prisma.wholesaleCustomer.findMany({
    where: { AND: [filterWhere[filter], ...(searchWhere ? [searchWhere] : [])] },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function getWholesaleCustomer(id: string) {
  if (!isUuid(id)) {
    return null;
  }

  return prisma.wholesaleCustomer.findUnique({
    where: { id },
    include: { lead: { select: { id: true, createdAt: true } } },
  });
}

// Otros CUIT cargados con el mismo email (en el checkout se elige entre ellos).
export async function getWholesaleCustomersByEmail(email: string, excludeId?: string) {
  return prisma.wholesaleCustomer.findMany({
    where: { email: email.toLowerCase(), ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, cuit: true, businessName: true, legalName: true, contactName: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createWholesaleCustomer(payload: unknown) {
  const data = parseCustomer(payload);

  try {
    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.wholesaleCustomer.create({ data });

      // Una consulta que se convierte en cliente queda marcada como tal.
      if (data.leadId) {
        await tx.wholesaleLead.updateMany({ where: { id: data.leadId }, data: { status: "CLIENT" } });
      }

      return created;
    });

    revalidateCustomers();
    return { id: customer.id };
  } catch (error) {
    throw toFriendlyError(error);
  }
}

export async function updateWholesaleCustomer(id: string, payload: unknown) {
  if (!isUuid(id)) {
    throw new AppError("El cliente no existe.", 404, true);
  }

  // La consulta de origen solo se asigna al crear el cliente.
  const data = { ...parseCustomer(payload), leadId: undefined };

  try {
    const { count } = await prisma.wholesaleCustomer.updateMany({ where: { id }, data });

    if (count === 0) {
      throw new AppError("El cliente no existe o fue eliminado.", 404, true);
    }
  } catch (error) {
    throw toFriendlyError(error);
  }

  revalidateCustomers();
}

function parseCustomer(payload: unknown) {
  const parsed = wholesaleCustomerSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Revisá los datos del cliente.", 400, true);
  }

  return parsed.data;
}

function toFriendlyError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new AppError("Ya hay un cliente con ese CUIT. Buscalo en el listado para editarlo.", 409, true);
  }

  return error;
}

function revalidateCustomers() {
  revalidatePath("/admin/mayoristas/clientes", "layout");
  revalidatePath("/admin/mayoristas/consultas");
}

function isUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}
