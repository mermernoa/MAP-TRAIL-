import { describe, expect, it } from 'vitest';
import { missingRules } from '../lib/password';

describe('mot de passe', () => {
  it('exige 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial', () => {
    expect(missingRules('Trail2027!')).toEqual([]);
    expect(missingRules('trail2027!').map((r) => r.id)).toEqual(['upper']);
    expect(missingRules('Trail2027').map((r) => r.id)).toEqual(['symbol']);
    expect(missingRules('Tr@il1').map((r) => r.id)).toEqual(['length']);
    expect(missingRules('').length).toBe(5);
  });
});
