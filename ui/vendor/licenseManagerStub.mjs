/**
 * Stub for `@primeui/license-manager` (PrimeVue 5).
 *
 * PrimeVue 5.0.0 added a license check that runs on every `app.use(PrimeVue, …)`
 * and prints a console warning plus a fixed "Invalid PrimeUI License" banner when
 * no license key is configured. The cryptographic signature only gates premium
 * components — majoor uses community components only, so the check is pure
 * noise. This stub makes `verifyLicense` report valid, suppressing the warning
 * and banner without affecting functionality.
 *
 * Wired via `resolve.alias` in vite.config.mjs (see `@primeui/license-manager`).
 */

const VERIFY_STATUS = Object.freeze({
    valid: true,
    status: "active",
    message: "PrimeUI license is active.",
});

export function registerLicense() {
    // No-op: community components don't need a key.
    return undefined;
}

export function getLicenseService() {
    return null;
}

export async function verifyLicense() {
    return VERIFY_STATUS;
}

export async function verify() {
    return VERIFY_STATUS;
}

export function createLicenseService() {
    return { verify: async () => VERIFY_STATUS, has: () => true };
}

export function formatLicenseMessage() {
    return VERIFY_STATUS.message;
}

export const PRIMEUI_PRODUCT = "primeui";
export const PRIMEUI_PRO_PREFIX = "primeui-pro:";
export const PRODUCT_MAP = Object.freeze({
    primeui: "primeui",
});
export const SHORT_NAME_LABELS = Object.freeze({
    primeui: "PrimeUI",
});
export const GRACE_DAYS = 30;
