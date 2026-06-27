/**
 * Central server-side utility functions.
 */

/**
 * Sanitizes the user name parameter for safe database queries or display.
 * @param {string} value - The input user name.
 * @returns {string} The sanitized user name.
 */
export function sanitizeUser(value) {
  if (!value || typeof value !== "string") {
    return "Trader";
  }
  return value.replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 32) || "Trader";
}
