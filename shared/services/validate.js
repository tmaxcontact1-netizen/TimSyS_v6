'use strict';

const { ValidationService } = require('../../contracts/validate');

/**
 * ValidationService implementation using Zod.
 */
class ValidationServiceImpl extends ValidationService {
  validate(schema, data) {
    const result = schema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    }

    return {
      success: false,
      errors: result.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    };
  }

  sanitize(input) {
    if (typeof input === 'string') {
      return this._sanitizeString(input);
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.sanitize(item));
    }

    if (input !== null && typeof input === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(input)) {
        result[this._sanitizeString(key)] = this.sanitize(value);
      }
      return result;
    }

    return input;
  }

  _sanitizeString(str) {
    // Remove HTML tags
    let cleaned = str.replace(/<\/?[^>]+(>|$)/g, '');

    // Remove script content
    cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');

    // Escape dangerous characters
    cleaned = cleaned
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    return cleaned;
  }
}

const validate = new ValidationServiceImpl();

module.exports = validate;