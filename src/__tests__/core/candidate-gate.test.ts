// Issue #514: the candidate gate — a page is a claim that the source treats
// the thing, and a name the source only mentions does not make it.

import { describe, it, expect } from 'vitest';
import { classifyCandidate as classify, gateCandidates as gate, gateProfileFor, GATE_LANGUAGE_PROFILES } from '../../core/candidate-gate';

const DE = GATE_LANGUAGE_PROFILES.de;
const classifyCandidate = (text: string, name: string) => classify(text, name, DE);
const gateCandidates = (a: Parameters<typeof gate>[0], t: string) => gate(a, t, 'de');
import type { EntityInfo, ConceptInfo } from '../../types';

const TEXT = `# Ferritin

Ferritin ist das intrazelluläre Eisenspeicherprotein. Es steigt bei Entzündung
(CRP erhöht), Lebererkrankung, Malignomen und Hämochromatose an. Die Transferrinsättigung
ergänzt den Befund: sie fällt beim funktionellen Eisenmangel ab. Niedrige Ferritins
sind beweisend.

Typische Ursachen sind Blutverlust, Malabsorption, Schwangerschaft und vegane Ernährung.
Das Hepcidin, das in der Leber gebildet wird, ist der zentrale Regulator der Aufnahme,
und der Wert steigt bei Entzündung, sinkt bei Eisenmangel.

- Eisen
- Transferrin
- Ein längerer Punkt, der wirklich etwas über Haptoglobin aussagt und kein Listeneintrag ist
`;

describe('classifyCandidate', () => {
  it('prose when the name carries a sentence', () => {
    expect(classifyCandidate(TEXT, 'Ferritin')).toBe('prose');
    expect(classifyCandidate(TEXT, 'Transferrinsättigung')).toBe('prose');
  });
  it('aside when the name appears only in parentheses', () => {
    expect(classifyCandidate(TEXT, 'CRP')).toBe('aside');
  });
  it('aside when the name is one short item of an enumeration', () => {
    expect(classifyCandidate(TEXT, 'Malabsorption')).toBe('aside');
    expect(classifyCandidate(TEXT, 'Schwangerschaft')).toBe('aside');
    expect(classifyCandidate(TEXT, 'vegane Ernährung')).toBe('aside');
  });
  it('prose when the comma-rich sentence is a nested clause, not a list (the S111 overreach)', () => {
    expect(classifyCandidate(TEXT, 'Hepcidin')).toBe('prose');
  });
  it('aside for a short markdown list item, prose for a long one', () => {
    expect(classifyCandidate(TEXT, 'Transferrin')).toBe('aside');
    expect(classifyCandidate(TEXT, 'Haptoglobin')).toBe('prose');
  });
  it('prose wins once: Lebererkrankung is in an enumeration but Entzündung also carries a clause', () => {
    expect(classifyCandidate(TEXT, 'Lebererkrankung')).toBe('aside');
    expect(classifyCandidate(TEXT, 'Entzündung')).toBe('prose');
  });
  it('absent when the name never appears — including core-word-only, compound and alias cases', () => {
    expect(classifyCandidate(TEXT, 'Eisenstoffwechsel')).toBe('absent');
    expect(classifyCandidate(TEXT, 'C-reaktives Protein')).toBe('absent');
    // `Eisen` is a part of `Eisenspeicherprotein` / `Eisenmangel`, not a word the source says on its own...
    expect(classifyCandidate(TEXT.replace('- Eisen\n', ''), 'Eisen')).toBe('absent');
    expect(classifyCandidate(TEXT, '')).toBe('absent');
  });
  it('tolerates inflection but not compounds', () => {
    expect(classifyCandidate('Niedrige Ferritins sind beweisend.', 'Ferritin')).toBe('prose');
    expect(classifyCandidate('Reich an Kohlenhydraten.', 'Kohlenhydrate')).toBe('prose');
    expect(classifyCandidate('Die oxidativen Wirkungen sind belegt.', 'Oxidative Wirkung')).toBe('prose');
    expect(classifyCandidate('Die Transferrinsättigung fällt.', 'Transferrin')).toBe('absent');
  });
  // The boundary has two halves and only the trailing one is visible above: a
  // suffix compound is rejected by the lookahead after the name, so a prefix
  // compound is the case that needs the leading check. Without it, a page named
  // `Transferrin` would be built from a note that only says `Co-Transferrin`.
  it('a name that only appears inside a longer word is absent, on both sides', () => {
    expect(classifyCandidate('Das Co-Transferrin ist erhöht.', 'Transferrin')).toBe('prose');
    expect(classifyCandidate('Das Antitransferrin ist erhöht.', 'Transferrin')).toBe('absent');
    expect(classifyCandidate('Die Transferrinsättigung fällt.', 'Transferrin')).toBe('absent');
  });
  it('is case-insensitive and NFC-normalized', () => {
    expect(classifyCandidate(TEXT, 'ferritin')).toBe('prose');
    expect(classifyCandidate(TEXT, 'Transferrinsättigung')).toBe('prose');
  });
  it('a heading counts as prose', () => {
    expect(classifyCandidate('# Hepcidin\n\nKurz.', 'Hepcidin')).toBe('prose');
  });
});

