import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MODULES = [
  {
    slug: "who-we-are",
    title: "Who We Are",
    description: "Company history, founder's story, vision, mission, values, and culture.",
    lessons: [
      { slug: "company-history", title: "Company History", content: "[INSERT CLABANE COMPANY HISTORY]" },
      { slug: "founders-story", title: "Founder's Story", content: "[INSERT FOUNDER STORY]" },
      { slug: "vision-mission", title: "Vision & Mission", content: "[INSERT CLABANE VISION]\n\n[INSERT CLABANE MISSION]" },
      { slug: "values-culture", title: "Values & Culture", content: "[INSERT CLABANE VALUES]\n\n[INSERT CLABANE CULTURE DESCRIPTION]" },
    ],
  },
  {
    slug: "how-we-work",
    title: "How We Work",
    description: "Professional standards, communication, internal conduct, ethics, and expected behaviour.",
    lessons: [
      { slug: "professional-standards", title: "Professional Standards", content: "[INSERT CLABANE PROFESSIONAL STANDARDS]" },
      { slug: "communication", title: "Communication", content: "[INSERT COMMUNICATION GUIDELINES]" },
      { slug: "conduct-ethics", title: "Conduct & Ethics", content: "[INSERT CODE OF CONDUCT AND ETHICS POLICY]" },
    ],
  },
  {
    slug: "our-products",
    title: "Our Products",
    description: "Product portfolio, product knowledge, how products should be presented, and FAQs.",
    lessons: [
      { slug: "product-portfolio", title: "Product Portfolio", content: "[INSERT PRODUCT INFORMATION]" },
      { slug: "presenting-products", title: "Presenting Our Products", content: "[INSERT PRODUCT PRESENTATION GUIDELINES]" },
      { slug: "faqs", title: "Frequently Asked Questions", content: "[INSERT PRODUCT FAQS]" },
    ],
  },
  {
    slug: "customer-experience",
    title: "Customer Experience",
    description: "Customer treatment, service standards, complaint handling, escalation, and brand standards.",
    lessons: [
      { slug: "service-standards", title: "Customer Service Standards", content: "[INSERT CUSTOMER SERVICE POLICY]" },
      { slug: "complaints-escalation", title: "Complaint Handling & Escalation", content: "[INSERT ESCALATION PROCEDURE]" },
      { slug: "brand-standards", title: "Brand Standards", content: "[INSERT BRAND STANDARDS]" },
    ],
  },
  {
    slug: "data-and-security",
    title: "Data and Security",
    description: "Password security, protecting customer information, privacy, phishing awareness, and basic infosec.",
    lessons: [
      { slug: "password-security", title: "Password Security", content: "[INSERT PASSWORD SECURITY POLICY]" },
      { slug: "protecting-customer-data", title: "Protecting Customer Information", content: "[INSERT DATA PROTECTION POLICY]" },
      { slug: "phishing-awareness", title: "Phishing Awareness", content: "[INSERT PHISHING AWARENESS TRAINING CONTENT]" },
    ],
  },
];

