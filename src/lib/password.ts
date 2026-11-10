/**
 * Règles du mot de passe des comptes, les mêmes que celles du projet Supabase
 * (supabase/config.toml : 8 caractères, minuscule, majuscule, chiffre, caractère spécial).
 */
export interface PasswordRule {
  id: 'length' | 'upper' | 'lower' | 'digit' | 'symbol';
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: '8 caractères minimum', test: (p) => [...p].length >= 8 },
  { id: 'upper', label: 'Une majuscule', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Une minuscule', test: (p) => /[a-z]/.test(p) },
  { id: 'digit', label: 'Un chiffre', test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'Un caractère spécial (!@#…)', test: (p) => /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/.test(p) },
];

/** Règles non respectées (vide : mot de passe accepté). */
export const missingRules = (password: string) => PASSWORD_RULES.filter((r) => !r.test(password));

export const PASSWORD_HINT = '8 caractères minimum, avec une majuscule, une minuscule, un chiffre et un caractère spécial.';