describe('gateCandidates', () => {
  const e = (name: string, extra: Partial<EntityInfo> = {}): EntityInfo =>
    ({ name, type: 'other', summary: '', mentions_in_source: [], ...extra });
  const c = (name: string, related: string[] = []): ConceptInfo =>
    ({ name, type: 'term', summary: '', mentions_in_source: [], related_concepts: related });

  it('keeps prose, drops aside and absent, and reports why', () => {
    const out = gateCandidates(
      { entities: [e('Ferritin'), e('CRP')], concepts: [c('Eisenmangel'), c('Eisenstoffwechsel')] },
      TEXT,
    );
    expect(out.entities.map(x => x.name)).toEqual(['Ferritin']);
    expect(out.concepts.map(x => x.name)).toEqual(['Eisenmangel']);
    expect(out.dropped).toEqual([
      { name: 'CRP', kind: 'entity', verdict: 'aside' },
      { name: 'Eisenstoffwechsel', kind: 'concept', verdict: 'absent' },
    ]);
  });

  it('prunes dropped names from the survivors\' related_* lists', () => {
    const out = gateCandidates(
      {
        entities: [e('Ferritin', { related_entities: ['CRP', 'Transferrin'], related_concepts: ['Eisenstoffwechsel', 'Eisenmangel'] })],
        concepts: [c('Eisenmangel', ['Eisenstoffwechsel', 'Ferritin']), c('Eisenstoffwechsel')],
      },
      TEXT,
    );
    expect(out.entities[0].related_entities).toEqual(['CRP', 'Transferrin']);
    expect(out.entities[0].related_concepts).toEqual(['Eisenmangel']);
    expect(out.concepts.map(x => x.name)).toEqual(['Eisenmangel']);
    expect(out.concepts[0].related_concepts).toEqual(['Ferritin']);
    expect(out.linkedAnyway).toEqual([]);
  });

  it('keeps a dropped name in related_* lists when the vault already has a page for it', () => {
    // Eisenstoffwechsel is absent from THIS note, so it earns no page here —
    // but a page for it exists, and the edge to an existing page is not a
    // dead link. CRP is not a candidate in this input, so it is never judged.
    const known = (name: string) => name.toLowerCase() === 'eisenstoffwechsel';
    const out = gate(
      {
        entities: [e('Ferritin', { related_entities: ['CRP', 'Transferrin'], related_concepts: ['Eisenstoffwechsel', 'Eisenmangel'] })],
        concepts: [c('Eisenmangel', ['Eisenstoffwechsel', 'Ferritin']), c('Eisenstoffwechsel')],
      },
      TEXT,
      'de',
      known,
    );
    expect(out.concepts.map(x => x.name)).toEqual(['Eisenmangel']);
    expect(out.dropped.map(d => d.name)).toEqual(['Eisenstoffwechsel']);
    expect(out.entities[0].related_entities).toEqual(['CRP', 'Transferrin']);
    expect(out.entities[0].related_concepts).toEqual(['Eisenstoffwechsel', 'Eisenmangel']);
    expect(out.concepts[0].related_concepts).toEqual(['Eisenstoffwechsel', 'Ferritin']);
    expect(out.linkedAnyway).toEqual(['Eisenstoffwechsel']);
  });

  it('is a no-op — input returned untouched — for a language without a profile, and resolves region codes', () => {
    const input = { entities: [e('CRP')], concepts: [c('Eisenstoffwechsel')] };
    // Italian forms its plurals by vowel alternation; a suffix profile would
    // under-match, so it has none — on purpose, see the module header.
    const it_ = gate(input, TEXT, 'it');
    expect(it_.applied).toBe(false);
    expect(it_.dropped).toEqual([]);
    expect(it_.entities).toBe(input.entities);
    expect(gate(input, TEXT, undefined).applied).toBe(false);
    expect(gate(input, TEXT, 'de-CH').applied).toBe(true);
    expect(gateProfileFor('EN')).toBe(GATE_LANGUAGE_PROFILES.en);
    expect(gateProfileFor('zh-Hant')).toBe(GATE_LANGUAGE_PROFILES.zh);
    expect(gateProfileFor('sv')).toBeNull();
    expect(gateProfileFor('ru')).toBeNull();
  });

  it('uses the English profile for English wikis', () => {
    const en = GATE_LANGUAGE_PROFILES.en;
    const text = 'Ferritins are iron stores. Causes include bleeding, malabsorption, pregnancy and diet.';
    expect(classify(text, 'Ferritin', en)).toBe('prose');
    expect(classify(text, 'malabsorption', en)).toBe('aside');
    expect(classify(text, 'Ferritinwert', en)).toBe('absent');
  });

  it('is a no-op when everything is prose', () => {
    const input = { entities: [e('Ferritin')], concepts: [c('Eisenmangel', ['Ferritin'])] };
    const out = gateCandidates(input, TEXT);
    expect(out.dropped).toEqual([]);
    expect(out.entities).toBe(input.entities);
    expect(out.concepts).toBe(input.concepts);
  });
});

