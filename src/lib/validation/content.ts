import { z } from "zod";

export const createEmployeeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: z.string().trim().min(1).max(200),
  department: z.string().trim().max(200).optional(),
  jobTitle: z.string().trim().max(200).optional(),
  startDate: z.string().datetime().optional().or(z.literal("")).optional(),
});

export const updateEmployeeSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  department: z.string().trim().max(200).optional(),
  jobTitle: z.string().trim().max(200).optional(),
  status: z.enum(["ACTIVE", "DEACTIVATED"]).optional(),
});

export const createModuleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().trim().max(2000).optional(),
  order: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
});

export const updateModuleSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  order: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

export const createLessonSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  content: z.string().max(50_000).optional(),
  order: z.number().int().min(0).optional(),
});

export const updateLessonSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(50_000).optional(),
  order: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export const MAX_VIDEO_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const videoUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1).max(300),
  contentType: z.enum(ALLOWED_VIDEO_MIME_TYPES as [string, ...string[]]),
  fileSizeBytes: z.number().int().positive().max(MAX_VIDEO_SIZE_BYTES),
});

export const documentUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1).max(300),
  contentType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES as [string, ...string[]]),
  fileSizeBytes: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES),
});

export const createVideoSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  storageKey: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
  mimeType: z.string(),
  durationSeconds: z.number().int().positive().optional(),
  completionThresholdPercent: z.number().int().min(1).max(100).optional(),
});

export const updateVideoSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  isPublished: z.boolean().optional(),
  completionThresholdPercent: z.number().int().min(1).max(100).optional(),
});

export const replaceVideoSchema = z.object({
  storageKey: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
  mimeType: z.string(),
  durationSeconds: z.number().int().positive().optional(),
});

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  storageKey: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
  mimeType: z.string(),
});

export const createAssessmentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  passMarkPercent: z.number().int().min(1).max(100).optional(),
  allowAnswerReview: z.boolean().optional(),
});

export const answerOptionSchema = z.object({
  text: z.string().trim().min(1).max(500),
  isCorrect: z.boolean(),
});

export const createQuestionSchema = z
  .object({
    type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE"]),
    text: z.string().trim().min(1).max(2000),
    explanation: z.string().trim().max(2000).optional(),
    marks: z.number().int().min(1).max(100).optional(),
    order: z.number().int().min(0).optional(),
    options: z.array(answerOptionSchema).min(2).max(10),
  })
  .refine((data) => data.options.some((o) => o.isCorrect), {
    message: "At least one option must be marked correct.",
    path: ["options"],
  });
