import { describe, expect, it } from 'vitest';

import { splitFullName } from './mailer.js';

describe('splitFullName', () => {
  it('splits a first and a last name', () => {
    expect(splitFullName('Rüstəm Məmmədov')).toEqual({ firstName: 'Rüstəm', lastName: 'Məmmədov' });
  });

  it('keeps a patronymic with the first name', () => {
    // "Əli Əhməd oğlu Məmmədov" — the surname is the last word.
    expect(splitFullName('Əli Əhməd oğlu Məmmədov')).toEqual({
      firstName: 'Əli Əhməd oğlu',
      lastName: 'Məmmədov',
    });
  });

  it('treats a single word as a first name', () => {
    expect(splitFullName('Leyla')).toEqual({ firstName: 'Leyla', lastName: '' });
  });

  it('handles missing input', () => {
    expect(splitFullName('')).toEqual({ firstName: '', lastName: '' });
    expect(splitFullName(null)).toEqual({ firstName: '', lastName: '' });
    expect(splitFullName(undefined)).toEqual({ firstName: '', lastName: '' });
  });

  it('collapses extra whitespace', () => {
    expect(splitFullName('  Rüstəm   Məmmədov  ')).toEqual({ firstName: 'Rüstəm', lastName: 'Məmmədov' });
  });
});