describe('estimated language profiles (unmeasured — the setting is opt-in)', () => {
  const P = GATE_LANGUAGE_PROFILES;

  it('fr: plural -s/-x and feminine -e are inflection, a comma list is an aside', () => {
    const t = 'Les vitamines hydrosolubles se perdent à la cuisson. Les causes incluent le saignement, la malabsorption, la grossesse et le régime.';
    expect(classify(t, 'vitamine hydrosoluble', P.fr)).toBe('prose');
    expect(classify(t, 'malabsorption', P.fr)).toBe('aside');
    expect(classify(t, 'ferritine', P.fr)).toBe('absent');
  });

  it('es / pt: plural -s/-es — and the documented edge of the estimate', () => {
    expect(classify('Los ácidos grasos omega-3 reducen la inflamación.', 'ácido graso', P.es)).toBe('prose');
    expect(classify('Os ácidos graxos ômega-3 reduzem a inflamação.', 'ácido graxo', P.pt)).toBe('prose');
    expect(classify('Causas: sangrado, malabsorción, embarazo y dieta.', 'malabsorción', P.es)).toBe('aside');
    // Portuguese -l → -is is a stem change, not a suffix: the profile does not
    // see it. Pinned here so the limit is visible, not discovered.
    expect(classify('As vitaminas lipossolúveis acumulam-se no fígado.', 'vitamina lipossolúvel', P.pt)).toBe('absent');
  });

  it('nl: plural -s/-en', () => {
    expect(classify('De vitamines worden in de lever opgeslagen.', 'vitamine', P.nl)).toBe('prose');
    expect(classify('Oorzaken zijn bloedverlies, malabsorptie, zwangerschap en dieet.', 'malabsorptie', P.nl)).toBe('aside');
  });

  it('ko: particles attach to the noun; spaces delimit words', () => {
    const t = '페리틴은 세포 내 철 저장 단백질이다. 염증(CRP 상승), 간질환, 악성종양에서 상승한다.';
    expect(classify(t, '페리틴', P.ko)).toBe('prose');
    expect(classify(t, 'CRP', P.ko)).toBe('aside');
    expect(classify(t, '간질환', P.ko)).toBe('aside');
    expect(classify(t, '헵시딘', P.ko)).toBe('absent');
  });

  it('zh: substring match without boundaries, fullwidth parentheses, 、 marks an enumeration outright', () => {
    const t = '铁蛋白是细胞内的储铁蛋白。它在炎症（CRP升高）、肝病、恶性肿瘤和血色病时升高。转铁蛋白饱和度补充了这一结果。';
    expect(classify(t, '铁蛋白', P.zh)).toBe('prose');
    expect(classify(t, '转铁蛋白饱和度', P.zh)).toBe('prose');
    expect(classify(t, 'CRP', P.zh)).toBe('aside');
    expect(classify(t, '肝病', P.zh)).toBe('aside');
    expect(classify(t, '恶性肿瘤', P.zh)).toBe('aside');
    expect(classify(t, '血清铁', P.zh)).toBe('absent');
  });

  it('ja: 、 is the general comma, ・ the list separator; length in characters', () => {
    const t = 'フェリチンは細胞内の鉄貯蔵タンパク質である。炎症（CRP上昇）や肝疾患・悪性腫瘍・ヘモクロマトーシスで上昇する。';
    expect(classify(t, 'フェリチン', P.ja)).toBe('prose');
    expect(classify(t, 'CRP', P.ja)).toBe('aside');
    expect(classify(t, '悪性腫瘍', P.ja)).toBe('aside');
    expect(classify(t, 'ヘプシジン', P.ja)).toBe('absent');
  });

  it('char-script list items: a short bullet is an aside, a long one is prose', () => {
    const t = '# 鉄\n\n- 鉄\n- トランスフェリン\n- ハプトグロビンについて本当に何かを述べている長い項目であり、単なる箇条書きではない\n';
    expect(classify(t, 'トランスフェリン', P.ja)).toBe('aside');
    expect(classify(t, 'ハプトグロビン', P.ja)).toBe('prose');
  });
});

