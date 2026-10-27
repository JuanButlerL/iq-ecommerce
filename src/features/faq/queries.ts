import { prisma } from "@/lib/db/prisma";

export async function getPublishedFaqs() {
  return prisma.frequentlyAskedQuestion.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
}

export async function getAdminFaqs() {
  return prisma.frequentlyAskedQuestion.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
}
