import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { getStorageService } from "@/lib/storage";

export async function GET() {
  const auth = await getAuthorizedSession(["EMPLOYEE"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const certificate = await prisma.certificate.findFirst({ where: { employeeId: auth.session.sub } });
  if (!certificate || !certificate.storageKey || !certificate.storageBucket) {
    return NextResponse.json({ error: "No certificate has been issued yet." }, { status: 404 });
  }

  const storage = getStorageService();
  const url = await storage.getSignedDownloadUrl(
    { provider: certificate.storageProvider!, bucket: certificate.storageBucket, key: certificate.storageKey },
    300
  );

  return NextResponse.json({ url, certificateNo: certificate.certificateNo, issuedAt: certificate.issuedAt });
}
