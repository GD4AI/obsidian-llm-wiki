// Issue #658: strict structured-output normalisation at the schema-emitting
// boundary.
//
// Strict OpenAI-compatible endpoints reject a `response_format` schema unless
// `required` lists every property and every object carries
// `additionalProperties: false`. The AI SDK already puts `strict: true` on the
// wire for every openai-compatible provider (`@ai-sdk/openai-compatible`
// defaults `strictJsonSchema` to `true`), so the body a strict endpoint sees
// today is `strict: true` + an incomplete `required` — the combination the
// endpoint in #658 rejects (`Missing 'action'`).
//
// This module rewrites the emitted JSON Schema into the strict dialect. It
// runs at the `json_schema_strict` tier only (`output-mode-prober.ts`): the
// plain body goes first and stays as it is for every backend that accepts it
// (LM Studio measured — on the full ingest path the strict body cost a
// quarter to a third of the extracted items), the strict body is sent after a
// strict-mode 400 and remembered per (baseURL, model), or pinned by task
// policy (`extract=strict:off`). At that tier, for every schema:
//
//   * every property is listed in `required`, in property order;
//   * a property that was optional becomes nullable (`type: [..., "null"]`,
//     the form verified against LM Studio in #658 — not `anyOf`);
//   * every object node gets `additionalProperties: false`;
//   * keys are emitted in a canonical order, so two converters that agree on
//     content produce the same bytes (zod 3's `zod-to-json-schema` and zod 4's
//     `z.toJSONSchema()` differ in `additionalProperties`, the nullable form
//     and key order — see #669).
//
// "Optional → nullable" has a reading half. The SDK validates the model's
// answer with the same `Schema` object it emitted, and a zod `.optional()`
// rejects `null`. `stripOptionalNulls` removes `null` from exactly the
// properties the normaliser made nullable (the ones the *original* schema
// did not require) before the validator runs, so the 17 zod schemas in
// `output-schemas.ts` stay untouched and see the value shape they always saw.

import { jsonSchema } from 'ai';
import type { JSONSchema7, Schema } from 'ai';

type JSONSchema7Definition = JSONSchema7 | boolean;
type JSONSchema7TypeName = Extract<JSONSchema7['type'], string>;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return typeof (value as { then?: unknown })?.then === 'function';
}

/** Adds `null` to a property schema so a strict provider may answer `null`. */
function makeNullable(node: JSONSchema7): JSONSchema7 {
  const out: JSONSchema7 = { ...node };
  if (typeof out.type === 'string') {
    out.type = out.type === 'null' ? out.type : [out.type, 'null'];
  } else if (Array.isArray(out.type)) {
    if (!out.type.includes('null')) out.type = [...out.type, 'null'];
  }
  if (Array.isArray(out.enum) && !out.enum.includes(null)) {
    out.enum = [...out.enum, null];
  }
  if (out.type !== undefined) return out;
  for (const key of ['anyOf', 'oneOf'] as const) {
    const branches = out[key];
    if (Array.isArray(branches)) {
      const hasNull = branches.some((b) => isObject(b) && (b as JSONSchema7).type === 'null');
      if (!hasNull) out[key] = [...branches, { type: 'null' }];
      return out;
    }
  }
  // No `type`, no union to extend (`$ref`, `const`, an empty `{}`): the
  // only way to admit null is a union around the node.
  return { anyOf: [out, { type: 'null' }] };
}

/**
 * Emits a node with its keys in a fixed order. `properties` keeps the
 * author's member order (it is meaningful to the model); `required` follows
 * the same order. Everything else is sorted by key.
 */
function canonical(node: JSONSchema7): JSONSchema7 {
  const out: JsonObject = {};
  for (const key of Object.keys(node).sort()) {
    out[key] = (node as JsonObject)[key];
  }
  return out;
}

/**
 * Folds `anyOf: [{type: "string"}, {type: "null"}]` into
 * `type: ["string", "null"]`. Both mean the same; zod 3's converter writes
 * the array form for `.nullable()`, zod 4's writes the `anyOf` form. One
 * form on the wire — the one verified against LM Studio in #658.
 */
function foldTypeUnion(node: JSONSchema7): JSONSchema7 {
  for (const key of ['anyOf', 'oneOf'] as const) {
    const branches = node[key];
    if (!Array.isArray(branches) || node.type !== undefined) continue;
    const isTypeOnlyUnion = branches.every((b) => isObject(b) && typeof b.type === 'string' && Object.keys(b).length === 1);
    if (!isTypeOnlyUnion) continue;
    const folded: JSONSchema7 = { ...node, type: branches.map((b) => (b as JSONSchema7).type as JSONSchema7TypeName) };
    delete folded[key];
    return folded;
  }
  return node;
}