// Link markup is syntax, not an aside: PAREN_RE matches the inner `[X]` of a
// `[[X]]` and both halves of `[text](url)`, so a name the author linked was
// classified `aside` — the opposite of what a link means. Measured on a German
// vault (16 notes, 321 candidates): 32 verdicts move `aside` → `prose`, none
// the other way.
describe('classifyCandidate — link markup is not a parenthesis', () => {
  it('reads a wikilinked name as prose, not as an aside', () => {
    const t = 'Die Kaskade läuft über [[NF-κB]] und endet in Zytokinfreisetzung.';
    expect(classifyCandidate(t, 'NF-κB')).toBe('prose');
  });

  it('keeps BOTH names of a piped link readable', () => {
    const t = 'Es wird bevorzugt vor [[ACE-Hemmer|ACEi]] eingesetzt und senkt die Mortalität.';
    expect(classifyCandidate(t, 'ACE-Hemmer')).toBe('prose');
    expect(classifyCandidate(t, 'ACEi')).toBe('prose');
  });

  it('treats a markdown link like the text it displays', () => {
    const t = 'Der Wirkstoff steht auf der [WHO-Liste der essenziellen Medikamente](https://example.org/x).';
    expect(classifyCandidate(t, 'WHO-Liste der essenziellen Medikamente')).toBe('prose');
  });

  it('reads an embed like a wikilink', () => {
    const t = 'Die Abbildung ![[Mitochondrium]] zeigt den Aufbau im Detail und erklärt ihn.';
    expect(classifyCandidate(t, 'Mitochondrium')).toBe('prose');
  });

  // S135 inverts the S132 half-rule: the author's link outranks the bracket
  // around it. The UNLINKED neighbour in the same parenthesis stays an aside.
  it('reads a linked name as prose even inside a real parenthesis', () => {
    const t = 'Hormonelle Dysregulation (Leptin-Resistenz und auch [[Insulinresistenz]]) ist typisch.';
    expect(classifyCandidate(t, 'Insulinresistenz')).toBe('prose');
    expect(classifyCandidate(t, 'Leptin-Resistenz')).toBe('aside');
  });

  // A citation in square brackets carries no `(url)` and stays an aside.
  it('leaves a bare bracketed citation an aside', () => {
    const t = 'Die Methodik folgt dem Standard [ATS Statement: Guidelines 2002].';
    expect(classifyCandidate(t, 'ATS Statement: Guidelines 2002')).toBe('aside');
  });
});

