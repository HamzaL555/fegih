# Question JSON import

Sistem iki formatı qəbul edir.

## Canonical format

```json
[
  {
    "category": "Quran",
    "level": 1,
    "points": 10,
    "question": "İslamın neçə şərti vardır?",
    "answers": [
      { "text": "3", "isCorrect": false },
      { "text": "4", "isCorrect": false },
      { "text": "5", "isCorrect": true },
      { "text": "6", "isCorrect": false }
    ],
    "explanation": "İslamın beş şərti vardır.",
    "image": "https://res.cloudinary.com/.../question.webp"
  }
]
```

- `category` mövcud və aktiv kateqoriyanın adı/slug-u olmalıdır.
- `level` mövcud və aktiv səviyyənin ID və ya order dəyəridir.
- `points` verilməzsə səviyyənin DB xalı götürülür.
- `image` yalnız HTTPS URL ola bilər.
- Hər sualda 2–8 cavab, unikal mətn və dəqiq bir `isCorrect: true` olmalıdır.

## Repo legacy formatı

```json
[
  {
    "id": 1,
    "question": "...",
    "correct_answer": "...",
    "wrong_answers": ["...", "...", "..."]
  }
]
```

Legacy faylda səviyyə filename-dən (`level7.json` → 7) və ya CLI `--level` seçimindən götürülür. Düzgün cavab idxal zamanı cavablar arasında təsadüfi mövqe alır; mobil API heç vaxt düzgün cavabı start cavabında qaytarmır.

## Validation report

Preview hər problemi aşağıdakı məlumatla qaytarır:

```json
{
  "itemIndex": 4,
  "field": "answers",
  "code": "correct_answer_count",
  "message": "Hər sualda dəqiq bir düzgün cavab olmalıdır"
}
```

`itemIndex` sıfır əsaslıdır; UI `itemIndex + 1` göstərir. Eyni faylda təkrar mətn və database-də eyni fingerprint də import önizləməsində `duplicate: true` kimi göstərilir.

## CLI

```bash
npm run import:questions -- path/to/questions.json --level 3 --category "Quran"
npm run import:questions -- questions/examples --recursive --category "İslam ümumi"
```

CLI heç bir sualı təhlükəsizlik səbəbindən silmir; yalnız validasiya olunan və daha əvvəl mövcud olmayan məlumatları əlavə edir. Transaction hər fayl üçün icra olunur.
