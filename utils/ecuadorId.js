// utils/ecuadorId.js
export function validateEcuadorCedula(cedulaRaw) {
  // 1) Normaliza: solo dígitos
  const cedula = String(cedulaRaw ?? "").replace(/\D/g, "");

  // 2) Debe tener 10 dígitos
  if (cedula.length !== 10) return { ok: false, reason: "LENGTH" };

  // 3) No permitir todos iguales (0000000000, 1111111111, etc.)
  if (/^(\d)\1{9}$/.test(cedula)) return { ok: false, reason: "REPEATED" };

  // 4) Provincia 01–24
  const province = Number(cedula.slice(0, 2));
  if (province < 1 || province > 24) return { ok: false, reason: "PROVINCE" };

  // 5) Tercer dígito: personas naturales 0–5
  const third = Number(cedula[2]);
  if (third < 0 || third > 5) return { ok: false, reason: "THIRD_DIGIT" };

  // 6) Dígito verificador (módulo 10 con coef 2,1,2,1...)
  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    let val = Number(cedula[i]) * coefficients[i];
    if (val >= 10) val -= 9;
    sum += val;
  }

  const checkDigit = Number(cedula[9]);
  const computed = (10 - (sum % 10)) % 10;

  if (computed !== checkDigit) return { ok: false, reason: "CHECKSUM" };

  return { ok: true, cedula, province, thirdDigit: third };
}

// Mensajes listos para UI
export function cedulaErrorMessage(reason) {
  switch (reason) {
    case "LENGTH":
      return "La cédula debe tener 10 dígitos.";
    case "REPEATED":
      return "Esta cedula ingresada ya está registrada.";
    case "PROVINCE":
      return "La cédula ingresada no es válida.";
    case "THIRD_DIGIT":
      return "La cédula ingresada no es válida.";
    case "CHECKSUM":
      return "La cédula ingresada no es válida.";
    default:
      return "La cédula ingresada no es válida.";
  }
}
