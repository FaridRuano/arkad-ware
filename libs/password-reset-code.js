const DEFAULT_MASTER_PASSWORD_RESET_CODE = "ARKAD-RESET-2026";

export function normalizeRecoveryCode(code = "") {
    return code.trim().toUpperCase();
}

export function getMasterPasswordResetCode() {
    return normalizeRecoveryCode(
        process.env.PASSWORD_RESET_CODE || DEFAULT_MASTER_PASSWORD_RESET_CODE
    );
}

export function isValidMasterPasswordResetCode(code = "") {
    return normalizeRecoveryCode(code) === getMasterPasswordResetCode();
}
