# Question sources

`examples/level1.json`–`level15.json` real mənbə JSON fayllarıdır və mövcud formatdadır:

```json
{
  "id": 1,
  "question": "...",
  "correct_answer": "...",
  "wrong_answers": ["...", "...", "..."]
}
```

Fayllar seed və CLI idxal qurğusunda `İslam ümumi` kateqoriyasına, fayl adındakı səviyyəyə bağlanır. CLI eyni JSON-u təkrar idxal etdikdə mətn fingerprint-i sayəsində duplicate yaratmır.

Admin panel canonical formatda da preview/import dəstəkləyir. Faylları mütləq commit etməzdən əvvəl məzmunu yoxlayın: import validatoru sualın mətnini və cavablarını bazaya yazır, dini məzmunu yoxlamır.
