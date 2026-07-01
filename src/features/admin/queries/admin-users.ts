import { prisma } from "@/lib/db/prisma";

export async function getAdminUsers() {
  return prisma.adminUser.findMany({
    orderBy: [{ active: "desc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      allowedSections: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
