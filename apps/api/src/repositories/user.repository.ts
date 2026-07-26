import { prisma } from "../lib/prisma.js";

export const userRepository = {
  findByEmail: (email: string) =>
    prisma.user.findUnique({
      where: { email },
      include: { teacherProfile: true, adminProfile: true, centerProfile: true, studentProfile: true },
    }),

  findById: (id: string) => prisma.user.findUnique({ where: { id } }),

  linkWallet: (id: string, args: { evmAddress?: string; midenAccountId?: string }) =>
    prisma.user.update({ where: { id }, data: args }),
};
