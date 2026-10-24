// How many real user turns are follow-ups?
//
// The harness's derived follow-up family is a CONSTRUCTED shape: the question
// names nothing at all, so "no history answers it" is close to built in. The
// number that decides the weighting design is the share of REAL turns that
// behave that way, and that number sits in the user's own stored conversation.
//
// Read-only and local: it reads the plugin's data.json, counts, prints. No
// model call, no network, nothing leaves the machine.
//
// The classification reuses the harness's own `questionStats` shape — the
// production `lexMatchByTitleAndAliases` plus `nameTierCoverage` over the top
// hit — so the two tools cannot disagree about what "names nothing" means.
//
// It is imprecise, and the imprecision is the point of printing the per-turn
// table rather than only the rate. On the production vault it classifies a
// colloquial follow-up ("也就是说是不是用token换智力？") as self-sufficient with
// coverage 1.000, because `token` appears in some page's title. That is the
// same defect a coverage gate would have: the number measures whether the
// question carries an ASPECT WORD, not whether it names its own topic. So the
// rate this prints is a lower bound, and the table is what lets a reader
// correct it.
//
// Usage:
//   npx tsx tools/dev-instrument/run-followup-rate.mjs \
//     "/path/to/Vault/.obsidian/plugins/karpathywiki/data.json" \
//     "/path/to/Vault/wiki"
//
// The first argument is the plugin's data.json, the second the wiki folder its
// index.md lives in. Both are local paths; nothing is sent anywhere.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { parseIndexForPages } from '../../src/core/index-search.ts';
import { withBodies } from '../../src/wiki/query-engine/pipeline/read-index.ts';
import { tokenizeQuery, lexMatchByTitleAndAliases } from '../../src/core/ppr-cascade.ts';
import { segment, buildPageTerms, buildCorpusTerms, nameTierCoverage } from '../../src/core/term-index.ts';

const [dataJson, wikiDir] = process.argv.slice(2);
const data = JSON.parse(readFileSync(dataJson, 'utf8'));
const history = data.queryHistory ?? [];
const users = history.filter(m => m.role === 'user');
if (users.length === 0) {
  console.log('no user turns in queryHistory');
  process.exit(0);
}

const indexContent = existsSync(join(wikiDir, 'index.md')) ? readFileSync(join(wikiDir, 'index.md'), 'utf8') : '';
const pageRefs = parseIndexForPages(indexContent);
const refs = withBodies(pageRefs, new Map());
const corpusTerms = buildCorpusTerms(refs.map(p => buildPageTerms({ title: p.title, aliases: p.aliases, summary: '', text: '' })));

function questionStats(question) {
  const hits = lexMatchByTitleAndAliases(question, refs, { corpus: corpusTerms });
  const queryTerms = tokenizeQuery(question).flatMap(t => segment(t));
  const topPageTerms = hits.length > 0
    ? buildPageTerms({ title: hits[0].page.title, aliases: hits[0].page.aliases, summary: '', text: '' })
    : null;
  const coverage = topPageTerms ? nameTierCoverage(queryTerms, topPageTerms, corpusTerms) : 0;
  return { count: hits.length, coverage };
}

console.log(`wiki=${wikiDir.split('/').slice(-1)[0]} pages=${refs.length} user turns=${users.length}\n`);

let followUps = 0;
const rows = [];
users.forEach((m, i) => {
  const text = m.content.trim();
  const terms = segment(text);
  const st = questionStats(text);
  // A turn is a follow-up when the vault's name tier does not answer it: its
  // identifying words are not in any page's title, so they can only come from
  // what was said before. Both conditions are needed — `lexHits` alone counts
  // one shared common word as an answer, and `coverage` alone is 0 when there
  // is no hit at all.
  const isFollowUp = st.count === 0 || st.coverage < 0.5;
  if (isFollowUp) followUps += 1;
  rows.push({ i: i + 1, isFollowUp, st, terms: terms.length, text });
  console.log(`  ${String(i + 1).padStart(2)}. ${isFollowUp ? 'FOLLOW-UP' : 'self-suff'}  cov=${st.coverage.toFixed(3)}  nameTierHits=${String(st.count).padStart(4)}  contentTerms=${String(terms.length).padStart(2)}  ${text.slice(0, 50)}`);
});

const pct = (100 * followUps) / users.length;
console.log(`\nfollow-up turns: ${followUps} / ${users.length} = ${pct.toFixed(0)}%`);
console.log(`self-sufficient: ${users.length - followUps} / ${users.length} = ${(100 - pct).toFixed(0)}%`);
console.log('\nn is small: the plugin stores the latest conversation only (`maxConversationHistory`).');
