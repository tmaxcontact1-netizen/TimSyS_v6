/**
 * TimSyS Contract: ValidationService
 * Status: FROZEN v6.0.0
 *
 * Zod-schema-based validation and input sanitization.
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} success - Whether validation passed
 * @property {Object} [data] - Cleaned/parsed data on success
 * @property {Array<{field: string, message: string}>} [errors] - Field-level errors on failure
 */

/** @interface ValidationService */
module.exports = {
  /**
   * Validate data against a Zod schema.
   * @param {import('zod').ZodSchema} schema - Zod schema instance
   * @param {*} data - Input data to validate
   * @returns {ValidationResult}
   */
  validate(schema, data) {},

  /**
   * Sanitize raw input string.
   * Strips dangerous content, trims whitespace, normalizes encoding.
   * @param {string} input - Raw input
   * @returns {string} Sanitized output
   */
  sanitize(input) {}
};
