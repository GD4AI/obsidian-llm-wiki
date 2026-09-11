// System prompt builder — extracted from WikiEngine for modularity.
// Pure functions with no Obsidian vault dependencies.

import { LLMWikiSettings, WIKI_LANGUAGES, ExtractionGranularity } from '../types';
import { getActiveEntityTags, getActiveConceptTags } from '../core/tag-vocab';

export function buildWikiLanguageDirective(settings: LLMWikiSettings): string {
  const lang = settings.wikiLanguage || 'en';
  const langName = WIKI_LANGUAGES[lang] || lang;
  return `IMPORTANT: You MUST write ALL content in ${langName}. Every page title, summary, description, and label must be in ${langName}. Do NOT output any content in other languages.`;
}

export const SECTION_LABELS: Record<string, Record<string, string>> = {
  en: {
    basic_information: 'Basic Information', description: 'Description',
    related_content: 'Related Content', mentions_in_source: 'Mentions in Source',
    new_information: 'New Information', definition: 'Definition',
    key_characteristics: 'Key Characteristics', applications: 'Applications',
    related_concepts: 'Related Concepts', related_entities: 'Related Entities',
    source: 'Source', core_content: 'Core Content', key_entities: 'Key Entities',
    key_concepts: 'Key Concepts', main_points: 'Main Points',
    new_claim: 'New Claim',
    existing_knowledge: 'Existing Knowledge', resolution_suggestion: 'Resolution Suggestion',
    source_page: 'Source Page', related_pages: 'Related Pages', updated: 'Updated',
  },
  zh: {
    basic_information: '基本信息', description: '描述',
    related_content: '相关内容', mentions_in_source: '来源提及',
    new_information: '新信息', definition: '定义',
    key_characteristics: '关键特征', applications: '应用',
    related_concepts: '相关概念', related_entities: '相关实体',
    source: '来源', core_content: '核心内容', key_entities: '关键实体',
    key_concepts: '关键概念', main_points: '要点',
    new_claim: '新主张',
    existing_knowledge: '已有知识', resolution_suggestion: '解决建议',
    source_page: '来源页面', related_pages: '相关页面', updated: '更新于',
  },
  // v1.22.0: Traditional Chinese (zh-Hant) for HK/MO/TW/MY/SG users
  'zh-Hant': {
    basic_information: '基本資訊', description: '描述',
    related_content: '相關內容', mentions_in_source: '來源提及',
    new_information: '新資訊', definition: '定義',
    key_characteristics: '關鍵特徵', applications: '應用',
    related_concepts: '相關概念', related_entities: '相關實體',
    source: '來源', core_content: '核心內容', key_entities: '關鍵實體',
    key_concepts: '關鍵概念', main_points: '要點',
    new_claim: '新主張',
    existing_knowledge: '已有知識', resolution_suggestion: '解決建議',
    source_page: '來源頁面', related_pages: '相關頁面', updated: '更新於',
  },
  ja: {
    basic_information: '基本情報', description: '説明',
    related_content: '関連コンテンツ', mentions_in_source: 'ソースでの言及',
    new_information: '新情報', definition: '定義',
    key_characteristics: '主な特徴', applications: '応用',
    related_concepts: '関連概念', related_entities: '関連エンティティ',
    source: 'ソース', core_content: '核心内容', key_entities: '主要エンティティ',
    key_concepts: '主要概念', main_points: '要点',
    new_claim: '新しい主張',
    existing_knowledge: '既存の知識', resolution_suggestion: '解決案',
    source_page: 'ソースページ', related_pages: '関連ページ', updated: '更新日',
  },
  ko: {
    basic_information: '기본 정보', description: '설명',
    related_content: '관련 콘텐츠', mentions_in_source: '출처 언급',
    new_information: '새 정보', definition: '정의',
    key_characteristics: '주요 특징', applications: '응용',
    related_concepts: '관련 개념', related_entities: '관련 엔티티',
    source: '출처', core_content: '핵심 내용', key_entities: '주요 엔티티',
    key_concepts: '주요 개념', main_points: '주요 사항',
    new_claim: '새 주장',
    existing_knowledge: '기존 지식', resolution_suggestion: '해결 제안',
    source_page: '출처 페이지', related_pages: '관련 페이지', updated: '업데이트',
  },
  de: {
    basic_information: 'Grundlegende Informationen', description: 'Beschreibung',
    related_content: 'Verwandte Inhalte', mentions_in_source: 'Erwähnungen in der Quelle',
    new_information: 'Neue Informationen', definition: 'Definition',
    key_characteristics: 'Hauptmerkmale', applications: 'Anwendungen',
    related_concepts: 'Verwandte Konzepte', related_entities: 'Verwandte Entitäten',
    source: 'Quelle', core_content: 'Kerninhalt', key_entities: 'Wichtige Entitäten',
    key_concepts: 'Wichtige Konzepte', main_points: 'Hauptpunkte',
    new_claim: 'Neue Behauptung',
    existing_knowledge: 'Bestehendes Wissen', resolution_suggestion: 'Lösungsvorschlag',
    source_page: 'Quellseite', related_pages: 'Verwandte Seiten', updated: 'Aktualisiert',
  },
  fr: {
    basic_information: 'Informations de base', description: 'Description',
    related_content: 'Contenu associé', mentions_in_source: 'Mentions dans la source',
    new_information: 'Nouvelles informations', definition: 'Définition',
    key_characteristics: 'Caractéristiques principales', applications: 'Applications',
    related_concepts: 'Concepts associés', related_entities: 'Entités associées',
    source: 'Source', core_content: 'Contenu principal', key_entities: 'Entités clés',
    key_concepts: 'Concepts clés', main_points: 'Points principaux',
    new_claim: 'Nouvelle affirmation',
    existing_knowledge: 'Connaissances existantes', resolution_suggestion: 'Suggestion de résolution',
    source_page: 'Page source', related_pages: 'Pages associées', updated: 'Mis à jour',
  },
  es: {
    basic_information: 'Información básica', description: 'Descripción',
    related_content: 'Contenido relacionado', mentions_in_source: 'Menciones en la fuente',
    new_information: 'Nueva información', definition: 'Definición',
    key_characteristics: 'Características clave', applications: 'Aplicaciones',
    related_concepts: 'Conceptos relacionados', related_entities: 'Entidades relacionadas',
    source: 'Fuente', core_content: 'Contenido principal', key_entities: 'Entidades clave',
    key_concepts: 'Conceptos clave', main_points: 'Puntos principales',
    new_claim: 'Nueva afirmación',
    existing_knowledge: 'Conocimiento existente', resolution_suggestion: 'Sugerencia de resolución',
    source_page: 'Página de origen', related_pages: 'Páginas relacionadas', updated: 'Actualizado',
  },
  pt: {
    basic_information: 'Informações básicas', description: 'Descrição',
    related_content: 'Conteúdo relacionado', mentions_in_source: 'Menções na fonte',
    new_information: 'Novas informações', definition: 'Definição',
    key_characteristics: 'Características principais', applications: 'Aplicações',
    related_concepts: 'Conceitos relacionados', related_entities: 'Entidades relacionadas',
    source: 'Fonte', core_content: 'Conteúdo principal', key_entities: 'Entidades principais',
    key_concepts: 'Conceitos principais', main_points: 'Pontos principais',
    new_claim: 'Nova afirmação',
    existing_knowledge: 'Conhecimento existente', resolution_suggestion: 'Sugestão de resolução',
    source_page: 'Página de origem', related_pages: 'Páginas relacionadas', updated: 'Atualizado',
  },
  it: {
    basic_information: 'Informazioni di base', description: 'Descrizione',
    related_content: 'Contenuti correlati', mentions_in_source: 'Menzioni nella sorgente',
    new_information: 'Nuove informazioni', definition: 'Definizione',
    key_characteristics: 'Caratteristiche principali', applications: 'Applicazioni',
    related_concepts: 'Concetti correlati', related_entities: 'Entità correlate',
    source: 'Sorgente', core_content: 'Contenuto principale', key_entities: 'Entità chiave',
    key_concepts: 'Concetti chiave', main_points: 'Punti principali',
    new_claim: 'Nuova affermazione',
    existing_knowledge: 'Conoscenza esistente', resolution_suggestion: 'Suggerimento di risoluzione',
    source_page: 'Pagina sorgente', related_pages: 'Pagine correlate', updated: 'Aggiornato',
  },
  // v1.26.0: Russian (ru) section labels
  ru: {
    basic_information: 'Основная информация', description: 'Описание',
    related_content: 'Связанный контент', mentions_in_source: 'Упоминания в источнике',
    new_information: 'Новая информация', definition: 'Определение',
    key_characteristics: 'Ключевые характеристики', applications: 'Применения',
    related_concepts: 'Связанные концепции', related_entities: 'Связанные сущности',
    source: 'Источник', core_content: 'Основное содержание', key_entities: 'Ключевые сущности',
    key_concepts: 'Ключевые концепции', main_points: 'Основные пункты',
    new_claim: 'Новое утверждение',
    existing_knowledge: 'Существующее знание', resolution_suggestion: 'Предложение по разрешению',
    source_page: 'Страница-источник', related_pages: 'Связанные страницы', updated: 'Обновлено',
  },
};

