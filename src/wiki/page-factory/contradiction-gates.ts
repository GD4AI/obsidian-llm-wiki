// page-factory/contradiction-gates.ts — two deterministic-checkable gates an
// item-level contradiction must pass before it becomes a record.
//
// Measured on a live vault (S150/S151, 14 note/page pairs, 3 draws each):
// of nine contradictions the triage recorded in one night, two were real,
// three were positions the source only REPORTED (a critic's view, an older
// hypothesis the note argues against), and four conflicted with nothing the
// page says — the model compared the source against what it knows, not
// against the page. A prompt rule ("only with a quote", "only if the source
// asserts it") removed the false positives and the planted true positive
// alike. Two required FIELDS with a deterministic check behind each kept the
// sensitivity: the quote field found 13/13 exact page sentences, and the
// stance question — asked as its own small call over the source excerpt,
// not inside the triage — separated reported from held 24/24 vs 48/48.
//
// Gate 1 (`statementOnPage`): the triage names the page sentence the claim
// conflicts with (`existing_statement`, see prompts/merge.ts and
// output-schemas.ts); if that sentence is not on the page, there is nothing
// to contradict and the item is demoted to a plain complementary fact.
// Gate 2 (`verifySourceStance`): the source is asked whether it holds the
// claim itself; a claim it merely reports is not the source's contradiction
// and is demoted too. The evidence sentence is checked against the excerpt,
// and an unverifiable "no" is not acted on — the gate only ever removes an
// item on evidence it can show.
// `applyContradictionGates` runs both over a triage's items, in that order.
// Scope: the item-level lane only. The page-level `contradictory` strategy
// (whole-page rewrite, marker from `triage.reason`) and the conversation
// ingest carry the same defect class and are deliberately left as they are
// here — one lane measured, one lane changed.

import type { LLMClient, LLMWikiSettings, SourceContext } from '../../types';
import type { ComplementaryItem } from './merge-triage';
import { PROMPTS } from '../../prompts';
import { renderTemplate } from '../../core/template-renderer';
import { parseJsonResponse } from '../../core/json';
import { TOKENS_SOURCE_STANCE } from '../../constants';
import { resolveModelForTask } from '../../core/model-resolver';
import { normalizeQuote } from '../lint/utils';
import { SourceStanceSchema, type SourceStance } from '../../llm-sdk/output-schemas';

/**
 * Normalize prose for containment checks. Builds on the #244 quote-grounding
 * fold (`normalizeQuote`: case, punctuation, whitespace) and first reduces
 * wiki markup that fold would glue together — `[[page|text]]` to its text,
 * footnote markers and emphasis dropped — so a page sentence with a link in
 * it still contains the model's plain quote of it. NFC first: a body saved
 * decomposed and a quote typed composed are the same sentence.
 */
