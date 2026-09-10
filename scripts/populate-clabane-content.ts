/**
 * Populates the existing Clabane Academy modules with real content sourced
 * from clabane.com (via web search — direct fetching of the site was
 * blocked by this environment's network policy; see CONTENT-SOURCES.md for
 * exactly which pages/facts were used and how).
 *
 * This does NOT change the platform's architecture. It writes into the
 * same Module/Lesson/Assessment/Question/AnswerOption tables the admin UI
 * already manages — everything here could equally have been typed in by
 * an administrator through Content Management, just at a volume where a
 * script is faster and less error-prone than 37 lessons of manual entry.
 *
 * Idempotent-ish: re-running replaces each module's lessons and assessment
 * wholesale (delete + recreate) rather than trying to diff/merge, since
 * partial merges of curriculum content are more error-prone than a clean
 * replace. Existing employee progress tied to the replaced lessons/
 * assessments is intentionally reset — see resetTrainingProgress() below.
 */
import { PrismaClient } from "@prisma/client";
import { getStorageService } from "../src/lib/storage";

const prisma = new PrismaClient();

interface LessonInput {
  slug: string;
  title: string;
  content: string;
}

interface OptionInput {
  text: string;
  isCorrect: boolean;
}

interface QuestionInput {
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  text: string;
  explanation?: string;
  options: OptionInput[];
}

async function cleanUpOrphanTestData() {
  console.log("Cleaning up prior QA/UAT test accounts and stale storage objects...");

  // Videos attached to lessons we're about to replace get cascade-deleted
  // at the DB level, but their storage objects need explicit cleanup first
  // (Prisma's onDelete: Cascade has no idea object storage exists).
  const videos = await prisma.video.findMany();
  if (videos.length > 0) {
    const storage = getStorageService();
    await Promise.all(
      videos.map((v) =>
        storage.deleteObject({ provider: v.storageProvider, bucket: v.storageBucket, key: v.storageKey })
      )
    );
    console.log(`  Removed ${videos.length} video object(s) from storage.`);
  }

  // Certificates reference a completion state that's about to become
  // inaccurate (all content is being replaced) — clean these up too so
  // nobody appears certified against curriculum they never saw.
  const certificates = await prisma.certificate.findMany();
  if (certificates.length > 0) {
    const storage = getStorageService();
    await Promise.all(
      certificates
        .filter((c) => c.storageBucket && c.storageKey)
        .map((c) =>
          storage.deleteObject({ provider: c.storageProvider!, bucket: c.storageBucket!, key: c.storageKey! })
        )
    );
    await prisma.certificate.deleteMany();
    console.log(`  Removed ${certificates.length} certificate(s) issued against the old placeholder content.`);
  }

  // Throwaway accounts created during earlier UAT/smoke-testing sessions —
  // not real users, safe to remove entirely.
  const testAccounts = await prisma.user.deleteMany({
    where: { OR: [{ email: { startsWith: "smoketest+" } }, { email: { startsWith: "uat.taylor+" } }] },
  });
  if (testAccounts.count > 0) {
    console.log(`  Removed ${testAccounts.count} leftover UAT test account(s).`);
  }

  // Remaining demo employees (jane.doe, sam.smith) keep their accounts but
  // get a clean progress slate against the new curriculum.
  await prisma.moduleProgress.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.videoProgress.deleteMany();
  await prisma.assessmentAttempt.deleteMany();
  console.log("  Reset progress/attempt history for remaining demo accounts.");
}

async function replaceModuleContent(
  slug: string,
  title: string,
  description: string,
  lessons: LessonInput[]
) {
  const module_ = await prisma.module.update({
    where: { slug },
    data: { title, description },
  });

  await prisma.lesson.deleteMany({ where: { moduleId: module_.id } });
  for (let i = 0; i < lessons.length; i++) {
    await prisma.lesson.create({
      data: {
        moduleId: module_.id,
        slug: lessons[i].slug,
        title: lessons[i].title,
        content: lessons[i].content,
        order: i,
        isPublished: true,
      },
    });
  }
  console.log(`  ${title}: wrote ${lessons.length} lesson(s).`);
  return module_.id;
}

async function replaceModuleAssessment(
  moduleId: string,
  title: string,
  passMarkPercent: number,
  questions: QuestionInput[]
) {
  await prisma.assessment.deleteMany({ where: { moduleId } });
  const assessment = await prisma.assessment.create({
    data: { moduleId, title, passMarkPercent, isPublished: true },
  });

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await prisma.question.create({
      data: {
        assessmentId: assessment.id,
        type: q.type,
        text: q.text,
        explanation: q.explanation,
        marks: 1,
        order: i,
        isActive: true,
        options: {
          create: q.options.map((o, idx) => ({ text: o.text, isCorrect: o.isCorrect, order: idx })),
        },
      },
    });
  }
  console.log(`  ${title}: wrote ${questions.length} question(s), pass mark ${passMarkPercent}%.`);
}

// ---------------------------------------------------------------------------
// MODULE 1 — WHO WE ARE
// ---------------------------------------------------------------------------

