import { config } from "dotenv";
config({ path: ".env.test" });

import { beforeEach } from "vitest";
import { prisma } from "@/lib/db";

// Full isolation between tests: truncate every table and cascade, then
// reset identity sequences. Cheap enough at this schema size and far less
// fragile than trying to track per-test cleanup manually.
beforeEach(async () => {
  const tables = [
    "AuditLog",
    "Certificate",
    "VideoProgress",
    "LessonProgress",
    "ModuleProgress",
    "AttemptAnswer",
    "AssessmentAttempt",
    "AnswerOption",
    "Question",
    "Assessment",
    "Document",
    "Video",
    "Lesson",
    "Module",
    "EmployeeProfile",
    "User",
  ];
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE;`);
});
