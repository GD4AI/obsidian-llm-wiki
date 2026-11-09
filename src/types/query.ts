/**
 * Query history, schema suggestions and page-creation results.
 *
 * Split out of `types.ts` by #929.
 */
export interface QueryHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /**
   * v1.24.0: Retrieval metadata persisted per assistant turn so the
   * label survives Obsidian restart. Optional — pre-v1.24.0 history
   * is loaded without it, and the retrieval label simply won't render
   * (no crash).
   */
  retrieval?: {
    arm: string;
    count: number;
    topPaths: string[];
  };
}

// Schema types

export interface WikiSchema {
  version: number;
  updated: string;
  auto_suggestion_count: number;
  body: string;
}

export interface SchemaSuggestion {
  timestamp: string;
  source: string;
  changes_needed: boolean;
  suggestions: string;
  /** v1.22.0 #97: full proposed new body (frontmatter-free, ready to
   *  splice). Undefined when the LLM only provided markdown suggestions
   *  (legacy v1.21.x format) or when changes_needed is false. */
  newSchemaBody?: string;
}

// Ingestion report passed to onDone callback

// Result of page creation/update
export interface PageCreationResult {
  path: string | null;
  /**
   * Issue #290 — whether this write created the page or merged into one that
   * already existed. Decided by the pre-write existence check the router
   * already performs to choose between the create and merge paths, so it
   * reports what actually happened rather than what the caller intended.
   * The ingest log splits "Created pages" from "Updated pages" on it; merges
   * are the half of an ingest where existing content can be lost, so they must
   * not be reported as creations.
   */
  created: boolean;
}