export function getSectionLabels(settings: LLMWikiSettings): Record<string, string> {
  const lang = settings.wikiLanguage || 'en';
  return SECTION_LABELS[lang] || SECTION_LABELS.en;
}

// Granularity instruction text for extraction prompts.
// custom is generated dynamically (injects concrete entity/concept limit numbers from settings).
const GRANULARITY_INSTRUCTIONS: Record<ExtractionGranularity, string> = {
  fine: 'Extract ALL entities and concepts worth recording from the source, including those mentioned only once or tangentially.',
  standard: 'Extract important and moderately important entities and concepts from the source. Ignore minor items mentioned only in passing.',
  coarse: 'Extract only the most essential entities and concepts from the source — those without which the text cannot be understood. Quality over quantity.',
  minimal: 'Extract only the most critical entities and concepts from the source — maximum 5 total items. Extreme selectivity for cost control.',
  custom: '', // placeholder — never used; getGranularityInstruction handles custom dynamically
};

// Numeric limits for entity/concept generation in fix (non-ingestion) contexts.
// Keyed by granularity: max per type (entities, concepts).
// custom is handled dynamically in getGranularityFixLimits.
const GRANULARITY_FIX_LIMITS: Record<ExtractionGranularity, { maxEntities: number; maxConcepts: number }> = {
  fine:     { maxEntities: 6, maxConcepts: 6 },
  standard: { maxEntities: 3, maxConcepts: 3 },
  coarse:   { maxEntities: 2, maxConcepts: 2 },
  minimal:  { maxEntities: 1, maxConcepts: 2 },
  custom:   { maxEntities: 0, maxConcepts: 0 }, // placeholder — never used
};