export function normalizeStatement(s: string): string {
  return normalizeQuote(
    s
      .normalize('NFC')
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\^\[[^\]]*\]/g, '')
      .replace(/[*_`#>]/g, ' '),
  );
}

export type StatementMatch = 'exact' | 'partial' | 'none';

/** Gate 1's partial tier: this many consecutive words of the quote on the page. */
const PARTIAL_MATCH_WORDS = 6;
/** Gate 2's evidence has to be a sentence, not a word the excerpt happens to contain. */
const MIN_EVIDENCE_WORDS = 4;

/**
 * Gate 1 — is the quoted statement on the page? `exact` after
 * normalization; `partial` when any run of six consecutive words of the
 * quote occurs on the page (a model that trims or joins a sentence still
 * passes); `none` otherwise, which includes an empty quote. Callers with
 * several statements against one page pass the body normalized once.
 */
export function statementOnPage(
  statement: string | undefined,
  body: string,
  normalizedBody: string = normalizeStatement(body),
): StatementMatch {
  const s = normalizeStatement(statement ?? '');
  if (!s) return 'none';
  if (normalizedBody.includes(s)) return 'exact';
  const words = s.split(' ');
  for (let i = 0; i + PARTIAL_MATCH_WORDS <= words.length; i++) {
    if (normalizedBody.includes(words.slice(i, i + PARTIAL_MATCH_WORDS).join(' '))) return 'partial';
  }
  return 'none';
}

export interface SourceStanceContext {
  settings: LLMWikiSettings;
  getClient(): LLMClient | null;
}

export interface SourceStanceVerdict {
  /** `yes` the source holds the claim · `no` it reports it (evidence shown) · `unverified` no usable answer. */
  holds: 'yes' | 'no' | 'unverified';
  evidence?: string;
}

/**
 * Gate 2 — does the source hold the claim as its own position? One small
 * call over the note excerpt the triage already saw; nothing else about the
 * page is sent, so the answer can only come from the source text. Never
 * throws: any failure is `unverified`, and the caller keeps the item.
 */
export async function verifySourceStance(
  ctx: SourceStanceContext,
  params: { pageName: string; claim: string; sourceExcerpt: string; sourceContext?: SourceContext },
): Promise<SourceStanceVerdict> {
  const client = ctx.getClient();
  const excerpt = params.sourceExcerpt.trim();
  if (!client || !excerpt) return { holds: 'unverified' };

  const summary = params.sourceContext?.summary?.trim();
  const prompt = renderTemplate(PROMPTS.sourceStance, {
    page_name: params.pageName,
    source_excerpt: excerpt,
    source_context: summary ? `\n\n**What the source document as a whole is about:**\n${summary}` : '',
    claim: params.claim,
  });
  const model = resolveModelForTask(ctx.settings, 'ingest');
  const thinking = ctx.settings.disableThinking ? { enableThinking: false } : {};

  // Same two-path shape as classifyMergeNeed: typed output when the client
  // offers it, JSON text otherwise.
  let parsed: SourceStance | null;
  try {
    if (client.createMessageWithOutput) {
      const result = await client.createMessageWithOutput<SourceStance>({
        task: 'source-stance',
        model,
        max_tokens: TOKENS_SOURCE_STANCE,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object', schema: SourceStanceSchema },
        ...thinking,
      });
      parsed = result.output && typeof result.output === 'object'
        ? result.output
        : await parseJsonResponse(result.text) as SourceStance | null;
    } else {
      const response = await client.createMessage({
        task: 'source-stance',
        model,
        max_tokens: TOKENS_SOURCE_STANCE,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        ...thinking,
      });
      parsed = await parseJsonResponse(response) as SourceStance | null;
    }
  } catch (e) {
    console.warn(`[source-stance] call failed (${e instanceof Error ? e.message : String(e)}) — keeping the item`);
    return { holds: 'unverified' };
  }

  const answer = typeof parsed?.holds === 'string' ? parsed.holds.trim().toLowerCase() : '';
  const evidence = typeof parsed?.evidence === 'string' ? parsed.evidence.trim() : '';
  if (answer === 'yes') return { holds: 'yes', evidence };
  if (answer === 'no') {
    // A "no" is acted on only when the model can show the sentence it read it from.
    const folded = normalizeStatement(evidence);
    const shown = folded.split(' ').length >= MIN_EVIDENCE_WORDS && normalizeStatement(excerpt).includes(folded);
    return shown ? { holds: 'no', evidence } : { holds: 'unverified', evidence };
  }
  return { holds: 'unverified' };
}

/**
 * A `contradictory` item one of the two gates demoted to `complementary`.
 * Reported, never silent: the caller logs it (`describeDemotion`), and the
 * item still lands on the page as an ordinary fact — only the record and
 * the marker are withheld.
 */
export interface DemotedContradiction {
  content: string;
  target_section: string;
  gate: 'existing-statement' | 'source-stance';
  /** What the gate saw: the unmatched quote, or the excerpt sentence showing the claim is reported. */
  detail: string;
}

/** One line for the log: which gate, and what it saw. */
export function describeDemotion(d: DemotedContradiction): string {
  const claim = d.content.slice(0, 80);
  if (d.gate === 'existing-statement') {
    return d.detail
      ? `contradiction demoted by gate "existing-statement": "${claim}" — quoted statement not on the page: "${d.detail.slice(0, 80)}"`
      : `contradiction demoted by gate "existing-statement": "${claim}" — no existing statement quoted`;
  }
  return `contradiction demoted by gate "source-stance": "${claim}" — the source reports rather than holds it: "${d.detail.slice(0, 80)}"`;
}

/**
 * Run both gates over a triage's items. Gate 1 needs the page body; gate 2
 * needs the note excerpt and one call per surviving conflict. Items are
 * returned in their original order; a demoted one keeps its content and
 * section, loses `existing_statement`.
 */
export async function applyContradictionGates(
  items: ComplementaryItem[],
  existingContent: string,
  ctx: SourceStanceContext,
  source: { pageName: string; sourceExcerpt: string; sourceContext?: SourceContext },
): Promise<{ items: ComplementaryItem[]; demoted: DemotedContradiction[] }> {
  const demoted: DemotedContradiction[] = [];
  const demote = (item: ComplementaryItem, gate: DemotedContradiction['gate'], detail: string) => {
    demoted.push({ content: item.content, target_section: item.target_section, gate, detail });
    item.kind = 'complementary';
    delete item.existing_statement;
  };

  // Gate 1: the page body normalized once for every statement. An exact
  // quote is kept as the record's existing view; a partial match keeps the
  // item but not the quote — the record then names section and reason.
  const normalizedBody = normalizeStatement(existingContent);
  for (const item of items) {
    if (item.kind !== 'contradictory') continue;
    const statement = item.existing_statement ?? '';
    const match = statementOnPage(statement, existingContent, normalizedBody);
    if (match === 'none') demote(item, 'existing-statement', statement);
    else if (match === 'partial') delete item.existing_statement;
  }

  // Gate 2: the surviving conflicts, one call each, in order — a local
  // backend serves one request at a time and keeps the shared excerpt
  // prefix warm between them. Without an excerpt there is nothing to ask
  // against and the item stays (`unverified`).
  for (const item of items) {
    if (item.kind !== 'contradictory') continue;
    const verdict = await verifySourceStance(ctx, {
      pageName: source.pageName,
      claim: item.content,
      sourceExcerpt: source.sourceExcerpt,
      sourceContext: source.sourceContext,
    });
    if (verdict.holds === 'no') demote(item, 'source-stance', verdict.evidence ?? '');
  }

  return { items, demoted };
}
