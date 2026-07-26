import { prisma } from "../lib/prisma.js";

export const subjectRepository = {
  listAll: () => prisma.subject.findMany({ include: { chapters: true }, orderBy: { name: "asc" } }),

  listAssignedToTeacher: (userId: string) =>
    prisma.subject.findMany({
      where: { teachers: { some: { userId } } },
      include: { chapters: true },
      orderBy: { name: "asc" },
    }),
};