async function main() {
  console.log("Seeding Clabane Academy demo data...");

  const adminPasswordHash = await bcrypt.hash("AdminPass123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@clabane.example" },
    update: {},
    create: {
      email: "admin@clabane.example",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: adminPasswordHash,
      profile: { create: { fullName: "Alex Admin", department: "People & Culture", jobTitle: "Academy Administrator" } },
    },
  });

  for (let i = 0; i < MODULES.length; i++) {
    const m = MODULES[i];
    const module_ = await prisma.module.upsert({
      where: { slug: m.slug },
      update: {},
      create: {
        slug: m.slug,
        title: m.title,
        description: m.description,
        order: i,
        isPublished: true,
        isRequired: true,
        createdById: admin.id,
      },
    });

    let firstLessonId: string | null = null;
    for (let j = 0; j < m.lessons.length; j++) {
      const l = m.lessons[j];
      const lesson = await prisma.lesson.upsert({
        where: { moduleId_slug: { moduleId: module_.id, slug: l.slug } },
        update: {},
        create: {
          moduleId: module_.id,
          slug: l.slug,
          title: l.title,
          content: l.content,
          order: j,
          isPublished: true,
        },
      });
      if (j === 0) firstLessonId = lesson.id;
    }

    // Sample video metadata only — no binary file is actually uploaded to
    // object storage by the seed script, so this stays unpublished (it
    // demonstrates the metadata shape in the admin video manager without
    // exposing a broken player to employees). A real upload goes through
    // Admin → Content → Lesson → Upload Video, which stores the object in
    // object storage and only then writes this kind of metadata row.
    if (firstLessonId) {
      const existingVideo = await prisma.video.findFirst({ where: { lessonId: firstLessonId } });
      if (!existingVideo) {
        await prisma.video.create({
          data: {
            lessonId: firstLessonId,
            title: `${m.title} — Welcome Video [SAMPLE METADATA]`,
            description: "[INSERT VIDEO DESCRIPTION] Placeholder metadata; upload a real file via Content Management to publish.",
            storageProvider: "local",
            storageBucket: "clabane-academy",
            storageKey: `videos/sample-${m.slug}.mp4`,
            durationSeconds: 300,
            fileSizeBytes: BigInt(250 * 1024 * 1024),
            mimeType: "video/mp4",
            isPublished: false,
            uploadedById: admin.id,
          },
        });
      }
    }

    const existingAssessment = await prisma.assessment.findUnique({ where: { moduleId: module_.id } });
    if (!existingAssessment) {
      const assessment = await prisma.assessment.create({
        data: {
          moduleId: module_.id,
          title: `${m.title} Assessment`,
          passMarkPercent: 80,
          isPublished: true,
        },
      });

      await prisma.question.create({
        data: {
          assessmentId: assessment.id,
          type: "TRUE_FALSE",
          text: `[SAMPLE QUESTION] "${m.title}" is one of the five mandatory Clabane Academy onboarding modules.`,
          marks: 1,
          order: 0,
          options: {
            create: [
              { text: "True", isCorrect: true, order: 0 },
              { text: "False", isCorrect: false, order: 1 },
            ],
          },
        },
      });

      await prisma.question.create({
        data: {
          assessmentId: assessment.id,
          type: "MULTIPLE_CHOICE",
          text: `[SAMPLE QUESTION] What is the minimum passing score for a Clabane Academy module assessment?`,
          marks: 1,
          order: 1,
          options: {
            create: [
              { text: "50%", isCorrect: false, order: 0 },
              { text: "70%", isCorrect: false, order: 1 },
              { text: "80%", isCorrect: true, order: 2 },
              { text: "100%", isCorrect: false, order: 3 },
            ],
          },
        },
      });
    }
  }

  const employeePasswordHash = await bcrypt.hash("EmployeePass123", 12);
  await prisma.user.upsert({
    where: { email: "jane.doe@clabane.example" },
    update: {},
    create: {
      email: "jane.doe@clabane.example",
      role: "EMPLOYEE",
      status: "ACTIVE",
      passwordHash: employeePasswordHash,
      profile: {
        create: {
          fullName: "Jane Doe",
          department: "Customer Support",
          jobTitle: "Support Associate",
          startDate: new Date(),
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "sam.smith@clabane.example" },
    update: {},
    create: {
      email: "sam.smith@clabane.example",
      role: "EMPLOYEE",
      status: "PENDING_ACTIVATION",
      profile: {
        create: {
          fullName: "Sam Smith",
          department: "Sales",
          jobTitle: "Sales Associate",
          startDate: new Date(),
        },
      },
    },
  });

  console.log("Seed complete.");
  console.log("  Admin login:    admin@clabane.example / AdminPass123");
  console.log("  Employee login: jane.doe@clabane.example / EmployeePass123");
  console.log("  Pending employee (not yet activated): sam.smith@clabane.example");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