// S135: three parenthesis rescues, measured together on 20 German notes and
// two independent draws — 159 aside verdicts, 68 move to prose (32 exemplar,
// 19 linked occurrence, 19 gloss), none the other way, every case reviewed.
describe('classifyCandidate — exemplar lists, glosses and linked occurrences (S135)', () => {
  it('exemplar marker: members of the group named before the parenthesis are prose', () => {
    const t = 'Medikamentös sind Stimulanzien (Methylphenidat als First-Line in Deutschland, alternativ Amphetamine wie Lisdexamfetamin) die Therapie der Wahl.';
    expect(classifyCandidate(t, 'Methylphenidat')).toBe('prose');
    expect(classifyCandidate(t, 'Lisdexamfetamin')).toBe('prose');
  });

  it('exemplar marker: `z. B.` and `etc.`', () => {
    const t1 = 'Für Patienten auf Antikoagulanzien (z. B. Warfarin) ist Vorsicht geboten.';
    expect(classifyCandidate(t1, 'Warfarin')).toBe('prose');
    const t2 = 'Non-Stimulanzien (Atomoxetin, Guanfacin etc.) kommen bei Kontraindikationen zum Einsatz.';
    expect(classifyCandidate(t2, 'Atomoxetin')).toBe('prose');
    expect(classifyCandidate(t2, 'Guanfacin')).toBe('prose');
  });

  it('a parenthesis without a marker stays an aside', () => {
    const t = 'Es steigt bei Entzündung (CRP erhöht) deutlich an.';
    expect(classifyCandidate(t, 'CRP')).toBe('aside');
  });

  it('gloss: a parenthesis holding nothing but the name introduces the term', () => {
    const t1 = 'Die Glykolyse führt zur Übersäuerung (Azidose) des Gewebes.';
    expect(classifyCandidate(t1, 'Azidose')).toBe('prose');
    const t2 = 'Häufig genannt wird **Maca** (*Lepidium meyenii*) in Studien.';
    expect(classifyCandidate(t2, 'Lepidium meyenii')).toBe('prose');
  });

  it('gloss needs full cover: a compound around the name is no gloss', () => {
    const t = 'Die Entfernung geschädigter Zellen (p53-abhängig) verhindert Tumoren.';
    expect(classifyCandidate(t, 'p53')).toBe('aside');
  });

  it('the gloss rule decides pages, not identity: a member gloss is prose too', () => {
    const t = 'Grüntee-Polyphenole (EGCG) aktivieren Caspasen und modulieren die Bcl-2-Familie.';
    expect(classifyCandidate(t, 'EGCG')).toBe('prose');
  });

  it('a profile without exemplar markers keeps the strict reading', () => {
    const t = 'Pour les anticoagulants (Warfarin notamment) la prudence est requise.';
    expect(classify(t, 'Warfarin', GATE_LANGUAGE_PROFILES.fr)).toBe('aside');
  });
});

// domain axis stage 3 (#568): the semantic half — the model's coverage
// observation meets the threshold in code.
import { applyCoverageThreshold, COVERAGE_BELOW_THRESHOLD } from '../../core/candidate-gate';

