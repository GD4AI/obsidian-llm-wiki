// Issue #658: strict structured-output normalisation at the schema-emitting
// boundary. Pins (1) what the normaliser does to a schema, (2) that the
// validator still sees the original value shape, (3) that the normalised
// body is byte-equal whether zod 3 (`zod-to-json-schema`) or zod 4
// (`z.toJSONSchema()`) produced the raw schema — the wire-body regression
// coverage #669 asks for, and (4) the exact bytes for the two schemas #669
// names, as file snapshots that the zod 4 migration must leave unchanged.

import { describe, it, expect } from 'vitest';
import { zodSchema } from 'ai';
import type { JSONSchema7 } from 'ai';
import { z as z3 } from 'zod';
import { z as z4 } from 'zod/v4';
import {
  normalizeStrictJsonSchema,
  strictSchemaFor,
  stripOptionalNulls,
  toStrictSchema,
} from '../../llm-sdk/strict-schema';
import * as OutputSchemas from '../../llm-sdk/output-schemas';
import { FixDeadLinkSchema, SourceAnalysisLLMSchema } from '../../llm-sdk/output-schemas';

/** Emits what `buildOutputArgs` hands to `Output.object()` for a zod schema. */
function wireBody(schema: Parameters<typeof zodSchema>[0]): JSONSchema7 {
  return toStrictSchema(zodSchema(schema)).jsonSchema as JSONSchema7;
}

/**
 * The strict dialect as a checker: every object node lists every property
 * in `required`, in property order, and forbids additional properties.
 * Mirrors the rule the endpoint in #658 enforces (`'required' is required
 * to be supplied and to be an array including every key in properties`).
 */
function assertStrictDialect(node: JSONSchema7 | boolean, path = '$'): void {
  if (typeof node === 'boolean') return;
  if (node.type === 'object' || node.properties !== undefined) {
    const names = Object.keys(node.properties ?? {});
    expect(node.required, `${path}.required`).toEqual(names);
    expect(node.additionalProperties, `${path}.additionalProperties`).toBe(false);
    for (const name of names) assertStrictDialect(node.properties![name], `${path}.${name}`);
  }
  if (node.items !== undefined && !Array.isArray(node.items)) assertStrictDialect(node.items, `${path}[]`);
  for (const branch of [...(node.anyOf ?? []), ...(node.oneOf ?? []), ...(node.allOf ?? [])]) {
    assertStrictDialect(branch, `${path}|`);
  }
}

