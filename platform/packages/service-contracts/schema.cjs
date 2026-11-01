"use strict";
const keys = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "maxItems",
  "minItems",
  "anyOf",
  "pattern",
  "format",
]);
function assertSchema(schema, depth = 0) {
  if (
    !schema ||
    typeof schema !== "object" ||
    Array.isArray(schema) ||
    depth > 12
  )
    throw TypeError("Invalid contract schema");
  for (const key of Object.keys(schema))
    if (!keys.has(key)) throw TypeError("Unsupported schema keyword: " + key);
  if (schema.anyOf) {
    if (
      !Array.isArray(schema.anyOf) ||
      schema.anyOf.length < 2 ||
      schema.anyOf.length > 8
    )
      throw TypeError("Invalid schema alternatives");
    schema.anyOf.forEach((child) => assertSchema(child, depth + 1));
    return schema;
  }
  if (
    ![
      "object",
      "array",
      "string",
      "integer",
      "number",
      "boolean",
      "null",
    ].includes(schema.type)
  )
    throw TypeError("Unsupported schema type");
  if (schema.type === "object") {
    if (
      !schema.properties ||
      Array.isArray(schema.properties) ||
      schema.additionalProperties !== false ||
      !Array.isArray(schema.required) ||
      schema.required.some((k) => !Object.hasOwn(schema.properties, k))
    )
      throw TypeError(
        "Object contracts must enumerate required properties and forbid extras",
      );
    Object.values(schema.properties).forEach((s) => assertSchema(s, depth + 1));
  }
  if (schema.type === "array") {
    assertSchema(schema.items, depth + 1);
    if (
      !Number.isSafeInteger(schema.maxItems) ||
      schema.maxItems < 0 ||
      schema.maxItems > 1000
    )
      throw TypeError("Array bounds required");
  }
  for (const key of ["minLength", "maxLength", "minItems", "maxItems"])
    if (
      schema[key] !== undefined &&
      (!Number.isSafeInteger(schema[key]) || schema[key] < 0)
    )
      throw TypeError("Invalid schema bound");
  for (const key of [
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
  ])
    if (schema[key] !== undefined && !Number.isFinite(schema[key]))
      throw TypeError("Invalid numeric bound");
  if (schema.pattern !== undefined) new RegExp(schema.pattern);
  if (
    schema.format !== undefined &&
    !["uuid", "date", "date-time"].includes(schema.format)
  )
    throw TypeError("Unsupported schema format");
  return schema;
}
function validate(schema, value, location = "$", depth = 0) {
  if (depth > 12) return [location + ": nesting limit"];
  if (schema.anyOf)
    return schema.anyOf.some(
      (s) => validate(s, value, location, depth + 1).length === 0,
    )
      ? []
      : [location + ": no matching alternative"];
  const type =
    value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (
    schema.type === "integer"
      ? !Number.isSafeInteger(value)
      : schema.type !== type
  )
    return [location + ": expected " + schema.type];
  if (schema.enum && !schema.enum.includes(value))
    return [location + ": invalid enum"];
  if (Object.hasOwn(schema, "const") && value !== schema.const)
    return [location + ": invalid constant"];
  const errors = [];
  if (type === "object") {
    for (const key of schema.required)
      if (!Object.hasOwn(value, key))
        errors.push(location + "." + key + ": required");
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties, key))
        errors.push(location + "." + key + ": unknown field");
      else
        errors.push(
          ...validate(
            schema.properties[key],
            value[key],
            location + "." + key,
            depth + 1,
          ),
        );
    }
  }
  if (type === "array") {
    if (value.length > schema.maxItems || value.length < (schema.minItems || 0))
      errors.push(location + ": array bounds");
    else
      value.forEach((v, i) =>
        errors.push(
          ...validate(schema.items, v, location + "[" + i + "]", depth + 1),
        ),
      );
  }
  if (type === "string") {
    if (
      (schema.minLength !== undefined && value.length < schema.minLength) ||
      (schema.maxLength !== undefined && value.length > schema.maxLength) ||
      (schema.pattern && !new RegExp(schema.pattern).test(value))
    )
      errors.push(location + ": string constraints");
    if (
      schema.format === "uuid" &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      )
    )
      errors.push(location + ": uuid");
    if (
      schema.format === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      errors.push(location + ": date");
    if (schema.format === "date-time" && !Number.isFinite(Date.parse(value)))
      errors.push(location + ": timestamp");
  }
  if (
    type === "number" &&
    (!Number.isFinite(value) ||
      (schema.minimum !== undefined && value < schema.minimum) ||
      (schema.maximum !== undefined && value > schema.maximum) ||
      (schema.exclusiveMinimum !== undefined &&
        value <= schema.exclusiveMinimum) ||
      (schema.exclusiveMaximum !== undefined &&
        value >= schema.exclusiveMaximum))
  )
    errors.push(location + ": numeric range");
  return errors.slice(0, 20);
}
module.exports = { assertSchema, validate };
