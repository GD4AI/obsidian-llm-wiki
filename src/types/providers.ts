/**
 * Predefined provider table. Split out of `types.ts` by #929 (#929).
 */
import type { ProviderConfig } from './llm';

// Predefined LLM provider configurations

export const PREDEFINED_PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    nameEn: 'OpenAI',
    nameZh: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyPlaceholder: 'sk-...',
    apiKeyPlaceholderEn: 'sk-...',
    apiKeyPlaceholderZh: 'sk-...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  'openai-codex': {
    id: 'openai-codex',
    name: 'ChatGPT Plan (Codex OAuth)',
    nameEn: 'ChatGPT Plan (Codex OAuth)',
    nameZh: 'ChatGPT Plan (Codex OAuth)',
    baseUrl: '',
    apiKeyPlaceholder: '',
    apiKeyPlaceholderEn: '',
    apiKeyPlaceholderZh: '',
    requiresBaseUrl: false,
    authMode: 'codex-oauth'
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    nameEn: 'Anthropic (Claude)',
    nameZh: 'Anthropic (Claude)',
    baseUrl: '',
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyPlaceholderEn: 'sk-ant-...',
    apiKeyPlaceholderZh: 'sk-ant-...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    nameEn: 'Google Gemini',
    nameZh: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeyPlaceholder: 'AIza...',
    apiKeyPlaceholderEn: 'AIza...',
    apiKeyPlaceholderZh: 'AIza...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    nameEn: 'OpenRouter',
    nameZh: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyPlaceholder: 'sk-or-...',
    apiKeyPlaceholderEn: 'sk-or-...',
    apiKeyPlaceholderZh: 'sk-or-...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    nameEn: 'DeepSeek',
    nameZh: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyPlaceholder: 'sk-...',
    apiKeyPlaceholderEn: 'sk-...',
    apiKeyPlaceholderZh: 'sk-...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    nameEn: 'MiniMax',
    nameZh: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/v1',
    apiKeyPlaceholder: 'sk-cp-...',
    apiKeyPlaceholderEn: 'sk-cp-...',
    apiKeyPlaceholderZh: 'sk-cp-...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    nameEn: 'Kimi (Moonshot)',
    nameZh: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKeyPlaceholder: 'sk-...',
    apiKeyPlaceholderEn: 'sk-...',
    apiKeyPlaceholderZh: 'sk-...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  glm: {
    id: 'glm',
    name: 'GLM (Zhipu AI)',
    nameEn: 'GLM (Zhipu AI)',
    nameZh: 'GLM (智谱AI)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyPlaceholder: '...',
    apiKeyPlaceholderEn: '...',
    apiKeyPlaceholderZh: '...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  // Issue #723: a named hosted provider, not a custom endpoint — the user never
  // types a URL for it — so it belongs with the fixed-baseURL providers above
  // the custom group rather than wedged between them. OpenCode routes on client
  // identity: it needs a stable per-conversation id and rejects requests without
  // one, which the client fills from the `{sessionId}` placeholder.
  opencode: {
    id: 'opencode',
    name: 'OpenCode (Zen / Go)',
    nameEn: 'OpenCode (Zen / Go)',
    nameZh: 'OpenCode（Zen / Go）',
    baseUrl: 'https://opencode.ai/zen/go/v1',
    apiKeyPlaceholder: 'OpenCode API Key',
    apiKeyPlaceholderEn: 'OpenCode API Key',
    apiKeyPlaceholderZh: 'OpenCode API Key',
    requiresBaseUrl: false,
    authMode: 'api-key',
    // Deliberately no `supportsStructuredOutputs`. Every cloud compat preset
    // (gemini / openrouter / deepseek / minimax / kimi / glm) omits it for the
    // same reason documented at `ProviderConfig.supportsStructuredOutputs`: cloud
    // backends receive `json_object`, not `json_schema`. Setting it on Go costs a
    // wasted call — `response_format type is unavailable now` → 400 →
    // OutputModeProber demotes and retries — on the first schema-bearing call per
    // (baseURL, model) per session. Measured on a real Go key by @aisahpA (#736).
    defaultHeaders: { 'x-opencode-session': '{sessionId}' }
  },
  // v1.24.1 PATCH Bedrock Stage 1 — reuses AnthropicSdkClient via the
  // bedrock-mantle endpoint (Bearer auth, no AWS SDK). baseUrl is filled
  // dynamically by createLLMClientFromSettings based on `bedrockRegion`.
  'bedrock-anthropic': {
    id: 'bedrock-anthropic',
    name: 'Amazon Bedrock (Anthropic via mantle)',
    nameEn: 'Amazon Bedrock (Anthropic via mantle)',
    nameZh: 'Amazon Bedrock（Anthropic via mantle）',
    baseUrl: '',  // Resolved at runtime from bedrockRegion (see constants.ts)
    apiKeyPlaceholder: 'ABSK... (Bedrock bearer key)',
    apiKeyPlaceholderEn: 'ABSK... (Bedrock bearer key)',
    apiKeyPlaceholderZh: 'ABSK...（Bedrock bearer key）',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  // v1.24.1 PATCH Bedrock Stage 1 — reuses OpenAICompatSdkClient via
  // bedrock-mantle /v1 chat-completions. Same bearer auth as Bedrock-
  // Anthropic; region is resolved at runtime from `bedrockRegion`.
  'bedrock-openai': {
    id: 'bedrock-openai',
    name: 'Amazon Bedrock (OpenAI via mantle)',
    nameEn: 'Amazon Bedrock (OpenAI via mantle)',
    nameZh: 'Amazon Bedrock（OpenAI via mantle）',
    baseUrl: '',  // Resolved at runtime from bedrockRegion
    apiKeyPlaceholder: 'ABSK... (Bedrock bearer key)',
    apiKeyPlaceholderEn: 'ABSK... (Bedrock bearer key)',
    apiKeyPlaceholderZh: 'ABSK...（Bedrock bearer key）',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    nameEn: 'Ollama (Local)',
    nameZh: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    apiKeyPlaceholder: 'ollama (no Key required)',
    apiKeyPlaceholderEn: 'ollama (no Key required)',
    apiKeyPlaceholderZh: 'ollama (无需Key)',
    requiresBaseUrl: false,
    authMode: 'none',
    supportsStructuredOutputs: true
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    nameEn: 'LM Studio (Local)',
    nameZh: 'LM Studio（本地）',
    baseUrl: 'http://localhost:1234/v1',
    apiKeyPlaceholder: 'lmstudio',
    apiKeyPlaceholderEn: 'lmstudio (optional)',
    apiKeyPlaceholderZh: 'lmstudio（可选）',
    requiresBaseUrl: false,
    authMode: 'none',
    supportsStructuredOutputs: true
  },
  custom: {
    id: 'custom',
    name: 'Custom OpenAI-Compatible (Completion)',
    nameEn: 'Custom OpenAI-Compatible (Completion)',
    nameZh: '自定义 OpenAI 兼容（Completion）',
    baseUrl: '',
    apiKeyPlaceholder: 'API Key',
    apiKeyPlaceholderEn: 'API Key',
    apiKeyPlaceholderZh: 'API Key',
    requiresBaseUrl: true,
    authMode: 'api-key',
    supportsStructuredOutputs: true
  },
  // Issue #723: the same user-supplied base URL, spoken as `/v1/responses`
  // instead of `/v1/chat/completions`. Separate preset rather than a toggle so
  // the two shapes can coexist — a gateway may support one, both, or neither,
  // and a user who guessed wrong can switch back without re-entering the URL.
  'custom-responses': {
    id: 'custom-responses',
    name: 'Custom OpenAI-Compatible (Responses)',
    nameEn: 'Custom OpenAI-Compatible (Responses)',
    nameZh: '自定义 OpenAI 兼容（Responses）',
    baseUrl: '',
    apiKeyPlaceholder: 'API Key',
    apiKeyPlaceholderEn: 'API Key',
    apiKeyPlaceholderZh: 'API Key',
    requiresBaseUrl: true,
    authMode: 'api-key',
    supportsStructuredOutputs: true,
    apiShape: 'responses'
  },
  'anthropic-compatible': {
    id: 'anthropic-compatible',
    name: 'Custom Anthropic-Compatible',
    nameEn: 'Custom Anthropic-Compatible',
    nameZh: '自定义 Anthropic 兼容',
    baseUrl: '',
    apiKeyPlaceholder: 'API Key',
    apiKeyPlaceholderEn: 'API Key',
    apiKeyPlaceholderZh: 'API Key',
    requiresBaseUrl: true,
    authMode: 'api-key'
  }
};
