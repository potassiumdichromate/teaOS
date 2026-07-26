// Local-dev-only seed: Subjects/Chapters and one demo account per role.
// Never seeds fake ChainAnchor/MidenNote rows — those only ever come from a
// real testnet/mainnet call, per the project's no-mocks rule (see
// docs/DATABASE.md "Migrations").
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const physics = await prisma.subject.upsert({
    where: { name: "Physics" },
    update: {},
    create: { name: "Physics" },
  });
  const mechanics = await prisma.chapter.upsert({
    where: { subjectId_name: { subjectId: physics.id, name: "Mechanics" } },
    update: {},
    create: { subjectId: physics.id, name: "Mechanics" },
  });

  const passwordHash = await bcrypt.hash("dev-password-only", 10);

  const teacherUser = await prisma.user.upsert({
    where: { email: "teacher@example.dev" },
    update: {},
    create: { email: "teacher@example.dev", passwordHash, role: "TEACHER" },
  });
  await prisma.teacherProfile.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      fullName: "Demo Teacher",
      subjects: { connect: [{ id: physics.id }] },
      chapters: { connect: [{ id: mechanics.id }] },
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.dev" },
    update: {},
    create: { email: "admin@example.dev", passwordHash, role: "ADMIN" },
  });
  await prisma.adminProfile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { userId: adminUser.id, fullName: "Demo Admin", designation: "NTA Controller" },
  });

  const centerUser = await prisma.user.upsert({
    where: { email: "center@example.dev" },
    update: {},
    create: { email: "center@example.dev", passwordHash, role: "CENTER" },
  });
  await prisma.centerProfile.upsert({
    where: { userId: centerUser.id },
    update: {},
    create: {
      userId: centerUser.id,
      centerCode: "CTR-001",
      name: "Demo Examination Center",
      address: "123 Test Street, Demo City",
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: "student@example.dev" },
    update: {},
    create: { email: "student@example.dev", passwordHash, role: "STUDENT" },
  });
  await prisma.studentProfile.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      applicationId: "APP-000001",
      fullName: "Demo Student",
      dob: new Date("2008-05-14"),
    },
  });

  console.log("Seed complete:", { physics: physics.id, mechanics: mechanics.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