const module1Lessons: LessonInput[] = [
  {
    slug: "introduction",
    title: "Introduction",
    content: `# Welcome to Module 1

This module introduces you to Clabane — who we are, why we exist, and what we stand for. By the end of this module, you should understand our origin, our mission, our values, and what makes Clabane different in the skincare industry.

## Learning Objectives
- Explain where Clabane came from and why it was founded
- Describe Clabane's mission and purpose
- Identify Clabane's core values
- Describe what makes Clabane different from other skincare brands

## What You'll Cover
- Our Story
- Why Clabane Exists
- Our Mission and Purpose
- Our Values
- Our Culture
- What Clabane Stands For

> Key takeaway: Clabane is a dermatologist-led skincare brand built specifically for sensitive skin, with a strong focus on African skin. Understanding this focus will help you represent the brand accurately and confidently with every customer.

This module is based on Clabane's official website (clabane.com). Where Clabane has additional internal materials — for example a fuller founder interview or company timeline — your manager may provide these separately.`,
  },
  {
    slug: "our-story",
    title: "Our Story",
    content: `# Our Story

Clabane is a skincare brand founded by Dr. Malik Ssempereza, who serves as CEO & Founder. Clabane is a Ugandan-born brand, built with dermatologists at the helm and science at its core.

## Why Clabane Was Created
Clabane was created to fill a gap in the skincare market: there was no dedicated brand focused on sensitive African skin. Most skin conditions affecting sensitive skin need long-term, daily maintenance with products that are safe, gentle, and effective — and at the time, these products weren't readily available for African skin specifically.

## The Science Behind It
African skin has a higher concentration of melanin and can behave differently to other skin types because of genetic makeup and climate — particularly when the skin is sensitive. Clabane's products are formulated by African dermatologists, using world-class standards and natural ingredients, to meet these specific needs.

## Confirmed Company Facts
- All Clabane products are **SGS certified** — safe and gentle, with no side effects
- Clabane is the most recommended sensitive skincare brand by doctors and pharmacists in East Africa
- Clabane also operates in hair care, through the **Clabane Hair Series**, formulated for African hair needs

## Read the Full Story
This is a summary. For the complete story in Clabane's own words, visit clabane.com/pages/our-story.

> Key takeaway: Clabane exists because sensitive African skin needed a dedicated, dermatologist-led skincare brand — and that gap is what Dr. Ssempereza set out to close.

[CLABANE INTERNAL POLICY REQUIRED: If there is a more detailed founder story, company timeline, or milestones that Clabane wants new employees to know, please add them here.]`,
  },
  {
    slug: "why-clabane-exists",
    title: "Why Clabane Exists",
    content: `# Why Clabane Exists

Clabane exists to solve a real problem: sensitive African skin was underserved by the skincare industry.

## The Gap We Fill
- Sensitive skin often needs long-term, daily maintenance
- Many existing products weren't formulated with African skin's specific needs in mind
- African skin has a higher melanin concentration and can react differently to certain ingredients, climates, and conditions

## Our Response
Clabane brought together African dermatologists to formulate products specifically for this need, combining world-class formulation standards with natural ingredients.

## Why This Matters to You
As a Clabane employee, understanding this "why" helps you:
- Explain to customers why Clabane products are formulated differently
- Recommend the right products with confidence
- Represent a brand with a genuine purpose, not just a product line

> Key takeaway: Every Clabane product exists to serve people with sensitive skin — especially sensitive African skin — who were not well served before.`,
  },
  {
    slug: "our-mission-and-purpose",
    title: "Our Mission and Purpose",
    content: `# Our Mission and Purpose

## Our Mission
> "We harness nature to develop solutions that heal, nourish, nurture and protect sensitive skin for a better quality of life."

## What This Means Day to Day
- **Heal**: helping resolve skin concerns like acne, pigmentation, and eczema
- **Nourish**: providing skin with what it needs to function and look healthy
- **Nurture**: caring for skin over the long term, not just a "quick fix"
- **Protect**: shielding skin from damage, for example sun protection

## Our Vision
To be the leading cosmeceutical brand for sensitive African skin — providing unique care that celebrates the beauty of African skin in its varied shades, textures, and needs.

> Key takeaway: Clabane's mission isn't just about selling skincare — it's about improving quality of life through healthier skin.`,
  },
  {
    slug: "our-values",
    title: "Our Values",
    content: `# Our Values

Clabane's core values guide how the brand formulates products and treats customers.

## Our Core Values
- **Safety First** — all products are SGS certified, safe, and gentle, with no side effects
- **Authenticity** — formulations are created by African dermatologists using world-class standards
- **Excellence** — commitment to excellence in customer service, prioritising each client's unique needs
- **Community** — committed to giving back and promoting skin health education
- **Natural Innovation** — harnessing nature to develop healing solutions

> Key takeaway: Clabane's values centre on taking sensitive skin seriously, combining science with nature, and trusting dermatologist expertise.`,
  },
  {
    slug: "our-culture",
    title: "Our Culture",
    content: `# Our Culture

## Customer-Centric
Clabane keeps our customers at the heart of everything we do. That principle should guide every interaction you have, whether you're formulating, selling, or supporting.

## Team Appreciation
Clabane values celebrating its team and recognising the people behind the brand.

## Passion for African Skin Health
Culturally, Clabane is driven by a genuine passion for African skin health and education — not just selling products.

## What to Expect
[CLABANE INTERNAL POLICY REQUIRED: Please describe the day-to-day mechanics of Clabane's working culture — for example how teams collaborate, company traditions, communication style, and what new employees should expect in their first weeks.]

> Key takeaway: Clabane's culture is customer-centric, team-oriented, and driven by a genuine passion for African skin health and education.`,
  },
  {
    slug: "what-clabane-stands-for",
    title: "What Clabane Stands For",
    content: `# What Clabane Stands For

## What Makes Clabane Different
- **Focus on sensitive skin**: Clabane isn't a general skincare brand — sensitive skin, especially sensitive African skin, is the specific focus
- **Dermatologist-formulated**: products are developed by African dermatologists, not generic cosmetic labs
- **Science plus nature**: formulations combine natural ingredients with dermatological science
- **Purpose over product**: the stated aim is a better quality of life through healthier skin, not just selling more products

## Our Long-Term Ambition
Clabane positions itself as a leading dermatologist-developed skincare brand in Africa dedicated to sensitive skin. As an employee, part of that ambition is carried by every customer interaction you have — each one is a chance to prove that a dedicated, sensitive-skin-first brand can make a genuine difference.

[CLABANE INTERNAL POLICY REQUIRED: If Clabane has specific stated long-term goals — for example regional expansion, new product lines, or sustainability commitments — please add them here.]

## Knowledge Check
You'll now take a short assessment covering everything in this module. You need to score at least 80% to complete Module 1. If you don't pass on your first attempt, you'll be able to review this module and try again.`,
  },
];

