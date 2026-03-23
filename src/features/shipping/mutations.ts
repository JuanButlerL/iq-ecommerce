"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { shippingProvinceSchema, shippingRuleSchema } from "@/lib/validations/shipping";

type ShippingRulePayload = {
  rule: unknown;
  provinces: unknown[];
};

export async function saveShippingRule(payload: ShippingRulePayload, ruleId?: string) {
  const parsedRule = shippingRuleSchema.safeParse(payload.rule);
  const parsedProvinces = payload.provinces.map((province) => shippingProvinceSchema.safeParse(province));

  if (!parsedRule.success || parsedProvinces.some((province) => !province.success)) {
    throw new AppError("Regla de envio invalida.", 400);
  }

  const provinceData = parsedProvinces.map((province) => {
    if (!province.success) {
      throw new AppError("Provincia invalida.", 400);
    }

    return province.data;
  });

  if (ruleId) {
    await prisma.$transaction(async (tx) => {
      await tx.shippingRule.update({
        where: { id: ruleId },
        data: parsedRule.data,
      });

      await tx.shippingRuleProvince.deleteMany({
        where: { shippingRuleId: ruleId },
      });

      await tx.shippingRuleProvince.createMany({
        data: provinceData.map((province) => ({
          shippingRuleId: ruleId,
          ...province,
        })),
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      const createdRule = await tx.shippingRule.create({
        data: parsedRule.data,
      });

      await tx.shippingRuleProvince.createMany({
        data: provinceData.map((province) => ({
          shippingRuleId: createdRule.id,
          ...province,
        })),
      });
    });
  }

  revalidatePath("/admin/envios");
  revalidatePath("/checkout");
}
