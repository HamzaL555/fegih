import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '../../config/prisma-client.js';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';
import { MAX_LEVELS, TOTAL_MAX_POINTS, TOTAL_QUESTIONS } from '../quiz/sual-cavab.js';

/**
 * Certificates are issued after a perfect 15-level Sual-Cavab run.
 *
 * There is no `Certificate` table in the schema, and adding one would require a
 * production migration. The existing `AuditLog` already stores a JSON payload
 * per user, so it is used as the durable record: the deterministic primary key
 * makes a second issue request impossible (unique PK), while the payload keeps
 * the recipient, date, score and run id. If a dedicated table is added later
 * this module is the only place that needs to change.
 */
const CERT_ENTITY = 'CERTIFICATE';
const CERT_ACTION = 'CERTIFICATE_ISSUED';
const CERT_TITLE = 'Fəqih — Sual-Cavab';
const CERT_ACHIEVEMENT = '15 səviyyənin hamısını səhvsiz tamamladınız';

function certificateId(userId: string) {
  return `CERT-${createHash('sha256').update(`fegih-certificate:${userId}`).digest('hex').slice(0, 12).toUpperCase()}`;
}

type CertificatePayload = {
  id: string;
  title: string;
  achievement: string;
  recipientName: string;
  issuedAt: string;
  sessionId: string;
  score: number;
};

function toCertificate(row: { id: string; entityId: string | null; after: unknown; createdAt: Date }): CertificatePayload {
  const payload = (row.after ?? {}) as Partial<CertificatePayload>;
  return {
    id: payload.id ?? row.entityId ?? row.id,
    title: payload.title ?? CERT_TITLE,
    achievement: payload.achievement ?? CERT_ACHIEVEMENT,
    recipientName: payload.recipientName ?? '',
    issuedAt: payload.issuedAt ?? row.createdAt.toISOString(),
    sessionId: payload.sessionId ?? '',
    score: payload.score ?? TOTAL_MAX_POINTS,
  };
}

async function existingCertificate(userId: string) {
  const row = await prisma.auditLog.findFirst({
    where: { userId, entityType: CERT_ENTITY, action: CERT_ACTION },
    orderBy: { createdAt: 'desc' },
  });
  return row ? toCertificate(row) : null;
}

/** A run only counts when every one of the 15 levels was cleared perfectly. */
async function qualifyingRun(userId: string) {
  return prisma.quizSession.findFirst({
    where: {
      userId,
      questionCount: TOTAL_QUESTIONS,
      status: 'COMPLETED',
      currentLevel: { gte: MAX_LEVELS },
      score: { gte: TOTAL_MAX_POINTS },
      completedAt: { not: null },
    },
    orderBy: { completedAt: 'desc' },
    select: { id: true, score: true, currentLevel: true, completedAt: true },
  });
}

