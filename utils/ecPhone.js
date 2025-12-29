// utils/ecPhone.js

/**
 * Limpia a solo dígitos.
 */
export function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Recibe lo que el usuario escribió en el campo "resto" (sin +593),
 * y devuelve un "national significant number" para Ecuador (NSN):
 * - Para móvil: 9 + 8 dígitos  => 9XXXXXXXX
 *
 * Reglas UX:
 * - No permite que empiece con 0 (lo elimina).
 * - Si el usuario pega el número completo con 09..., lo normaliza a 9...
 * - Si pega +593..., también lo normaliza a 9...
 */
export function normalizeEcMobileRemainder(input) {
  let d = onlyDigits(input);

  // Si pega +593...
  if (d.startsWith("593")) d = d.slice(3);

  // Si pega 09XXXXXXXXX (10 dígitos local)
  if (d.startsWith("0")) d = d.slice(1);

  // Ahora debería empezar con 9 (móvil). Si no, lo dejamos igual para que valide luego.
  // Limita a 9 dígitos (9 + 8)
  d = d.slice(0, 9);

  return d;
}

/**
 * Valida móvil Ecuador en formato remainder (sin +593):
 * Debe ser exactamente 9 dígitos y empezar con 9.
 */
export function validateEcMobileRemainder(input) {
  const remainder = normalizeEcMobileRemainder(input);

  if (remainder.length === 0) return { ok: false, reason: "REQUIRED" };
  if (!remainder.startsWith("9")) return { ok: false, reason: "MUST_START_9" };
  if (remainder.length !== 9) return { ok: false, reason: "LENGTH" };

  return { ok: true, remainder };
}

/**
 * Convierte remainder válido a E.164 con +593
 */
export function toEcE164FromRemainder(input) {
  const res = validateEcMobileRemainder(input);
  if (!res.ok) return res;

  const e164 = `+593${res.remainder}`;
  return { ok: true, e164, remainder: res.remainder };
}

/**
 * Formatea remainder (9XXXXXXXX) como "9XX XXX XXX" (solo visual).
 */
export function formatEcMobileRemainderPretty(input) {
  const r = normalizeEcMobileRemainder(input);

  // 9 digits: 9XX XXX XXX
  // indices: 0 | 1-2 | 3-5 | 6-8
  if (r.length <= 1) return r;
  if (r.length <= 3) return `${r.slice(0, 3)} ${r.slice(3)}`.trim();
  if (r.length <= 6) return `${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6)}`.trim();
  return `${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6, 9)}`.trim();
}

export function ecPhoneErrorMessage(reason) {
  switch (reason) {
    case "REQUIRED":
      return "Ingresa tu número de celular.";
    case "MUST_START_9":
      return "En Ecuador, el celular debe empezar con 9 (ej: 9XX XXX XXX).";
    case "LENGTH":
      return "El celular debe tener 9 dígitos después de +593 (ej: +593 9XX XXX XXX).";
    default:
      return "Número inválido.";
  }
}