function normalizeNode(def: JSONSchema7Definition): JSONSchema7Definition {
  if (typeof def === 'boolean') return def;
  const node: JSONSchema7 = foldTypeUnion({ ...def });

  const isMap = node.properties === undefined && isObject(node.additionalProperties);
  if (isMap) {
    // An open map (`additionalProperties: <schema>`, no fixed keys) has no
    // strict form; normalise the value schema and leave the map open rather
    // than turning it into an object that admits no key at all.
    node.additionalProperties = normalizeNode(node.additionalProperties as JSONSchema7);
  } else if (node.type === 'object' || node.properties !== undefined) {
    const properties = node.properties ?? {};
    const names = Object.keys(properties);
    const wasRequired = new Set(Array.isArray(node.required) ? node.required : []);
    const nextProperties: Record<string, JSONSchema7Definition> = {};
    for (const name of names) {
      const child = normalizeNode(properties[name]);
      nextProperties[name] = typeof child === 'boolean' || wasRequired.has(name)
        ? child
        : makeNullable(child);
    }
    node.properties = nextProperties;
    node.required = names;
    node.additionalProperties = false;
  }

  if (node.items !== undefined) {
    node.items = Array.isArray(node.items)
      ? node.items.map(normalizeNode)
      : normalizeNode(node.items);
  }
  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    const branches = node[key];
    if (Array.isArray(branches)) node[key] = branches.map(normalizeNode);
  }
  // `$ref`/`definitions` never reach this boundary: the SDK adapters inline
  // (`$refStrategy: 'none'`, `reused: 'inline'`) and no raw caller writes them.
  return canonical(node);
}

/**
 * Rewrites a JSON Schema into the strict structured-output dialect: every
 * property required, former optionals nullable, `additionalProperties: false`
 * on every object, canonical key order. Pure — the input is not mutated.
 */
export function normalizeStrictJsonSchema(schema: JSONSchema7): JSONSchema7 {
  const out = normalizeNode(schema);
  return typeof out === 'boolean' ? schema : out;
}

/**
 * Removes `null` from the properties that `normalizeStrictJsonSchema` made
 * nullable — those the *original* schema did not list in `required` — so the
 * original validator sees the shape it was written for. Properties the
 * original schema already allowed to be `null` are left alone. Pure.
 */
export function stripOptionalNulls(value: unknown, original: JSONSchema7Definition): unknown {
  if (typeof original === 'boolean') return value;
  if (Array.isArray(value)) {
    const items = original.items;
    if (items === undefined || Array.isArray(items)) return value;
    return value.map((item) => stripOptionalNulls(item, items));
  }
  if (!isObject(value)) return value;
  const properties = original.properties;
  if (properties === undefined) return value;
  const wasRequired = new Set(Array.isArray(original.required) ? original.required : []);
  const out: JsonObject = {};
  for (const key of Object.keys(value)) {
    const child = properties[key];
    if (child === undefined) {
      out[key] = value[key];
    } else if (value[key] === null && !wasRequired.has(key)) {
      continue;
    } else {
      out[key] = stripOptionalNulls(value[key], child);
    }
  }
  return out;
}

/**
 * Wraps an AI SDK `Schema` so that the wire sees the strict dialect and the
 * validator sees the original value shape. Both halves read the adapter's
 * JSON Schema once, lazily — the SDK's `jsonSchema()` memoises a thunk — so
 * neither the zod conversion nor the normalisation runs before the wire
 * needs it, and neither runs twice.
 */
export function toStrictSchema<T>(adapted: Schema<T>): Schema<T> {
  let original: JSONSchema7 | PromiseLike<JSONSchema7> | undefined;
  const readOriginal = (): JSONSchema7 | PromiseLike<JSONSchema7> => (original ??= adapted.jsonSchema);
  const validate = adapted.validate;
  return jsonSchema<T>(
    () => {
      const raw = readOriginal();
      return isPromiseLike(raw) ? raw.then(normalizeStrictJsonSchema) : normalizeStrictJsonSchema(raw);
    },
    {
      validate: validate === undefined
        ? undefined
        : async (value) => validate(stripOptionalNulls(value, await readOriginal())),
    },
  );
}

const strictByKey = new WeakMap<object, Schema<unknown>>();

/**
 * `toStrictSchema` memoised on the caller's schema object. The schemas in
 * `output-schemas.ts` are module constants and `buildOutputArgs` runs on every
 * call and every retry, so the adaptation and the normalisation happen once
 * per schema for the life of the process instead of once per request.
 */
export function strictSchemaFor<T>(key: object, adapt: () => Schema<T>): Schema<T> {
  const cached = strictByKey.get(key);
  if (cached !== undefined) return cached as Schema<T>;
  const strict = toStrictSchema(adapt());
  strictByKey.set(key, strict);
  return strict;
}