async function progress(userId: string) {
  const best = await prisma.quizSession.findFirst({
    where: { userId, questionCount: TOTAL_QUESTIONS, status: 'COMPLETED' },
    orderBy: [{ score: 'desc' }, { completedAt: 'desc' }],
    select: { currentLevel: true, score: true, completedAt: true },
  });
  return {
    bestLevel: best?.currentLevel ?? 0,
    bestScore: best?.score ?? 0,
    requiredLevel: MAX_LEVELS,
    requiredScore: TOTAL_MAX_POINTS,
    completedAt: best?.completedAt?.toISOString() ?? null,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const certificatesRouter = Router();
certificatesRouter.use(requireAuth);

certificatesRouter.get('/', async (request, response) => {
  const userId = request.user!.id;
  const [certificate, run, stats] = await Promise.all([
    existingCertificate(userId),
    qualifyingRun(userId),
    progress(userId),
  ]);
  response.json({
    data: certificate ? [certificate] : [],
    meta: {
      eligible: Boolean(run),
      progress: stats,
      /** The run that will be referenced if the user issues now. */
      qualifyingRunId: run?.id ?? null,
    },
  });
});

certificatesRouter.post('/issue', writeLimiter, async (request, response) => {
  const userId = request.user!.id;
  const existing = await existingCertificate(userId);
  if (existing) {
    response.json({ data: existing, meta: { alreadyIssued: true } });
    return;
  }
  const run = await qualifyingRun(userId);
  if (!run) {
    const stats = await progress(userId);
    throw new ApiError(409, 'CERTIFICATE_NOT_EARNED', 'Complete all 15 levels without a mistake to earn a certificate', stats);
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } });
  const id = certificateId(userId);
  const payload: CertificatePayload = {
    id,
    title: CERT_TITLE,
    achievement: CERT_ACHIEVEMENT,
    recipientName: user.displayName,
    issuedAt: new Date().toISOString(),
    sessionId: run.id,
    score: run.score,
  };
  try {
    // Deterministic id = one certificate per user, even under concurrent calls.
    await prisma.auditLog.create({
      data: {
        id,
        userId,
        action: CERT_ACTION,
        entityType: CERT_ENTITY,
        entityId: id,
        after: payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    // Unique primary key: another request created it first.
    if ((error as { code?: string }).code !== 'P2002') throw error;
    const raced = await existingCertificate(userId);
    if (raced) {
      response.json({ data: raced, meta: { alreadyIssued: true } });
      return;
    }
    throw error;
  }
  response.status(201).json({ data: payload, meta: { alreadyIssued: false } });
});

certificatesRouter.get('/:certificateId', async (request, response) => {
  const certificateIdParam = z.string().min(1).max(120).parse(request.params.certificateId);
  const row = await prisma.auditLog.findFirst({
    where: { id: certificateIdParam, userId: request.user!.id, entityType: CERT_ENTITY, action: CERT_ACTION },
  });
  if (!row) throw ApiError.notFound('Certificate not found');
  response.json({ data: toCertificate(row) });
});

/**
 * Printable certificate. The response is HTML rather than a binary PDF so it
 * renders on every platform; the browser's "Print → Save as PDF" produces the
 * downloadable PDF without shipping a PDF font/rendering dependency to a
 * serverless function.
 */
certificatesRouter.get('/:certificateId/file', async (request, response) => {
  const certificateIdParam = z.string().min(1).max(120).parse(request.params.certificateId);
  const row = await prisma.auditLog.findFirst({
    where: { id: certificateIdParam, userId: request.user!.id, entityType: CERT_ENTITY, action: CERT_ACTION },
  });
  if (!row) throw ApiError.notFound('Certificate not found');
  const certificate = toCertificate(row);
  const issued = new Date(certificate.issuedAt).toLocaleDateString('az-AZ', { day: '2-digit', month: 'long', year: 'numeric' });
  const html = `<!doctype html>
<html lang="az">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(certificate.title)} — ${escapeHtml(certificate.recipientName)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px;
    background: #f4f7f5; font-family: Georgia, 'Times New Roman', serif; color: #123b2a; }
  .sheet { width: min(960px, 100%); background: #fffdf8; border: 2px solid #c9a227;
    outline: 10px solid #065f46; outline-offset: -18px; padding: 64px 56px; text-align: center; position: relative; }
  .brand { font-family: system-ui, -apple-system, sans-serif; letter-spacing: .35em; text-transform: uppercase;
    font-size: 13px; color: #065f46; font-weight: 700; }
  h1 { font-size: clamp(28px, 4vw, 44px); margin: 18px 0 6px; color: #065f46; }
  .gold { width: 120px; height: 3px; background: #c9a227; margin: 18px auto 28px; }
  .lede { font-size: 18px; margin: 0 0 8px; }
  .name { font-size: clamp(30px, 5vw, 52px); font-weight: 700; margin: 14px 0 18px; }
  .achievement { font-size: 19px; line-height: 1.5; max-width: 620px; margin: 0 auto 28px; }
  .meta { display: flex; gap: 28px; justify-content: center; flex-wrap: wrap; font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px; color: #4b5563; }
  .meta strong { display: block; color: #065f46; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 4px; }
  .seal { margin: 30px auto 0; width: 92px; height: 92px; border-radius: 50%; border: 2px solid #c9a227;
    display: grid; place-items: center; color: #065f46; font-family: system-ui, sans-serif; font-size: 11px;
    letter-spacing: .12em; text-transform: uppercase; }
  @media print { body { background: #fff; padding: 0; } .sheet { border-color: #c9a227; box-shadow: none; } }
</style>
</head>
<body>
  <main class="sheet">
    <div class="brand">Fəqih</div>
    <h1>Şəhadətnamə</h1>
    <div class="gold"></div>
    <p class="lede">Bu şəhadətnamə təqdim olunur</p>
    <div class="name">${escapeHtml(certificate.recipientName)}</div>
    <p class="achievement">${escapeHtml(certificate.achievement)}</p>
    <div class="meta">
      <div><strong>Verilmə tarixi</strong>${escapeHtml(issued)}</div>
      <div><strong>Nəticə</strong>${certificate.score} / ${TOTAL_MAX_POINTS} xal</div>
      <div><strong>Sertifikat ID</strong>${escapeHtml(certificate.id)}</div>
    </div>
    <div class="seal">Fəqih<br/>Sual-Cavab</div>
  </main>
</body>
</html>`;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Disposition', `inline; filename="${certificate.id}.html"`);
  response.setHeader('Cache-Control', 'private, no-store');
  response.send(html);
});
