import { z } from "zod";

export const questionSchema = z.object({
  question: z.string().trim().min(3, "Sual ən azı 3 simvoldan ibarət olmalıdır").max(5000, "Sual çox uzundur"),
  answers: z.array(z.object({
    /** Kept so the API updates the existing row instead of creating a new one. */
    id: z.string().optional(),
    text: z.string().trim().min(1, "Cavab boş ola bilməz").max(1000, "Cavab çox uzundur"),
    isCorrect: z.boolean()
  })).min(2, "Ən azı iki cavab tələb olunur").max(8, "Ən çoxu səkkiz cavab ola bilər"),
  categoryId: z.string().min(1, "Kateqoriya seçin"),
  levelId: z.string().min(1, "Səviyyə seçin"),
  points: z.number({ error: "Xal sayı rəqəm olmalıdır" }).int().min(0).max(100000),
  imageUrl: z.string().url().optional().or(z.literal(""))
}).superRefine((value, context) => {
  const correctCount = value.answers.filter((answer) => answer.isCorrect).length;
  if (correctCount !== 1) {
    context.addIssue({ code: "custom", path: ["answers"], message: "Dəqiq bir doğru cavab seçin" });
  }
  const normalizedAnswers = value.answers.map((answer) => answer.text.trim().toLocaleLowerCase("az"));
  if (new Set(normalizedAnswers).size !== normalizedAnswers.length) {
    context.addIssue({ code: "custom", path: ["answers"], message: "Cavab mətnləri unikal olmalıdır" });
  }
});

export type QuestionFormValues = z.infer<typeof questionSchema>;
