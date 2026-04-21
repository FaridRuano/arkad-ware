import { cedulaErrorMessage, validateEcuadorCedula } from "@utils/ecuadorId";

const GENERIC_DOCUMENT_REGEX = /^[A-Z0-9-]{5,20}$/;

export function normalizeDocumentId(value = "") {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function validateClientDocument(rawValue) {
  const value = normalizeDocumentId(rawValue);

  if (!value) {
    return { ok: false, value, kind: "empty", message: "El documento es requerido" };
  }

  if (/^\d{10}$/.test(value)) {
    const cedulaResult = validateEcuadorCedula(value);

    if (!cedulaResult.ok) {
      return {
        ok: false,
        value,
        kind: "ecuador-cedula",
        message: cedulaErrorMessage(cedulaResult.reason),
      };
    }

    return { ok: true, value, kind: "ecuador-cedula", message: "" };
  }

  if (!GENERIC_DOCUMENT_REGEX.test(value)) {
    return {
      ok: false,
      value,
      kind: "generic",
      message: "El documento debe tener entre 5 y 20 caracteres alfanuméricos",
    };
  }

  return { ok: true, value, kind: "generic", message: "" };
}
