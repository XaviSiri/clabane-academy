import { describe, it, expect } from "vitest";
import {
  videoUploadUrlSchema,
  documentUploadUrlSchema,
  createQuestionSchema,
  createEmployeeSchema,
  MAX_VIDEO_SIZE_BYTES,
  MAX_DOCUMENT_SIZE_BYTES,
} from "@/lib/validation/content";
import { loginSchema } from "@/lib/validation/auth";

describe("file upload validation", () => {
  it("accepts an allowed video MIME type within the size limit", () => {
    const result = videoUploadUrlSchema.safeParse({
      fileName: "intro.mp4",
      contentType: "video/mp4",
      fileSizeBytes: 10_000_000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a disallowed MIME type (e.g. an executable disguised as a video)", () => {
    const result = videoUploadUrlSchema.safeParse({
      fileName: "malware.exe",
      contentType: "application/x-msdownload",
      fileSizeBytes: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a video over the maximum size", () => {
    const result = videoUploadUrlSchema.safeParse({
      fileName: "huge.mp4",
      contentType: "video/mp4",
      fileSizeBytes: MAX_VIDEO_SIZE_BYTES + 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a document over the maximum size", () => {
    const result = documentUploadUrlSchema.safeParse({
      fileName: "policy.pdf",
      contentType: "application/pdf",
      fileSizeBytes: MAX_DOCUMENT_SIZE_BYTES + 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported document type", () => {
    const result = documentUploadUrlSchema.safeParse({
      fileName: "notes.txt",
      contentType: "text/plain",
      fileSizeBytes: 1000,
    });
    expect(result.success).toBe(false);
  });
});

describe("question authoring validation", () => {
  it("requires at least one correct option", () => {
    const result = createQuestionSchema.safeParse({
      type: "MULTIPLE_CHOICE",
      text: "What is our mission?",
      options: [
        { text: "A", isCorrect: false },
        { text: "B", isCorrect: false },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed question", () => {
    const result = createQuestionSchema.safeParse({
      type: "TRUE_FALSE",
      text: "Passwords should be shared with colleagues.",
      options: [
        { text: "True", isCorrect: false },
        { text: "False", isCorrect: true },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("account input validation", () => {
  it("normalizes email casing for login", () => {
    const result = loginSchema.safeParse({ email: "Admin@Clabane.Example", password: "x" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("admin@clabane.example");
  });

  it("rejects an invalid email when creating an employee", () => {
    const result = createEmployeeSchema.safeParse({ email: "not-an-email", fullName: "Jane Doe" });
    expect(result.success).toBe(false);
  });
});