describe('applyCoverageThreshold (domain axis stage 3, #568)', () => {
  const mk = (name: string, coverage?: string, related: string[] = []): EntityInfo =>
    ({ name, type: 'other', summary: '', mentions_in_source: [], related_entities: related, ...(coverage ? { coverage } : {}) } as unknown as EntityInfo);
  const mkC = (name: string, coverage?: string, related: string[] = []): ConceptInfo =>
    ({ name, type: 'term', summary: '', mentions_in_source: [], related_concepts: related, ...(coverage ? { coverage } : {}) } as unknown as ConceptInfo);

  it('the threshold is `named` and nothing else', () => {
    expect([...COVERAGE_BELOW_THRESHOLD]).toEqual(['named']);
  });

  it('drops `named`, keeps `defined`, `discussed`, a missing value and an unknown value', () => {
    const r = applyCoverageThreshold({
      entities: [mk('Ferritin', 'defined'), mk('CRP', 'named'), mk('Eisen')],
      concepts: [mkC('Hepcidin', 'discussed'), mkC('Zink', 'NAMED '), mkC('Kupfer', 'somewhat')],
    });
    expect(r.applied).toBe(true);
    expect(r.entities.map(e => e.name)).toEqual(['Ferritin', 'Eisen']);
    expect(r.concepts.map(c => c.name)).toEqual(['Hepcidin', 'Kupfer']);
    expect(r.dropped).toEqual([
      { name: 'CRP', kind: 'entity', verdict: 'named' },
      { name: 'Zink', kind: 'concept', verdict: 'named' },
    ]);
  });

  it('prunes dropped names from the survivors\' related_* lists', () => {
    const r = applyCoverageThreshold({
      entities: [mk('Ferritin', 'defined', ['CRP', 'Eisen']), mk('CRP', 'named')],
      concepts: [mkC('Hepcidin', 'discussed', ['Zink', 'Ferritin']), mkC('Zink', 'named')],
    });
    expect(r.entities[0].related_entities).toEqual(['Eisen']);
    expect(r.concepts[0].related_concepts).toEqual(['Ferritin']);
  });

  it('returns the input untouched when nothing falls below the threshold', () => {
    const entities = [mk('Ferritin', 'defined')];
    const r = applyCoverageThreshold({ entities, concepts: [] });
    expect(r.entities).toBe(entities);
    expect(r.dropped).toEqual([]);
  });

  // S135: the author's link outranks the model's `named` — measured twice in
  // one day ([[Reis]] in Arsen, [[Blei]] in Reis, both hand-linked, both
  // dropped by the threshold before this rule).
  describe('linked names survive the threshold', () => {
    const text = [
      'Hauptquellen sind Nahrungsmittel ([[Reis]] nimmt Arsen stark auf).',
      'Spuren von [[Blei|Bleibelastung]] und die [[Notizen/HPA-Axis|Stressachse]] spielen mit.',
      'Details im [ATS Statement](https://example.org/ats).',
    ].join('\n');

    it('keeps a `named` candidate whose name is a wikilink target, pipe alias, or markdown link text', () => {
      const r = applyCoverageThreshold({
        entities: [mk('Reis', 'named'), mk('Bleibelastung', 'named'), mk('ATS Statement', 'named')],
        concepts: [mkC('HPA-Axis', 'named')],
      }, text);
      expect(r.entities.map(e => e.name)).toEqual(['Reis', 'Bleibelastung', 'ATS Statement']);
      expect(r.concepts.map(c => c.name)).toEqual(['HPA-Axis']);
      expect(r.dropped).toEqual([]);
    });

    it('still drops a `named` candidate the note never linked — and everything without sourceText', () => {
      const r = applyCoverageThreshold({ entities: [mk('Arsen', 'named')], concepts: [] }, text);
      expect(r.dropped.map(d => d.name)).toEqual(['Arsen']);
      const r2 = applyCoverageThreshold({ entities: [mk('Reis', 'named')], concepts: [] });
      expect(r2.dropped.map(d => d.name)).toEqual(['Reis']);
    });

    it('the link is an exact claim: a compound or inflected form does not inherit it', () => {
      const r = applyCoverageThreshold({ entities: [mk('Reisprodukte', 'named')], concepts: [] }, text);
      expect(r.dropped.map(d => d.name)).toEqual(['Reisprodukte']);
    });
  });
});

describe('applyCoverageThreshold with isKnownPage (#620 parity)', () => {
  const mk = (name: string, coverage?: string, related: string[] = []): EntityInfo =>
    ({ name, type: 'other', summary: '', mentions_in_source: [], related_entities: related, ...(coverage ? { coverage } : {}) } as unknown as EntityInfo);

  it('keeps the edge of a dropped name the vault already has a page for', () => {
    const r = applyCoverageThreshold(
      {
        entities: [mk('Ferritin', 'defined', ['CRP', 'Eisen']), mk('CRP', 'named')],
        concepts: [],
      },
      undefined,
      name => name === 'CRP', // vault has a CRP page
    );
    expect(r.entities[0].related_entities).toEqual(['CRP', 'Eisen']);
    expect(r.linkedAnyway).toEqual(['CRP']);
    expect(r.dropped).toEqual([{ name: 'CRP', kind: 'entity', verdict: 'named' }]);
  });

  it('still prunes a dropped name the vault does not know', () => {
    const r = applyCoverageThreshold(
      {
        entities: [mk('Ferritin', 'defined', ['CRP', 'Eisen']), mk('CRP', 'named')],
        concepts: [],
      },
      undefined,
      () => false,
    );
    expect(r.entities[0].related_entities).toEqual(['Eisen']);
    expect(r.linkedAnyway).toEqual([]);
  });
});

// S135: the three-outcome table. Measured over 1,153 items across three runs:
// its full-page set equals exactly the serial gates' keep set; dissent
// (prose+named / aside+covered) births stubs instead of drops.
import { applyOutcomeTable, type StubIdentity } from '../../core/candidate-gate';

