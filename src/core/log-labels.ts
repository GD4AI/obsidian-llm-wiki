// The ingest log's section labels, one table for all languages.
//
// `LogWriter` writes them (`**Created pages**: …`), `log-parser.ts` reads
// them back for the Operation History Panel. Both sides come here, so a
// label the writer can produce is a label the parser recognises, in every
// language the plugin offers (`WIKI_LANGUAGES`). Kept out of the locale
// files on purpose: a table of all languages inside a file of one language
// invites translation of the wrong rows (#667).
//
// Pure, no Obsidian dependencies.

import { escapeRegex } from '../wiki/lint/utils';

export interface LogLabels {
  createdPages: string;
  updatedPages: string;
  contradictionsFound: string;
}

export const LOG_LABELS: Record<string, LogLabels> = {
  en: { createdPages: 'Created pages', updatedPages: 'Updated pages', contradictionsFound: 'Contradictions found' },
  zh: { createdPages: '创建页面', updatedPages: '更新页面', contradictionsFound: '发现矛盾' },
  'zh-Hant': { createdPages: '建立頁面', updatedPages: '更新頁面', contradictionsFound: '發現矛盾' },
  ja: { createdPages: '作成ページ', updatedPages: '更新ページ', contradictionsFound: '矛盾を発見' },
  ko: { createdPages: '생성 페이지', updatedPages: '업데이트 페이지', contradictionsFound: '모순 발견' },
  de: { createdPages: 'Erstellte Seiten', updatedPages: 'Aktualisierte Seiten', contradictionsFound: 'Widersprüche gefunden' },
  fr: { createdPages: 'Pages créées', updatedPages: 'Pages mises à jour', contradictionsFound: 'Contradictions trouvées' },
  es: { createdPages: 'Páginas creadas', updatedPages: 'Páginas actualizadas', contradictionsFound: 'Contradicciones encontradas' },
  pt: { createdPages: 'Páginas criadas', updatedPages: 'Páginas atualizadas', contradictionsFound: 'Contradições encontradas' },
  it: { createdPages: 'Pagine create', updatedPages: 'Pagine aggiornate', contradictionsFound: 'Contraddizioni trovate' },
  ru: { createdPages: 'Созданные страницы', updatedPages: 'Обновлённые страницы', contradictionsFound: 'Найдены противоречия' },
};

/** Labels for `lang`; English when the language has no entry. */
export function getLogLabels(lang: string | undefined): LogLabels {
  return lang && Object.prototype.hasOwnProperty.call(LOG_LABELS, lang) ? LOG_LABELS[lang] : LOG_LABELS.en;
}

/**
 * Regex matching one `**<label>**: rest` line for `field` in any language,
 * with the rest of the line captured as group 1. Old entries were written
 * by older writers, so every language's label is accepted regardless of the
 * vault's current setting.
 */
export function logLabelLineRe(field: keyof LogLabels): RegExp {
  const labels = [...new Set(Object.values(LOG_LABELS).map(l => l[field]))].map(escapeRegex);
  return new RegExp(`^\\*\\*(?:${labels.join('|')})\\*\\*[：:]\\s*(.*)$`);
}
