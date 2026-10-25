-- CreateTable
CREATE TABLE "QuranSurah" (
    "number" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "englishName" VARCHAR(150) NOT NULL,
    "englishNameTranslation" VARCHAR(250) NOT NULL,
    "revelationType" VARCHAR(20) NOT NULL,
    "ayahCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuranSurah_pkey" PRIMARY KEY ("number")
);

-- CreateTable
CREATE TABLE "QuranAyah" (
    "id" TEXT NOT NULL,
    "surahNumber" INTEGER NOT NULL,
    "ayahNumber" INTEGER NOT NULL,
    "arabicText" TEXT NOT NULL,
    "translationText" TEXT NOT NULL,
    "juz" INTEGER NOT NULL,
    "page" INTEGER NOT NULL,
    "isSajda" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuranAyah_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuranSurah_englishName_idx" ON "QuranSurah"("englishName");

-- CreateIndex
CREATE INDEX "QuranAyah_surahNumber_ayahNumber_idx" ON "QuranAyah"("surahNumber", "ayahNumber");

-- CreateIndex
CREATE INDEX "QuranAyah_juz_page_idx" ON "QuranAyah"("juz", "page");

-- CreateIndex
CREATE UNIQUE INDEX "QuranAyah_surahNumber_ayahNumber_key" ON "QuranAyah"("surahNumber", "ayahNumber");

-- AddForeignKey
ALTER TABLE "QuranAyah" ADD CONSTRAINT "QuranAyah_surahNumber_fkey" FOREIGN KEY ("surahNumber") REFERENCES "QuranSurah"("number") ON DELETE CASCADE ON UPDATE CASCADE;