describe('applyOutcomeTable (S135)', () => {
  const mk = (name: string, coverage?: string, related: string[] = []): EntityInfo =>
    ({ name, type: 'other', summary: 's', mentions_in_source: [], related_entities: related, ...(coverage ? { coverage } : {}) } as unknown as EntityInfo);
  const mkC = (name: string, coverage?: string, related: string[] = []): ConceptInfo =>
    ({ name, type: 'term', summary: 's', mentions_in_source: [], related_concepts: related, ...(coverage ? { coverage } : {}) } as unknown as ConceptInfo);
  const none = (): StubIdentity => 'none';

  // TEXT (top of file): Ferritin/Entzündung prose · CRP/Malabsorption aside ·
  // Eisenstoffwechsel absent.

  it('agreement cells: prose+covered keeps, aside+named and absent drop', () => {
    const r = applyOutcomeTable({
      entities: [mk('Ferritin', 'discussed'), mk('CRP', 'named')],
      concepts: [mkC('Eisenstoffwechsel', 'discussed')],
    }, TEXT, 'de', none);
    expect(r.applied).toBe(true);
    expect(r.entities.map(e => e.name)).toEqual(['Ferritin']);
    expect(r.concepts).toEqual([]);
    expect(r.stubs).toEqual([]);
    expect(r.dropped).toEqual([
      { name: 'CRP', kind: 'entity', verdict: 'aside+named' },
      { name: 'Eisenstoffwechsel', kind: 'concept', verdict: 'absent' },
    ]);
  });

  it('dissent cells birth stubs: prose+named and aside+covered', () => {
    const r = applyOutcomeTable({
      entities: [mk('Ferritin', 'named'), mk('CRP', 'discussed')],
      concepts: [],
    }, TEXT, 'de', none);
    expect(r.entities).toEqual([]);
    expect(r.stubs.map(s => ({ name: s.item.name, cell: s.cell }))).toEqual([
      { name: 'Ferritin', cell: 'prose+named' },
      { name: 'CRP', cell: 'aside+covered' },
    ]);
    expect(r.dropped).toEqual([]);
  });

  it('a missing coverage value counts as covered (same contract as the threshold)', () => {
    const r = applyOutcomeTable({ entities: [mk('Ferritin'), mk('CRP')], concepts: [] }, TEXT, 'de', none);
    expect(r.entities.map(e => e.name)).toEqual(['Ferritin']);
    expect(r.stubs.map(s => s.item.name)).toEqual(['CRP']);
  });

  it("the author's link outranks both gates", () => {
    const text = 'Es steigt bei Entzündung ([[CRP]] erhöht) an.';
    const r = applyOutcomeTable({ entities: [mk('CRP', 'named')], concepts: [] }, text, 'de', none);
    expect(r.entities.map(e => e.name)).toEqual(['CRP']);
    expect(r.stubs).toEqual([]);
  });

  it('a dissent name an existing page answers gets no stub and stays linkable', () => {
    const r = applyOutcomeTable({
      entities: [mk('Ferritin', 'discussed', ['CRP'])],
      concepts: [mkC('CRP', 'discussed')],
    }, TEXT, 'de', () => 'match');
    expect(r.stubs).toEqual([]);
    expect(r.existing).toEqual([{ name: 'CRP', kind: 'concept', cell: 'aside+covered' }]);
    // NOT pruned: the existing page takes the edge.
    expect(r.entities[0].related_entities).toEqual(['CRP']);
  });

  it('an ambiguous dissent name gets no stub and IS pruned', () => {
    const r = applyOutcomeTable({
      entities: [mk('Ferritin', 'discussed', ['CRP'])],
      concepts: [mkC('CRP', 'discussed')],
    }, TEXT, 'de', () => 'ambiguous');
    expect(r.stubs).toEqual([]);
    expect(r.dropped).toEqual([{ name: 'CRP', kind: 'concept', verdict: 'ambiguous' }]);
    expect(r.entities[0].related_entities).toEqual([]);
  });

  it('stub names are not pruned from the survivors\' related_* lists', () => {
    const r = applyOutcomeTable({
      entities: [mk('Ferritin', 'discussed', ['CRP']), mk('CRP', 'discussed')],
      concepts: [],
    }, TEXT, 'de', none);
    expect(r.stubs.map(s => s.item.name)).toEqual(['CRP']);
    expect(r.entities[0].related_entities).toEqual(['CRP']);
  });

  it('no language profile: input untouched, applied false', () => {
    const input = { entities: [mk('Ferritin', 'named')], concepts: [] };
    const r = applyOutcomeTable(input, TEXT, 'sv', none);
    expect(r.applied).toBe(false);
    expect(r.entities).toBe(input.entities);
    expect(r.stubs).toEqual([]);
  });
});
