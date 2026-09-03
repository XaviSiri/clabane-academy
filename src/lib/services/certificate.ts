import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/db";
import { getStorageService } from "@/lib/storage";
import { recordAuditLog } from "@/lib/audit";
import { customAlphabet } from "nanoid";

const nanoidNumeric = customAlphabet("0123456789", 6);

async function generateCertificateNo(): Promise<string> {
  const year = new Date().getFullYear();
  // Retry on the rare collision rather than relying on sequential counters,
  // which would require a separate contended counter table.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `CLA-${year}-${nanoidNumeric()}`;
    const exists = await prisma.certificate.findUnique({ where: { certificateNo: candidate } });
    if (!exists) return candidate;
  }
  throw new Error("Failed to generate a unique certificate number.");
}

/**
 * Issues a certificate the moment every required module reaches COMPLETED,
 * and never before. Idempotent: calling this repeatedly for an employee who
 * already has a certificate is a no-op.
 */
export async function checkAndIssueCertificate(employeeId: string, ipAddress?: string | null) {
  const existing = await prisma.certificate.findFirst({ where: { employeeId } });
  if (existing) return existing;

  const requiredModules = await prisma.module.findMany({
    where: { isPublished: true, isRequired: true },
    select: { id: true },
  });
  if (requiredModules.length === 0) return null;

  const completedCount = await prisma.moduleProgress.count({
    where: {
      employeeId,
      moduleId: { in: requiredModules.map((m) => m.id) },
      status: "COMPLETED",
    },
  });

  if (completedCount < requiredModules.length) return null;

  const employee = await prisma.user.findUniqueOrThrow({
    where: { id: employeeId },
    include: { profile: true },
  });

  const certificateNo = await generateCertificateNo();
  const issuedAt = new Date();
  const pdfBytes = await renderCertificatePdf({
    employeeName: employee.profile?.fullName ?? employee.email,
    certificateNo,
    issuedAt,
  });

  const storage = getStorageService();
  const upload = await storage.putObject({
    key: `certificates/${employeeId}/${certificateNo}.pdf`,
    body: Buffer.from(pdfBytes),
    contentType: "application/pdf",
  });

  const certificate = await prisma.certificate.create({
    data: {
      certificateNo,
      employeeId,
      issuedAt,
      storageProvider: upload.provider,
      storageBucket: upload.bucket,
      storageKey: upload.key,
    },
  });

  await recordAuditLog({
    userId: employeeId,
    action: "CERTIFICATE_GENERATED",
    entityType: "Certificate",
    entityId: certificate.id,
    metadata: { certificateNo },
    ipAddress,
  });

  return certificate;
}

async function renderCertificatePdf(params: {
  employeeName: string;
  certificateNo: string;
  issuedAt: Date;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const navy = rgb(0.05, 0.14, 0.28);
  const gold = rgb(0.72, 0.58, 0.2);

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: gold, borderWidth: 3 });

  const centerText = (text: string, y: number, font = regular, size = 16, color = navy) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - textWidth) / 2, y, size, font, color });
  };

  centerText("CLABANE ACADEMY", height - 100, bold, 30, navy);
  centerText("Certificate of Completion", height - 140, bold, 20, gold);
  centerText("This certifies that", height - 210, regular, 14);
  centerText(params.employeeName, height - 250, bold, 26, navy);
  centerText(
    "has successfully completed the Clabane Academy onboarding programme.",
    height - 290,
    regular,
    14
  );
  centerText(`Completion Date: ${params.issuedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`, height - 350, regular, 13);
  centerText(`Certificate ID: ${params.certificateNo}`, height - 375, regular, 13);

  return doc.save();
}
