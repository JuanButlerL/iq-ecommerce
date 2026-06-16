"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { testimonialFormSchema } from "@/lib/validations/testimonial";

export async function saveTestimonial(payload: unknown, testimonialId?: string) {
  const parsed = testimonialFormSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Datos de testimonio invalidos.", 400);
  }

  const data = {
    name: parsed.data.name,
    roleLabel: parsed.data.roleLabel || null,
    quote: parsed.data.quote,
    avatarLabel: parsed.data.avatarLabel || null,
    active: parsed.data.active,
    sortOrder: parsed.data.sortOrder,
  };

  if (testimonialId) {
    await prisma.testimonial.update({
      where: { id: testimonialId },
      data,
    });
  } else {
    await prisma.testimonial.create({
      data,
    });
  }

  revalidateTestimonialViews();
}

export async function deleteTestimonial(testimonialId: string) {
  await prisma.testimonial.delete({
    where: { id: testimonialId },
  });

  revalidateTestimonialViews();
}

function revalidateTestimonialViews() {
  revalidatePath("/");
  revalidatePath("/admin/testimonios");
}