describe('normalizeStrictJsonSchema', () => {
  it('lists every property in required and makes the former optionals nullable', () => {
    const out = normalizeStrictJsonSchema({
      type: 'object',
      properties: { action: { type: 'string' }, count: { type: 'number' } },
      required: ['count'],
    });
    expect(out).toEqual({
      additionalProperties: false,
      properties: { action: { type: ['string', 'null'] }, count: { type: 'number' } },
      required: ['action', 'count'],
      type: 'object',
    });
  });

  it('applies the same rule to nested objects and to objects inside arrays', () => {
    const out = normalizeStrictJsonSchema({
      type: 'object',
      properties: {
        inner: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'boolean' } }, required: ['a'] },
        list: { type: 'array', items: { type: 'object', properties: { n: { type: 'string' }, k: { type: 'number' } }, required: ['n'] } },
      },
      required: ['inner'],
    });
    assertStrictDialect(out);
    const inner = out.properties!.inner as JSONSchema7;
    expect(inner.type).toBe('object');
    expect(inner.required).toEqual(['a', 'b']);
    expect((inner.properties!.b as JSONSchema7).type).toEqual(['boolean', 'null']);
    const list = out.properties!.list as JSONSchema7;
    expect(list.type).toEqual(['array', 'null']);
    const item = list.items as JSONSchema7;
    expect(item.required).toEqual(['n', 'k']);
    expect((item.properties!.k as JSONSchema7).type).toEqual(['number', 'null']);
  });

  it('extends an optional enum with null and leaves an already nullable property alone', () => {
    const out = normalizeStrictJsonSchema({
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['entity', 'concept'] },
        path: { type: ['string', 'null'] },
      },
      required: ['path'],
    });
    expect(out.properties!.kind).toEqual({ enum: ['entity', 'concept', null], type: ['string', 'null'] });
    expect(out.properties!.path).toEqual({ type: ['string', 'null'] });
  });

  it('leaves an open map (additionalProperties as a schema, no fixed keys) open and normalises its value schema', () => {
    const out = normalizeStrictJsonSchema({
      type: 'object',
      additionalProperties: { type: 'object', properties: { a: { type: 'string' } } },
    });
    expect(out).toEqual({
      additionalProperties: { additionalProperties: false, properties: { a: { type: ['string', 'null'] } }, required: ['a'], type: 'object' },
      type: 'object',
    });
  });

  it('admits null through a union when an optional node has no type to widen ($ref, const)', () => {
    const out = normalizeStrictJsonSchema({
      type: 'object',
      properties: { ref: { $ref: '#/definitions/X' }, lit: { const: 'a' }, union: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'number' }] } },
    });
    expect(out.properties!.ref).toEqual({ anyOf: [{ $ref: '#/definitions/X' }, { type: 'null' }] });
    expect(out.properties!.lit).toEqual({ anyOf: [{ const: 'a' }, { type: 'null' }] });
    expect(out.properties!.union).toEqual({ anyOf: [{ minLength: 1, type: 'string' }, { type: 'number' }, { type: 'null' }] });
  });

  it('does not mutate its input', () => {
    const input: JSONSchema7 = { type: 'object', properties: { a: { type: 'string' } } };
    const copy = JSON.parse(JSON.stringify(input));
    normalizeStrictJsonSchema(input);
    expect(input).toEqual(copy);
  });

  it('emits a canonical key order regardless of the input order', () => {
    const a = normalizeStrictJsonSchema({ type: 'object', properties: { x: { type: 'string' } }, additionalProperties: true, $schema: 's' });
    const b = normalizeStrictJsonSchema({ $schema: 's', additionalProperties: true, properties: { x: { type: 'string' } }, type: 'object' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('stripOptionalNulls', () => {
  const original: JSONSchema7 = {
    type: 'object',
    properties: {
      action: { type: 'string' },
      path: { type: ['string', 'null'] },
      items: { type: 'array', items: { type: 'object', properties: { n: { type: 'string' }, k: { type: 'number' } }, required: ['n'] } },
    },
    required: ['path'],
  };

  it('drops null only from properties the original schema did not require', () => {
    expect(stripOptionalNulls({ action: null, path: null }, original)).toEqual({ path: null });
  });

  it('descends into arrays of objects and keeps unknown keys', () => {
    expect(stripOptionalNulls({ path: 'p', items: [{ n: 'a', k: null }, { n: 'b', k: 2 }], extra: null }, original))
      .toEqual({ path: 'p', items: [{ n: 'a' }, { n: 'b', k: 2 }], extra: null });
  });

  it('passes non-object values through', () => {
    expect(stripOptionalNulls('text', original)).toBe('text');
    expect(stripOptionalNulls(null, original)).toBe(null);
  });
});

describe('toStrictSchema — the Schema object Output.object() receives', () => {
  it('emits the strict dialect on the wire side', () => {
    const body = wireBody(FixDeadLinkSchema);
    assertStrictDialect(body);
    expect(body.required).toEqual(['action', 'correct_link', 'stub_title', 'stub_type']);
    expect((body.properties!.action as JSONSchema7).type).toEqual(['string', 'null']);
  });

  it('accepts a strict-provider answer that fills optionals with null, and hands the validator the original shape', async () => {
    const schema = toStrictSchema(zodSchema(FixDeadLinkSchema));
    const result = await schema.validate!({ action: null, correct_link: null, stub_title: 'Kreatin', stub_type: null });
    expect(result).toEqual({ success: true, value: { stub_title: 'Kreatin' } });
  });

  it('still rejects a wrong type — the original validator is the one that runs', async () => {
    const schema = toStrictSchema(zodSchema(FixDeadLinkSchema));
    const result = await schema.validate!({ action: 42 });
    expect(result.success).toBe(false);
  });

  it('an optional field that also allows null counts as optional: null is dropped (PathResolutionLLMSchema.path — callers read `match && path`)', async () => {
    const schema = toStrictSchema(zodSchema(OutputSchemas.PathResolutionLLMSchema));
    const result = await schema.validate!({ match: false, path: null, classification: null });
    expect(result).toEqual({ success: true, value: { match: false } });
  });

  it('is memoised per schema object, so retries do not re-adapt or re-normalise', () => {
    let adaptions = 0;
    const adapt = () => { adaptions += 1; return zodSchema(FixDeadLinkSchema); };
    const first = strictSchemaFor(FixDeadLinkSchema, adapt);
    const second = strictSchemaFor(FixDeadLinkSchema, adapt);
    expect(second).toBe(first);
    expect(adaptions).toBe(1);
  });

  it('leaves a schema without a validator without one', () => {
    const { jsonSchema } = zodSchema(FixDeadLinkSchema);
    const bare = toStrictSchema({ jsonSchema, validate: undefined } as unknown as Parameters<typeof toStrictSchema>[0]);
    expect(bare.validate).toBeUndefined();
  });
});

describe('every exported output schema reaches the wire in the strict dialect', () => {
  const exported = Object.entries(OutputSchemas).filter(([name]) => name.endsWith('Schema'));

  it('covers the 17 schemas at the boundary', () => {
    expect(exported.map(([name]) => name).sort()).toMatchInlineSnapshot(`
      [
        "AliasGenerationLLMSchema",
        "ConversationDedupStatusLLMSchema",
        "DedupResultLLMSchema",
        "FixDeadLinkSchema",
        "LemmaClassifyLLMSchema",
        "LinkOrphanSchema",
        "MergeTriageSchema",
        "PathResolutionLLMSchema",
        "QueryKeywordsSchema",
        "QueryViewValueSchema",
        "SchemaSuggestionLLMSchema",
        "SeedSelectorSchema",
        "SourceAnalysisLLMSchema",
        "SourceStanceSchema",
        "TagFixLLMSchema",
        "TypeRepairLLMSchema",
        "WelcomeTranslationLLMSchema",
      ]
    `);
  });

  it.each(exported)('%s', (_name, schema) => {
    assertStrictDialect(wireBody(schema as Parameters<typeof zodSchema>[0]));
  });
});

describe('wire-body regression across zod 3 and zod 4 (#669)', () => {
  // The same shape written twice: zod 3 `.passthrough()` (what
  // output-schemas.ts uses today) and zod 4 `.looseObject()` (its documented
  // replacement). zod 3.25.x ships both APIs, so the comparison runs without
  // a dependency change. The raw bodies differ (`additionalProperties`,
  // the nullable form, key order — the SDK routes zod 4 through
  // `z.toJSONSchema()` and then forces `additionalProperties: false`); the
  // normalised bodies must not.
  const shape3 = z3.object({
    action: z3.enum(['fix', 'stub', 'skip']).optional(),
    path: z3.string().nullable(),
    items: z3.array(z3.object({ n: z3.string(), k: z3.number().optional() }).passthrough()).optional(),
    inner: z3.object({ a: z3.boolean().optional() }).passthrough(),
  }).passthrough();
  const shape4 = z4.looseObject({
    action: z4.enum(['fix', 'stub', 'skip']).optional(),
    path: z4.string().nullable(),
    items: z4.array(z4.looseObject({ n: z4.string(), k: z4.number().optional() })).optional(),
    inner: z4.looseObject({ a: z4.boolean().optional() }),
  });

  it('the raw bodies differ — documented, not asserted as a contract', () => {
    const raw3 = JSON.stringify(zodSchema(shape3).jsonSchema);
    const raw4 = JSON.stringify(zodSchema(shape4).jsonSchema);
    expect(raw3).not.toBe(raw4);
    expect(raw3).toContain('"additionalProperties":true');
    expect(raw4).toContain('"additionalProperties":false');
  });

  it('the normalised bodies are byte-equal', () => {
    expect(JSON.stringify(wireBody(shape3))).toBe(JSON.stringify(wireBody(shape4)));
  });

  it('FixDeadLinkSchema — pinned bytes', async () => {
    await expect(JSON.stringify(wireBody(FixDeadLinkSchema), null, 2))
      .toMatchFileSnapshot('./__snapshots__/strict-schema/FixDeadLinkSchema.json');
  });

  it('SourceAnalysisLLMSchema — pinned bytes', async () => {
    await expect(JSON.stringify(wireBody(SourceAnalysisLLMSchema), null, 2))
      .toMatchFileSnapshot('./__snapshots__/strict-schema/SourceAnalysisLLMSchema.json');
  });
});
