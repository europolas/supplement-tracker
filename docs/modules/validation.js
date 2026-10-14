/**
 * Reusable client-side form rules.
 * English messages are the default; createValidators accepts the active translator. Always repeat security validation on the server.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export const validators = {
  required: value => String(value ?? '').trim() !== '' || "This field is required.",
  email: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) || "Enter a valid email address.",
  password: value => (typeof value === 'string' && [...value].length >= 15 && [...value].length <= 128) || "The password must contain 15 to 128 characters.",
  min: minimum => value => Number.isFinite(Number(value)) && Number(value) >= minimum || `Minimum value: ${minimum}.`,
  maxLength: maximum => value => [...String(value)].length <= maximum || `Maximum ${maximum} characters.`,
  matches: other => value => value === other || "The values do not match."
};
export function validate(data, rules) {
  const errors = {};
  for (const [key, checks] of Object.entries(rules)) for (const check of checks) { const result = check(data[key], data); if (result !== true) { errors[key] = String(result || "Invalid value."); break; } }
  return { valid: !Object.keys(errors).length, errors };
}

/** Bind built-in validation errors to the app translator; custom validators remain caller-owned. */
export function createValidators(i18n) {
  return {
    ...Object.fromEntries(['required', 'email', 'password'].map(key => [key, value => { const result = validators[key](value); return result === true ? true : i18n.message(result); }])),
    min: minimum => value => validators.min(minimum)(value) === true || i18n.t('validationMin', { minimum }),
    maxLength: maximum => value => validators.maxLength(maximum)(value) === true || i18n.t('validationMax', { maximum }),
    matches: other => value => validators.matches(other)(value) === true || i18n.message('The values do not match.')
  };
}
