/**
 * Downloads per-locale Quran translations and merges them into
 * `prisma/data/quran.json` (and then into the database) so the app can show
 * ayahs in whatever language the user selected.
 *
 * Editions come from alquran.cloud:
 *   az.musayev  - Əlikhan Musayev (Azərbaycanca)
 *   tr.ozturk  - Yasar Nuri Öztürk (Türkçə)
 *   en.asad     - Mohammad Asad (İngilisce) - fallback
 *
 * Usage: node scripts/fetch-quran-translations.mjs [--push]
 *   --push  also write the merged translations into PostgreSQL
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';

const EDITIONS = [
  { locale: 'az', edition: 'az.musayev', label: 'Əlikhan Musayev' },
  { locale: 'tr', edition: 'tr.ozturk', label: 'Yasar Nuri Öztürk' },
  { locale: 'en', edition: 'en.asad', label: 'Mohammad Asad' },
];

const dataPath = resolve('prisma/data/quran.json');

async function fetchEdition({ edition, label }) {
  process.stdout.write(`  ${edition.padEnd(12)} (${label}) ... `);
  const response = await fetch(`https://api.alquran.cloud/v1/quran/${edition}`);
  if (!response.ok) throw new Error(`${edition}: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.code !== 200 || !Array.isArray(payload.data?.surahs)) throw new Error(`${edition}: unexpected payload`);
  process.stdout.write(`${payload.data.surahs.reduce((total, surah) => total + surah.ayahs.length, 0)} aye\n`);
  return payload.data.surahs;
}

const quran = JSON.parse(await readFile(dataPath, 'utf8'));
console.log('Mövcud Quran:', quran.surahs.length, 'surə /', quran.surahs.reduce((t, s) => t + s.ayahs.length, 0), 'ayə');

for (const target of EDITIONS) {
  const surahs = await fetchEdition(target);
  let updated = 0;
  let missing = 0;
  for (let index = 0; index < quran.surahs.length; index += 1) {
    const local = quran.surahs[index];
    const remote = surahs.find((item) => item.number === local.number);
    if (!remote) continue;
    for (const ayah of local.ayahs) {
      const source = remote.ayahs.find((item) => item.numberInSurah === ayah.number);
      const text = source?.text?.trim();
      if (!text) { missing += 1; continue; }
      ayah.translations = { ...(ayah.translations ?? {}), [target.locale]: text };
      // `translationText` stays the English fallback used by search.
      if (target.locale === 'en') ayah.translation = text;
      updated += 1;
    }
  }
  console.log(`    -> ${updated} ayəyə yazıldı${missing ? `, ${missing} tapılmadı` : ''}`);
}

await writeFile(dataPath, `${JSON.stringify(quran, null, 0)}\n`, 'utf8');
console.log('Yazıldı:', dataPath);

if (process.argv.includes('--push')) {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const rows = quran.surahs.flatMap((surah) =>
    surah.ayahs
      .filter((ayah) => ayah.translations && Object.keys(ayah.translations).length)
      .map((ayah) => ({ surahNumber: surah.number, ayahNumber: ayah.number, translations: ayah.translations })),
  );
  process.stdout.write(`\nDB-yə yazılır: ${rows.length} sətir ... `);
  // One set-based UPDATE with a single JSON parameter beats 6236 round trips and
  // avoids the parameter limit a literal VALUES list would hit.
  await prisma.$executeRaw`
    UPDATE "QuranAyah" AS a
    SET "translations" = v."translations"
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
      AS v("surahNumber" int, "ayahNumber" int, "translations" jsonb)
    WHERE a."surahNumber" = v."surahNumber" AND a."ayahNumber" = v."ayahNumber"
  `;
  console.log('tamamlandı');

  const withTranslations = await prisma.quranAyah.count({
    where: { NOT: { translations: Prisma.dbNull } },
  });
  console.log('Tərcüməsi olan sətir:', withTranslations);

  for (const [surahNumber, ayahNumber] of [[1, 1], [2, 255], [112, 1]]) {
    const sample = await prisma.quranAyah.findUnique({
      where: { surahNumber_ayahNumber: { surahNumber, ayahNumber } },
      select: { translations: true },
    });
    console.log(`\nNümunə ${surahNumber}:${ayahNumber}`);
    for (const [locale, text] of Object.entries(sample?.translations ?? {})) {
      console.log(`  [${locale}] ${String(text).slice(0, 100)}…`);
    }
  }
  await prisma.$disconnect();
}