export function getGranularityInstruction(settings: LLMWikiSettings): string {
  const granularity = settings.extractionGranularity || 'standard';
  if (granularity === 'custom') {
    const entityLimit = settings.customEntityLimit ?? 5;
    const conceptLimit = settings.customConceptLimit ?? 5;
    return `Extract at most ${entityLimit} entities and at most ${conceptLimit} concepts from the source. If you reach either limit, stop extracting that type.`;
  }
  return GRANULARITY_INSTRUCTIONS[granularity] || GRANULARITY_INSTRUCTIONS.standard;
}

// Issue #96 was originally addressed by appending a granularity instruction to
// the lint prompt (appendGranularityToPrompt). That helper was never wired to a
// caller — the #96 intent is served by getGranularityFixLimits (fill-empty-page)
// and getGranularityInstruction (source-analyzer ingest path) instead. Removed
// in the audit phase-1 cleanup (dead code, 0 callers, 0 tests).

export function getGranularityFixLimits(settings: LLMWikiSettings): { maxEntities: number; maxConcepts: number } {
  const granularity = settings.extractionGranularity || 'standard';
  if (granularity === 'custom') {
    return {
      maxEntities: settings.customEntityLimit ?? 5,
      maxConcepts: settings.customConceptLimit ?? 5
    };
  }
  return GRANULARITY_FIX_LIMITS[granularity] || GRANULARITY_FIX_LIMITS.standard;
}

export function applySectionLabels(prompt: string, settings: LLMWikiSettings): string {
  const labels = getSectionLabels(settings);
  let result = prompt;
  for (const [key, label] of Object.entries(labels)) {
    result = result.replace(new RegExp(`\\{\\{section_${key}\\}\\}`, 'g'), label);
  }
  return result;
}

export async function buildSystemPrompt(
  settings: LLMWikiSettings,
  getSchemaContext: (task: string) => Promise<string | undefined>,
  task: string
): Promise<string | undefined> {
  const parts: string[] = [];
  const langDirective = buildWikiLanguageDirective(settings);
  if (langDirective) parts.push(langDirective);
  const schemaContext = await getSchemaContext(task);
  if (schemaContext) parts.push(schemaContext);

  // Issue #328 Phase 1: the runtime-injection layer is the SOLE source of
  // truth for the active tag vocabulary. Always append. Any dedup is the
  // caller's responsibility — schema bodies produced by
  // buildDefaultSchemaBody() no longer contain a baked enum to duplicate
  // against.
  const tagVocab = buildActiveTagVocabularySection(settings);
  if (tagVocab) parts.push(tagVocab);

  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

/**
 * Issue #85 v6: Build the active tag-vocabulary section for the LLM
 * prompt. When `tagVocabularyMode === 'custom'` the section lists the
 * user-defined CSV (so the LLM emits matching types); in `default` mode
 * it lists the hardcoded VALID_*_TAGS so the LLM has a concrete enum
 * to choose from instead of inventing new subtype names.
 *
 * The output is a plain-text section (no markdown) that can be appended
 * to ingestion / page-generation / lint-analyze prompts. Designed to be
 * language-neutral so the surrounding prompt can stay in the wiki
 * language.
 */
export function buildActiveTagVocabularySection(
  settings: LLMWikiSettings
): string {
  const entities = getActiveEntityTags(settings);
  const concepts = getActiveConceptTags(settings);
  const lines: string[] = [];
  lines.push('## Active Tag Vocabulary (runtime)');
  lines.push('');
  lines.push(
    'When assigning `type` to an entity or concept, you MUST use one of the following allowed values. Do NOT invent new types.'
  );
  lines.push('');
  lines.push('**Entity types** (entity_type field — one of):');
  for (const t of entities) lines.push(`- ${t}`);
  lines.push('');
  lines.push('**Concept types** (concept_type field — one of):');
  for (const t of concepts) lines.push(`- ${t}`);
  lines.push('');
  lines.push(
    'If a discovered item does not clearly fit any of the above, choose the closest match. Do NOT emit a free-form type string — the frontmatter validator will reject it.'
  );
  return lines.join('\n');
}
