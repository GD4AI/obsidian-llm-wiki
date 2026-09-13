export const EN_TEXTS = {
    // Plugin Info
    pluginTitle: 'Karpathy LLM Wiki Settings',
    pluginIntro: 'This plugin implements {{link}} concept for Obsidian. It reads your notes, uses AI to extract entities and concepts, and builds a structured, interlinked Wiki in your vault.',
    karpathyLinkText: "Andrej Karpathy's LLM Wiki",

    // Features Section
    featuresTitle: 'How It Works',
    workflow1Title: '1. Ingest',
    workflow1Desc: 'Select a note — AI extracts entities, concepts, and relationships into Wiki pages.',
    workflow2Title: '2. Query',
    workflow2Desc: 'Chat with your Wiki — answers are grounded in your ingested knowledge.',
    workflow3Title: '3. Maintain',
    workflow3Desc: 'Auto-generated index, cross-links, and lint checks keep the Wiki healthy.',

    // Language Switcher
    languageTitle: 'Interface Language',
    languageDesc: 'Select your preferred language for settings panel. Restart plugin to apply language changes to command palette.',
    languageEn: 'English',
    languageZh: '中文',
    languageZhHant: '繁體中文',
    languageJa: '日本語',
    languageKo: '한국어',
    languageDe: 'Deutsch',
    languageFr: 'Français',
    languageEs: 'Español',
    languagePt: 'Português',
    languageIt: 'Italiano',
    languageRu: 'Русский',

    // Status
    statusTitle: 'LLM Client Status',
    llmWikiStatusSection: 'LLM-Wiki Status',
    statusInitialized: 'Initialized',
    statusNotInitialized: 'Not initialized',
    statusReady: 'LLM Ready',
    statusNotReady: 'LLM not configured — complete setup and pass connection test',
    currentProvider: 'Current Provider',

    // Provider Configuration
    providerSection: 'LLM Configuration',
    providerName: 'LLM Provider',
    providerDesc: 'Select predefined provider or custom OpenAI-compatible service. For Coding Plan or similar bundles, choose Custom OpenAI/Anthropic and enter the provider\'s Base URL and API Key manually',

    // API Key
    apiKeyName: 'API Key',
    apiKeyDesc: 'API key. Stored in your OS credential manager — not in data.json.',
    apiKeyPlaceholder: 'Enter API Key',
    // v1.25.4 #339: SecretStorage migration repair + failure Notice
    apiKeyMigrateToSecretStorageButton: 'Migrate Secret Storage',
    apiKeyMigratedToSecretStorageSuccess: 'API key restored from SecretStorage to settings.',
    apiKeyMigrationFailedNotice: 'Failed to save API key to SecretStorage: {}',
    codexAuthName: 'ChatGPT Plan sign-in',
    codexAuthDesc: 'Experimental Codex OAuth access using your ChatGPT plan allowance. OpenAI Platform API billing remains separate.',
    codexAuthSignedOut: 'Not signed in',
    codexAuthSignedIn: 'Signed in',
    codexAuthBrowserButton: 'Sign in with browser',
    codexAuthDeviceButton: 'Use device code',
    codexAuthDeviceInstructions: 'Enter this code on the OpenAI page: {}',
    codexAuthCopyCode: 'Copy code',
    codexAuthSignOutButton: 'Sign out',
    codexAuthBusy: 'Waiting for OpenAI authorization...',
    codexAuthFailed: 'ChatGPT authorization failed: {}',
    codexAuthQuota: 'ChatGPT Codex allowance reached. Wait for the displayed reset period and try again.',
    codexAuthExperimental: 'Experimental: availability follows OpenAI Codex authentication and model policies.',
    codexModelsRefreshName: 'Account models',
    codexModelsRefreshDesc: 'Synchronize picker-visible models from your signed-in OpenAI Codex account.',
    codexModelsRefreshButton: 'Refresh account models',
    codexModelsRefreshing: 'Refreshing...',
    codexModelsRefreshSuccess: 'Synchronized {} account models.',
    codexModelsRefreshFailed: 'Could not refresh account models; using the available fallback list. {}',

    // Base URL
    baseUrlName: 'API Base URL',
    baseUrlDescCustom: 'Required: Custom OpenAI-compatible endpoint',
    baseUrlDescOverride: 'Optional: Override preset Base URL',

    // Ollama Hint
    ollamaHint: 'Ollama runs locally, no API Key required',
    // LM Studio Hint
    lmstudioHint: 'LM Studio runs locally, API Key is optional',

    // LLM execution cap
    maxTokensPerCallName: 'Max output tokens per call',
    maxTokensPerCallDesc: 'Cap how many tokens the model is allowed to generate in a single response. Lower this if you run a local model with a small context window and see errors. Leave at the default (0 = no cap) for cloud models.',

    // Issue #111: slug casing
    slugCaseName: 'File Name Casing',
    slugCaseDesc: 'Controls whether generated wiki filenames are lowercased. "Preserve" is recommended for languages where lowercase changes meaning (e.g. German nouns).',
    slugCaseLower: 'Lowercase (default)',
    slugCasePreserve: 'Preserve case',
    // Minimum alias length (Advanced settings, next to slug case).
    minAliasLengthName: 'Minimum alias length',
    minAliasLengthDesc: 'Aliases shorter than this (after trimming) are not written to wiki pages. Default 2 keeps two-letter abbreviations (ML, AI, UI) usable; raise to 3 if your vault collects two-letter aliases that differ only in case (Cr/CR). Range 2–6.',
    minAliasLengthClamped: 'Value outside range (2–6), set to {}',

    // Model Selection
    modelSection: 'Model Selection',
    fetchModelsName: 'Fetch Available Models',
    fetchModelsDesc: 'Get latest model list from Provider API',
    fetchModelsButton: 'Fetch Models',
    fetchingModels: 'Fetching...',
    fetchSuccess: 'Success! {} models available',
    fetchFailed: 'Failed or empty list, please input model name manually',
    fetchNotSupported: 'Provider doesn\'t support model list query',
    fetchErrorAuth: 'Authentication failed (HTTP 401/403). Verify your API Key, or enter a Model ID below and click Test Connection to validate.',
    fetchErrorEndpoint: 'Endpoint not found (HTTP 404). Verify the BaseURL, or enter a Model ID and click Test Connection to validate.',
    fetchErrorServer: 'Provider server error (HTTP 5xx). Try again later, or enter a Model ID and click Test Connection to validate.',
    fetchErrorEmpty: 'Provider has no model list endpoint. Enter a Model ID below and click Test Connection to validate.',
    fetchErrorNetwork: 'Network request failed. Check your internet connection, BaseURL, proxy settings, or API Key. You can also enter a Model ID below and click Test Connection to validate.',

    selectModelName: 'Select Model',
    selectModelDesc: 'Choose from {} available models',
    customInputOption: 'Custom input...',
    customInputHint: 'To use other models, select "Custom input..."',

    modelName: 'Model Name',
    modelDescCustom: 'Using custom model (click above button to re-fetch list)',
    modelDescFetchFailed: 'Model list fetch failed. Verify your API Key and Endpoint URL, or enter a Model ID below and click Test Connection to validate.',
    modelInputPlaceholder: 'Enter Model ID, then Test Connection',

    switchToDropdown: 'Switch to Dropdown Selection',
    useDropdownButton: 'Use Dropdown',

    // v1.24.0 #208: per-task model picker
    modelTaskModeName: 'Model Scope',
    modelTaskModeDesc: 'Choose whether all tasks use the same model, or use separate models per task (ingest / lint / query). Hidden per-task values are preserved when you switch back to unified.',
    modelTaskModeUnified: 'Use unified model (default)',
    modelTaskModePerTask: 'Use different models per task',
    perTaskIngestModelName: 'Ingest Model',
    perTaskIngestModelDesc: 'Used for ingesting notes, conversations, schema maintenance, and Welcome note generation.',
    perTaskLintModelName: 'Lint Model',
    perTaskLintModelDesc: 'Used for lint analysis, duplicate detection, fix-* runs, and link orphan correction.',
    perTaskQueryModelName: 'Query Model',
    perTaskQueryModelDesc: 'Used for Query Wiki chat and save-to-wiki evaluation.',

    // Test & Save
    testConnectionName: 'Test Connection',
    testConnectionDesc: 'Validate configuration can successfully call LLM API',
    testButton: 'Test Connection',
    testing: 'Testing...',

    saveSettingsName: 'Save Settings',
    saveSettingsDesc: 'Save current configuration',
    saveButton: 'Save Settings',
    savedNotice: 'Settings saved!',

    // v1.24.0 (Bug C 3.4 / plan C): gradual migration Notice — shown on
    // startup or after a mid-session wikiFolder change when chat history
    // contains links from a previous wiki folder.
    queryHistoryMigrationNotice: 'Query Wiki history contains links from a previous wiki folder. New queries now use the latest folder automatically. To refresh all stored messages, open the Query Wiki panel and click the Clear history button there.',

    wikiIngestedMarkerFailed: 'Wiki-ingested marker could not be written for \'{filename}\'. The ingest succeeded, but re-running it later will not be skipped — use force re-ingest or add the marker manually.',
    wikiIngestedMarkerRepaired: '[LLM Wiki] Startup repair: re-stamped the wiki-ingested marker on {count} ingested note(s).',
    // v1.24.0 Issue #251: Custom Query Instructions collapsible panel
    customInstructionsTitle: 'Custom Query Instructions',
    customInstructionsDesc: 'Persistent instructions appended to every Query Wiki system prompt. Only affects Query Wiki chat; ingest, lint, and page generation are unaffected.',
    customInstructionsPlaceholder: 'e.g. Treat this as research: search broadly, cite sources, separate facts from interpretation...',
    customInstructionsApply: 'Apply',
    customInstructionsClear: 'Clear',
    customInstructionsCharCount: '{current}/{max} chars',
    instructionsApplied: 'Custom query instructions saved.',
    instructionsCleared: 'Custom query instructions cleared.',

    // Test Connection
    testConnectionSuccessful: 'Connection successful',
    testConnectionFailed: 'Connection failed',
    testConnectionProvider: 'Provider: ',
    codexAuthRequired: 'Sign in to ChatGPT Plan before testing the connection.',
    bedrockSsoRequired: 'Run AWS SSO sign-in (Settings → Bedrock) before testing the connection.',
    bedrockIamRequired: 'Enter your IAM access keys (Settings → Bedrock) before testing the connection.',
    bedrockAuthMethodName: 'Authentication',
    bedrockAuthMethodDesc: 'API key uses a Bedrock API key; AWS SSO signs requests with IAM Identity Center credentials; IAM keys use static access keys.',
    bedrockAuthOptionApiKey: 'API key',
    bedrockAuthOptionSso: 'AWS SSO',
    bedrockAuthOptionIam: 'IAM keys',
    bedrockSsoStartUrlName: 'SSO start URL',
    bedrockSsoStartUrlDesc: 'Your organization portal URL, e.g. https://d-xxxxxxxxx.awsapps.com/start',
    bedrockSsoAccountIdName: 'AWS account ID',
    bedrockSsoAccountIdDesc: '12-digit account whose role will be assumed, e.g. 123456789012',
    bedrockSsoRoleNameName: 'Role name',
    bedrockSsoRoleNameDesc: 'IAM role to assume for Bedrock access, e.g. PowerUserAccess',
    bedrockSsoLoginButton: 'Sign in with AWS SSO',
    bedrockSsoSignOutButton: 'Sign out of AWS SSO',
    bedrockSsoStatusSignedIn: 'Signed in · expires {}',
    bedrockSsoStatusSignedOut: 'Not signed in',
    bedrockSsoBusy: 'Sign-in in progress…',
    bedrockSsoUserCodeInstructions: 'AWS SSO code: {}. Open the link and approve access.',
    bedrockSsoCopyCode: 'Copy code',
    bedrockSsoFailed: 'AWS SSO sign-in failed: {}',
    bedrockSsoDetectedPrefill: 'Detected account/role: {}',
    bedrockIamKeyName: 'Access key ID',
    bedrockIamKeyDesc: 'IAM access key identifier, e.g. AKIA… or ASIA…',
    bedrockIamSecretName: 'Secret access key',
    bedrockIamSecretDesc: "Stored only in this device's secret storage — never in data.json",
    bedrockIamSessionTokenName: 'Session token (optional)',
    bedrockIamSessionTokenDesc: 'Required only for temporary credentials (STS)',
    bedrockIamClearButton: 'Clear saved IAM keys',
    bedrockIamSaveFailed: 'Failed to save IAM keys: {}',
    errorUnknown: 'Unknown error',

    // Issue #137: LLM fallback notices (shown when thinking-dialect
    // fallback or param-stripping happens during a request).
    fallbackThinkingDialect: 'Thinking control: switched to "{dialect}" dialect (this provider uses a different thinking-control format). Output is unchanged.',
    fallbackThinkingNone: 'Thinking control fully disabled for this provider. Reasoning content may still appear; if so, try a different model.',
    fallbackParamStripped: 'Parameter "{field}" not supported by this provider. Stripped from the request; behavior may differ from configuration.',

    // Wiki Init Status
    wikiInitStatusReady: 'Wiki initialized',
    wikiInitStatusNotReady: 'Wiki not initialized — will auto-create on first ingestion',

    // Wiki Folder
    wikiSection: 'Wiki Configuration',
    wikiFolderName: 'Wiki Folder',
    // v1.24.0: added the "restart Obsidian" hint because the wikiFolder
    // affects engine caches and Query Wiki panels that aren't fully
    // re-bound on settings change.
    wikiFolderDesc: 'Location for generated Wiki pages. Restart Obsidian after changing — engine caches and open Query Wiki panels need to rebind.',
    wikiFolderPlaceholder: 'wiki',

    // Errors
    errorNoApiKey: 'Please configure API Key first',
    errorNoModel: 'Please select a model first — click Fetch Models, or enter a Model ID manually',
    llmNotReady: 'LLM is not configured. Please go to Settings → Karpathy LLM Wiki to configure your provider, fetch available models, and pass the connection test.',
    errorFetchFailed: 'Failed: {}',

    // Query Settings
    querySectionTitle: 'Wiki Query Configuration',
    // v1.24.0: renamed from "Max Conversation History" to clarify the
    // semantics — this is a memory-window cap, not a hard storage limit
    // (history is itself a rolling buffer). 1 = each turn independent
    // (no cross-turn memory). Settings UI is a dropdown of presets, so
    // no "presets: 1/10/30/50/100/500" list is needed in the description.
    // v1.24.0: maxConversationHistoryHint was a dead i18n key (never
    // referenced from UI code); the recommendation text now lives inline
    // in the desc.
    maxConversationHistoryName: 'Conversation Memory Rounds',
    maxConversationHistoryDesc: 'How many past conversation rounds the LLM sees as memory. 1 = each turn independent (no cross-turn memory); higher values let the model remember earlier turns in the session. Recommended: 1 for one-shot Q&A, 10–50 for ongoing research.',
    numberRangeValidation: 'Please enter a number between 1-50',
    numberRangeClamped: 'Value exceeds range (1-500), automatically set to {}',

    // Query Modal UI
    queryModalTitle: 'Query Wiki - Conversational Query',
    queryModalPlaceholder: 'Enter question...',
    queryModalSendButton: 'Send',
    queryModalStopButton: 'Stop',
    queryModalSaveButton: 'Save to Wiki',
    queryModalClearButton: 'Clear History',
    queryModalHistoryCount: 'Conversation history: {}/{} rounds',
    queryModalStreaming: 'Streaming...',
    queryModalFallbackStreaming: 'Streaming not supported, switched to non-streaming. Please wait...',
    queryPhaseSearching: 'Analyzing Wiki index, selecting relevant pages...',
    queryPhaseFoundPages: 'Found {count} page(s): {pages}',
    queryPhaseLoadingPages: 'Loading page content...',
    queryPhaseContextReady: 'Context ready. Generating answer...',
    queryPhaseGenerating: 'Generating... (elapsed {time}s)',
    queryPhaseNonStreaming: 'Non-streaming mode, generating response... (elapsed {time}s)',
    queryModalErrorPrefix: 'Error: ',
    queryModalHint: 'Queries based on Wiki content. Click "Save to Wiki" to extract valuable conversations as Wiki pages.',

    // v1.20.0: Query Wiki thinking-block collapsible summary
    queryThinkingSummary: 'Thinking process',
    queryThinkingSteps: 'steps',

    // Error Messages
    errorLLMClientNotInit: 'LLM Client not initialized. Please save settings.',
    errorIngestFailed: 'Ingest failed: ',
    errorQueryFailed: 'Query failed: ',
    fileWriteFailed: 'Could not create or update file: {path}',

    // Success Messages
    ingestSuccess: 'Ingest successful: {} pages created, {} pages updated',
    querySuccess: 'Query completed',
    lintSuccess: 'Wiki lint completed',
    lintReadingPages: 'Reading {count} Wiki pages...',
    lintReadingPagesProgress: 'Reading Wiki pages: {current}/{total}...',
    lintScanningLinks: 'Scanning dead links...',
    lintScanningLinksProgress: 'Scanning dead links: {current}/{total}...',
    lintCheckingDuplicates: 'Checking for duplicate pages...',
    lintCheckingDuplicatesProgress: 'Verifying duplicates: batch {current} ...',
    lintFixingPolluted: 'Fixing polluted page {current}/{total}: {title} → {newTitle}',
    lintModalFixPolluted: '🧹 Fix polluted pages ({count})',
    lintDuplicateCheckFailed: 'Duplicate detection failed — see console for details',
    lintDuplicateCheckFailedDetail: 'Duplicate check failed at {step}: {error}',
    lintMergeItemFailed: 'Merge failed: {source} → {target} — {error}',
    lintAliasesMissing: 'Aliases missing: {count} page(s) without aliases',
    lintAliasesSection: 'Pages missing aliases [{count}]',
    lintAliasesItem: '- [[{page}]]',
    lintAliasesCompleteBtn: 'Complete aliases ({count})',
    lintAliasesFilling: 'Generating aliases {current}/{total}: {page}',
    lintAliasesFilled: 'Alias completion complete. Filled {filled}/{total} pages.',
    lintAliasesFillFailed: 'Alias generation failed: {page} — {error}',
    // Issue #85 v7: tag-violation retag notifications
    lintTagViolationFiring: 'Retagging {current}/{total}: {path}',
    lintTagViolationFailed: 'Retag failed for {path}: {error}',
    lintTagViolationFixed: 'Retag complete. Fixed {fixed}/{total} page(s).',
    lintTagViolationFixedNone: 'Retag complete. No pages needed fixing (LLM kept current tags).',
    lintTagViolationSection: 'Pages with out-of-vocabulary tags [{count}]',
    lintTagViolationItem: '- [[{path}]] — invalid: {tags}',
    lintTagViolationRetagBtn: '🏷️ Retag {count} page(s) with LLM',
    lintFixItemFailed: 'Fix failed: [[{target}]] — {error}',
    lintLinkItemFailed: 'Link failed: {page} — {error}',
    lintRetrying: 'Retrying ({attempt}/{max}) after error...',
    lintAnalyzingLLM: 'LLM analyzing Wiki health...',
    saveToWikiSuccess: 'Conversation saved to Wiki!',
    querySaveAlreadyExists: 'Notice: nothing was written (knowledge already exists in Wiki):',
    saveSummary: '{entities} entities, {concepts} concepts, {pages} pages',
    aliasAdded: 'Added alias \'{alias}\' to page \'{page}\'',

    // Status Messages
    ingestingSources: 'Ingesting sources...',
    queryingWiki: 'Querying Wiki...',
    lintingWiki: 'Linting Wiki...',
    savingToWiki: 'Saving conversation to Wiki...',
    clearingHistory: 'Clearing conversation history...',

    // Buttons
    ingestButton: 'Ingest',
    queryButton: 'Query',
    lintButton: 'Lint',
    cancelButton: 'Cancel',

    // Links
    karpathyGistLink: 'Karpathy\'s LLM Wiki Gist',
    obsidianPluginAPI: 'Obsidian Plugin API',
    anthropicSDK: 'Anthropic SDK',
    openaiSDK: 'OpenAI SDK',

    // v1.24.1 PATCH Bedrock Stage 1
    bedrockRegionName: 'AWS Region',
    bedrockRegionDesc: 'Amazon Bedrock region for this account. Drives the bedrock-mantle endpoint URL; cannot be overridden via baseURL.',
    bedrockRegionHint: 'bedrock-mantle is available in 18 regions; model coverage varies by region.',

    // Other
    availableModelsLoading: 'Loading available models...',
    noModelsAvailable: 'No models available',

    // LLM Language Hint
    llmLanguageHint: 'Please answer in English.',

    // Schema Configuration
    schemaSection: 'Schema Configuration',
    enableSchemaName: 'Enable Schema',
    enableSchemaDesc: 'Generate and inject schema/config.md into all LLM prompts for structured Wiki output',
    viewSchemaButton: 'View / Edit Schema',
    regenerateSchemaButton: 'Regenerate Default Schema',
    schemaRegeneratedNotice: 'Default schema regenerated.',
    schemaRegenerateFailed: 'Schema generation failed',

    // Wiki Output Language
    wikiLanguageName: 'Wiki Output Language',
    wikiLanguageDesc: 'All generated wiki pages, index, log, and query responses use this language',
    customWikiLanguageOption: 'Custom...',
    customWikiLanguageHint: 'Enter a language name (e.g. Italian, Arabic). It will be passed to the LLM as the output language directive.',
    customWikiLanguagePlaceholder: 'e.g. Italian',

    // Index & Log Labels (per language)
    indexLabels: {
      en: { subtitle: 'Auto-generated knowledge base directory', entities: 'Entities', concepts: 'Concepts', sources: 'Sources' },
      zh: { subtitle: '自动生成的知识库目录', entities: '实体', concepts: '概念', sources: '来源' },
      ja: { subtitle: '自動生成ナレッジベースディレクトリ', entities: 'エンティティ', concepts: '概念', sources: 'ソース' },
      ko: { subtitle: '자동 생성 지식 베이스 디렉토리', entities: '엔티티', concepts: '컨셉', sources: '소스' },
      de: { subtitle: 'Automatisch generiertes Wissensdatenbank-Verzeichnis', entities: 'Entitäten', concepts: 'Konzepte', sources: 'Quellen' },
      fr: { subtitle: 'Répertoire de base de connaissances généré automatiquement', entities: 'Entités', concepts: 'Concepts', sources: 'Sources' },
      es: { subtitle: 'Directorio de base de conocimiento generado automáticamente', entities: 'Entidades', concepts: 'Conceptos', sources: 'Fuentes' },
      pt: { subtitle: 'Diretório de base de conhecimento gerado automaticamente', entities: 'Entidades', concepts: 'Conceitos', sources: 'Fontes' },
    },

    // Extraction Settings
    extractionSectionTitle: 'Extraction',
    extractionGranularityName: 'Extraction Granularity',
    extractionGranularityDesc: 'Controls entities/concepts extracted per source file. Higher = more pages, more API tokens.\nFine: deep analysis. Standard: daily notes. Coarse: quick overview. Minimal: batch 100+ files (caps items per source, ~5 — not detail per item). Custom: set your own (up to 500).\nTip: Use Minimal/Coarse for folders with many files to save time and cost.',
    extractionGranularityFine: 'Fine — deep analysis (≤100 items)',
    extractionGranularityStandard: 'Standard — daily notes (≤50 items)',
    extractionGranularityCoarse: 'Coarse — quick overview (≤10 items)',
    extractionGranularityMinimal: 'Minimal — batch 100+ files (≤5 items)',
    extractionGranularityCustom: 'Custom — set your own limits (1~500)',
    customEntityLimitName: 'Custom Entity Limit',
    customEntityLimitDesc: 'Maximum number of entities to extract per source file (1-500)',
    customConceptLimitName: 'Custom Concept Limit',
    customConceptLimitDesc: 'Maximum number of concepts to extract per source file (1-500)',

    // Issue #85 v2: Tag Vocabulary (chip input UX, embedded in Wiki Configuration)
    tagVocabularyInlineDesc: 'Controlled vocabulary for entity and concept frontmatter tags. Obsidian nested tags with "/" are preserved.',
    tagVocabularyModeName: 'Tag Vocabulary Configuration',
    tagVocabularyModeDescDefault: 'Default uses built-in tags: {}. Switch to Custom to define your own.',
    tagVocabularyModeDescCustom: 'Custom: define your own entity and concept tags below. Use the chip input — Enter or comma to add, × to remove.',
    // v1.25.10 PATCH Issue #368 — clarification, not enforcement. The custom
    // vocabulary is a SCHEMA INJECTION HINT for the LLM, not a write-time
    // gate. Small/local models may still emit out-of-vocabulary types; the
    // lint "out-of-vocabulary type" diagnostic surfaces those pages for review.
    tagVocabularyNotEnforcedHint: 'Schema hint only — the LLM may still emit out-of-vocabulary types. Run Lint to find and fix those pages.',
    tagVocabularyModeDefault: 'Default (built-in subtype tags)',
    tagVocabularyModeCustom: 'Custom (user-defined)',
    customEntityTagsName: 'Custom Entity Tags',
    customEntityTagsDesc: 'Press Enter or comma to add a chip. Click × to remove. Nested tags with "/" are preserved.',
    customEntityTagsPlaceholder: 'person, organization, project, place',
    customConceptTagsName: 'Custom Concept Tags',
    customConceptTagsDesc: 'Press Enter or comma to add a chip. Click × to remove. Nested tags with "/" are preserved.',
    customConceptTagsPlaceholder: 'theory, method, field, phenomenon, term',
    chipDuplicateHint: 'Duplicate tag skipped',

    // Ingestion Acceleration
    accelerationSectionTitle: 'Ingestion Acceleration',
    pageGenerationConcurrencyName: 'LLM Concurrency',
    pageGenerationConcurrencyDesc: 'Number of LLM calls in parallel during ingestion and lint operations. Higher values speed up processing but increase API costs and may trigger rate limits.',
    concurrencyValueSingular: 'Current concurrency: {} (serial — safest)',
    concurrencyValuePlural: 'Current concurrency: {} (parallel)',
    batchDelayName: 'Batch Delay (ms)',
    batchDelayDesc: 'Delay between parallel batches to prevent API rate limiting (100-10000ms). Current: {}ms. Increase if you see 429 errors.',

    // Auto Maintenance
    autoMaintainSection: 'Auto Maintenance',
    autoMaintainBetaBadge: 'BETA — Experimental feature. May have issues. Recommended for advanced users only.',
    autoWatchName: 'Watch Folders',
    autoWatchDesc: 'Automatically detect new or changed .md files in the watched folders and notify or auto-ingest',
    watchedFoldersName: 'Watched Folders',
    watchedFoldersDesc: 'Your declared source folders. Their tags form the domain-tag vocabulary offered at ingestion, and — with auto-watch on — they are watched for new content. Click "Add Folder" to select from your vault.',
    addWatchedFolderButton: 'Add Folder',
    removeWatchedFolderButton: 'Remove',
    webClipperPresetName: 'Watch Clippings (Web Clipper)',
    webClipperPresetDesc: 'Add the Clippings/ folder used by Obsidian Web Clipper to the watch list. Your web clips will be auto-ingested into the Wiki.',
    noWatchedFoldersHint: 'No folders configured. Add a folder or enable the Clippings preset.',
    autoWatchModeName: 'Watch Mode',
    autoWatchModeDesc: '"Notify Only" shows a prompt. "Auto Ingest" processes silently.',
    watchModeNotify: 'Notify Only',
    watchModeAuto: 'Auto Ingest',
    autoWatchDebounceName: 'Debounce Delay (seconds)',
    autoWatchDebounceDesc: 'Wait time before triggering ingest after a file change (1-60 seconds)',
    periodicLintName: 'Periodic Lint',
    periodicLintDesc: 'Run LLM lint on schedule, only when source files have changed since last check',
    periodicLintOff: 'Off',
    periodicLintDaily: 'Daily',
    periodicLintWeekly: 'Weekly',
    periodicLintMonthly: 'Monthly',
    autoSmartFixName: 'Auto Smart Fix',
    autoSmartFixDesc: 'When lint runs, automatically apply all fixes (Smart Fix All) without showing the report modal. The fix summary is still shown on completion.',
    autoSmartFixNotice: 'Auto Smart Fix: applying all fixes...',

    autoIngestLevelName: 'Auto Ingest Notification',
    autoIngestLevelDesc: 'How to notify when auto-ingest completes. "Notice" (transient) is non-blocking. "Modal" opens the full report. Disabled when Watch Mode is "Notify Only".',
    autoIngestLevelNotice: 'Notice (non-blocking)',
    autoIngestLevelModal: 'Modal (full report)',
    startupCheckName: 'Run quick fixes on startup',
    startupCheckDesc: 'Auto-fix low-level format issues (sources, double-nested links) on plugin load. Verifies Wiki folder structure. Default ON.',
    startupCheckNoticeLevelName: 'Show quick fixes result',
    startupCheckNoticeLevelDesc: 'QuickFixes always run on plugin start (Welcome note, folder structure, sources normalize, incomplete pages, log header). Choose whether to display the summary Notice after start. Silent mode logs to the developer console and the Operation History Panel only.',
    startupCheckNoticeVisible: 'Visible (show Notice)',
    startupCheckNoticeSilent: 'Silent (no Notice)',
    suggestSchemaCommand: 'Suggest Schema Updates',
    autoMaintainCostWarning: '⚠️ Cost Notice: Auto-maintenance features consume API tokens. "Auto Ingest" triggers LLM calls on every source file change. "Periodic Lint" runs LLM health checks on schedule (only when source changes are detected). Configure carefully to avoid unexpected charges.',

    // Notices
    startupCheckSummary: 'Wiki has {pages} pages ({entities} entities, {concepts} concepts, {sources} sources)',
    watcherActiveNotice: 'Wiki: file watcher active — monitoring watched folders',
    watchIngestNotice: 'Wiki: {count} file(s) changed in sources/. Run "Ingest Sources" to process.',

    // Startup quick fixes detail (Issue #81)
    startupCheckTitle: 'Wiki quick fixes complete',
    startupCheckStructureLabel: 'Wiki structure',
    startupCheckStructureOk: 'complete',
    startupCheckStructureMissing: 'incomplete — will auto-create on first ingestion',
    startupCheckSourcesLabel: 'Sources normalized',
    startupCheckSourcesClean: 'already clean',
    startupCheckSourcesCleaned: 'cleaned {files} file(s), {entries} entry(ies)',
    startupCheckIncompleteClean: 'incomplete pages: none',
    startupCheckIncompleteArchived: 'incomplete pages: archived {count} (recoverable from .trash)',
    startupCheckDisableHint: 'To disable, go to Settings → Auto Maintenance → Run quick fixes on startup',
    autoIngestRunning: 'Auto-ingesting {count} changed file(s)...',
    autoIngestComplete: 'Auto-ingest complete: {success} succeeded, {fail} failed',
    scheduledLintRunning: 'Running scheduled wiki lint...',
    wikiLintStats: 'Wiki lint: {pages} pages ({entities} entities, {concepts} concepts, {sources} sources)',
    wikiHealthStats: 'Wiki health: {pages} pages ({entities} entities, {concepts} concepts, {sources} sources){indexStatus}',
    lintWikiStart: 'Starting wiki lint...',
    lintWikiComplete: 'Wiki lint complete',
    lintWikiFailed: 'Wiki lint failed',
    analyzingSchema: 'Analyzing Wiki and generating schema suggestions...',
    schemaSuggestionGenerated: 'Schema suggestions generated, see wiki/schema/suggestions.md',
    noSchemaUpdateNeeded: 'No schema updates needed.',
    schemaSuggestionFailed: 'Schema suggestion failed',
    // v1.22.0 #97: Schema diff Modal — IDE-style preview + Apply/Regenerate
    schemaDiffTitle: 'Schema update preview',
    schemaDiffSummary: '+{add} / -{del} lines',
    schemaDiffRegenerateLabel: 'Refine the suggestion (optional):',
    schemaDiffRegenerateBtn: 'Regenerate',
    schemaDiffOpenFileBtn: 'Open file',
    schemaDiffApplyBtn: 'Apply',
    schemaDiffApplied: 'Schema updated. Backup: {path}',
    schemaDiffEmptyTitle: 'No changes recommended',
    schemaDiffFailed: 'Schema apply failed: {reason}',
    schemaDiffRestoreHint: 'Backup saved to {path}. To restore, rename that file back to "wiki/schema/config.md" in your file explorer. The most recent 3 backups are kept.',
    schemaRegenerateNoBody: 'Regeneration succeeded but the LLM did not return a new body.',
    schemaNotFoundNotice: 'Schema file not found. Enable schema to create it.',
    selectFolderNoMdFiles: 'No Markdown files in folder: {path}',
    batchIngestSkipNotice: 'Skipping {skipped}/{total} already-ingested files. Ingesting {new} new files...',
    batchIngestAllIngested: 'All {total} files in this folder have already been ingested.',
    batchIngestStarting: 'Ingesting {count} file(s) from "{folder}" — this may take several minutes. A report will appear when complete.',
    batchIngestComplete: 'Batch ingest complete: {success}/{total} succeeded, {fail} failed',
    batchIngestFailedFiles: 'Failed files:',
    historyTruncated: 'History truncated to last {max} rounds',
    historyCleared: 'History cleared',

    // User Feedback Loop
    reviewedPagePreserved: 'Preserving user-reviewed content for: {}',

    // Query-to-Wiki feedback
    querySuggestSaveTitle: 'Save to Wiki?',
    querySuggestSaveDesc: 'This conversation contains valuable knowledge. Save it to your Wiki?',
    querySuggestSaveYes: 'Save',
    querySuggestSaveNo: 'Dismiss',

    // Ingestion Report
    ingestReportElapsedTime: 'Elapsed time',
    ingestReportSkippedFiles: 'Skipped (already ingested)',
    ingestReportRejectedFiles: 'Skipped',
    rejectionReasonEmpty: 'empty',
    rejectionReasonType: 'unsupported type',
    rejectionReasonDuplicate: 'duplicate content',
    rejectionReasonPdfUnsupported: 'provider cannot read PDF',
    rejectionReasonMineruPageLimit: 'exceeds MinerU page limit',
    rejectionReasonMineruSizeLimit: 'exceeds MinerU size limit',
    ingestReportFailedGuidance: 'These items could not be automatically created. You can manually create the corresponding pages, or lower the extraction granularity and re-ingest the source file.',

    // Command Names (sentence case per Obsidian Bot rule 1)
    cmdIngestSource: 'Ingest single source',
    cmdIngestFolder: 'Ingest from folder',
    cmdIngestMultipleFiles: 'Ingest multiple files',
    cmdQueryWiki: 'Query wiki',
    cmdLintWiki: 'Lint wiki',
    cmdRegenerateIndex: 'Regenerate index',
    cmdSuggestSchema: 'Suggest schema updates',
    cmdCancelIngestion: 'Cancel current ingestion',
    cmdIngestActiveFile: 'Ingest current file',
    cmdViewHistory: 'View operation history',
    noActiveFile: 'No file is currently open',
    mdOnlyFile: 'Only Markdown files can be ingested',

    // v1.26.3 PATCH (B2.5 follow-up): single-file ingest + batch-check
    // Toasts. These feed showProgressFor → persistent Notice (Toast), which
    // is separate from the status-bar channel — they were hardcoded English
    // ('Ingesting: <file>', 'Checking for already-ingested files...'),
    // producing English Toasts on non-English vaults.
    ingestSingleFileStart: 'Ingesting: {filename}',
    ingestCheckingExisting: 'Checking for already-ingested files...',
    // Auto-lint completion Notice ("N findings" phrase — full phrase so
    // each locale can order/pluralize freely).
    lintFindingsSummary: '{total} findings',

    // Ingestion status bar
    ingestionStatusBar: 'Ingesting... click to cancel',
    lintStatusBar: 'Linting... click to cancel',
    ingestStatusAnalyzing: 'Ingesting… (click to cancel)',
    lintStatusAnalyzing: 'Linting… (click to cancel)',
    // v1.25.11 PATCH #169 — fine-grained stage hints for the status bar.
    // These labels are ADD-only emission sandwiched between the page name
    // and the always-visible base label (e.g. "My Note · Generating summary ·
    // Ingesting… (click to cancel)"). They never replace the base label, so
    // the cancel affordance is preserved through every long-running stage.
    ingestStageAnalyze: 'Analyzing source',
    ingestStageSummary: 'Generating summary',
    ingestStageEntity: 'Creating entity',
    ingestStageConcept: 'Creating concept',
    ingestStageRetry: 'Retrying failed page',
    ingestStageSave: 'Saving pages',
    ingestStageIndex: 'Generating index',
    pdfStageReading: 'Reading PDF',
    pdfStageConverting: 'Converting PDF',
    pdfStageSidecar: 'Writing sidecar',
    lintStagePrep: 'Reading pages',
    lintStageProgrammatic: 'Scanning links',
    lintStageAnalyzing: 'Running LLM analysis',
    lintStageDedup: 'Detecting duplicates',
    lintStageContradiction: 'Detecting contradictions',
    ingestionCancelling: 'Cancelling — will stop after current batch completes',
    ingestionCancelled: 'Ingestion cancelled',
    // v1.26.3 PATCH follow-up (B2.5): status-bar progress text i18n.
    // These were previously hardcoded English strings in wiki-engine.ts,
    // conversation-ingest.ts, and source-analyzer.ts, causing mixed-language
    // status bars on non-English vaults. Every status-bar text emitted via
    // onProgress (which routes through composeStatusBarUpdate → setText)
    // now flows through getText() so the user's selected language is honored
    // end-to-end. Placeholder contract:
    //   {filename}  — source file basename
    //   {total}     — total batch count
    //   {current}   — current batch index (1-based)
    //   {entities}  — accumulated entities count so far
    //   {concepts}  — accumulated concepts count so far
    //   {step} / {totalSteps} — page-generation step counter
    //   {type}      — 'Entity' or 'Concept' (resolved via ingestItemType*)
    //   {name}      — entity / concept / file name
    ingestBatchInitial: 'Analyzing batch 1/{total}...',
    ingestBatchProgress: 'Analyzing batch {current}/{total} ({entities} entities, {concepts} concepts so far)...',
    ingestBatchProcessed: 'Analyzed batch {current}, processing...',
    ingestAnalyzing: 'Analyzing: {filename}',
    ingestCreatingSummary: '[{step}/{totalSteps}] Creating summary...',
    ingestCreatingItem: '[{step}/{totalSteps}] {type}: {name}',
    ingestUpdating: '[{step}/{totalSteps}] Updating: {name}',
    ingestGeneratingIndex: '[{step}/{totalSteps}] Generating index...',
    ingestItemTypeEntity: 'Entity',
    ingestItemTypeConcept: 'Concept',
    convAnalyzing: 'Analyzing conversation...',
    convCheckingExisting: 'Checking for existing knowledge...',
    convAlreadyExists: 'This knowledge already exists in Wiki',
    convCreatingSummary: 'Creating summary page...',
    convGeneratingSummary: 'Generating summary page...',
    convSavingEntity: 'Saving entity: {name}',
    convSavingConcept: 'Saving concept: {name}',
    convGeneratingIndex: 'Generating index...',

    // Lint Report
    lintReportTitle: 'Wiki lint report',
    lintReportSummary: 'Wiki status overview: {total} pages total, {aliasesMissing} pages missing aliases, {duplicates} duplicate pages, {deadLinks} dead links ({deadLinkFromDup} involve duplicates), {orphans} orphan pages ({orphanFromDup} are duplicates), {emptyPages} empty pages, {ungroundedQuotes} ungrounded quotes, {tagViolations} out-of-vocabulary tags. Lint elapsed: {elapsedSeconds}s',

    // Advanced LLM Settings (v1.20.0: default = no provider-specific overrides).
    // v1.26.0 (#382 item 2): renamed advancedSettingsModeName →
    // advancedLlmModeName so the label scopes to LLM sampling params and is
    // not confused with the generic bottom "Advanced settings" panel.
    advancedLlmModeName: 'Advanced LLM parameters',
    advancedLlmModeDesc: 'Default mode follows whatever the model provider recommends. Switch to Custom only when you have a specific reason to override (for example: a particular model needs a fixed temperature, or you want to suppress the model\'s reasoning output).',
    advancedSettingsDefault: 'Default (follow provider)',
    advancedSettingsCustom: 'Custom (override provider)',
    // v1.26.0 (#382 item 2): bottom "Advanced settings" panel — generic
    // home for all advanced-user settings that are NOT LLM sampling params
    // (those live under advancedLlmModeName above). Off by default; the
    // toggle reveals lint thresholds, the Welcome note, and future knobs.
    advancedSettingsSection: 'Advanced settings',
    showAdvancedSettingsName: 'Show advanced settings',
    showAdvancedSettingsDesc: 'Turn on to reveal advanced settings below. Turning off hides them and resets them to defaults.',
    disableThinkingName: 'Disable thinking',
    disableThinkingDesc: 'Turn off the model\'s chain-of-thought / reasoning output in its response. Default off — the model decides whether to show reasoning, and that usually gives the best answer. Turn this on only if your provider dumps raw reasoning text into the response and you want a clean answer.',
    taskPoliciesPlaceholder: 'Example: extract=text:off',
    taskPoliciesName: 'Per-step output mode and thinking',
    taskPoliciesDesc: 'One entry per pipeline step, `step=mode:thinking`, comma-separated — e.g. `extract=text:off`. Modes: `-` (leave), `schema`, `json`, `text`; thinking: `-`, `off`, `on`, `low`, `medium`, `high`. Step names include extract, extract-retry, lemma-classify, merge-triage, source-stance, dedup, page-generate, related-page, lint-dedup — a misspelled name matches nothing. Leave blank for the built-in baseline (extraction in text mode). An entry that cannot be read is not saved.',
    // Issue #137: compatibility hints for advanced settings (kept short; no
    // provider list to avoid maintenance burden when providers change).
    extractionTemperatureName: 'Extraction temperature',
    extractionTemperatureDesc: 'Controls how creative vs faithful the model is when writing entity/concept pages. Lower numbers = more deterministic and factual; higher numbers = more varied. Most users leave this blank.',
    chatTemperatureName: 'Query temperature',
    chatTemperatureDesc: 'Same idea as Extraction temperature, but only affects how Query Wiki answers questions. Lower numbers = more literal answers; higher numbers = more conversational. Most users leave this blank.',
    repetitionPenaltyName: 'Repetition penalty',
    repetitionPenaltyDesc: 'Discourages the model from repeating the same words or phrases. Higher numbers mean less repetition. Only certain local-model providers (Ollama, LM Studio, llama.cpp) accept this; cloud providers will silently ignore it. Most users leave this blank. Values above 1.0 may cause LLM output errors during extraction on small local models — if a run fails, reduce or clear this value.',
    repetitionPenaltyErrorHint: 'Note: a custom Repetition penalty of {value} is set. Values above 1.0 can break grammar-constrained extraction on small local models — reduce or clear this setting and retry.',
    temperaturePlaceholder: 'leave blank = provider default',
    // v1.26.0 (#382 item 2): Lint dedup threshold overrides (bottom
    // "Advanced settings" panel, showAdvancedSettings toggle on). The
    // "leave blank" placeholder above is reused so the input row reads the
    // same as the temperature rows in the Advanced section.
    lintDedupJaccardLinkThresholdName: 'Duplicate link similarity',
    lintDedupJaccardLinkThresholdDesc: 'Range 0–1 (default 0.4). Two pages are flagged as duplicates when the wiki-links they both point to overlap by at least this fraction. Lower → catches more near-duplicates (including pages that just share common hubs); higher → only flags pages that point to nearly the same set of pages. Raise if you see false positives between pages that happen to link to the same hub. Leave blank for the default.',
    lintDedupJaccardBodyGateName: 'Minimum body similarity',
    lintDedupJaccardBodyGateDesc: 'Range 0–1 (default 0.2). Even if two pages share wiki-links, they\'re only flagged as duplicates when their body text is at least this similar (as a fraction). Lower → more candidates pass through to LLM verification; higher → only nearly-identical bodies get flagged. Raise if LLM is being asked about pages that obviously aren\'t duplicates. Leave blank for the default.',
    lintDedupBigramThresholdName: 'Title similarity',
    lintDedupBigramThresholdDesc: 'Range 0–1 (default 0.4). Two pages are flagged as duplicates when the characters in their titles (or aliases) overlap by at least this fraction. Lower → catches spelling variants, typos, and translations of the same concept; higher → only flags near-identical titles. Raise if LLM is reviewing pages with very different names that aren\'t actually duplicates. Leave blank for the default.',
    lintDeadLinkSection: 'Dead links (detected) [{count}]',
    lintEmptyPageSection: 'Empty pages (detected) [{count}]',
    lintOrphanSection: 'Orphan pages (detected) [{count}]',
    lintContradictionSection: 'Contradictions (detected)',
    lintDuplicateSection: 'Duplicate pages (detected)',
    lintPollutedSection: 'Polluted pages (detected) [{count}]',
    lintPollutedItem: '- [[{page}]] → should be "{clean}"',
    lintSourcesNormalizedSection: 'Sources normalized (auto-fixed) [{files} files / {entries} entries]',
    lintSourcesNormalizedItem: 'Cleaned {entries} polluted sources entries across {files} file(s) (external paths, .md extensions, alias pipes removed and deduplicated).',
    lintNoIssuesFound: 'No duplicates, dead links, empty pages, orphan pages, or ungrounded quotes detected.',
    lintSourceDriftSection: 'Source notes changed since ingest [{count}]',
    lintSourceDriftItem: '- [[{page}]] — origin note [[{note}]] was edited after ingest; the page may be stale',
    lintContradictionMarkerSection: 'Pages flagged with contradictions (merge triage) [{count}]',
    lintContradictionMarkerItem: '- [[{page}]] — conflicting source(s): {sources}; review and remove the contradictions: marker when settled',
    lintQuoteGroundingSection: 'Ungrounded quotes (detected) [{count}]',
    lintQuoteGroundingItem: '- [[{page}]]{sourceHint}: "{quote}"',
    lintDeadLinkItem: '- [[{source}]] → **{target}** (page does not exist){dupFlag}',
    lintDeadLinkMore: '- ... {count} more dead links',
    lintEmptyPageItem: '- [[{page}]] — less than 50 characters of substantive content',
    lintOrphanItem: '- [[{page}]] — no other Wiki pages link here{dupFlag}',
    lintDuplicateItem: '- [[{target}]] and [[{source}]] — {reason}',
    lintDeadLinkAffectedByDup: ' (⚠️ involves duplicate page)',
    lintOrphanIsDuplicate: ' (⚠️ duplicate page)',
    lintHubLinkDensitySection: 'Hub link density issues (Issue #157 / #175) [{count}]',
    lintHubLinkDensityItem: '- [[{page}]] — {inDegree} in-degree, {relatedCount} related links, distinctiveness {distinctiveness} → {recommendation}{lowTargets}',
    lintHubLinkDensityStrip: '⚠️ strip',
    lintHubLinkDensityReview: '🔍 review',
    lintHubLinkDensityKeep: '✅ keep',
    lintHubLinkDensitySummary: 'Summary: {strip} page(s) recommended for strip, {review} page(s) recommended for review.',
    lintHubLinkDensityNoRelated: ' (no ## Related section found)',
    lintContradictionOpen: 'Open contradictions: {count}',
    lintContradictionItem: '- [{status}] [[{page}]] — {claim}',
    lintContradictionStatusDetected: 'Detected',

    // Lint Analysis Prompt

    // Lint Fix Progress
    lintFixProgress: 'Fixing {current}/{total}: [[{target}]]',
    lintFixDeadComplete: 'Dead link fix complete. Fixed {fixed}/{total} items.',
    lintFillProgress: 'Expanding {current}/{total}: {page}',
    lintFillComplete: 'Page expansion complete. Filled {filled}/{total} pages.',
    lintDeleteCompleted: 'Deleted {count} empty stubs',
    lintDeleteFailed: 'Failed to delete {failed}/{total} empty stubs (see console for details)',
    lintFillFailed: 'Failed to expand: {page} — {error}',
    lintLinkProgress: 'Linking {current}/{total}: {page}',
    lintLinkComplete: 'Orphan linking complete. Linked {linked} pages.',
    lintFixNoAction: 'No action taken (no client)',
    lintFixIndexUpdated: 'Wiki index and log updated.',
    lintFixAllComplete: 'All fixes complete. See log for details.',
    lintFixAllNoChanges: 'No changes were made — all phases reported 0 fixes. Check wiki/log.md for details.',
    lintFixPhasesLabel: 'phases modified',
    lintPollutedFixed: 'Polluted pages fixed: {fixed}/{total}. Index regenerated.',
    regenerateIndexCompleted: 'Index regenerated',
    operationFailed: 'Failed: ',

    // Lint Report Modal
    lintModalActionsTitle: 'Fix suggestions (requires LLM tokens):',
    lintLogReference: 'Full report saved to log.md',
    lintModalFixDeadLinks: 'Fix dead links ({count})',
    lintModalExpandEmpty: 'Expand empty pages ({count})',
    lintModalDeleteEmpty: 'Delete empty stubs ({count})',
    lintModalLinkOrphans: 'Link orphan pages ({count})',
    lintModalAnalyzeSchema: 'Analyze schema',
    lintModalMergeDuplicates: 'Merge duplicates ({count})',
    lintModalFixAll: 'Smart fix all ({count} issues)',
    lintMergeProgress: 'Merging {current}/{total}: {source} → {target}',
    lintMergeComplete: 'Duplicate merge complete. Merged {merged}/{total} pairs.',

    // Ingest Report Modal
    ingestReportTitle: 'Ingest report',
    ingestReportSourceFile: 'Source file',
    ingestReportCreated: 'Created',
    ingestReportUpdated: 'Updated',
    ingestReportContradictions: 'Contradictions found',
    ingestReportFailedTitle: 'Failed to ingest',
    ingestReportErrorDetail: 'Error detail',
    ingestReportClose: 'Close',
    ingestReportCreatedPages: 'Created pages: {count}',
    ingestReportUpdatedPages: 'Updated pages: {count}',
    // v1.22.2: log.md header content (Operation History Panel hint)
    logHeaderTitle: 'Wiki Operation Log',
    logHeaderSubtitle: 'Every ingest, lint run, and maintenance operation is recorded here automatically. For a better experience, use the **Operation History** panel:',
    logHeaderShortcut: 'Cmd+P → "View operation history"',
    logHeaderSettingsShortcut: 'Or open from Settings → Auto Maintenance → Operation History',
    // v1.22.2: concise per-file ingest summary labels for Notice (no modal)
    ingestionCreatedPages: '{count} page(s) created',
    ingestionUpdatedPages: '{count} page(s) updated',
    ingestionNoticeHistoryHint: 'View Operations History for details.',
    ingestReportEntitiesCount: '{count} entities',
    ingestReportConceptsCount: '{count} concepts',
    ingestReportContradictionsFound: 'Contradictions found: {count}',
    ingestReportEntityType: 'Entity',
    ingestReportConceptType: 'Concept',
    timeMinutes: 'min',
    timeSeconds: 'sec',

    // Rate Limit Warnings
    rateLimitDetected: '⚠️ Rate limit detected: {count} page(s) failed with 429 errors. Try: (1) Lower concurrency to {suggestedConcurrency} or 1 (serial), (2) Increase batch delay to {suggestedDelay}ms, (3) Switch to a provider with higher rate limits.',
    rateLimitDetectedShort: '⚠️ Rate limit hit — consider lowering concurrency or increasing batch delay in Settings → Ingestion Acceleration.',

    // Long source warning
    sourceRejectedEmpty: '⏭️ "{filename}" has no content to ingest — skipped. Empty or frontmatter-only notes don\'t create wiki pages.',
    sourceRejectedType: '⏭️ "{filename}" is not a supported file type — skipped. Only text notes (e.g. .md, .txt) can be ingested.',
    sourceRejectedDuplicate: '⏭️ "{filename}" skipped — its content is already in the wiki.',
    // v1.25.0 PDF Level 1 (cache-only architecture)
    pdfReadingInProgress: 'Reading PDF: {filename}',
    sourceRejectedPdfUnsupported: '⏭️ "{filename}" skipped — your current provider or model doesn\'t accept PDF input. Switch provider, open Settings → LLM Configuration → Advanced and turn on "Force PDF support" to try anyway, or switch the Markdown conversion backend to MinerU (also handles images and Office documents).',
    clearPdfCacheCommand: 'Clear PDF conversion cache',
    pdfCacheCleared: 'PDF cache cleared ({count} entries removed).',
    // v1.25.0 PR3: Advanced PDF settings
    forcePdfSupportName: 'Force PDF support',
    forcePdfSupportDesc: 'Off by default. Turn this on if your provider isn\'t listed as native but can still handle PDF files. When on, the PDF will be sent to your current provider — if it gets rejected, you\'ll see a clear notice. Native PDF providers (Anthropic / OpenAI / Bedrock) don\'t need this.',
    writePdfMarkdownToVaultName: 'Write converted Markdown to Vault',
    writePdfMarkdownToVaultDesc: 'Off by default. When on, each PDF conversion result is written to a "<basename>.pdf.md" file next to the source PDF. When off (cache-only architecture), results live only in the plugin cache and leave no artifacts in your Vault.',
    markdownConversionBackendName: 'Markdown conversion backend',
    markdownConversionBackendDesc: 'Native uses your provider\'s built-in PDF support (limited scope, not every provider/model handles PDF, costs LLM tokens). MinerU is an online service — fast, free up to the daily quota, accepts PDF/images/Office — but requires an API token (set it in the field below).',
    markdownConversionBackendNative: 'Provider PDF/image support',
    markdownConversionBackendMineru: 'MinerU online API',
    mineruApiTokenName: 'MinerU API token',
    mineruApiTokenDesc: 'Get your token at https://mineru.net/apiManage/token. MinerU accepts files up to 200 MB and up to 200 pages.',
    mineruApiTokenPlaceholder: 'Paste MinerU API token',
    mineruUploadingInProgress: 'Uploading PDF to MinerU: {filename}',
    mineruWaitingInProgress: 'Waiting for MinerU conversion: {filename}',
    mineruDownloadingInProgress: 'Downloading MinerU result: {filename}',
    markdownConversionComplete: 'Conversion complete: {filename}',
    markdownConversionCompleteSaved: 'Conversion complete — written to {path}: {filename}',
    mineruPageLimitRejected: '{filename} exceeds MinerU\'s {limit}-page limit — split the file and retry',
    mineruSizeLimitRejected: '{filename} exceeds MinerU\'s {limit} MB size limit',
    ingestRejectedSummary: '{count} file(s) skipped (empty, duplicate, or unsupported type).',
    reingestConfirmTitle: 'Re-ingest this file?',
    reingestConfirmBody: 'The content of "{filename}" is already in the wiki. Re-ingest it anyway?',
    reingestConfirmYes: 'Re-ingest',
    reingestConfirmNo: 'Skip',
    // v1.26.0 (#382 item 1, Batch 2): sources participate in dedup by
    // default via the sourceFingerprint signal (body-hash equality). Off
    // here to exclude source pages from lint duplicate-detection.
    lintDedupIncludeSourcesName: 'Include sources in dedup',
    lintDedupIncludeSourcesDesc: 'On by default. When on, sources with identical bodies are flagged as duplicates during lint. Turn off if your source corpus generates false positives.',
    // Issue #514: opt-in candidate gate (bottom Advanced settings panel).
    skipMentionOnlyCandidatesName: 'Skip candidates the source only mentions',
    skipMentionOnlyCandidatesDesc: 'Off by default. When on, an extracted entity or concept whose name does not appear in the note’s running text — absent, or only inside parentheses, enumerations or short list items — gets no page and no further model call, and is removed from the other candidates’ related lists. Works for wiki languages with a word-boundary profile (German measured; English, French, Spanish, Portuguese, Dutch estimated); for other languages the ingest reports once that it cannot apply. Leave off for glossary-style vaults or bullet-point notes where every named term should become a page.',
    createStubsForUnresolvableLinksName: 'Create stub pages for unresolvable links',
    createStubsForUnresolvableLinksDesc: 'On by default. When Fix Dead Links cannot resolve a link to any existing page, it writes an empty placeholder page and repoints the link at it — never LLM-filled. Turn this off to leave such links untouched: they stay visible in every lint report until a real source defines them.',
    // v1.26.0 (#382 item 1, Batch 2): sub-heading for the dedup
    // sub-group at the bottom of the "Advanced settings" panel.
    lintDedupSectionHeading: 'Duplicate detection',
    // v1.26.0 (#382 item 1, Batch 2): Notice Toast fired when the
    // dedup-phase empty-response retry mechanism kicks in. Designed
    // for cross-LLM-phase reuse — fix-runners, analysis-phase, etc.
    // can use the same Toast key when they adopt the retry helper.
    // The {count} placeholder is the number of batches that recovered
    // via immediate + 2s-backoff retry.
    // v1.26.0 (#382 item 1, Batch 2 follow-up): the Toast text must be
    // reusable across ALL LLM business paths (dedup, analysis, fix-runners,
    // conversation-ingest, merge, headless CLI). Generic phrasing — no
    // reference to any specific phase. The {count} placeholder is the
    // number of batches that recovered via retry.
    //
    // NOTE: We deliberately do NOT claim "task completed" in the Toast —
    // the retry recovered this batch but other batches in the same
    // scan may still be running. The Toast is informational ("here's
    // what happened, look in the console for full detail"), not a
    // status claim. Operators reading the console see the truth.
    llmRetryRecoveredToast: 'LLM task: {count} batch(es) needed retry due to a transient provider response issue. See console for detail. If this recurs, consider lowering Page Generation Concurrency in Provider settings.',
    longSourceNotice: '📄 "{filename}" has {lines} lines ({size}). Long texts require iterative batch extraction — the LLM reads the full document in multiple passes. This may take several minutes. Please be patient.',
    longSourceNoticeShort: '📄 Large file detected ({lines} lines). Ingestion may take a while.',

    // Ingestion History Panel (#122) — UI keys
    historyButton: 'Operation History',
    historyButtonDesc: 'View recent ingestions, lint reports, and other changes your Wiki has undergone',
    historyButtonOpen: 'View History',
    historyModalTitle: 'Operation History',
    historyModalSubtitle: 'Recent operations from your LLM-Wiki',
    historyEmpty: 'No operations recorded yet. Ingest a note or run Lint to populate this list.',
    historyReadError: 'Could not read operation log: {error}',
    historyEntryKindIngest: 'Ingest',
    historyEntryKindMaintenance: 'Maintenance',
    historyEntryKindFix: 'Fix',
    historyEntryKindOther: 'Operation',
    historyEntryTime: '{date} · {time}',
    historyEntryTimeNoTime: '{date}',
    historyEntrySource: 'Source: {source}',
    historyEntrySourceUnknown: 'Untitled ingest',
    historyEntryCreatedLabel: 'Created',
    historyEntryUpdatedLabel: 'Updated',
    historyEntryCreatedCount: '{count} created',
    historyEntryUpdatedCount: '{count} updated',
    historyEntryNoChanges: 'No page changes',
    historyEntryContradictions: '⚠️ {count} contradiction(s)',
    historyEntrySectionCreated: 'Created pages',
    historyEntrySectionUpdated: 'Updated pages',
    historyEntrySectionContradictions: 'Contradictions',
    historyEntrySectionDetails: 'Details',
    historyEntrySectionReport: 'Report findings',
    historyEntryOpenPage: 'Open',
    historyEntryDetailsNoContradictions: 'No contradictions found',
    historySearchPlaceholder: '🔍 Search by source title or page path…',
    historyFilterAll: 'All',
    historyFilterIngest: 'Ingest only',
    historyFilterMaintenance: 'Maintenance only',
    historyFilterFix: 'Fix only',
    historyFilterContradictions: '⚠️ Has contradictions',
    historyRefreshButton: '⟳ Refresh',
    historyExpandDay: 'Click to expand',
    historyCollapseDay: 'Click to collapse',
    historyShowMore: 'Show {count} older entries',
    historyNoMatch: 'No operations match your search/filter.',
    historyCloseButton: 'Close',
    historyLimit: 50,
    historyBadgeIngestShort: '📥',
    historyBadgeMaintenanceShort: '🔍',
    historyBadgeFixShort: '🔧',
    historyBadgeOtherShort: '📌',
    // KPI labels (Operation History Panel v2)
    historyKpiPages: 'Pages',
    historyKpiDeadLinks: 'Dead links',
    historyKpiOrphans: 'Orphans',
    historyKpiEmpty: 'Empty',
    historyKpiDuplicates: 'Duplicates',
    historyKpiTagViolations: 'Tag issues',
    historyKpiUnsourced: 'Unsourced',
    historyKpiDuration: 'Lint time',
    historyKpiDurationSec: '{seconds}s',
    // Operation History v3 — rich section rendering
    historySectionDeadLinks: 'Dead links ({count})',
    historySectionTagViolations: 'Tag issues ({count})',
    historySectionOrphans: 'Orphan pages ({count})',
    historySectionEmptyPages: 'Empty pages ({count})',
    historySectionLlmAnalysis: 'LLM analysis ({count})',
    historyDeadLinkSource: 'Source',
    historyDeadLinkTarget: 'Missing',
    historyOpenInLog: 'Open in log.md',
    historyShowMoreItems: 'Show {count} more',
    historyTrendUp: '↗ {delta}',
    historyTrendDown: '↘ {delta}',
    historyTrendSame: '→ same',
    historyChipContradiction: 'Contradiction',
    historyChipOutdated: 'Outdated',
    historyChipMissing: 'Missing',
    historyChipStructure: 'Structure',
    historySeverityHigh: 'High',
    historySeverityMedium: 'Medium',
    historySeverityLow: 'Low',
    historyPageTypeEntity: '📦 entity',
    historyPageTypeConcept: '💡 concept',
    historyPageTypeSource: '📄 source',
    historyGlobalInsight: 'Your Wiki has {dead} dead link(s), {orphans} orphan(s), and {tags} tag issue(s). Last Lint took {duration}.',
    historyGlobalInsightClean: 'Your Wiki is clean — no dead links, orphans, or tag issues detected.',
    historyGlobalInsightNoData: 'No maintenance reports yet — run a Lint to populate.',
    // v3.1 — modal title, subtitle w/ count, time-range filter
    historyModalHeaderTitle: 'Operation History',
    historyModalSubtitleWithCount: 'Recent operations from your LLM-Wiki · {count} entries',
    historyTimeRangeAll: 'All time',
    historyTimeRange1d: 'Past day',
    historyTimeRange3d: 'Past 3 days',
    historyTimeRange1w: 'Past week',
    historyTimeRange1m: 'Past month',
    // v3.1 — ingest metric cards
    historyIngestTotal: 'Total pages',
    historyIngestByType: 'By type',
    historyIngestSource: 'Source file',
    historyIngestNoTimestamp: 'No timestamp',
    historyIngestFirstTime: 'First ingest',
    historyIngestLatestTime: 'Latest ingest',
    historyTimeRangeCustom: 'Custom range',
    historyCustomRangeFrom: 'From',
    historyCustomRangeTo: 'To',
    historyCustomRangeApply: 'Apply',
    historyCustomRangeClear: 'Clear',
    // v1.23.0 — first-run welcome note (Phase 5.1.5)
    welcomeNoteTierANotice: 'Karpathy Wiki: vault is empty. Create your first source note and run Ingest to get started.',
    welcomeNoteTierBNotice: 'Karpathy Wiki: created a Welcome note. Open it to declare your domains and pick 2-3 source notes to seed the link graph.',
    welcomeNoteRecreateCommand: 'Recreate Wiki Welcome Note',
    welcomeNoteRecreateCommandTooltip: 'Re-create the Welcome note at <wikiFolder>/Welcome.md with current domain seeds and LLM configuration test. Existing file is overwritten.',
    welcomeNoteSettingsToggle: 'Create Wiki Welcome Note on first run',
    welcomeNoteSettingsToggleDesc: 'On your very first run (when the wiki folder is empty), create a one-page getting-started note at <wikiFolder>/Welcome.md. It explains what LLM-Wiki does, asks you to declare your domain focus, and walks you through ingesting your first 2-3 source notes. The note is written in English by default, or in your wiki language if the LLM is configured. Disable this if you already know how the plugin works and don\'t want the onboarding note cluttering your vault.',
    welcomeNoteRunConfigTest: 'Welcome note written in English. Open Settings → LLM Provider → Test Connection to localize it on next recreate.',
    welcomeNoteRecreated: 'Recreated Wiki Welcome note at {path}',
    welcomeNoteNotRecreated: 'Welcome note was not recreated. Check LLM configuration.',
    welcomeNoteGenerating: 'Wiki Welcome note: generating in background — you will get a Notice when it finishes.',
    welcomeNoteGenerationFailed: 'Wiki Welcome note generation failed: {error}',
    welcomeNoteFileName: 'Welcome to Karpathy LLM Wiki',
    startupCheckWelcomePending: 'Welcome note: generating in background (you will get a Notice when it finishes).',
    startupCheckWelcomeCreated: 'Welcome note created at {path}',
    // v1.23.0 Phase 5.1.5: Multi-File Suggest modal (cmdIngestMultipleFiles).
    // The modal's title, hint, search placeholder, action buttons,
    // status labels and queue-empty placeholder all live here. Status
    // labels double as both the right-pane text and the data-attribute
    // keys for `updateLeftPaneSelections` to recognise, so they must
    // remain stable English strings.
    multiFileModalTitle: 'Ingest multiple files',
    multiFileModalHint: 'Select source notes to ingest. The right pane shows the live ingest queue and progress.',
    multiFileSearchPlaceholder: 'Filter files by path…',
    multiFileAddToQueue: 'Add to queue',
    multiFileSelectAll: 'Select all',
    multiFileFileCount: '{count} file(s)',
    multiFileNoFilesAvailable: 'No files available to ingest.',
    multiFileNoFilesMatch: 'No files match "{q}".',
    multiFileQueueEmpty: 'No files in the queue. Check files on the left to add them.',
    multiFileStatusPending: 'Pending',
    multiFileStatusRunning: 'Running',
    multiFileStatusCompleted: 'Completed',
    multiFileStatusFailed: 'Failed',
    multiFileCancelAria: 'Cancel this file',
    // #598: what the vault says about a row, resolved when the picker
    // opens. The queue only knows this session.
    multiFileRowIngested: 'Ingested',
    multiFileRowDrifted: 'Note changed since ingest',
    // v1.23.0 Phase 5.1.5: Multi-File Suggest modal action button
    // that removes every pending and running job from the ingest
    // queue. Completed and failed jobs are preserved so the user
    // still sees what happened.
    cancelAllQueueJobs: 'Cancel all',
} as const;
