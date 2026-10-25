import { describe, expect, it } from 'vitest';
import { parseQuestionImport } from './question-import.js';

describe('question import parser', () => {
  it('normalizes the repository legacy format', () => {
    const result = parseQuestionImport([{ id: 1, question: 'Sual?', correct_answer: 'Düzgün', wrong_answers: ['Səhv'] }], 'Test', 2);
    expect(result.valid).toBe(true);
    expect(result.questions[0]).toMatchObject({ level: 2, category: 'Test', question: 'Sual?' });
    expect(result.questions[0]?.answers).toHaveLength(2);
  });

  it('reports duplicate answers with an item index', () => {
    const result = parseQuestionImport([{ level: 1, question: 'Sual?', answers: [{ text: 'A', isCorrect: true }, { text: 'A', isCorrect: false }] }]);
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({ itemIndex: 0, field: 'answers', code: 'duplicate_answers' });
  });
});
