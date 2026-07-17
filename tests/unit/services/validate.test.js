'use strict';

const { z } = require('zod');
const validate = require('../../../shared/services/validate');

describe('ValidationService', function() {

  describe('validate', function() {
    test('should validate valid data against schema', function() {
      var schema = z.object({
        name: z.string(),
        age: z.number().min(0).max(150),
      });

      var result = validate.validate(schema, { name: 'Alice', age: 30 });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Alice');
      expect(result.data.age).toBe(30);
    });

    test('should reject invalid data with errors', function() {
      var schema = z.object({
        name: z.string(),
        age: z.number().min(0).max(150),
      });

      var result = validate.validate(schema, { name: 123, age: 'not-a-number' });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should reject missing required fields', function() {
      var schema = z.object({
        required: z.string(),
      });

      var result = validate.validate(schema, {});

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should return coerced data on success', function() {
      var schema = z.object({
        count: z.coerce.number(),
      });

      var result = validate.validate(schema, { count: '42' });

      expect(result.success).toBe(true);
      expect(result.data.count).toBe(42);
      expect(typeof result.data.count).toBe('number');
    });
  });

  describe('sanitize', function() {
    test('should strip HTML tags from strings', function() {
      var input = '<script>alert("xss")</script>Hello';
      var result = validate.sanitize(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello');
    });

    test('should escape dangerous characters', function() {
      var result = validate.sanitize('<img src=x onerror=alert(1)>');
      expect(result).not.toContain('<img');
    });

    test('should sanitize recursively in objects', function() {
      var input = {
        name: '<b>John</b>',
        bio: '<script>evil()</script>',
        nested: { value: '<iframe>x</iframe>' },
      };

      var result = validate.sanitize(input);

      expect(result.name).not.toContain('<b>');
      expect(result.bio).not.toContain('<script>');
      expect(result.nested.value).not.toContain('<iframe>');
    });

    test('should sanitize arrays', function() {
      var input = ['<script>1</script>', '<b>2</b>', 'normal'];
      var result = validate.sanitize(input);
      expect(result[0]).not.toContain('<script>');
      expect(result[1]).not.toContain('<b>');
      expect(result[2]).toBe('normal');
    });

    test('should pass through numbers and booleans unchanged', function() {
      expect(validate.sanitize(42)).toBe(42);
      expect(validate.sanitize(true)).toBe(true);
      expect(validate.sanitize(null)).toBeNull();
    });
  });
});