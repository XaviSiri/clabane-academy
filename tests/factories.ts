import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export async function createAdmin(overrides: Partial<{ email: string; password: string }> = {}) {
  const email = overrides.email ?? `admin-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const password = overrides.password ?? "AdminPass123";
  const user = await prisma.user.create({
    data: {
      email,
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: await hashPassword(password),
      profile: { create: { fullName: "Test Admin" } },
    },
  });
  return { user, email, password };
}

export async function createEmployee(overrides: Partial<{ email: string; password: string; status: "ACTIVE" | "PENDING_ACTIVATION" | "DEACTIVATED" }> = {}) {
  const email = overrides.email ?? `employee-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const password = overrides.password ?? "EmployeePass123";
  const status = overrides.status ?? "ACTIVE";
  const user = await prisma.user.create({
    data: {
      email,
      role: "EMPLOYEE",
      status,
      passwordHash: status === "PENDING_ACTIVATION" ? null : await hashPassword(password),
      profile: { create: { fullName: "Test Employee" } },
    },
  });
  return { user, email, password };
}

export async function createPublishedModuleWithAssessment(params: {
  adminId: string;
  order?: number;
  passMarkPercent?: number;
}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const module_ = await prisma.module.create({
    data: {
      slug: `module-${suffix}`,
      title: `Test Module ${suffix}`,
      order: params.order ?? 0,
      isPublished: true,
      isRequired: true,
      createdById: params.adminId,
    },
  });

  const lesson = await prisma.lesson.create({
    data: {
      moduleId: module_.id,
      slug: "lesson-one",
      title: "Lesson One",
      content: "Some lesson content.",
      order: 0,
      isPublished: true,
    },
  });

  const assessment = await prisma.assessment.create({
    data: {
      moduleId: module_.id,
      title: "Test Assessment",
      passMarkPercent: params.passMarkPercent ?? 80,
      isPublished: true,
    },
  });

  const question = await prisma.question.create({
    data: {
      assessmentId: assessment.id,
      type: "MULTIPLE_CHOICE",
      text: "What is 2 + 2?",
      marks: 1,
      order: 0,
      options: {
        create: [
          { text: "3", isCorrect: false, order: 0 },
          { text: "4", isCorrect: true, order: 1 },
          { text: "5", isCorrect: false, order: 2 },
        ],
      },
    },
    include: { options: true },
  });

  return { module: module_, lesson, assessment, question };
}
