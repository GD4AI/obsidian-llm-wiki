import { CODEX_MODELS } from './constants';

export interface CodexModelPolicyTarget {
  provider?: string;
  availableModels?: string[];
  openAICodexModels?: Array<{ slug: string }>;
  openAICodexModelsFetchedAt?: number;
  openAICodexUnavailableModels?: string[];
  model: string;
  useCustomModel?: boolean;
  ingestModel?: string;
  lintModel?: string;
  queryModel?: string;
  ingestModelUseCustom?: boolean;
  lintModelUseCustom?: boolean;
  queryModelUseCustom?: boolean;
}

export function applyCodexModelPolicy(settings: CodexModelPolicyTarget): void {
  const accountModels = settings.openAICodexModels?.map((entry) => entry.slug).filter((slug) => slug.trim() !== '') ?? [];
  const unavailable = new Set(settings.openAICodexUnavailableModels ?? []);
  const models = (accountModels.length > 0 ? accountModels : [...CODEX_MODELS]).filter((model) => !unavailable.has(model));
  const supported = new Set<string>(models);
  settings.availableModels = models;
  if (!supported.has(settings.model)) settings.model = models[0] ?? '';
  settings.useCustomModel = false;
  for (const field of ['ingestModel', 'lintModel', 'queryModel'] as const) {
    if (settings[field] && !supported.has(settings[field])) settings[field] = '';
  }
  settings.ingestModelUseCustom = false;
  settings.lintModelUseCustom = false;
  settings.queryModelUseCustom = false;
}

export function preserveCodexRuntimeModelState(target: CodexModelPolicyTarget, runtime: CodexModelPolicyTarget): void {
  target.openAICodexModels = runtime.openAICodexModels ? [...runtime.openAICodexModels] : [];
  target.openAICodexModelsFetchedAt = runtime.openAICodexModelsFetchedAt ?? 0;
  target.openAICodexUnavailableModels = [...(runtime.openAICodexUnavailableModels ?? [])];
  if (target.provider !== undefined && target.provider !== 'openai-codex') return;
  target.model = runtime.model;
  target.ingestModel = runtime.ingestModel;
  target.lintModel = runtime.lintModel;
  target.queryModel = runtime.queryModel;
  applyCodexModelPolicy(target);
}