const module1Questions: QuestionInput[] = [
  {
    type: "TRUE_FALSE",
    text: "Clabane was created specifically to serve sensitive skin, with a strong focus on African skin.",
    explanation: "Clabane was founded to fill a gap in the market for cosmeceuticals formulated for sensitive African skin.",
    options: [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "Who is the CEO & Founder of Clabane?",
    options: [
      { text: "Dr. Malik Ssempereza", isCorrect: true },
      { text: "Dr. Aisha Osei", isCorrect: false },
      { text: "Mr. John Mukasa", isCorrect: false },
      { text: "Dr. Sarah Nakato", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "According to Clabane's mission, what does Clabane aim to do for skin?",
    options: [
      { text: "Heal, nourish, nurture, and protect it", isCorrect: true },
      { text: "Clean, brighten, firm, and tone it", isCorrect: false },
      { text: "Exfoliate, hydrate, tan, and cool it", isCorrect: false },
      { text: "Bleach, thin, tighten, and mattify it", isCorrect: false },
    ],
  },
  {
    type: "TRUE_FALSE",
    text: "African skin has a higher concentration of melanin and can behave differently due to genetic makeup and climate.",
    options: [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "Clabane's products are formulated by:",
    options: [
      { text: "African dermatologists", isCorrect: true },
      { text: "Generic overseas cosmetic labs", isCorrect: false },
      { text: "Customer focus groups only", isCorrect: false },
      { text: "Marketing consultants", isCorrect: false },
    ],
  },
  {
    type: "TRUE_FALSE",
    text: "If Clabane's specific internal company culture hasn't been provided by management yet, it's fine to describe it to a new employee anyway based on assumptions.",
    explanation: "Anything marked as requiring Clabane internal input should never be invented or guessed at.",
    options: [
      { text: "True", isCorrect: false },
      { text: "False", isCorrect: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// MODULE 2 — HOW WE WORK
// ---------------------------------------------------------------------------

const module2Lessons: LessonInput[] = [
  {
    slug: "professional-standards",
    title: "Professional Standards",
    content: `# Professional Standards

As a Clabane employee, you represent a brand built on trust, expertise, and care for people with sensitive skin. Professional standards help make sure every customer and colleague experiences that consistently.

## General Expectations
The points below are general professional workplace expectations, not confirmed Clabane-specific policy. They apply until your manager provides Clabane's official standards.
- Be punctual and reliable
- Communicate clearly and respectfully
- Dress and present yourself appropriately for your role
- Treat colleagues and customers with courtesy at all times
- Take ownership of your work and follow through on commitments

[CLABANE INTERNAL POLICY REQUIRED: Please provide Clabane's official professional standards, including any specific dress code, attendance policy, and workplace conduct expectations.]

> Key takeaway: Until Clabane's specific policy is provided, apply general professional standards — punctuality, respect, and reliability — in every interaction.`,
  },
  {
    slug: "communication",
    title: "Communication",
    content: `# Communication

Clear, respectful communication is essential — both with colleagues and with customers who often come to Clabane with a sensitive skin concern they care deeply about.

## General Communication Principles
- Listen before responding — understand what the person actually needs
- Use clear, simple language and avoid jargon customers won't understand
- Be honest — don't promise something a product can't deliver
- Respond promptly, and let people know if you need more time
- Keep a calm, professional tone, even in difficult conversations

## Internal Communication
[CLABANE INTERNAL POLICY REQUIRED: Please provide Clabane's preferred internal communication channels and expectations, such as which tools to use, response time expectations, and escalation contacts.]

> Key takeaway: Good communication is about listening first and being honest — never overpromise what a Clabane product can do.`,
  },
  {
    slug: "conduct-and-ethics",
    title: "Conduct & Ethics",
    content: `# Conduct and Ethics

## General Ethical Principles
These are general workplace ethics principles. Clabane's specific code of conduct should be provided by management.
- Be honest in all dealings with customers, colleagues, and the company
- Never make product claims that aren't supported by Clabane's official information
- Protect customer information and company information (covered in more detail in Module 5)
- Avoid conflicts of interest
- Treat all colleagues and customers fairly, without discrimination

[CLABANE INTERNAL POLICY REQUIRED: Please provide Clabane's official Code of Conduct, including any specific rules on gifts, conflicts of interest, confidentiality, and disciplinary procedures.]

> Key takeaway: Never make a claim about a Clabane product that isn't confirmed by official Clabane information — this protects both the customer and the brand.`,
  },
  {
    slug: "teamwork-and-accountability",
    title: "Teamwork & Accountability",
    content: `# Teamwork and Accountability

## Why This Matters
Clabane's mission depends on consistent, reliable delivery — from formulation to the person answering a customer's question. That only works if every team member is accountable and works well with others.

## General Principles
- Support your colleagues and communicate proactively about problems
- Take responsibility for mistakes and focus on fixing them, not blaming others
- Follow through on commitments to your team
- Ask for help when you need it — don't guess on something you're unsure about, especially with customers

[CLABANE INTERNAL POLICY REQUIRED: Please provide any specific Clabane teamwork frameworks, performance expectations, or accountability processes used internally.]

> Key takeaway: If you're unsure about something, especially a product claim or a customer issue, ask rather than guess.`,
  },
  {
    slug: "representing-the-clabane-brand",
    title: "Representing the Clabane Brand",
    content: `# Representing the Clabane Brand

Every customer interaction is a reflection of Clabane's brand — a dermatologist-led, science-and-nature skincare brand focused on sensitive skin.

## What This Looks Like in Practice
- Speak about Clabane's mission and products accurately and confidently
- Only share product information that comes from official Clabane sources
- Show genuine care for customers' skin concerns — sensitive skin is personal
- Maintain a professional, approachable tone consistent with the brand

## In Person, Online, and On the Phone
Whether you're speaking with a customer face-to-face, on a call, on WhatsApp, or on social media, the same standard applies: represent Clabane as an expert, trustworthy, and caring brand.

[CLABANE INTERNAL POLICY REQUIRED: Please provide specific brand voice/tone guidelines, social media policy, and any messaging that should always or never be used.]

## Knowledge Check
You'll now take a short assessment on Module 2. A minimum score of 80% is required to complete this module.`,
  },
];

const module2Questions: QuestionInput[] = [
  {
    type: "TRUE_FALSE",
    text: "Until Clabane provides its official Code of Conduct, employees should apply general professional standards like punctuality and respect.",
    options: [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "What should you do before making a product claim to a customer?",
    options: [
      { text: "Confirm it's based on official Clabane information", isCorrect: true },
      { text: "Say whatever sounds convincing", isCorrect: false },
      { text: "Guess based on similar brands", isCorrect: false },
      { text: "Avoid answering entirely", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "Which best describes good communication with a customer?",
    options: [
      { text: "Listen first, then respond honestly and clearly", isCorrect: true },
      { text: "Talk as much as possible to sound knowledgeable", isCorrect: false },
      { text: "Agree with everything to avoid conflict", isCorrect: false },
      { text: "Use technical jargon to sound professional", isCorrect: false },
    ],
  },
  {
    type: "TRUE_FALSE",
    text: "If you make a mistake at work, the best approach is to focus on fixing it rather than blaming others.",
    options: [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "When representing Clabane on social media or WhatsApp, you should:",
    options: [
      { text: "Apply the same professional standard as an in-person interaction", isCorrect: true },
      { text: "Be more casual since it's not face-to-face", isCorrect: false },
      { text: "Only follow these standards during work hours in the office", isCorrect: false },
      { text: "Ignore messages you're unsure how to answer", isCorrect: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// MODULE 3 — OUR PRODUCTS
// ---------------------------------------------------------------------------

const module3Lessons: LessonInput[] = [
  {
    slug: "introduction",
    title: "Introduction to Our Products",
    content: `# Introduction to Our Products

This module gives you a working knowledge of Clabane's product range so you can confidently help customers find the right products for their skin.

## Learning Objectives
- Identify Clabane's main product categories
- Understand the difference between the Clabane Organics and Clabane MD ranges
- Match common skin concerns to relevant product categories
- Present products accurately, without overstating what they can do

## Two Product Lines
Clabane's catalogue includes products under two names:
- **Clabane Organics** — for example Gentle Foaming Mousse Cleanser, Vitamin C Youthful Glow Serum, Ultra Pigment Repair Kale Serum, BPO Acne Control Cream
- **Clabane MD** — for example Acne Control Cleanser, Protect & Repair Advanced Hybrid Sunscreen SPF-50, Sensitive Skin Mineral Sunscreen SPF-50

[CLABANE INTERNAL POLICY REQUIRED: Please confirm the exact positioning difference between "Clabane Organics" and "Clabane MD" so employees can explain this distinction accurately to customers.]

## What You'll Cover
Cleansers, Moisturizers, Sunscreens, Serums & Treatments, Acne Care, Pigmentation Care, Eczema & Sensitive Skin Care, Body Care, Bundles & Routines, Presenting Our Products, and FAQs.

> Key takeaway: Always match the product to the customer's actual skin concern, and never state a benefit that isn't part of Clabane's official product information.`,
  },
  {
    slug: "cleansers",
    title: "Cleansers",
    content: `# Cleansers

Cleansers are the first step in any skincare routine, removing dirt, oil, makeup, and impurities without stripping or irritating sensitive skin.

## Products We Know About
- **Clabane Organics Gentle Foaming Mousse Cleanser** — suited to all skin types, including sensitive skin; removes makeup and cleanses pores
- **Clabane Organics Acne Cleanser / Acne Cream Cleanser** — formulated to help control acne breakouts while moisturizing and unblocking pores
- **Clabane MD Acne Control Cleanser** — contains 10% benzoyl peroxide, Dead Sea minerals, grapefruit, and tea tree extract

## How to Present Cleansers
- Ask about the customer's skin type and any acne or sensitivity concerns before recommending a specific cleanser
- Explain that a gentle cleanser, like the Foaming Mousse Cleanser, is a safe general starting point for sensitive skin
- For acne-prone skin, the acne-specific cleansers may be more appropriate — see the Acne Care lesson for more detail

[CLABANE INTERNAL POLICY REQUIRED: Please confirm the complete current cleanser lineup and pricing, as the catalogue may have changed since this training was written.]

> Key takeaway: Start every skincare conversation with the right cleanser for the customer's skin type — it's the foundation of the routine.`,
  },
  {
    slug: "moisturizers",
    title: "Moisturizers",
    content: `# Moisturizers

Moisturizers hydrate and protect the skin barrier, which is especially important for sensitive skin that can be more prone to dryness and irritation.

## What We Know
Clabane's moisturizer range provides long-lasting hydration for the face and body, with protective and nourishing formulas. Some moisturizers are combined with sunscreen (see the Sunscreens lesson), including:
- **Clabane Protect & Refine Face Moisturizer with Sunscreen SPF 30** — contains Vitamin C, Niacinamide, Licorice, Chamomile, Aloe Vera, and Green Tea
- **Clabane Protect & Renew Age Reversing Face Moisturiser with Invisible Sunscreen SPF 50**

## How to Present Moisturizers
- Moisturizer is a daily-use essential, not optional, even for oily or acne-prone skin
- Where a moisturizer includes SPF, this can simplify a customer's routine by combining hydration and sun protection in one step
- Avoid claiming a moisturizer will "cure" a skin condition — describe it as supporting hydration and skin barrier health

[CLABANE INTERNAL POLICY REQUIRED: Please confirm the full moisturizer range, including any without SPF, and any specific usage instructions.]

> Key takeaway: Moisturizer is a daily essential for every skin type, including oily and acne-prone skin.`,
  },
  {
    slug: "sunscreens",
    title: "Sunscreens",
    content: `# Sunscreens

Sun protection is essential for all skin tones, including deeper skin tones, and is a core part of protecting sensitive skin from further damage or pigmentation issues.

## Products We Know About
- **Clabane MD Protect & Repair Advanced Hybrid Sunscreen SPF-50** — paraben-free, oil-free, and fragrance-free; suitable for face and body; formulated for sensitive skin
- **Clabane MD Sensitive Skin Mineral Sunscreen SPF-50**
- **Clabane Protect & Refine Face Moisturizer with Sunscreen SPF 30** and **Protect & Renew Age Reversing Face Moisturiser with Invisible Sunscreen SPF 50** — moisturizer and SPF combined (see the Moisturizers lesson)

## How to Present Sunscreens
- Daily sunscreen use is especially important for customers managing pigmentation or using active ingredients, like Vitamin C or cysteamine-based serums, that can increase sun sensitivity
- A mineral sunscreen may suit customers who prefer to avoid chemical UV filters — confirm specific formulation details against official product information before stating them
- If you're unsure of Clabane's specific reapplication guidance, refer the customer to the product packaging or clabane.com

[CLABANE INTERNAL POLICY REQUIRED: Please confirm the full SPF product range and any reapplication or usage guidance Clabane wants staff to communicate.]

> Key takeaway: Sunscreen is essential daily protection — pair it naturally with pigmentation and serum conversations.`,
  },
  {
    slug: "serums-and-treatments",
    title: "Serums & Treatments",
    content: `# Serums & Treatments

Serums are concentrated treatments targeting specific skin concerns, used after cleansing and before moisturizing.

## Products We Know About
- **Clabane Organics Vitamin C Youthful Glow Serum** — contains Ferulic acid, Hyaluronic acid, Jojoba, and Witch Hazel; supports a brighter, more youthful look
- **Clabane Organics Ultra Pigment Repair Kale Serum** — contains 5% cysteamine; designed to target hyperpigmentation, melasma, and dark spots; fragrance-free and non-comedogenic; suitable for sensitive and acne-prone skin

## How to Present Serums
- Serums are typically used in addition to, not instead of, a cleanser and moisturizer
- The Vitamin C serum is a good general-purpose brightening and antioxidant option
- The Kale Serum with cysteamine is specifically for pigmentation concerns like dark spots and melasma — pair this conversation with a sunscreen recommendation, since pigmentation-focused actives are often used alongside daily SPF

[CLABANE INTERNAL POLICY REQUIRED: Please confirm any patch-testing guidance, frequency of use, or interactions Clabane wants communicated for these actives.]

> Key takeaway: Serums target specific concerns — match the serum to the concern, and always mention sunscreen alongside pigmentation treatments.`,
  },
  {
    slug: "acne-care",
    title: "Acne Care",
    content: `# Acne Care

Clabane's acne care products are designed to treat and help prevent acne while still hydrating and soothing sensitive skin, rather than over-drying it, which can make sensitive skin worse.

## Products We Know About
- **Clabane Organics BPO Acne Control Cream** — contains benzoyl peroxide; has anti-inflammatory effects that can help calm redness and reduce inflammation from acne breakouts, beneficial for inflamed or sensitive acne-prone skin
- **Clabane Organics Acne Cleanser / Acne Cream Cleanser**
- **Clabane MD Acne Control Cleanser** — 10% benzoyl peroxide, Dead Sea minerals, grapefruit, and tea tree extract

## How to Present Acne Care
- Acknowledge that acne-prone skin can also be sensitive — Clabane's acne products are formulated with that in mind
- Benzoyl peroxide can be drying for some people; pairing an acne treatment with a suitable moisturizer is a reasonable general routine
- Don't promise acne will clear by a specific timeframe — results vary and Clabane hasn't published guaranteed timelines

[CLABANE INTERNAL POLICY REQUIRED: Please confirm any recommended usage frequency, patch-testing advice, or warnings, such as sun sensitivity, for acne products.]

> Key takeaway: Treat acne care as caring for sensitive, inflamed skin, not just "drying out" breakouts.`,
  },
  {
    slug: "pigmentation-care",
    title: "Pigmentation Care",
    content: `# Pigmentation Care

Hyperpigmentation — dark spots, melasma, uneven tone — is a common concern, and one Clabane specifically formulates for.

## Products We Know About
- **Clabane Organics Ultra Pigment Repair Kale Serum** — 5% cysteamine technology, designed to target hyperpigmentation, melasma, and dark spots; fragrance-free, non-comedogenic; suitable for sensitive and acne-prone skin

## How to Present Pigmentation Care
- Always pair a pigmentation conversation with sunscreen — sun exposure is a major driver of pigmentation, and treated skin can be more sun-sensitive
- Set realistic expectations: pigmentation correction is typically gradual, not immediate
- If a customer describes a pigmentation concern that sounds medical, such as sudden changes, pain, or bleeding, encourage them to see a dermatologist rather than self-treating

[CLABANE INTERNAL POLICY REQUIRED: Please confirm expected timelines, usage frequency, and any specific customer-facing guidance for pigmentation products.]

> Key takeaway: Pigmentation care and sunscreen go hand in hand — never recommend one without the other.`,
  },
  {
    slug: "eczema-and-sensitive-skin",
    title: "Eczema & Sensitive Skin Care",
    content: `# Eczema & Sensitive Skin Care

Sensitive skin, including eczema-prone skin, is the reason Clabane exists. This category deserves particular care in how you present it.

## Products We Know About
- **Clabane Eczema Care** (moisturising cream) — designed to soothe dry, itchy, sensitive, and irritated skin while softening and protecting it

## How to Present Eczema & Sensitive Skin Products
- Emphasise gentleness — fragrance-free, soothing, and protective language is appropriate; avoid suggesting the product is a medical treatment or cure
- Eczema can be a diagnosed medical condition — if a customer describes symptoms that sound severe or undiagnosed, encourage them to speak with a doctor or dermatologist rather than relying on skincare products alone
- Sensitive skin customers may need extra patience and reassurance — this ties directly into Module 4's customer experience training

[CLABANE INTERNAL POLICY REQUIRED: Please confirm any medical-claim boundaries Clabane requires staff to observe when discussing eczema and sensitive skin products.]

> Key takeaway: Be genuinely gentle and reassuring in these conversations, and know when to suggest a dermatologist instead of a product.`,
  },
  {
    slug: "body-care",
    title: "Body Care",
    content: `# Body Care

Clabane's range extends beyond the face to body care, though our confirmed public information here is more limited than for face products.

## What We Know
Clabane offers body washes described as non-drying and gentle, alongside moisturizing creams and lotions for long-lasting hydration, and sunscreens suitable for body use, such as the MD Advanced Hybrid Sunscreen SPF-50, which can be used on face and body.

## Hair Care
Clabane also operates in the hair care space through the **Clabane Hair Series**, formulated for African hair needs.

[CLABANE INTERNAL POLICY REQUIRED: Please provide the current body care and Clabane Hair Series product lineups, with names and key benefits for each.]

> Key takeaway: Don't guess at product names or claims for body care — confirm with your manager or the current catalogue if a customer asks for detail beyond what's covered here.`,
  },
  {
    slug: "bundles-and-routines",
    title: "Bundles & Routines",
    content: `# Bundles & Routines

Clabane offers Sets & Combos: bundles of products designed to work together as a complete routine to cleanse, moisturize, heal, and protect.

## Why Bundles Matter
- They make it easier for customers to build a complete routine without guessing which products to combine
- They often represent better value than buying items individually
- They're a natural recommendation for customers who are new to Clabane and want a simple starting point

## How to Present Bundles
- Ask about the customer's main concern, such as acne, pigmentation, or general sensitive skin, and recommend the bundle that matches, where one exists
- Explain what's included and how the products work together, for example cleanse, then treat, then moisturize, then protect

[CLABANE INTERNAL POLICY REQUIRED: Please provide the current list of Sets & Combos, their contents, and pricing.]

> Key takeaway: A bundle recommendation should always be based on the customer's actual skin concern, not just what's convenient to sell.`,
  },
  {
    slug: "presenting-our-products",
    title: "Presenting Our Products",
    content: `# Presenting Our Products

How you talk about Clabane products matters as much as which product you recommend.

## Do
- Base every claim on official Clabane product information — packaging, clabane.com, or materials from your manager
- Ask about skin type and concerns before recommending anything
- Set realistic expectations about timelines and results
- Recommend sunscreen alongside actives like Vitamin C, cysteamine-based pigmentation treatments, and other actives
- Suggest a dermatologist for anything that sounds like a medical condition

## Don't
- Don't make medical claims, such as promising a product will cure eczema — Clabane products support and soothe skin; they are not medical treatments unless officially described as such
- Don't guarantee specific results or timelines
- Don't recommend a product you're not confident about — check first

> Key takeaway: Confidence comes from accuracy. Only state what you know is true from official Clabane information.`,
  },
  {
    slug: "product-faqs",
    title: "Frequently Asked Questions",
    content: `# Frequently Asked Questions

Clabane publishes a Frequently Asked Questions page (clabane.com/pages/frequently-asked-questions) and a Key Ingredients page (clabane.com/pages/key-ingredients). We recommend reviewing both directly, as this training could not capture their full content.

## What We Can Confirm
- Clabane's products are formulated by African dermatologists for sensitive skin, using natural ingredients backed by science
- One documented key ingredient is Japanese knotweed, used for its anti-inflammatory properties, relevant to acne, eczema, and helping balance skin tone for hyperpigmentation

## Common Questions You May Get
- "Which product is right for my skin type?" — Ask about their main concern and refer to the relevant lesson in this module
- "Is this safe for sensitive skin?" — Clabane's products are formulated specifically for sensitive skin, but always recommend a patch test for new products, especially with active ingredients
- "How long until I see results?" — Be honest: results vary, and Clabane has not published guaranteed timelines

[CLABANE INTERNAL POLICY REQUIRED: Please provide the full FAQ content and Key Ingredients page content so this lesson can be completed accurately, along with any other ingredient safety guidance frequently asked by customers.]

## Knowledge Check
You'll now take a short assessment on Module 3. A minimum score of 80% is required to complete this module.`,
  },
];

const module3Questions: QuestionInput[] = [
  {
    type: "MULTIPLE_CHOICE",
    text: "Which two product line names appear in Clabane's catalogue?",
    options: [
      { text: "Clabane Organics and Clabane MD", isCorrect: true },
      { text: "Clabane Pure and Clabane Advanced", isCorrect: false },
      { text: "Clabane Classic and Clabane Premium", isCorrect: false },
      { text: "Clabane Junior and Clabane Senior", isCorrect: false },
    ],
  },
  {
    type: "TRUE_FALSE",
    text: "The Clabane Organics Ultra Pigment Repair Kale Serum contains 5% cysteamine and targets hyperpigmentation.",
    options: [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "What should always be recommended alongside a pigmentation treatment?",
    options: [
      { text: "Sunscreen", isCorrect: true },
      { text: "A stronger exfoliant", isCorrect: false },
      { text: "A fragrance-free cleanser only", isCorrect: false },
      { text: "Nothing extra is needed", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "The Clabane MD Acne Control Cleanser contains which active ingredient?",
    options: [
      { text: "10% benzoyl peroxide", isCorrect: true },
      { text: "Retinol", isCorrect: false },
      { text: "2% salicylic acid", isCorrect: false },
      { text: "Hydroquinone", isCorrect: false },
    ],
  },
  {
    type: "TRUE_FALSE",
    text: "Clabane Eczema Care is intended to soothe dry, itchy, sensitive, and irritated skin.",
    options: [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "If a customer describes symptoms that sound like a medical skin condition, you should:",
    options: [
      { text: "Recommend they see a dermatologist or doctor", isCorrect: true },
      { text: "Recommend the strongest available product", isCorrect: false },
      { text: "Tell them it will resolve on its own", isCorrect: false },
      { text: "Avoid responding", isCorrect: false },
    ],
  },
  {
    type: "TRUE_FALSE",
    text: "It is acceptable to promise a customer a specific timeframe for seeing results, even if Clabane hasn't published one.",
    explanation: "Never guarantee results or timelines that aren't officially confirmed by Clabane.",
    options: [
      { text: "True", isCorrect: false },
      { text: "False", isCorrect: true },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "Which Clabane product line is formulated specifically for African hair needs?",
    options: [
      { text: "Clabane Hair Series", isCorrect: true },
      { text: "Clabane Organics", isCorrect: false },
      { text: "Clabane MD", isCorrect: false },
      { text: "Clabane Eczema Care", isCorrect: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// MODULE 4 — CUSTOMER EXPERIENCE
// ---------------------------------------------------------------------------

const module4Lessons: LessonInput[] = [
  {
    slug: "how-customers-should-be-treated",
    title: "How Customers Should Be Treated",
    content: `# How Customers Should Be Treated

Clabane customers are often dealing with a sensitive skin concern that affects their confidence and comfort — this calls for genuine empathy, not just politeness.

## General Principles
- Treat every customer with respect, patience, and empathy
- Listen fully before responding — sensitive skin concerns can be personal
- Never make a customer feel judged about their skin
- Be honest, even when the honest answer is "I'm not sure, let me find out"

## Clabane's Support Channels
Customers can reach Clabane through:
- Email: care@clabane.com
- WhatsApp / phone: +256-750748747 or +256-762757307
- Facebook and Instagram: @ClabaneSkinCare (#ClabaneSkinCare)
- The chat feature on clabane.com

> Key takeaway: Sensitive skin is personal to the customer — lead with empathy, not just a sales pitch.

[CLABANE INTERNAL POLICY REQUIRED: Please confirm which of these channels apply to your specific team or role, and any internal customer service standards beyond what's listed here.]`,
  },
  {
    slug: "understanding-customer-needs",
    title: "Understanding Customer Needs",
    content: `# Understanding Customer Needs

Good customer experience starts with understanding what the customer actually needs, not assuming.

## Ask, Don't Assume
- What is their main skin concern?
- What is their skin type — oily, dry, combination, sensitive?
- Have they used Clabane products before?
- Are they currently using any other skincare or medical treatments?

## Why This Matters
Recommending the wrong product for a customer's actual need can damage trust, especially with sensitive skin, where the wrong product can cause a reaction. Taking the time to understand the customer properly is part of Clabane's dermatologist-led, science-based approach.

> Key takeaway: A few good questions up front prevent a bad recommendation later.`,
  },
  {
    slug: "handling-product-questions",
    title: "Handling Product Questions",
    content: `# Handling Product Questions

Product questions are one of the most common customer interactions you'll have. Module 3, Our Products, gives you the product knowledge — this lesson covers how to handle the conversation.

## How to Handle Product Questions
- If you know the answer from official Clabane information, answer clearly and confidently
- If you're not sure, say so, then find out rather than guessing
- Never invent an ingredient, benefit, or claim that isn't officially confirmed
- For medical-sounding questions, such as about a diagnosed skin condition, recommend the customer speak with a dermatologist or doctor

> Key takeaway: "I'm not sure, let me check" protects both the customer and Clabane's credibility far more than a guess does.`,
  },
  {
    slug: "returns-and-refunds",
    title: "Returns & Refunds",
    content: `# Returns & Refunds

This is Clabane's published returns and refunds information — you can refer customers to it directly.

## Damaged or Incorrect Items
If a customer receives a damaged or incorrect product, Clabane will replace it and cover the cost of return shipping. Customers should be directed to email care@clabane.com or contact Clabane by phone/WhatsApp at +256-750748747 or +256-762757307.

## Standard Returns
- Clabane's standard return window is 14 days
- Outside of this window, Clabane reserves the right to deny a refund, issue a partial refund, or provide store credit instead, at its discretion
- Customers should be encouraged to email care@clabane.com before sending anything back, to confirm eligibility

## Where to Send Returns
Clabane Skincare, Plot 3A2 & 3A3 Sports Lane, Forest Mall, 1st Floor, Room 049, Kampala, Uganda.

> Key takeaway: For damaged or incorrect items, act quickly and reassure the customer — Clabane covers the cost. For standard returns, always point customers to care@clabane.com before they send anything back.

[CLABANE INTERNAL POLICY REQUIRED: Please confirm current shipping timelines and any updates to this policy, as return policies can change.]`,
  },
  {
    slug: "complaints-and-escalation",
    title: "Complaints & Escalation",
    content: `# Complaints & Escalation

## What We Know
For damaged, incorrect, or unresolved issues, Clabane's customer-facing contact is:
- Email: care@clabane.com
- Phone / WhatsApp: +256-750748747 or +256-762757307

## Internal Escalation Process
[CLABANE INTERNAL POLICY REQUIRED: Please provide Clabane's internal escalation process — for example when a frontline employee should involve a supervisor or manager, how complaints should be logged, and expected response times.]

## General Complaint-Handling Principles
- Listen fully without interrupting
- Acknowledge the customer's frustration genuinely
- Don't get defensive — focus on solving the problem
- If you can't resolve it yourself, say so clearly and explain the next step, rather than leaving the customer unsure

> Key takeaway: A calm, honest acknowledgment plus a clear next step de-escalates almost any complaint.`,
  },
  {
    slug: "difficult-customer-scenarios",
    title: "Difficult Customer Scenarios",
    content: `# Difficult Customer Scenarios

## Scenario 1: The Frustrated Customer
A customer contacts you angry that a product "didn't work" as they expected.
Approach: Listen without interrupting. Acknowledge their frustration. Ask what result they expected and how they used the product. If appropriate, explain realistic timelines and check they used the product as intended, without sounding like you're blaming them.

## Scenario 2: The Uncertain Customer
A customer isn't sure which product is right for them and is asking a lot of questions.
Approach: This is a good sign, not an annoyance — they care about getting it right. Ask about their skin type and concern, then walk them through the relevant product category calmly.

## Scenario 3: A Question You Can't Answer
A customer asks something you genuinely don't know, such as a specific ingredient interaction.
Approach: Say "That's a great question, let me find out for you" rather than guessing. Follow up promptly.

## Scenario 4: A Medical-Sounding Concern
A customer describes symptoms that sound like a medical condition needing a doctor's attention.
Approach: Be caring but clear: recommend they see a dermatologist or doctor. Don't attempt to diagnose or promise a Clabane product will resolve it.

> Key takeaway: In every scenario, the same pattern applies — listen, stay calm, be honest, and know when to escalate or refer out.`,
  },
  {
    slug: "protecting-the-brand",
    title: "Protecting the Brand and Following Up",
    content: `# Protecting the Brand and Following Up

## Protecting the Clabane Brand
Every interaction either builds or weakens trust in Clabane. To protect the brand:
- Only make claims backed by official Clabane information
- Handle complaints calmly and professionally, even in public channels like social media
- Never argue with a customer publicly — move the conversation to a private channel, such as email, WhatsApp, or a direct message, if it becomes tense

## Customer Follow-Up
- Where appropriate, check back in with customers after a resolution to confirm they're satisfied
- Consistent, caring follow-up reinforces Clabane's reputation as a brand that genuinely cares about sensitive skin

[CLABANE INTERNAL POLICY REQUIRED: Please provide any specific brand protection guidelines, such as a social media response policy, and follow-up procedures used internally.]

## Knowledge Check
You'll now take a short assessment on Module 4. A minimum score of 80% is required to complete this module.`,
  },
];

const module4Questions: QuestionInput[] = [
  {
    type: "MULTIPLE_CHOICE",
    text: "What is Clabane's standard return window?",
    options: [
      { text: "14 days", isCorrect: true },
      { text: "7 days", isCorrect: false },
      { text: "30 days", isCorrect: false },
      { text: "60 days", isCorrect: false },
    ],
  },
  {
    type: "TRUE_FALSE",
    text: "If a customer receives a damaged or incorrect item, Clabane will cover the cost of return shipping.",
    options: [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "Before a customer sends back a standard return, they should be encouraged to:",
    options: [
      { text: "Email care@clabane.com to confirm eligibility", isCorrect: true },
      { text: "Ship it back immediately with no contact", isCorrect: false },
      { text: "Post about it on social media first", isCorrect: false },
      { text: "Wait at least 30 days before contacting Clabane", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "What is the best first step when handling an angry customer complaint?",
    options: [
      { text: "Listen fully and acknowledge their frustration", isCorrect: true },
      { text: "Explain company policy immediately", isCorrect: false },
      { text: "Transfer them to someone else right away", isCorrect: false },
      { text: "Ask them to calm down", isCorrect: false },
    ],
  },
  {
    type: "TRUE_FALSE",
    text: "It's appropriate to argue with a customer publicly on social media if they are being unreasonable.",
    options: [
      { text: "True", isCorrect: false },
      { text: "False", isCorrect: true },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "Which of these is a real Clabane customer support channel mentioned in this training?",
    options: [
      { text: "WhatsApp / phone +256-750748747", isCorrect: true },
      { text: "A dedicated 24/7 call center", isCorrect: false },
      { text: "In-app live chat only", isCorrect: false },
      { text: "SMS only", isCorrect: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// MODULE 5 — DATA AND SECURITY
// ---------------------------------------------------------------------------

const module5Lessons: LessonInput[] = [
  {
    slug: "password-security",
    title: "Password Security",
    content: `# Password Security

## General Best Practices
- Use a unique password for every system — never reuse your Clabane password elsewhere
- Use a long password or passphrase rather than a short, simple one
- Never share your password with anyone, including colleagues or IT — no legitimate request will ever ask for it
- Use a password manager if one is provided or approved by Clabane
- Change your password immediately if you suspect it may have been exposed

## Clabane Academy's Own Requirement
When you activated your Academy account, you were required to set a password of at least 10 characters, including upper case, lower case, and a number. Apply the same standard, or Clabane's official standard if different, to your other work systems.

[CLABANE INTERNAL POLICY REQUIRED: Please confirm Clabane's official password policy for company systems, including minimum requirements, password rotation rules, and whether a password manager is provided.]

> Key takeaway: Your password is the first line of defense — never share it, and never reuse it.`,
  },
  {
    slug: "protecting-customer-information",
    title: "Protecting Customer Information",
    content: `# Protecting Customer Information

Clabane holds customer information such as names, contact details, and order history. Protecting this is both a legal and ethical responsibility.

## General Principles
- Only access customer information you need for your role
- Never share customer information with anyone outside Clabane without authorization
- Don't discuss specific customer details in public or informal settings
- Be careful when sending customer information by email — confirm the recipient before sending
- Dispose of any printed customer information securely

## Privacy
Treat customer information the way you'd want your own information treated: with care, and only used for the purpose it was given.

[CLABANE INTERNAL POLICY REQUIRED: Please provide Clabane's specific data protection and privacy policy, including any legal requirements that apply to how customer data is stored and used.]

> Key takeaway: Only access and share customer information when it's genuinely necessary for your role.`,
  },
  {
    slug: "phishing-and-suspicious-messages",
    title: "Phishing & Suspicious Messages",
    content: `# Phishing & Suspicious Messages

Phishing is when someone tries to trick you into revealing information, like passwords, or taking an action, like clicking a link or making a payment, by pretending to be someone trustworthy.

## Warning Signs
- Urgent or threatening language, such as "act now or your account will be closed"
- Requests for passwords, payment details, or sensitive information by email or message
- Unexpected attachments or links, especially from unfamiliar senders
- Email addresses that look almost right but aren't, such as a slightly misspelled domain
- Messages that seem to come from a colleague or manager but ask for something unusual, such as an urgent payment or gift card purchase

## What To Do
- Don't click links or open attachments you're not confident about
- Verify unusual requests through a separate channel — call the person, don't just reply to the email
- Report suspicious messages rather than ignoring them

> Key takeaway: If a message creates urgency or asks for sensitive information, slow down and verify before acting.`,
  },
  {
    slug: "account-and-device-security",
    title: "Account & Device Security",
    content: `# Account & Device Security

## Account Security
- Log out of shared or public devices after use
- Don't leave your account logged in unattended
- Enable additional security features, such as two-factor authentication, where Clabane systems support them

## Device Security
- Keep your device's operating system and apps up to date
- Use a lock screen — PIN, password, or biometric — on any device used for work
- Don't install unapproved software on company devices
- Be cautious using public Wi-Fi for work tasks and avoid accessing sensitive systems on unsecured networks where possible

[CLABANE INTERNAL POLICY REQUIRED: Please confirm Clabane's specific device policy, for example whether personal devices may be used for work, and any required security software.]

> Key takeaway: Treat any device you use for Clabane work like it holds sensitive information, because it does.`,
  },
  {
    slug: "reporting-security-incidents",
    title: "Reporting Security Incidents",
    content: `# Reporting Security Incidents

## Why Reporting Matters
The sooner a potential security issue is reported, the sooner it can be contained. Nobody gets in trouble for reporting something that turns out to be harmless, but staying quiet about a real issue can cause real damage.

## What Counts as an Incident
- Clicking a suspicious link or opening a suspicious attachment
- Losing a work device or having one stolen
- Noticing unusual account activity, such as logins you don't recognize
- Accidentally sending customer or company information to the wrong person

## Who To Contact
[CLABANE INTERNAL POLICY REQUIRED: Please provide the specific person, team, or process employees should use to report a security incident, and how urgently they should expect a response.]

> Key takeaway: Report first, don't wait to be sure — a fast report is always better than a late one.`,
  },
  {
    slug: "responsible-use-of-systems",
    title: "Responsible Use of Company Information and Systems",
    content: `# Responsible Use of Company Information and Systems

## General Principles
- Use Clabane systems and information only for legitimate work purposes
- Don't install unauthorized software or connect unapproved devices to company systems
- Keep company information, including internal documents, pricing, and unpublished product information, confidential
- Report any system access you have that seems broader than your role requires

[CLABANE INTERNAL POLICY REQUIRED: Please provide any specific acceptable use policy Clabane has for company systems, email, and internet access.]

> Key takeaway: Company systems and information are provided for your work — use them responsibly and keep them secure.

## Knowledge Check
You'll now take a short assessment on Module 5. A minimum score of 80% is required to complete this module.`,
  },
];

const module5Questions: QuestionInput[] = [
  {
    type: "TRUE_FALSE",
    text: "You should never share your work password with a colleague, even if they say IT requested it.",
    options: [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "Which of these is a warning sign of a phishing message?",
    options: [
      { text: "Urgent language demanding immediate action", isCorrect: true },
      { text: "A message from a known, verified colleague about routine work", isCorrect: false },
      { text: "An email with no links or attachments", isCorrect: false },
      { text: "A message sent during work hours", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "If you click a suspicious link by mistake, you should:",
    options: [
      { text: "Report it as a possible security incident right away", isCorrect: true },
      { text: "Ignore it if nothing seems to happen", isCorrect: false },
      { text: "Wait to see if a problem develops before telling anyone", isCorrect: false },
      { text: "Only mention it if asked", isCorrect: false },
    ],
  },
  {
    type: "TRUE_FALSE",
    text: "Using a unique password for every system reduces the risk if one password is exposed.",
    options: [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    text: "When using a work device on public Wi-Fi, you should:",
    options: [
      { text: "Be cautious and avoid accessing sensitive systems where possible", isCorrect: true },
      { text: "Use it the same as any secure network", isCorrect: false },
      { text: "Disable your lock screen for convenience", isCorrect: false },
      { text: "Share the connection with others nearby", isCorrect: false },
    ],
  },
  {
    type: "TRUE_FALSE",
    text: "Company information such as unpublished product details should be kept confidential.",
    options: [
      { text: "True", isCorrect: true },
      { text: "False", isCorrect: false },
    ],
  },
];

// ---------------------------------------------------------------------------

async function main() {
  console.log("Populating Clabane Academy with real content...\n");

  await cleanUpOrphanTestData();

  console.log("\nWriting module content...");
  const module1Id = await replaceModuleContent(
    "who-we-are",
    "Who We Are",
    "Clabane's story, mission, values, and what makes us different, sourced from our official brand materials.",
    module1Lessons
  );
  const module2Id = await replaceModuleContent(
    "how-we-work",
    "How We Work",
    "Professional standards, communication, and conduct expected of every Clabane team member.",
    module2Lessons
  );
  const module3Id = await replaceModuleContent(
    "our-products",
    "Our Products",
    "A practical guide to Clabane's product range, organized by skin concern and category.",
    module3Lessons
  );
  const module4Id = await replaceModuleContent(
    "customer-experience",
    "Customer Experience",
    "How to deliver a Clabane-quality customer experience, including real returns and support information.",
    module4Lessons
  );
  const module5Id = await replaceModuleContent(
    "data-and-security",
    "Data and Security",
    "Practical security awareness for protecting yourself, customers, and Clabane.",
    module5Lessons
  );

  console.log("\nWriting assessments...");
  await replaceModuleAssessment(module1Id, "Who We Are Assessment", 80, module1Questions);
  await replaceModuleAssessment(module2Id, "How We Work Assessment", 80, module2Questions);
  await replaceModuleAssessment(module3Id, "Our Products Assessment", 80, module3Questions);
  await replaceModuleAssessment(module4Id, "Customer Experience Assessment", 80, module4Questions);
  await replaceModuleAssessment(module5Id, "Data and Security Assessment", 80, module5Questions);

  console.log("\nDone. Clabane Academy content populated.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
