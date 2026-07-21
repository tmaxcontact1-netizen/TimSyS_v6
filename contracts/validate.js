'use strict';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} success
 * @property {Object|undefined} data - Coerced/parsed data on success
 * @property {Array<{path: string, message: string}>|undefined} errors - Field errors on failure
 */

/**
 * ValidationService Contract — Zod schemas.
 *
 * All input validation goes through this interface.
 * Schemas are Zod schemas passed as the first argument.
 * Sanitization strips dangerous content (e.g., HTML, scripts) from string input.
 *
 * FROZEN: Do not modify after sign-off. Implementations must conform exactly.
 */
class ValidationService {
  /**
   * Validate data against a Zod schema.
   * @param {import('zod').ZodSchema} schema - Zod schema instance
   * @param {Object} data - Input to validate
   * @returns {ValidationResult}
   */
  validate(schema, data) {
    throw new Error('ValidationService.validate: not implemented');
  }

  /**
   * Sanitize input by stripping dangerous content.
   * Recursively sanitizes strings within objects and arrays.
   * @param {*} input - Any input (string, object, array)
   * @returns {*} Same shape, sanitized
   */
  sanitize(input) {
    throw new Error('ValidationService.sanitize: not implemented');
  }
}

module.exports = { ValidationService };