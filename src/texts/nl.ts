export const NL_TEXTS = {
    // Plugin Info
    pluginTitle: 'Karpathy LLM Wiki — instellingen',
    pluginIntro: 'Deze plug-in zet het concept {{link}} om in Obsidian. Hij leest je notities, gebruikt AI om entiteiten en concepten te extraheren en bouwt een gestructureerde, onderling gekoppelde wiki in je kluis.',
    karpathyLinkText: 'LLM-wiki van Andrej Karpathy',

    // Features Section
    featuresTitle: 'Hoe het werkt',
    workflow1Title: '1. Inlezen',
    workflow1Desc: 'Kies een notitie. AI haalt entiteiten, concepten en verbanden eruit en schrijft ze naar wikipagina\'s.',
    workflow2Title: '2. Bevragen',
    workflow2Desc: 'Stel vragen aan je wiki. De antwoorden steunen op wat je eerder hebt ingelezen.',
    workflow3Title: '3. Onderhouden',
    workflow3Desc: 'Een automatisch gegenereerde index, onderlinge koppelingen en lintcontroles houden de wiki gezond.',

    // Language Switcher
    languageTitle: 'Taal van de interface',
    languageDesc: 'Kies de taal van het instellingenpaneel. Herstart de plug-in om de taal ook in het opdrachtenpalet te zien.',
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
    statusTitle: 'Status van de LLM-client',
    llmWikiStatusSection: 'Status van LLM Wiki',
    statusInitialized: 'Gestart',
    statusNotInitialized: 'Niet gestart',
    statusReady: 'LLM gereed',
    statusNotReady: 'LLM niet ingesteld — rond de configuratie af en laat de verbindingstest slagen',
    currentProvider: 'Huidige provider',

    // Provider Configuration
    providerSection: 'LLM-configuratie',
    providerName: 'LLM-provider',
    providerDesc: 'Kies een vooraf ingestelde provider of een eigen OpenAI-compatibele dienst. Voor een bundel zoals een Coding Plan kies je Custom OpenAI/Anthropic en vul je de basis-URL en API-sleutel van de provider zelf in',

    // API Key
    apiKeyName: 'API-sleutel',
    apiKeyDesc: 'API-sleutel. Opgeslagen in het inloggegevensbeheer van je besturingssysteem, niet in `data.json`.',
    apiKeyPlaceholder: 'Vul de API-sleutel in',
    // v1.25.4 #339: SecretStorage migration repair + failure Notice
    apiKeyMigrateToSecretStorageButton: 'Naar SecretStorage verhuizen',
    apiKeyMigratedToSecretStorageSuccess: 'API-sleutel uit SecretStorage teruggezet naar de instellingen.',
    apiKeyMigrationFailedNotice: 'De API-sleutel kon niet naar SecretStorage worden geschreven: {}',
    codexAuthName: 'Aanmelden met ChatGPT Plan',
    codexAuthDesc: 'Experimentele Codex-toegang via OAuth, op je tegoed van het ChatGPT-plan. De facturering van het OpenAI-platform blijft daar los van staan.',
    codexAuthSignedOut: 'Niet aangemeld',
    codexAuthSignedIn: 'Aangemeld',
    codexAuthBrowserButton: 'Aanmelden via de browser',
    codexAuthDeviceButton: 'Eenmalige code gebruiken',
    codexAuthDeviceInstructions: 'Vul deze code in op de pagina van OpenAI: {}',
    codexAuthCopyCode: 'Code kopiëren',
    codexAuthSignOutButton: 'Afmelden',
    codexAuthBusy: 'Wachten op goedkeuring van OpenAI...',
    codexAuthFailed: 'Aanmelden bij ChatGPT is mislukt: {}',
    codexAuthQuota: 'Het Codex-tegoed van ChatGPT is op. Wacht tot de getoonde periode voorbij is en probeer het opnieuw.',
    codexAuthExperimental: 'Experimenteel: beschikbaarheid volgt de aanmeldstatus en het modelbeleid van OpenAI Codex.',
    codexModelsRefreshName: 'Modellen van je account',
    codexModelsRefreshDesc: 'Haal de modellen die je in de keuzelijst ziet op bij het OpenAI Codex-account waarmee je bent aangemeld.',
    codexModelsRefreshButton: 'Modellen van het account verversen',
    codexModelsRefreshing: 'Bezig met verversen...',
    codexModelsRefreshSuccess: '{} modellen van je account opgehaald.',
    codexModelsRefreshFailed: 'De modellen van je account konden niet worden opgehaald; de beschikbare terugvallijst wordt gebruikt. {}',

    // Base URL
    baseUrlName: 'Basis-URL van de API',
    baseUrlDescCustom: 'Verplicht: het adres van je eigen OpenAI-compatibele dienst',
    baseUrlDescOverride: 'Optioneel: de vooraf ingestelde basis-URL overschrijven',

    // Issue #723: custom request headers (shown directly below the Base URL).
    customHeadersName: 'Eigen headers',
    customHeadersDesc: 'Eén `Naam: waarde` per regel. Worden bij elk verzoek meegestuurd; lege regels en regels die met `#` beginnen worden genegeerd.',
    customHeadersInvalid: '{} regel(s) met een fout worden genegeerd.',

    // Ollama Hint
    ollamaHint: 'Ollama draait lokaal, een API-sleutel is niet nodig',
    // LM Studio Hint
    lmstudioHint: 'LM Studio draait lokaal, een API-sleutel is optioneel',

    // LLM execution cap
    maxTokensPerCallName: 'Maximum aantal uitvoertokens per aanroep',
    maxTokensPerCallDesc: 'Het hoogste aantal tokens dat één aanroep mag schrijven. Auto vraagt het model naar zijn eigen grens; een lokale server die geen grens opgeeft krijgt de standaardwaarde van de plug-in. Dit getal verhoogt en verlaagt wat een aanroep voor het genereren van een pagina opgeeft, en de redeneertokens komen uit hetzelfde budget. Dit is niet het contextvenster.',
    contextWindowName: 'Contextvenster van het model',
    contextWindowDesc: 'Hoeveel tokens het model tegelijk vasthoudt, invoer en uitvoer samen. Als dit is ingevuld, wordt de prompt eraf getrokken, zodat er nooit meer wordt gevraagd dan er overblijft. Auto laat de bovengrens onbegrensd.',

    // Issue #111: slug casing
    slugCaseName: 'Hoofdletters in bestandsnamen',
    slugCaseDesc: 'Bepaalt of gegenereerde wikibestandsnamen in kleine letters worden geschreven. "Behouden" is aan te raden voor talen waarin kleine letters de betekenis veranderen, zoals bij Duitse zelfstandige naamwoorden.',
    slugCaseLower: 'Kleine letters (standaard)',
    slugCasePreserve: 'Hoofdletters behouden',
    // Minimum alias length (Advanced settings, next to slug case).
    minAliasLengthName: 'Minimale lengte van een alias',
    minAliasLengthDesc: 'Aliassen die korter zijn dan dit (na het weghalen van spaties) worden niet naar wikipagina\'s geschreven. De standaardwaarde 2 houdt afkortingen van twee letters (ML, AI, UI) bruikbaar; zet hem op 3 als je kluis aliassen verzamelt die alleen in hoofdletters verschillen (Cr/CR). Bereik 2–6.',
    minAliasLengthClamped: 'Waarde buiten het bereik (2–6), ingesteld op {}',

    // Model Selection
    modelSection: 'Modelkeuze',
    fetchModelsName: 'Beschikbare modellen ophalen',
    fetchModelsDesc: 'Haal de nieuwste modellenlijst op bij de API van je provider',
    fetchModelsButton: 'Modellen ophalen',
    fetchingModels: 'Bezig met ophalen...',
    fetchSuccess: 'Gelukt! {} modellen beschikbaar',
    fetchFailed: 'Lege lijst of ophalen mislukt; vul de modelnaam zelf in',
    fetchNotSupported: 'Deze provider kan geen modellenlijst leveren',
    fetchErrorAuth: 'Aanmelden mislukt (HTTP 401/403). Controleer je API-sleutel, of vul hieronder een model-ID in en klik op Verbinding testen.',
    fetchErrorEndpoint: 'Het adres is niet gevonden (HTTP 404). Controleer de basis-URL, of vul een model-ID in en klik op Verbinding testen.',
    fetchErrorServer: 'De server van de provider gaf een fout (HTTP 5xx). Probeer het later opnieuw, of vul een model-ID in en klik op Verbinding testen.',
    fetchErrorEmpty: 'Deze provider heeft geen adres voor een modellenlijst. Vul hieronder een model-ID in en klik op Verbinding testen.',
    fetchErrorNetwork: 'Het netwerkverzoek is mislukt. Controleer je internetverbinding, de basis-URL, je proxy en je API-sleutel. Je kunt ook hieronder een model-ID invullen en op Verbinding testen klikken.',

    selectModelName: 'Model kiezen',
    selectModelDesc: 'Kies uit {} beschikbare modellen',
    customInputOption: 'Zelf invullen...',
    customInputHint: 'Wil je een ander model gebruiken, kies dan "Zelf invullen..."',

    modelName: 'Modelnaam',
    modelDescCustom: 'Je gebruikt een eigen model (klik hierboven om de lijst opnieuw op te halen)',
    modelDescFetchFailed: 'De modellenlijst kon niet worden opgehaald. Controleer je API-sleutel en het adres van de dienst, of vul hieronder een model-ID in en klik op Verbinding testen.',
    modelInputPlaceholder: 'Vul een model-ID in en test daarna de verbinding',

    switchToDropdown: 'Terug naar de keuzelijst',
    useDropdownButton: 'Keuzelijst gebruiken',

    // v1.24.0 #208: per-task model picker
    modelTaskModeName: 'Bereik van de modelkeuze',
    modelTaskModeDesc: 'Kies of alle taken hetzelfde model gebruiken, of per taak een eigen model (inlezen / lint / vragen). Waarden per taak blijven bewaard als je terugschakelt naar één model.',
    modelTaskModeUnified: 'Eén model voor alles (standaard)',
    modelTaskModePerTask: 'Per taak een eigen model',
    perTaskIngestModelName: 'Model voor inlezen',
    perTaskIngestModelDesc: 'Wordt gebruikt voor het inlezen van notities en gesprekken, voor het onderhoud van het schema en voor het maken van de welkomstnotitie.',
    perTaskLintModelName: 'Model voor lint',
    perTaskLintModelDesc: 'Wordt gebruikt voor lintanalyse, het vinden van dubbele pagina\'s, de fix-opdrachten en het herstellen van verweesde koppelingen.',
    perTaskQueryModelName: 'Model voor vragen',
    perTaskQueryModelDesc: 'Wordt gebruikt voor het gesprek in Query Wiki en voor de beoordeling bij opslaan naar de wiki.',

    // Test & Save
    testConnectionName: 'Verbinding testen',
    testConnectionDesc: 'Controleer of de configuratie de LLM-API kan aanroepen',
    testButton: 'Verbinding testen',
    testing: 'Bezig met testen...',

    saveSettingsName: 'Instellingen opslaan',
    saveSettingsDesc: 'Bewaar de huidige configuratie',
    saveButton: 'Instellingen opslaan',
    savedNotice: 'Instellingen opgeslagen!',

    // v1.24.0 (Bug C 3.4 / plan C): gradual migration Notice — shown on
    // startup or after a mid-session wikiFolder change when chat history
    // contains links from a previous wiki folder.
    queryHistoryMigrationNotice: 'De geschiedenis van Query Wiki bevat koppelingen uit een eerdere wikimap. Nieuwe vragen gebruiken nu automatisch de nieuwste map. Wil je alle bewaarde berichten verversen, open dan het paneel van Query Wiki en klik daar op de knop om de geschiedenis te wissen.',

    // v1.24.0 Issue #251: Custom Query Instructions collapsible panel
    customInstructionsTitle: 'Eigen instructies voor vragen',
    customInstructionsDesc: 'Deze instructies worden bij elke systeemprompt van Query Wiki toegevoegd. Ze gelden alleen voor het gesprek in Query Wiki; inlezen, lint en het genereren van pagina\'s blijven ongemoeid.',
    customInstructionsPlaceholder: 'bijv. Behandel dit als onderzoek: zoek breed, noem je bronnen en houd feiten en interpretatie uit elkaar...',
    customInstructionsApply: 'Toepassen',
    customInstructionsClear: 'Wissen',
    customInstructionsCharCount: '{current}/{max} tekens',
    instructionsApplied: 'Eigen instructies voor vragen opgeslagen.',
    instructionsCleared: 'Eigen instructies voor vragen gewist.',

    // Test Connection
    testConnectionSuccessful: 'De verbinding werkt',
    baseUrlUpdated: 'Basis-URL ingesteld op {url}',
    testConnectionFailed: 'De verbinding mislukte',
    testConnectionProvider: 'Provider: ',
    codexAuthRequired: 'Meld je aan met ChatGPT Plan voordat je de verbinding test.',
    bedrockSsoRequired: 'Meld je eerst aan met AWS SSO (Instellingen → Bedrock) voordat je de verbinding test.',
    bedrockIamRequired: 'Vul eerst je IAM-sleutels in (Instellingen → Bedrock) voordat je de verbinding test.',
    bedrockAuthMethodName: 'Aanmelden',
    bedrockAuthMethodDesc: 'Met een API-sleutel gebruik je een Bedrock-sleutel; met AWS SSO ondertekent IAM Identity Center je verzoeken; met IAM-sleutels gebruik je vaste toegangssleutels.',
    bedrockAuthOptionApiKey: 'API-sleutel',
    bedrockAuthOptionSso: 'AWS SSO',
    bedrockAuthOptionIam: 'IAM-sleutels',
    bedrockSsoStartUrlName: 'Start-URL van SSO',
    bedrockSsoStartUrlDesc: 'Het adres van het portaal van je organisatie, bijv. https://d-xxxxxxxxx.awsapps.com/start',
    bedrockSsoAccountIdName: 'AWS-account-ID',
    bedrockSsoAccountIdDesc: 'Het account van 12 cijfers waarvan de rol wordt gebruikt, bijv. 123456789012',
    bedrockSsoRoleNameName: 'Naam van de rol',
    bedrockSsoRoleNameDesc: 'De IAM-rol die voor toegang tot Bedrock wordt gebruikt, bijv. PowerUserAccess',
    bedrockSsoLoginButton: 'Aanmelden met AWS SSO',
    bedrockSsoSignOutButton: 'Afmelden bij AWS SSO',
    bedrockSsoStatusSignedIn: 'Aangemeld · verloopt {}',
    bedrockSsoStatusSignedOut: 'Niet aangemeld',
    bedrockSsoBusy: 'Bezig met aanmelden…',
    bedrockSsoUserCodeInstructions: 'Code voor AWS SSO: {}. Open de koppeling en geef toestemming.',
    bedrockSsoCopyCode: 'Code kopiëren',
    bedrockSsoFailed: 'Aanmelden bij AWS SSO is mislukt: {}',
    bedrockSsoDetectedPrefill: 'Gevonden account en rol: {}',
    bedrockIamKeyName: 'ID van de toegangssleutel',
    bedrockIamKeyDesc: 'Kenmerk van de IAM-toegangssleutel, bijv. AKIA… of ASIA…',
    bedrockIamSecretName: 'Geheime toegangssleutel',
    bedrockIamSecretDesc: 'Alleen opgeslagen in de sleutelopslag van dit apparaat, nooit in data.json',
    bedrockIamSessionTokenName: 'Sessietoken (optioneel)',
    bedrockIamSessionTokenDesc: 'Alleen nodig voor tijdelijke inloggegevens (STS)',
    bedrockIamClearButton: 'Bewaarde IAM-sleutels wissen',
    bedrockIamSaveFailed: 'De IAM-sleutels konden niet worden opgeslagen: {}',
    errorUnknown: 'Onbekende fout',

    // Issue #137: LLM fallback notices (shown when thinking-dialect
    // fallback or param-stripping happens during a request).
    fallbackThinkingDialect: 'Sturing van het denken: overgestapt op de variant "{dialect}" (deze provider gebruikt een ander formaat voor die sturing). De uitvoer verandert niet.',
    fallbackThinkingNone: 'Het denken is voor deze provider helemaal uitgezet. Er kan toch nog redenatie in de uitvoer staan; probeer in dat geval een ander model.',
    fallbackParamStripped: 'Deze provider kent de parameter "{field}" niet. Hij is uit het verzoek gehaald; het gedrag kan afwijken van de configuratie.',

    // Wiki Init Status
    wikiInitStatusReady: 'De wiki is aangemaakt',
    wikiInitStatusNotReady: 'De wiki is nog niet aangemaakt — dat gebeurt automatisch bij het eerste inlezen',

    // Wiki Folder
    wikiSection: 'Configuratie van de wiki',
    wikiFolderName: 'Wikimap',
    // v1.24.0: added the "restart Obsidian" hint because the wikiFolder
    // affects engine caches and Query Wiki panels that aren't fully
    // re-bound on settings change.
    wikiFolderDesc: 'De map waarin de wiki-pagina\'s worden gezet. Herstart Obsidian na een wijziging: de caches van de engine en geopende panelen van Query Wiki moeten opnieuw koppelen.',
    wikiFolderPlaceholder: 'wiki',

    // Errors
    errorNoApiKey: 'Stel eerst een API-sleutel in',
    errorNoModel: 'Kies eerst een model — klik op Modellen ophalen of vul zelf een model-ID in',
    llmNotReady: 'De LLM is niet ingesteld. Ga naar Instellingen → Karpathy LLM Wiki, stel je provider in, haal de beschikbare modellen op en laat de verbindingstest slagen.',
    errorFetchFailed: 'Mislukt: {}',

    // Query Settings
    querySectionTitle: 'Configuratie van het bevragen van de wiki',
    // v1.24.0: renamed from "Max Conversation History" to clarify the
    // semantics — this is a memory-window cap, not a hard storage limit
    // (history is itself a rolling buffer). 1 = each turn independent
    // (no cross-turn memory). Settings UI is a dropdown of presets, so
    // no "presets: 1/10/30/50/100/500" list is needed in the description.
    // v1.24.0: maxConversationHistoryHint was a dead i18n key (never
    // referenced from UI code); the recommendation text now lives inline
    // in the desc.
    maxConversationHistoryName: 'Rondes gespreksgeheugen',
    maxConversationHistoryDesc: 'Hoeveel eerdere rondes van het gesprek de LLM als geheugen ziet. 1 betekent dat elke beurt op zichzelf staat, zonder geheugen over beurten heen; hogere waarden laten het model eerdere beurten onthouden. Aanbevolen: 1 voor losse vragen, 10–50 voor doorlopend onderzoek.',
    numberRangeValidation: 'Vul een getal tussen 1 en 50 in',
    numberRangeClamped: 'De waarde valt buiten het bereik (1-500) en is automatisch op {} gezet',

    // Query Modal UI
    queryModalTitle: 'Query Wiki — gesprek over je wiki',
    queryModalPlaceholder: 'Stel je vraag...',
    queryModalSendButton: 'Versturen',
    queryModalStopButton: 'Stoppen',
    queryModalSaveButton: 'Naar de wiki opslaan',
    queryModalClearButton: 'Geschiedenis wissen',
    queryModalHistoryCount: 'Gespreksgeschiedenis: {}/{} rondes',
    queryModalStreaming: 'Bezig met streamen...',
    queryModalFallbackStreaming: 'Streamen wordt hier niet ondersteund; overgestapt op wachten op het hele antwoord. Even geduld...',
    queryPhaseSearching: 'De index van de wiki wordt bekeken en de relevante pagina\'s worden gekozen...',
    queryPhaseFoundPages: '{count} pagina(\'s) gevonden: {pages}',
    queryPhaseLoadingPages: 'De inhoud van de pagina\'s wordt geladen...',
    queryPhaseContextReady: 'De context staat klaar. Het antwoord wordt gemaakt...',
    queryPhaseGenerating: 'Bezig met maken... ({time}s verstreken)',
    queryPhaseNonStreaming: 'Zonder streamen, het antwoord wordt gemaakt... ({time}s verstreken)',
    queryModalErrorPrefix: 'Fout: ',
    queryModalHint: 'Vragen gaan over de inhoud van je wiki. Klik op "Naar de wiki opslaan" om een waardevol gesprek als wiki-pagina\'s te bewaren.',

    // v1.20.0: Query Wiki thinking-block collapsible summary
    queryThinkingSummary: 'Redenering',
    queryThinkingSteps: 'stappen',

    // Error Messages
    errorLLMClientNotInit: 'De LLM-client is niet gestart. Sla eerst de instellingen op.',
    errorIngestFailed: 'Inlezen mislukt: ',
    errorQueryFailed: 'De vraag mislukte: ',
    fileWriteFailed: 'Het bestand kon niet worden gemaakt of bijgewerkt: {path}',

    // Success Messages
    ingestSuccess: 'Inlezen gelukt: {} pagina\'s gemaakt, {} pagina\'s bijgewerkt',
    querySuccess: 'De vraag is afgerond',
    lintSuccess: 'De lintcontrole is afgerond',
    lintReadingPages: '{count} wiki-pagina\'s worden gelezen...',
    lintReadingPagesProgress: 'Wiki-pagina\'s lezen: {current}/{total}...',
    lintScanningLinks: 'Dode koppelingen zoeken...',
    lintScanningLinksProgress: 'Dode koppelingen zoeken: {current}/{total}...',
    lintCheckingDuplicates: 'Er wordt gezocht naar dubbele pagina\'s...',
    lintCheckingDuplicatesProgress: 'Dubbele pagina\'s controleren: ronde {current} ...',
    lintFixingPolluted: 'Vervuilde pagina {current}/{total} wordt hersteld: {title} → {newTitle}',
    lintModalFixPolluted: '🧹 Vervuilde pagina\'s herstellen ({count})',
    lintDuplicateCheckFailed: 'Het zoeken naar dubbele pagina\'s mislukte — zie de console voor details',
    lintDuplicateCheckFailedDetail: 'Het zoeken naar dubbele pagina\'s mislukte bij {step}: {error}',
    lintMergeItemFailed: 'Samenvoegen mislukt: {source} → {target} — {error}',
    lintAliasesMissing: 'Aliassen ontbreken: {count} pagina(\'s) zonder alias',
    lintAliasesSection: 'Pagina\'s zonder aliassen [{count}]',
    lintAliasesItem: '- [[{page}]]',
    lintAliasesCompleteBtn: 'Aliassen aanvullen ({count})',
    lintAliasesFilling: 'Aliassen maken {current}/{total}: {page}',
    lintAliasesFilled: 'Aliassen aangevuld. {filled}/{total} pagina\'s gevuld.',
    lintAliasesFillFailed: 'Het maken van aliassen mislukte: {page} — {error}',
    // Issue #85 v7: tag-violation retag notifications
    lintTagViolationFiring: 'Tags opnieuw zetten {current}/{total}: {path}',
    lintTagViolationFailed: 'Tags opnieuw zetten mislukte voor {path}: {error}',
    lintTagViolationFixed: 'Tags opnieuw gezet. {fixed}/{total} pagina(\'s) hersteld.',
    lintTagViolationFixedNone: 'Tags opnieuw gezet. Geen enkele pagina hoefde te worden hersteld (de LLM hield de huidige tags aan).',
    lintTagViolationSection: 'Pagina\'s met tags buiten de lijst [{count}]',
    lintTagViolationItem: '- [[{path}]] — ongeldig: {tags}',
    lintTagViolationRetagBtn: '🏷️ {count} pagina(\'s) opnieuw taggen met de LLM',
    lintFixItemFailed: 'Herstellen mislukt: [[{target}]] — {error}',
    lintLinkItemFailed: 'Koppelen mislukt: {page} — {error}',
    lintRetrying: 'Opnieuw proberen ({attempt}/{max}) na een fout...',
    lintAnalyzingLLM: 'De LLM bekijkt de gezondheid van de wiki...',
    saveToWikiSuccess: 'Het gesprek is naar de wiki opgeslagen!',
    querySaveAlreadyExists: 'Let op: er is niets geschreven (de kennis staat al in de wiki):',
    saveSummary: '{entities} entiteiten, {concepts} concepten, {pages} pagina\'s',
    aliasAdded: 'Alias \'{alias}\' toegevoegd aan pagina \'{page}\'',

    // Status Messages
    ingestingSources: 'Bronnen worden ingelezen...',
    queryingWiki: 'De wiki wordt bevraagd...',
    lintingWiki: 'De wiki wordt gecontroleerd...',
    savingToWiki: 'Het gesprek wordt naar de wiki opgeslagen...',
    clearingHistory: 'De gespreksgeschiedenis wordt gewist...',

    // Buttons
    ingestButton: 'Inlezen',
    queryButton: 'Vragen',
    lintButton: 'Lint',
    cancelButton: 'Annuleren',

    // Links
    karpathyGistLink: 'De Gist van Karpathy over LLM-wiki',
    obsidianPluginAPI: 'Obsidian Plugin API',
    anthropicSDK: 'Anthropic SDK',
    openaiSDK: 'OpenAI SDK',

    // v1.24.1 PATCH Bedrock Stage 1
    bedrockRegionName: 'AWS-regio',
    bedrockRegionDesc: 'De Amazon Bedrock-regio van dit account. Bepaalt het adres van het bedrock-mantle-eindpunt; de basis-URL kan dit niet overschrijven.',
    bedrockRegionHint: 'bedrock-mantle is beschikbaar in 18 regio\'s; welke modellen werken, verschilt per regio.',

    // Other
    availableModelsLoading: 'Beschikbare modellen worden geladen...',
    noModelsAvailable: 'Geen modellen beschikbaar',

    // LLM Language Hint
    llmLanguageHint: 'Antwoord in het Nederlands.',

    // Schema Configuration
    schemaSection: 'Configuratie van het schema',
    enableSchemaName: 'Schema gebruiken',
    enableSchemaDesc: 'Genereer schema/config.md en geef het mee aan elke prompt, zodat de wiki een vaste structuur krijgt',
    viewSchemaButton: 'Schema bekijken of bewerken',
    regenerateSchemaButton: 'Standaardschema opnieuw maken',
    schemaRegeneratedNotice: 'Het standaardschema is opnieuw gemaakt.',
    schemaRegenerateFailed: 'Het schema kon niet worden gemaakt',

    // Wiki Output Language
    wikiLanguageName: 'Taal van de wiki-uitvoer',
    wikiLanguageDesc: 'Alle wiki-pagina\'s, de index, het logboek en de antwoorden op vragen worden in deze taal geschreven',
    customWikiLanguageOption: 'Zelf invullen...',
    customWikiLanguageHint: 'Vul een taalnaam in (bijv. Italiaans, Arabisch). Die naam gaat als instructie voor de uitvoertaal naar de LLM.',
    customWikiLanguagePlaceholder: 'bijv. Italiaans',

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
      nl: { subtitle: 'Automatisch gegenereerde kennisbankmap', entities: 'Entiteiten', concepts: 'Concepten', sources: 'Bronnen' },
      pl: { subtitle: 'Automatycznie generowany katalog bazy wiedzy', entities: 'Encje', concepts: 'Pojęcia', sources: 'Źródła' },
      th: { subtitle: 'ไดเรกทอรีฐานความรู้ที่สร้างขึ้นอัตโนมัติ', entities: 'เอนทิตี', concepts: 'แนวคิด', sources: 'แหล่งข้อมูล' },
      'zh-Hant': { subtitle: '自動產生的知識庫目錄', entities: '實體', concepts: '概念', sources: '來源' },
      it: { subtitle: 'Elenco della base di conoscenza generato automaticamente', entities: 'Entità', concepts: 'Concetti', sources: 'Fonti' },
      ru: { subtitle: 'Каталог базы знаний, создаваемый автоматически', entities: 'Сущности', concepts: 'Концепции', sources: 'Источники' },
    },

    // Extraction Settings
    extractionSectionTitle: 'Extractie',
    extractionGranularityName: 'Hoeveelheid per bron',
    extractionGranularityDesc: 'Bepaalt hoeveel entiteiten en concepten er per bronbestand worden geëxtraheerd. Hoger betekent meer pagina\'s en meer API-tokens.\nFijn: diepe analyse. Standaard: dagelijkse notities. Grof: snel overzicht. Minimaal: 100+ bestanden in één keer (ongeveer 5 items per bron, dus geen detail per item). Eigen: stel je eigen grens in (tot 500).\nTip: gebruik Minimaal of Grof voor mappen met veel bestanden; dat scheelt tijd en kosten.',
    extractionGranularityFine: 'Fijn — diepe analyse (≤100 items)',
    extractionGranularityStandard: 'Standaard — dagelijkse notities (≤50 items)',
    extractionGranularityCoarse: 'Grof — snel overzicht (≤10 items)',
    extractionGranularityMinimal: 'Minimaal — 100+ bestanden in één keer (≤5 items)',
    extractionGranularityCustom: 'Eigen — stel zelf de grenzen in (1~500)',
    customEntityLimitName: 'Eigen grens voor entiteiten',
    customEntityLimitDesc: 'Het hoogste aantal entiteiten per bronbestand (1-500)',
    customConceptLimitName: 'Eigen grens voor concepten',
    customConceptLimitDesc: 'Het hoogste aantal concepten per bronbestand (1-500)',

    // Issue #85 v2: Tag Vocabulary (chip input UX, embedded in Wiki Configuration)
    tagVocabularyInlineDesc: 'Vaste lijst met tags voor de frontmatter van entiteiten en concepten. Geneste Obsidian-tags met "/" blijven bewaard.',
    tagVocabularyModeName: 'Configuratie van de taglijst',
    tagVocabularyModeDescDefault: 'Standaard gebruikt de ingebouwde tags: {}. Kies Eigen om je eigen tags te bepalen.',
    tagVocabularyModeDescCustom: 'Eigen: bepaal hieronder je eigen tags voor entiteiten en concepten. Typ en druk op Enter of komma om toe te voegen, klik op × om te verwijderen.',
    // v1.25.10 PATCH Issue #368 — clarification, not enforcement. The custom
    // vocabulary is a SCHEMA INJECTION HINT for the LLM, not a write-time
    // gate. Small/local models may still emit out-of-vocabulary types; the
    // lint "out-of-vocabulary type" diagnostic surfaces those pages for review.
    tagVocabularyNotEnforcedHint: 'Alleen een hint voor het schema — de LLM kan toch tags buiten de lijst maken. Draai Lint om zulke pagina\'s te vinden en te herstellen.',
    tagVocabularyModeDefault: 'Standaard (ingebouwde subtags)',
    tagVocabularyModeCustom: 'Eigen (zelf gedefinieerd)',
    customEntityTagsName: 'Eigen tags voor entiteiten',
    customEntityTagsDesc: 'Druk op Enter of komma om een tag toe te voegen. Klik op × om te verwijderen. Geneste tags met "/" blijven bewaard.',
    customEntityTagsPlaceholder: 'persoon, organisatie, project, plaats',
    customConceptTagsName: 'Eigen tags voor concepten',
    customConceptTagsDesc: 'Druk op Enter of komma om een tag toe te voegen. Klik op × om te verwijderen. Geneste tags met "/" blijven bewaard.',
    customConceptTagsPlaceholder: 'theorie, methode, vakgebied, fenomeen, term',
    chipDuplicateHint: 'Deze tag stond er al en is overgeslagen',

    // v1.27.3: topic-scoped prompt customization (extraction focus + content requirements)
    promptFocusSectionName: 'Prompts aanpassen',
    promptFocusOpenSchema: 'Naar het schema',
    extractionFocusName: 'Focus bij het extraheren',
    extractionFocusDesc: 'Vrije tekst die aan de extractieprompt wordt toegevoegd: welke entiteiten en concepten deze wiki voorrang moet geven. Het JSON-formaat en de tagregels veranderen niet. Leeg betekent uit. Maximaal 4000 tekens.',
    extractionFocusPlaceholder: 'bijv. sla terloopse vermeldingen over; elke persoon die wordt geciteerd krijgt een pagina',
    contentRequirementsName: 'Eisen aan de inhoud',
    contentRequirementsDesc: 'Vrije tekst met eisen die **binnen de secties vallen die een pagina al heeft**: nadruk, dekking en volgorde. Er komt geen nieuwe sectie bij; de lijst met secties in de plug-in bepaalt wat een schrijfactie overleeft. Regels over bronvermelding en het tegengaan van verzonnen inhoud blijven van het systeem. Leeg betekent uit. Maximaal 4000 tekens.',
    contentRequirementsPlaceholder: 'bijv. begin elke sectie met een samenvatting van één zin; houd secties onder 150 woorden',
    // Ingestion Acceleration
    accelerationSectionTitle: 'Inlezen versnellen',
    pageGenerationConcurrencyName: 'Gelijktijdige LLM-aanroepen',
    pageGenerationConcurrencyDesc: 'Het aantal LLM-aanroepen dat tegelijk loopt tijdens inlezen en lint. Hogere waarden zijn sneller, kosten meer en kunnen tegen een limiet van de provider aanlopen.',
    concurrencyValueSingular: 'Huidige gelijktijdigheid: {} (één voor één — het veiligst)',
    concurrencyValuePlural: 'Huidige gelijktijdigheid: {} (parallel)',
    batchDelayName: 'Pauze tussen rondes (ms)',
    batchDelayDesc: 'De pauze tussen parallelle rondes om een limiet van de provider te voorkomen (100-10000 ms). Nu: {} ms. Verhoog dit bij fouten met code 429.',

    // Auto Maintenance
    autoMaintainSection: 'Automatisch onderhoud',
    autoMaintainBetaBadge: 'BÈTA — Experimentele functie. Er kunnen fouten in zitten. Alleen voor gevorderde gebruikers.',
    autoWatchName: 'Mappen volgen',
    autoWatchDesc: 'Nieuwe of gewijzigde .md-bestanden in de gevolgde mappen automatisch opmerken en daar melding van geven of ze automatisch inlezen',
    watchedFoldersName: 'Gevolgde mappen',
    watchedFoldersDesc: 'De mappen die je als bron hebt aangewezen. Hun tags vormen de lijst met domeintags die bij het inlezen wordt aangeboden en, met automatisch volgen aan, worden ze op nieuwe inhoud gecontroleerd. Klik op "Map toevoegen" om er een uit je kluis te kiezen.',
    addWatchedFolderButton: 'Map toevoegen',
    removeWatchedFolderButton: 'Verwijderen',
    webClipperPresetName: 'Clippings volgen (Web Clipper)',
    webClipperPresetDesc: 'Zet de map Clippings/ die Obsidian Web Clipper gebruikt op de lijst. Wat je op het web knipt, wordt automatisch in de wiki ingelezen.',
    noWatchedFoldersHint: 'Er zijn nog geen mappen ingesteld. Voeg een map toe of zet de voorinstelling voor Clippings aan.',
    autoWatchModeName: 'Manier van volgen',
    autoWatchModeDesc: '"Alleen melden" toont een vraag. "Automatisch inlezen" doet het zonder iets te vragen.',
    watchModeNotify: 'Alleen melden',
    watchModeAuto: 'Automatisch inlezen',
    autoWatchDebounceName: 'Wachttijd (seconden)',
    autoWatchDebounceDesc: 'Hoe lang er wordt gewacht voordat een wijziging wordt ingelezen (1-60 seconden)',
    autoWatchDebounceClamped: 'Waarde buiten het bereik (1-60), automatisch op {} gezet',
    periodicLintName: 'Lint op een vaste tijd',
    periodicLintDesc: 'Laat de LLM op een schema de wiki controleren, maar alleen als bronbestanden sinds de vorige controle zijn gewijzigd',
    periodicLintOff: 'Uit',
    periodicLintDaily: 'Elke dag',
    periodicLintWeekly: 'Elke week',
    periodicLintMonthly: 'Elke maand',
    autoSmartFixName: 'Slim automatisch herstellen',
    autoSmartFixDesc: 'Past bij een lintcontrole meteen alle herstellingen toe, zonder eerst het rapport te tonen. Het overzicht van de herstellingen verschijnt nog steeds als alles klaar is.',
    autoSmartFixNotice: 'Slim automatisch herstellen: alle herstellingen worden toegepast...',

    autoIngestLevelName: 'Melding na automatisch inlezen',
    autoIngestLevelDesc: 'Hoe je hoort dat automatisch inlezen klaar is. "Melding" is kort en houdt niets tegen. "Venster" opent het volledige rapport. Uit als de manier van volgen "Alleen melden" is.',
    autoIngestLevelNotice: 'Melding (houdt niets tegen)',
    autoIngestLevelModal: 'Venster (volledig rapport)',
    startupCheckName: 'Snelle herstellingen bij het starten',
    startupCheckDesc: 'Herstelt bij het laden kleine formaatfouten (bronnen, dubbel geneste koppelingen) en controleert de mapstructuur van de wiki. Standaard aan.',
    startupCheckNoticeLevelName: 'Resultaat van de snelle herstellingen tonen',
    startupCheckNoticeLevelDesc: 'De snelle herstellingen lopen altijd bij het starten (welkomstnotitie, mapstructuur, bronnen opschonen, onvolledige pagina\'s, kop van het logboek). Kies of je daarna een melding wilt zien. In stille modus gaat het resultaat alleen naar de console en naar het paneel met de geschiedenis.',
    startupCheckNoticeVisible: 'Zichtbaar (melding tonen)',
    startupCheckNoticeSilent: 'Stil (geen melding)',
    suggestSchemaCommand: 'Voorstellen voor het schema',
    autoMaintainCostWarning: '⚠️ Let op de kosten: automatisch onderhoud gebruikt API-tokens. "Automatisch inlezen" doet bij elke wijziging een LLM-aanroep. "Lint op een vaste tijd" laat de LLM op een schema controleren, maar alleen als er iets is gewijzigd. Stel dit zorgvuldig in om onverwachte kosten te voorkomen.',

    // Notices
    startupCheckSummary: 'De wiki heeft {pages} pagina\'s ({entities} entiteiten, {concepts} concepten, {sources} bronnen)',
    watcherActiveNotice: 'Wiki: het volgen van bestanden is actief — de gevolgde mappen worden in het oog gehouden',
    watchIngestNotice: 'Wiki: {count} bestand(en) in sources/ is of zijn gewijzigd. Kies "Bronnen inlezen" om ze te verwerken.',

    // Startup quick fixes detail (Issue #81)
    startupCheckTitle: 'Snelle herstellingen van de wiki zijn klaar',
    startupCheckStructureLabel: 'Structuur van de wiki',
    startupCheckStructureOk: 'compleet',
    startupCheckStructureMissing: 'onvolledig — wordt bij het eerste inlezen automatisch aangemaakt',
    startupCheckSourcesLabel: 'Bronnen opgeschoond',
    startupCheckSourcesClean: 'was al schoon',
    startupCheckSourcesCleaned: '{files} bestand(en) opgeschoond, {entries} regel(s) aangepast',
    startupCheckIncompleteClean: 'onvolledige pagina\'s: geen',
    startupCheckIncompleteArchived: 'onvolledige pagina\'s: {count} verplaatst naar de prullenbak (terug te halen uit .trash)',
    startupCheckDisableHint: 'Wil je dit uitzetten, ga dan naar Instellingen → Automatisch onderhoud → Resultaat van de snelle herstellingen tonen',
    autoIngestRunning: '{count} gewijzigd bestand of gewijzigde bestanden worden automatisch ingelezen...',
    autoIngestComplete: 'Automatisch inlezen klaar: {success} gelukt, {fail} mislukt',
    scheduledLintRunning: 'De geplande lintcontrole loopt...',
    wikiLintStats: 'Lint van de wiki: {pages} pagina\'s ({entities} entiteiten, {concepts} concepten, {sources} bronnen)',
    wikiHealthStats: 'Gezondheid van de wiki: {pages} pagina\'s ({entities} entiteiten, {concepts} concepten, {sources} bronnen){indexStatus}',
    lintWikiStart: 'De lintcontrole van de wiki begint...',
    lintWikiComplete: 'De lintcontrole is klaar',
    lintWikiFailed: 'De lintcontrole is mislukt',
    analyzingSchema: 'De wiki wordt bekeken en er worden voorstellen voor het schema gemaakt...',
    schemaSuggestionGenerated: 'De voorstellen voor het schema staan in wiki/schema/suggestions.md',
    noSchemaUpdateNeeded: 'Het schema hoeft niet te worden aangepast.',
    schemaSuggestionFailed: 'Het maken van voorstellen voor het schema mislukte',
    // v1.22.0 #97: Schema diff Modal — IDE-style preview + Apply/Regenerate
    schemaDiffTitle: 'Voorbeeld van de wijziging in het schema',
    schemaDiffSummary: '+{add} / -{del} regels',
    schemaDiffRegenerateLabel: 'Het voorstel verfijnen (optioneel):',
    schemaDiffRegenerateBtn: 'Opnieuw maken',
    schemaDiffOpenFileBtn: 'Bestand openen',
    schemaDiffApplyBtn: 'Toepassen',
    schemaDiffApplied: 'Het schema is bijgewerkt. Reservekopie: {path}',
    schemaDiffEmptyTitle: 'Er worden geen wijzigingen voorgesteld',
    schemaDiffFailed: 'Het toepassen van het schema mislukte: {reason}',
    schemaDiffRestoreHint: 'De reservekopie staat in {path}. Wil je terug, hernoem dat bestand dan in je bestandsbeheer naar "wiki/schema/config.md". Er blijven 3 reservekopieën bewaard.',
    schemaRegenerateNoBody: 'Het opnieuw maken lukte, maar de LLM gaf geen nieuwe inhoud terug.',
    schemaNotFoundNotice: 'Het schemabestand is er niet. Zet het schema aan om het te laten maken.',
    selectFolderNoMdFiles: 'Deze map bevat geen Markdown-bestanden: {path}',
    batchIngestSkipNotice: '{skipped} van de {total} bestanden zijn al ingelezen en worden overgeslagen. {new} nieuwe bestanden worden verwerkt...',
    batchIngestAllIngested: 'Alle {total} bestanden in deze map zijn al ingelezen.',
    batchIngestStarting: '{count} bestand(en) uit "{folder}" worden ingelezen — dat kan een paar minuten duren. Als het klaar is, verschijnt er een rapport.',
    batchIngestComplete: 'Inlezen in één keer klaar: {success}/{total} gelukt, {fail} mislukt',
    batchIngestFailedFiles: 'Bestanden die mislukten:',
    historyTruncated: 'De geschiedenis is teruggebracht tot de laatste {max} rondes',
    historyCleared: 'De geschiedenis is gewist',

    // User Feedback Loop
    reviewedPagePreserved: 'Inhoud die je zelf hebt nagekeken blijft bewaard voor: {}',

    // Query-to-Wiki feedback
    querySuggestSaveTitle: 'Naar de wiki opslaan?',
    querySuggestSaveDesc: 'Dit gesprek bevat kennis die de moeite waard is. Wil je het in je wiki opslaan?',
    querySuggestSaveYes: 'Opslaan',
    querySuggestSaveNo: 'Niet nu',

    // Ingestion Report
    ingestReportElapsedTime: 'Verstreken tijd',
    ingestReportSkippedFiles: 'Overgeslagen (al ingelezen)',
    ingestReportRejectedFiles: 'Overgeslagen',
    rejectionReasonEmpty: 'leeg',
    rejectionReasonType: 'type wordt niet ondersteund',
    rejectionReasonDuplicate: 'inhoud bestaat al',
    rejectionReasonPdfUnsupported: 'de provider kan PDF niet lezen',
    rejectionReasonMineruPageLimit: 'meer pagina\'s dan MinerU aankan',
    rejectionReasonMineruSizeLimit: 'groter dan MinerU aankan',
    ingestReportFailedGuidance: 'Deze onderdelen konden niet automatisch worden gemaakt. Je kunt de pagina\'s zelf aanmaken, of de hoeveelheid per bron lager zetten en het bronbestand opnieuw inlezen.',

    // Command Names (sentence case per Obsidian Bot rule 1)
    cmdIngestSource: 'Eén bron inlezen',
    cmdIngestFolder: 'Een map inlezen',
    cmdIngestMultipleFiles: 'Meerdere bestanden inlezen',
    cmdQueryWiki: 'Wiki bevragen',
    cmdLintWiki: 'Wiki controleren',
    cmdRegenerateIndex: 'Index opnieuw maken',
    cmdSuggestSchema: 'Voorstellen voor het schema',
    cmdCancelIngestion: 'Inlezen stoppen',
    cmdIngestActiveFile: 'Huidig bestand inlezen',
    cmdViewHistory: 'Geschiedenis van handelingen',
    noActiveFile: 'Er is geen bestand open',
    mdOnlyFile: 'Alleen Markdown-bestanden kunnen worden ingelezen',

    // v1.26.3 PATCH (B2.5 follow-up): single-file ingest + batch-check
    // Toasts. These feed showProgressFor → persistent Notice (Toast), which
    // is separate from the status-bar channel — they were hardcoded English
    // ('Ingesting: <file>', 'Checking for already-ingested files...'),
    // producing English Toasts on non-English vaults.
    ingestSingleFileStart: 'Bezig met inlezen: {filename}',
    ingestCheckingExisting: 'Er wordt gekeken welke bestanden al zijn ingelezen...',
    // Auto-lint completion Notice ("N findings" phrase — full phrase so
    // each locale can order/pluralize freely).
    lintFindingsSummary: '{total} bevindingen',

    // Ingestion status bar
    ingestionStatusBar: 'Bezig met inlezen... klik om te stoppen',
    lintStatusBar: 'Bezig met controleren... klik om te stoppen',
    ingestStatusAnalyzing: 'Bezig met inlezen… (klik om te stoppen)',
    lintStatusAnalyzing: 'Bezig met controleren… (klik om te stoppen)',
    // v1.25.11 PATCH #169 — fine-grained stage hints for the status bar.
    // These labels are ADD-only emission sandwiched between the page name
    // and the always-visible base label (e.g. "My Note · Generating summary ·
    // Ingesting… (click to cancel)"). They never replace the base label, so
    // the cancel affordance is preserved through every long-running stage.
    ingestStageAnalyze: 'Bron wordt bekeken',
    ingestStageSummary: 'Samenvatting wordt gemaakt',
    ingestStageEntity: 'Entiteit wordt gemaakt',
    ingestStageConcept: 'Concept wordt gemaakt',
    ingestStageRetry: 'Mislukte pagina wordt opnieuw geprobeerd',
    ingestStageSave: 'Pagina\'s worden opgeslagen',
    ingestStageIndex: 'Index wordt gemaakt',
    pdfStageReading: 'PDF wordt gelezen',
    pdfStageConverting: 'PDF wordt omgezet',
    pdfStageSidecar: 'Hulpbestand wordt geschreven',
    lintStagePrep: 'Pagina\'s worden gelezen',
    lintStageProgrammatic: 'Koppelingen worden nagelopen',
    lintStageAnalyzing: 'De LLM analyseert de wiki',
    lintStageDedup: 'Dubbele pagina\'s worden gezocht',
    lintStageContradiction: 'Tegenstrijdigheden worden gezocht',
    ingestionCancelling: 'Stoppen — de huidige ronde wordt nog afgemaakt',
    ingestionCancelled: 'Het inlezen is gestopt',
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
    ingestBatchInitial: 'Ronde 1 van {total} wordt bekeken...',
    ingestBatchProgress: 'Ronde {current} van {total} wordt bekeken ({entities} entiteiten en {concepts} concepten tot nu toe)...',
    ingestBatchProcessed: 'Ronde {current} is bekeken, verwerken...',
    ingestAnalyzing: 'Bezig met bekijken: {filename}',
    ingestCreatingSummary: '[{step}/{totalSteps}] Samenvatting wordt gemaakt...',
    ingestCreatingItem: '[{step}/{totalSteps}] {type}: {name}',
    ingestUpdating: '[{step}/{totalSteps}] Bijwerken: {name}',
    ingestGeneratingIndex: '[{step}/{totalSteps}] Index wordt gemaakt...',
    ingestItemTypeEntity: 'Entiteit',
    ingestItemTypeConcept: 'Concept',
    convAnalyzing: 'Het gesprek wordt bekeken...',
    convCheckingExisting: 'Er wordt gekeken of deze kennis al bestaat...',
    convAlreadyExists: 'Deze kennis staat al in de wiki',
    convCreatingSummary: 'De samenvattingspagina wordt gemaakt...',
    convGeneratingSummary: 'De samenvattingspagina wordt gemaakt...',
    convSavingEntity: 'Entiteit wordt opgeslagen: {name}',
    convSavingConcept: 'Concept wordt opgeslagen: {name}',
    convGeneratingIndex: 'Index wordt gemaakt...',

    // Lint Report
    lintReportTitle: 'Rapport van de lintcontrole',
    lintReportSummary: 'Stand van de wiki: {total} pagina\'s in totaal, {aliasesMissing} pagina\'s zonder aliassen, {duplicates} dubbele pagina\'s, {deadLinks} koppelingen naar niet-bestaande pagina\'s (waarvan {deadLinkFromDup} met een dubbele pagina te maken hebben), {orphans} verweesde pagina\'s ({orphanFromDup} daarvan zijn dubbel), {emptyPages} lege pagina\'s, {ungroundedQuotes} citaten zonder bron in de tekst, {tagViolations} tags buiten de lijst. De controle duurde {elapsedSeconds}s',

    // Advanced LLM Settings (v1.20.0: default = no provider-specific overrides).
    // v1.26.0 (#382 item 2): renamed advancedSettingsModeName →
    // advancedLlmModeName so the label scopes to LLM sampling params and is
    // not confused with the generic bottom "Advanced settings" panel.
    advancedLlmModeName: 'Geavanceerde LLM-parameters',
    advancedLlmModeDesc: 'De standaardmodus volgt wat de provider van het model aanraadt. Kies Eigen alleen als je een goede reden hebt om daarvan af te wijken, bijvoorbeeld omdat een model een vaste temperatuur nodig heeft of omdat je de redenering van het model wilt onderdrukken.',
    advancedSettingsDefault: 'Standaard (provider volgen)',
    advancedSettingsCustom: 'Eigen (provider overschrijven)',
    // v1.26.0 (#382 item 2): bottom "Advanced settings" panel — generic
    // home for all advanced-user settings that are NOT LLM sampling params
    // (those live under advancedLlmModeName above). Off by default; the
    // toggle reveals lint thresholds, the Welcome note, and future knobs.
    advancedSettingsSection: 'Geavanceerde instellingen',
    showAdvancedSettingsName: 'Geavanceerde instellingen tonen',
    showAdvancedSettingsDesc: 'Zet dit aan om de geavanceerde instellingen hieronder te zien. Uitzetten verbergt ze en zet ze terug op de standaardwaarden.',
    disableThinkingName: 'Redeneren uitzetten',
    disableThinkingDesc: 'Zet de redenering van het model in het antwoord uit. Standaard uit: het model beslist zelf of het zijn redenering laat zien, en dat geeft meestal het beste antwoord. Zet dit alleen aan als je provider ruwe redeneringen in het antwoord zet en je een schoon antwoord wilt.',
    thinkingEffortName: 'Niveau van redeneren',
    thinkingEffortDesc: 'Hoeveel het model mag redeneren, voor providers die zo\'n instelling hebben. Standaard wordt er niets meegestuurd en kiest het model zelf. Een hoger niveau kan een beter antwoord geven en kost altijd meer tokens en tijd. Providers vertalen het niveau op hun eigen manier, dus dezelfde naam kan bij verschillende modellen iets anders betekenen.',
    thinkingEffortDefault: 'Standaard (provider beslist)',
    thinkingEffortLow: 'Laag',
    thinkingEffortMedium: 'Gemiddeld',
    thinkingEffortHigh: 'Hoog',
    taskPoliciesPlaceholder: 'Voorbeeld: extract=text:off',
    taskPoliciesName: 'Uitvoermodus en redeneren per stap',
    taskPoliciesDesc: 'Eén regel per stap in de pijplijn, `stap=modus:redeneren`, met komma\'s gescheiden, bijv. `extract=text:off`. Modi: `-` (laten staan), `schema`, `json`, `text`; redeneren: `-`, `off`, `on`, `low`, `medium`, `high`. Stapnamen zijn onder meer extract, extract-retry, lemma-classify, merge-triage, source-stance, dedup, page-generate, related-page en lint-dedup; een verkeerd gespelde naam past nergens op. Laat leeg voor de ingebouwde basis (extraheren in tekstmodus). Een regel die niet te lezen is, wordt niet opgeslagen.',
    // Issue #137: compatibility hints for advanced settings (kept short; no
    // provider list to avoid maintenance burden when providers change).
    extractionTemperatureName: 'Temperatuur bij extraheren',
    extractionTemperatureDesc: 'Bepaalt hoe vrij of juist hoe trouw het model entiteiten- en conceptpagina\'s schrijft. Lager betekent vaster en feitelijker, hoger betekent meer variatie. De meeste gebruikers laten dit leeg.',
    chatTemperatureName: 'Temperatuur bij vragen',
    chatTemperatureDesc: 'Hetzelfde idee als bij extraheren, maar dit geldt alleen voor de antwoorden in Query Wiki. Lager betekent letterlijker, hoger betekent meer als een gesprek. De meeste gebruikers laten dit leeg.',
    repetitionPenaltyName: 'Straf op herhaling',
    repetitionPenaltyDesc: 'Ontmoedigt het model om dezelfde woorden of zinnen te herhalen. Hoger betekent minder herhaling. Alleen sommige providers van lokale modellen (Ollama, LM Studio, llama.cpp) gebruiken dit; providers in de cloud negeren het zonder melding. De meeste gebruikers laten dit leeg. Waarden boven 1,0 kunnen bij kleine lokale modellen fouten in de uitvoer geven tijdens het extraheren; mislukt een ronde, verlaag of wis deze waarde dan.',
    repetitionPenaltyErrorHint: 'Let op: er staat een eigen straf op herhaling van {value}. Waarden boven 1,0 kunnen het extraheren met een vastgelegde grammatica bij kleine lokale modellen breken. Verlaag of wis deze instelling en probeer het opnieuw.',
    temperaturePlaceholder: 'leeg laten = standaard van de provider',
    // v1.26.0 (#382 item 2): Lint dedup threshold overrides (bottom
    // "Advanced settings" panel, showAdvancedSettings toggle on). The
    // "leave blank" placeholder above is reused so the input row reads the
    // same as the temperature rows in the Advanced section.
    lintDedupJaccardLinkThresholdName: 'Gelijkheid van koppelingen',
    lintDedupJaccardLinkThresholdDesc: 'Bereik 0–1 (standaard 0,4). Twee pagina\'s gelden als dubbel als de wiki-links waar ze beide naar wijzen voor minstens dit deel overlappen. Lager betekent meer bijna-dubbelen vinden, ook pagina\'s die alleen dezelfde veelgebruikte pagina\'s noemen; hoger betekent alleen pagina\'s die naar bijna dezelfde set wijzen. Verhoog dit als je onterechte meldingen ziet tussen pagina\'s die toevallig naar dezelfde pagina wijzen. Leeg laten geeft de standaardwaarde.',
    lintDedupJaccardBodyGateName: 'Minimale gelijkheid van de tekst',
    lintDedupJaccardBodyGateDesc: 'Bereik 0–1 (standaard 0,2). Ook als twee pagina\'s dezelfde wiki-links hebben, gelden ze pas als dubbel als hun tekst voor minstens dit deel overeenkomt. Lager betekent dat meer kandidaten naar de LLM gaan; hoger betekent dat alleen bijna gelijke teksten worden gemeld. Verhoog dit als de LLM pagina\'s te zien krijgt die duidelijk niet dubbel zijn. Leeg laten geeft de standaardwaarde.',
    lintDedupBigramThresholdName: 'Gelijkheid van titels',
    lintDedupBigramThresholdDesc: 'Bereik 0–1 (standaard 0,4). Twee pagina\'s gelden als dubbel als de tekens in hun titels of aliassen voor minstens dit deel overlappen. Lager betekent dat schrijfvarianten, typefouten en vertalingen van hetzelfde begrip worden gevonden; hoger betekent alleen bijna gelijke titels. Verhoog dit als de LLM pagina\'s bekijkt met heel verschillende namen die niet dubbel zijn. Leeg laten geeft de standaardwaarde.',
    lintDeadLinkSection: 'Koppelingen naar niet-bestaande pagina\'s (gevonden) [{count}]',
    lintEmptyPageSection: 'Lege pagina\'s (gevonden) [{count}]',
    lintOrphanSection: 'Verweesde pagina\'s (gevonden) [{count}]',
    lintContradictionSection: 'Tegenstrijdigheden (gevonden)',
    lintDuplicateSection: 'Dubbele pagina\'s (gevonden)',
    lintPollutedSection: 'Vervuilde pagina\'s (gevonden) [{count}]',
    lintPollutedItem: '- [[{page}]] → hoort "{clean}" te zijn',
    lintSourcesNormalizedSection: 'Bronnen opgeschoond (automatisch hersteld) [{files} bestanden / {entries} regels]',
    lintSourcesNormalizedItem: '{entries} vervuilde bronregels opgeschoond in {files} bestand(en): externe paden, .md-uitgangen en alias-scheidingstekens zijn weggehaald en dubbelen zijn samengevoegd.',
    lintNoIssuesFound: 'Geen dubbele pagina\'s, koppelingen naar niet-bestaande pagina\'s, lege pagina\'s, verweesde pagina\'s of citaten zonder bron in de tekst gevonden.',
    lintSourceDriftSection: 'Bronnotities die na het inlezen zijn gewijzigd [{count}]',
    lintSourceDriftItem: '- [[{page}]] — de oorspronkelijke notitie [[{note}]] is na het inlezen gewijzigd; de pagina is mogelijk verouderd',
    lintSourceDriftLinksOnlySection: 'Bronnotities waarvan alleen de koppelingen veranderden [{count}]',
    lintSourceDriftLinksOnlyItem: '- [[{page}]] — in [[{note}]] zijn alleen de paden van koppelingen veranderd (een pagina is verplaatst); de samenvatting is niet verouderd',
    lintContradictionMarkerSection: 'Pagina\'s met een teken van tegenstrijdigheid [{count}]',
    lintContradictionMarkerItem: '- [[{page}]] — bron(nen) die elkaar tegenspreken: {sources}; kijk ernaar en haal het teken contradictions: weg als het is opgelost',
    lintQuoteGroundingSection: 'Citaten zonder bron in de tekst (gevonden) [{count}]',
    lintQuoteGroundingItem: '- [[{page}]]{sourceHint}: "{quote}"',
    lintDeadLinkItem: '- [[{source}]] → **{target}** (deze pagina bestaat niet){dupFlag}',
    lintDeadLinkMore: '- ... nog {count} koppelingen naar niet-bestaande pagina\'s',
    lintEmptyPageItem: '- [[{page}]] — minder dan 50 tekens met inhoud',
    lintOrphanItem: '- [[{page}]] — geen enkele andere wikipagina wijst hierheen{dupFlag}',
    lintDuplicateItem: '- [[{target}]] en [[{source}]] — {reason}',
    lintDeadLinkAffectedByDup: ' (⚠️ met een dubbele pagina)',
    lintOrphanIsDuplicate: ' (⚠️ dubbele pagina)',
    lintHubLinkDensitySection: 'Knooppunten met te veel koppelingen [#157 / #175] [{count}]',
    lintCrystallizedHubsSection: 'Uitgekristalliseerde knooppunten [{count}]',
    lintCrystallizedHubsIntro: 'De buren van dit knooppunt wijzen nu naar elkaar, dus het knooppunt draagt niets meer. Als je knooppunten met de hand merkt, is de rol van dit knooppunt voorbij. De plug-in negeert dat teken en verandert niets. De bovenste {topN} knooppunten op aantal koppelingen zijn bekeken.',
    lintCrystallizedHubRow: '{path} — {degree} koppelingen, Percentiel van samenhang {percentile}%',
    lintHubLinkDensityItem: '- [[{page}]] — {inDegree} inkomende koppelingen, {relatedCount} verwante koppelingen, onderscheidend vermogen {distinctiveness} → {recommendation}{lowTargets}',
    lintHubLinkDensityStrip: '⚠️ weghalen',
    lintHubLinkDensityReview: '🔍 nakijken',
    lintHubLinkDensityKeep: '✅ houden',
    lintHubLinkDensitySummary: 'Samenvatting: bij {strip} pagina(\'s) is weghalen aangeraden, bij {review} pagina(\'s) nakijken.',
    lintHubLinkDensityIntro: 'Dit meet de uitgaande koppelingen van het knooppunt: wijzen ze naar pagina\'s die de buren al dekken? De lijst met uitgekristalliseerde knooppunten meet iets anders, namelijk of de buren naar elkaar wijzen. De twee lijsten kunnen verschillende pagina\'s noemen en de een volgt niet uit de ander.',
    lintHubLinkDensityNoRelated: ' (geen sectie ## Related gevonden)',
    lintContradictionOpen: 'Openstaande tegenstrijdigheden: {count}',
    lintContradictionItem: '- [{status}] [[{page}]] — {claim}',
    lintContradictionStatusDetected: 'Gevonden',

    // Lint Analysis Prompt

    // Lint Fix Progress
    lintFixProgress: 'Bezig met herstellen {current}/{total}: [[{target}]]',
    lintFixDeadComplete: 'Koppelingen naar niet-bestaande pagina\'s hersteld. {fixed}/{total} onderdelen gedaan.',
    lintFillProgress: 'Bezig met aanvullen {current}/{total}: {page}',
    lintFillComplete: 'Pagina\'s aangevuld. {filled}/{total} pagina\'s gevuld.',
    lintDeleteCompleted: '{count} lege pagina\'s zonder inhoud verwijderd',
    lintDeleteFailed: '{failed}/{total} lege pagina\'s zonder inhoud konden niet worden verwijderd (zie de console)',
    lintFillFailed: 'Aanvullen mislukte: {page} — {error}',
    lintLinkProgress: 'Bezig met koppelen {current}/{total}: {page}',
    lintLinkComplete: 'Verweesde pagina\'s gekoppeld. {linked} pagina\'s gekoppeld.',
    lintFixNoAction: 'Er is niets gedaan (geen client)',
    lintFixIndexUpdated: 'De index van de wiki en het logboek zijn bijgewerkt.',
    lintFixAllComplete: 'Alle herstellingen zijn klaar. Zie het logboek voor details.',
    lintFixAllNoChanges: 'Er is niets veranderd: elke fase meldde 0 herstellingen. Zie wiki/log.md voor details.',
    lintFixPhasesLabel: 'fasen aangepast',
    lintPollutedFixed: 'Vervuilde pagina\'s hersteld: {fixed}/{total}. De index is opnieuw gemaakt.',
    regenerateIndexCompleted: 'De index is opnieuw gemaakt',
    operationFailed: 'Mislukt: ',

    // Lint Report Modal
    lintModalActionsTitle: 'Voorgestelde herstellingen (kost LLM-tokens):',
    lintLogReference: 'Het volledige rapport staat in log.md',
    lintModalFixDeadLinks: 'Koppelingen naar niet-bestaande pagina\'s herstellen ({count})',
    lintModalExpandEmpty: 'Lege pagina\'s aanvullen ({count})',
    lintModalDeleteEmpty: 'Lege pagina\'s zonder inhoud verwijderen ({count})',
    lintModalLinkOrphans: 'Verweesde pagina\'s koppelen ({count})',
    lintModalAnalyzeSchema: 'Schema bekijken',
    lintModalMergeDuplicates: 'Dubbele pagina\'s samenvoegen ({count})',
    lintModalFixAll: 'Alles slim herstellen ({count} problemen)',
    lintMergeProgress: 'Bezig met samenvoegen {current}/{total}: {source} → {target}',
    lintMergeComplete: 'Samenvoegen klaar. {merged}/{total} paren samengevoegd.',

    // Ingest Report Modal
    ingestReportTitle: 'Rapport van het inlezen',
    ingestReportSourceFile: 'Bron',
    ingestReportCreated: 'Gemaakt',
    ingestReportUpdated: 'Bijgewerkt',
    ingestReportContradictions: 'Gevonden tegenstrijdigheden',
    ingestReportFailedTitle: 'Inlezen mislukt',
    ingestReportErrorDetail: 'Details van de fout',
    ingestReportClose: 'Sluiten',
    ingestReportCreatedPages: 'Gemaakte pagina\'s: {count}',
    ingestReportUpdatedPages: 'Bijgewerkte pagina\'s: {count}',
    ingestReportEmbeddedImages: 'Afbeeldingen in de notitie: {analyzed}/{discovered} bekeken; {sent} verstuurd uit {queued} in de wachtrij, in {packages} pakket(ten); {gifs} eerste beeld(en) van GIF\'s omgezet; {failed} pakket(ten) mislukt',
    ingestReportEmbeddedEvidenceSaved: 'Het beeldmateriaal is op de bronpagina bewaard',
    ingestReportEmbeddedImageSkipped: 'Afbeeldingen in de notitie zijn overgeslagen',
    embeddedImagesVisionUnsupported: 'Dit eindpunt weigerde de beelden te bekijken. Het inlezen van tekst gaat door; gebruik een model dat beelden kan zien of zet het bekijken van afbeeldingen uit.',
    // v1.22.2: log.md header content (Operation History Panel hint)
    logHeaderTitle: 'Logboek van de wiki',
    logHeaderSubtitle: 'Elke keer inlezen, elke lintcontrole en elke onderhoudshandeling wordt hier automatisch vastgelegd. Het paneel **Geschiedenis van handelingen** werkt prettiger:',
    logHeaderShortcut: (cmd: string) => `Cmd+P → "${cmd}"`,
    logHeaderSettingsShortcut: 'Of open het via Instellingen → Automatisch onderhoud → Geschiedenis van handelingen',
    // v1.22.2: concise per-file ingest summary labels for Notice (no modal)
    ingestionCreatedPages: '{count} pagina(\'s) gemaakt',
    ingestionUpdatedPages: '{count} pagina(\'s) bijgewerkt',
    ingestionNoticeHistoryHint: 'Zie de geschiedenis van handelingen voor details.',
    ingestReportEntitiesCount: '{count} entiteiten',
    ingestReportConceptsCount: '{count} concepten',
    ingestReportContradictionsFound: 'Gevonden tegenstrijdigheden: {count}',
    ingestReportEntityType: 'Entiteit',
    ingestReportConceptType: 'Concept',
    timeMinutes: 'min',
    timeSeconds: 'sec',

    // Rate Limit Warnings
    rateLimitDetected: '⚠️ Limiet van de provider bereikt: {count} pagina(\'s) faalden met fout 429. Probeer dit: (1) zet de gelijktijdigheid op {suggestedConcurrency} of op 1 (één voor één), (2) verhoog de pauze tussen rondes naar {suggestedDelay} ms, (3) stap over naar een provider met ruimere limieten.',
    rateLimitDetectedShort: '⚠️ Limiet van de provider bereikt — verlaag de gelijktijdigheid of verhoog de pauze tussen rondes bij Instellingen → Inlezen versnellen.',

    // Long source warning
    sourceRejectedEmpty: '⏭️ "{filename}" heeft geen inhoud om in te lezen en is overgeslagen. Lege notities of notities met alleen frontmatter leveren geen wikipagina\'s op.',
    sourceRejectedType: '⏭️ "{filename}" is overgeslagen: dit bestandstype wordt niet ondersteund. Alleen tekstnotities (zoals .md en .txt) kunnen worden ingelezen.',
    sourceRejectedDuplicate: '⏭️ "{filename}" is overgeslagen — de inhoud staat al in de wiki.',
    // v1.25.0 PDF Level 1 (cache-only architecture)
    pdfReadingInProgress: 'PDF wordt gelezen: {filename}',
    sourceRejectedPdfUnsupported: '⏭️ "{filename}" is overgeslagen — je huidige provider of model accepteert geen PDF. Stap over naar een andere provider, zet bij Instellingen → LLM-configuratie → Geavanceerd "PDF altijd proberen" aan, of kies MinerU als omzetter (die doet ook afbeeldingen en Office-bestanden).',
    clearPdfCacheCommand: 'Cache van PDF-omzetting wissen',
    pdfCacheCleared: 'De cache van PDF-omzetting is gewist ({count} onderdelen verwijderd).',
    // v1.25.0 PR3: Advanced PDF settings
    forcePdfSupportName: 'PDF altijd proberen',
    forcePdfSupportDesc: 'Standaard uit. Zet dit aan als je provider niet als geschikt staat vermeld maar wel PDF aankan. Als het aan staat, gaat de PDF naar je huidige provider; wordt hij geweigerd, dan zie je dat duidelijk. Providers die PDF zelf aankunnen (Anthropic, OpenAI, Bedrock) hebben dit niet nodig.',
    writePdfMarkdownToVaultName: 'Omgezette Markdown in de kluis opslaan',
    writePdfMarkdownToVaultDesc: 'Standaard uit. Staat dit aan, dan komt het resultaat van elke PDF-omzetting in een bestand "<basename>.pdf.md" naast de PDF. Staat het uit, dan blijft het resultaat alleen in de cache van de plug-in staan en laat het niets in je kluis achter.',
    analyzeEmbeddedImagesName: 'Afbeeldingen in notities bekijken bij het inlezen',
    analyzeEmbeddedImagesDesc: 'Standaard uit. Bekijkt elke geschikte lokale afbeelding in pakketten van 20 MiB; één afbeelding mag hoogstens 10 MiB zijn. Afbeeldingen op het internet worden nooit opgehaald.',
    streamIngestName: 'Verzoeken om in te lezen streamen',
    streamIngestDesc: 'Hoe verzoeken om in te lezen bij het model komen. Auto streamt op mobiel, omdat een mobiel platform een verzoek kan afbreken dat niets terugkrijgt terwijl het model nog bezig is; op de desktop, waar die grens niet bestaat, wordt het antwoord in één keer opgehaald. Streamen houdt de verbinding bezig, zodat een lange generatie niet stil wordt afgebroken. Het is niet sneller en het verstuurt een veelvoud aan bytes, al scheelt een proxy die de reeks gebeurtenissen comprimeert daarin. Altijd streamt op elk platform, voor een traag lokaal model achter een proxy met een eigen tijdslimiet. Nooit haalt overal in één keer op, voor wie op mobiel een databundel heeft en aanvaardt dat een lange aanroep op mobiel mislukt.',
    streamIngestAuto: 'Auto (aanbevolen)',
    streamIngestAlways: 'Altijd',
    streamIngestNever: 'Nooit',
    ingestHintReasoning: 'Het model heeft zijn hele budget aan redeneren besteed, dus er bleef geen antwoord over. Zet het redeneren voor deze stap uit, verlaag het niveau van redeneren, of verhoog "Maximum aantal uitvoertokens per aanroep" bij de geavanceerde LLM-parameters.',
    ingestHintMaxTokens: 'Het model weigerde de waarde voor max_tokens. Verlaag "Maximum aantal uitvoertokens per aanroep" bij de geavanceerde LLM-parameters.',
    ingestHintContextWindow: 'Het bronbestand is te groot voor het contextvenster van dit model. Gebruik een model met een groter venster of deel het bestand op.',
    ingestHintBadRequest: 'De API weigerde het verzoek. Controleer of de modelnaam bij deze provider hoort.',
    ingestHintAuth: 'Aanmelden mislukte. Controleer je API-sleutel bij de instellingen.',
    ingestHintRateLimit: 'De limiet van de provider is bereikt. Wacht even of stap over naar een provider met ruimere limieten.',
    ingestHintMobileTimeout: 'Het verzoek bleef te lang stil en het mobiele platform sloot het. Verzoeken om in te lezen streamen als de provider dat toelaat, dus waarschijnlijk houdt een proxy of de provider het antwoord tegen. Zet het bufferen van antwoorden op de proxy uit, of gebruik een model dat streamt.',
    ingestHintDesktopTimeout: 'Het verzoek liep af zonder dat er gegevens kwamen. Controleer het adres van de provider en elke proxy ervoor. Sluit een proxy stille verbindingen, zet dan "Verzoeken om in te lezen streamen" op Altijd (geavanceerde instellingen).',
    ingestHintStreamingOff: 'Het streamen bij inlezen staat uit. Een gebufferd verzoek stuurt niets tot het hele antwoord klaar is, dus sluit het mobiele platform het eerder. Zet "Verzoeken om in te lezen streamen" op Auto (geavanceerde instellingen).',
    ingestHintDefault: 'Controleer je netwerkverbinding, je API-sleutel en het adres van je provider bij de instellingen.',
    saveEmbeddedImageEvidenceName: 'Beeldmateriaal van afbeeldingen op de bronpagina bewaren',
    saveEmbeddedImageEvidenceDesc: 'Standaard uit. Bewaart per afbeelding de tekst eromheen en wat het beeldmodel zag, in een uitklapbare sectie van de bronpagina.',
    markdownConversionBackendName: 'Omzetter naar Markdown',
    markdownConversionBackendDesc: 'Native gebruikt de PDF-ondersteuning van je provider (beperkt: niet elke provider of elk model kan PDF aan, en het kost LLM-tokens). MinerU is een dienst op het internet — snel, gratis tot het dagelijkse tegoed op is, en het accepteert PDF, afbeeldingen en Office — maar je hebt een API-token nodig (vul dat hieronder in).',
    markdownConversionBackendNative: 'PDF en afbeeldingen via de provider',
    markdownConversionBackendMineru: 'MinerU via het internet',
    mineruApiTokenName: 'API-token van MinerU',
    mineruApiTokenDesc: 'Haal je token op via https://mineru.net/apiManage/token. MinerU accepteert bestanden tot 200 MB en tot 200 pagina\'s. Een token verloopt na ongeveer 90 dagen; vraag een nieuwe aan zodra een omzetting met fout 401 mislukt.',
    mineruTokenExpired: 'MinerU weigerde het API-token — het is waarschijnlijk verlopen (tokens gelden ongeveer 90 dagen). Haal een nieuw token via https://mineru.net/apiManage/token en werk de instelling bij.',
    mineruApiTokenPlaceholder: 'Plak hier het API-token van MinerU',
    mineruUploadingInProgress: 'PDF wordt naar MinerU verstuurd: {filename}',
    mineruWaitingInProgress: 'Wachten op de omzetting door MinerU: {filename}',
    mineruDownloadingInProgress: 'Het resultaat van MinerU wordt opgehaald: {filename}',
    markdownConversionComplete: 'Omzetten klaar: {filename}',
    markdownConversionCompleteSaved: 'Omzetten klaar — weggeschreven naar {path}: {filename}',
    mineruPageLimitRejected: '{filename} heeft meer pagina\'s dan MinerU aankan ({limit}) — deel het bestand en probeer opnieuw',
    mineruSizeLimitRejected: '{filename} is groter dan MinerU aankan ({limit} MB)',
    ingestRejectedSummary: '{count} bestand(en) overgeslagen (leeg, al aanwezig of een type dat niet wordt ondersteund).',
    reingestConfirmTitle: 'Dit bestand opnieuw inlezen?',
    reingestConfirmBody: 'De inhoud van "{filename}" staat al in de wiki. Toch opnieuw inlezen?',
    reingestConfirmYes: 'Opnieuw inlezen',
    reingestConfirmNo: 'Overslaan',
    // v1.26.0 (#382 item 1, Batch 2): sources participate in dedup by
    // default via the sourceFingerprint signal (body-hash equality). Off
    // here to exclude source pages from lint duplicate-detection.
    lintDedupIncludeSourcesName: 'Bronnen meenemen bij het zoeken naar dubbelen',
    lintDedupIncludeSourcesDesc: 'Standaard aan. Staat dit aan, dan gelden bronnen met precies dezelfde tekst tijdens de lintcontrole als dubbel. Zet het uit als je bronmateriaal onterechte meldingen oplevert.',
    legacyScorerName: 'Oude rangschikking bij vragen',
    legacyScorerDesc: 'Standaard uit. Staat dit aan, dan gebruikt het rangschikken van zoekresultaten de oudere, met de hand afgestelde methode in plaats van de nieuwere BM25F. Zet het aan als de resultaten na een update slechter werden.',
    // Issue #880: the answer context's token ceiling (bottom Advanced settings panel).
    queryContextBudgetName: 'Budget aan contexttokens',
    queryContextBudgetDesc: 'Begrenst het aantal tokens aan wikipagina\'s dat met één antwoord meegaat. Uit = 0. 8K past bij de meeste lokale omgevingen; verhoog het voor een groot model in de cloud. Pagina\'s die het laagst staan, vallen als eerste af.',
    // Issue #514: opt-in candidate gate (bottom Advanced settings panel).
    skipMentionOnlyCandidatesName: 'Kandidaten overslaan die alleen genoemd worden',
    skipMentionOnlyCandidatesDesc: 'Standaard uit. Staat dit aan, dan krijgt een geëxtraheerde entiteit of concept waarvan de naam niet in de lopende tekst van de notitie staat — niet aanwezig, of alleen tussen haakjes, in opsommingen of in korte lijstregels — geen pagina en geen volgende modelaanroep, en verdwijnt de naam uit de verwante lijsten van de andere kandidaten. Werkt voor talen met een woordgrensprofiel (Duits is gemeten; Engels, Frans, Spaans, Portugees en Nederlands zijn geschat); voor andere talen meldt het inlezen één keer dat het niet kan worden toegepast. Laat het uit voor een kluis met woordenlijsten of met notities in steekwoorden, waar elke genoemde term een pagina hoort te krijgen.',
    createStubsForUnresolvableLinksName: 'Lege pagina\'s maken voor koppelingen die nergens heen gaan',
    createStubsForUnresolvableLinksDesc: 'Standaard aan. Als Koppelingen naar niet-bestaande pagina\'s herstellen geen enkele bestaande pagina vindt, schrijft het een lege pagina en laat de koppeling daarheen wijzen — die wordt nooit door de LLM gevuld. Zet dit uit om zulke koppelingen te laten staan: ze blijven in elk lintrapport zichtbaar tot een echte bron ze definieert.',
    // v1.26.0 (#382 item 1, Batch 2): sub-heading for the dedup
    // sub-group at the bottom of the "Advanced settings" panel.
    lintDedupSectionHeading: 'Dubbele pagina\'s vinden',
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
    llmRetryRecoveredToast: 'LLM-taak: {count} ronde(s) moesten opnieuw omdat de provider even niet goed antwoordde. Zie de console voor details. Komt dit vaker voor, verlaag dan de gelijktijdigheid bij de providerinstellingen.',
    longSourceNotice: '📄 "{filename}" heeft {lines} regels ({size}). Lange teksten worden in rondes geëxtraheerd: de LLM leest het hele document in meerdere passes. Dat kan een paar minuten duren. Even geduld.',
    longSourceNoticeShort: '📄 Groot bestand gevonden ({lines} regels). Het inlezen kan even duren.',

    // Ingestion History Panel (#122) — UI keys
    historyButton: 'Geschiedenis van handelingen',
    historyButtonDesc: 'Bekijk wat je wiki de laatste tijd heeft doorgemaakt: wat er is ingelezen, de lintrapporten en andere wijzigingen',
    historyButtonOpen: 'Geschiedenis bekijken',
    historyModalTitle: 'Geschiedenis van handelingen',
    historyModalSubtitle: 'Recente handelingen in je LLM-wiki',
    historyEmpty: 'Er is nog niets vastgelegd. Lees een notitie in of draai een lintcontrole om hier iets te zien.',
    historyReadError: 'Het logboek kon niet worden gelezen: {error}',
    historyEntryKindIngest: 'Inlezen',
    historyEntryKindMaintenance: 'Onderhoud',
    historyEntryKindFix: 'Herstellen',
    historyEntryKindOther: 'Handeling',
    historyEntryTime: '{date} · {time}',
    historyEntryTimeNoTime: '{date}',
    historyEntrySource: 'Bron: {source}',
    historyEntrySourceUnknown: 'Inlezen zonder titel',
    historyEntryCreatedLabel: 'Gemaakt',
    historyEntryUpdatedLabel: 'Bijgewerkt',
    historyEntryCreatedCount: '{count} gemaakt',
    historyEntryUpdatedCount: '{count} bijgewerkt',
    historyEntryNoChanges: 'Geen pagina\'s gewijzigd',
    historyEntryContradictions: '⚠️ {count} tegenstrijdigheid of tegenstrijdigheden',
    historyEntrySectionCreated: 'Gemaakte pagina\'s',
    historyEntrySectionUpdated: 'Bijgewerkte pagina\'s',
    historyEntrySectionContradictions: 'Tegenstrijdigheden',
    historyEntrySectionDetails: 'Details',
    historyEntrySectionReport: 'Wat de controle vond',
    historyEntryOpenPage: 'Openen',
    historyEntryDetailsNoContradictions: 'Geen tegenstrijdigheden gevonden',
    historySearchPlaceholder: '🔍 Zoek op titel van de bron of op paginapad…',
    historyFilterAll: 'Alles',
    historyFilterIngest: 'Alleen inlezen',
    historyFilterMaintenance: 'Alleen onderhoud',
    historyFilterFix: 'Alleen herstellen',
    historyFilterContradictions: '⚠️ Met tegenstrijdigheden',
    historyRefreshButton: '⟳ Verversen',
    historyExpandDay: 'Klik om uit te klappen',
    historyCollapseDay: 'Klik om in te klappen',
    historyShowMore: '{count} oudere regels tonen',
    historyNoMatch: 'Geen enkele handeling past bij je zoekopdracht of filter.',
    historyCloseButton: 'Sluiten',
    historyLimit: 50,
    historyBadgeIngestShort: '📥',
    historyBadgeMaintenanceShort: '🔍',
    historyBadgeFixShort: '🔧',
    historyBadgeOtherShort: '📌',
    // KPI labels (Operation History Panel v2)
    historyKpiPages: 'Pagina\'s',
    historyKpiDeadLinks: 'Dode koppelingen',
    historyKpiOrphans: 'Verweesd',
    historyKpiEmpty: 'Leeg',
    historyKpiDuplicates: 'Dubbel',
    historyKpiTagViolations: 'Tagproblemen',
    historyKpiUnsourced: 'Zonder bron',
    historyKpiDuration: 'Duur van de controle',
    historyKpiDurationSec: '{seconds}s',
    // Operation History v3 — rich section rendering
    historySectionDeadLinks: 'Dode koppelingen ({count})',
    historySectionTagViolations: 'Tagproblemen ({count})',
    historySectionOrphans: 'Verweesde pagina\'s ({count})',
    historySectionEmptyPages: 'Lege pagina\'s ({count})',
    historySectionLlmAnalysis: 'Analyse door de LLM ({count})',
    historyDeadLinkSource: 'Bron',
    historyDeadLinkTarget: 'Ontbreekt',
    historyOpenInLog: 'Openen in log.md',
    historyShowMoreItems: 'Nog {count} tonen',
    historyTrendUp: '↗ {delta}',
    historyTrendDown: '↘ {delta}',
    historyTrendSame: '→ gelijk',
    historyChipContradiction: 'Tegenstrijdigheid',
    historyChipOutdated: 'Verouderd',
    historyChipMissing: 'Ontbreekt',
    historyChipStructure: 'Structuur',
    historySeverityHigh: 'Hoog',
    historySeverityMedium: 'Gemiddeld',
    historySeverityLow: 'Laag',
    historyPageTypeEntity: '📦 entiteit',
    historyPageTypeConcept: '💡 concept',
    historyPageTypeSource: '📄 bron',
    historyGlobalInsight: 'Je wiki heeft {dead} dode koppeling(en), {orphans} verweesde pagina(\'s) en {tags} tagprobleem of tagproblemen. De laatste controle duurde {duration}.',
    historyGlobalInsightClean: 'Je wiki is schoon — geen dode koppelingen, geen verweesde pagina\'s en geen tagproblemen gevonden.',
    historyGlobalInsightNoData: 'Er zijn nog geen onderhoudsrapporten — draai een lintcontrole om dit te vullen.',
    // v3.1 — modal title, subtitle w/ count, time-range filter
    historyModalHeaderTitle: 'Geschiedenis van handelingen',
    historyModalSubtitleWithCount: 'Recente handelingen in je LLM-wiki · {count} regels',
    historyTimeRangeAll: 'Alles',
    historyTimeRange1d: 'Afgelopen dag',
    historyTimeRange3d: 'Afgelopen 3 dagen',
    historyTimeRange1w: 'Afgelopen week',
    historyTimeRange1m: 'Afgelopen maand',
    // v3.1 — ingest metric cards
    historyIngestTotal: 'Pagina\'s in totaal',
    historyIngestByType: 'Per soort',
    historyIngestSource: 'Bronbestand',
    historyIngestNoTimestamp: 'Geen tijdstip',
    historyIngestFirstTime: 'Eerste keer ingelezen',
    historyIngestLatestTime: 'Laatste keer ingelezen',
    historyTimeRangeCustom: 'Eigen periode',
    historyCustomRangeFrom: 'Van',
    historyCustomRangeTo: 'Tot',
    historyCustomRangeApply: 'Toepassen',
    historyCustomRangeClear: 'Wissen',
    // v1.23.0 — first-run welcome note (Phase 5.1.5)
    welcomeNoteTierANotice: 'Karpathy Wiki: je kluis is leeg. Maak je eerste bronnotitie en kies Inlezen om te beginnen.',
    welcomeNoteTierBNotice: 'Karpathy Wiki: er is een welkomstnotitie gemaakt. Open hem om je domeinen te benoemen en 2-3 bronnotities te kiezen die de basis van het netwerk leggen.',
    welcomeNoteRecreateCommand: 'Welkomstnotitie van de wiki opnieuw maken',
    welcomeNoteRecreateCommandTooltip: 'Maakt de welkomstnotitie opnieuw aan als <wikiFolder>/Welcome.md, met de huidige domeinen en een test van de LLM-instellingen. Een bestaand bestand wordt overschreven.',
    welcomeNoteSettingsToggle: 'Bij de eerste keer een welkomstnotitie maken',
    welcomeNoteSettingsToggleDesc: 'Maakt bij de allereerste keer, als de wikimap leeg is, één pagina om mee te beginnen: <wikiFolder>/Welcome.md. Die legt uit wat LLM Wiki doet, vraagt je je domein te benoemen en leidt je langs het inlezen van je eerste 2-3 bronnotities. De notitie wordt standaard in het Engels geschreven, of in de taal van je wiki als de LLM is ingesteld. Zet dit uit als je de plug-in al kent en die uitleg niet in je kluis wilt.',
    welcomeNoteRunConfigTest: 'De welkomstnotitie is in het Engels geschreven. Ga naar Instellingen → LLM-provider → Verbinding testen om hem bij het opnieuw maken in jouw taal te krijgen.',
    welcomeNoteRecreated: 'De welkomstnotitie is opnieuw gemaakt in {path}',
    welcomeNoteNotRecreated: 'De welkomstnotitie is niet opnieuw gemaakt. Controleer de LLM-instellingen.',
    welcomeNoteGenerating: 'Welkomstnotitie: wordt op de achtergrond gemaakt — je krijgt een melding als het klaar is.',
    welcomeNoteGenerationFailed: 'Het maken van de welkomstnotitie mislukte: {error}',
    welcomeNoteFileName: 'Welkom bij Karpathy LLM Wiki',
    startupCheckWelcomePending: 'Welkomstnotitie: wordt op de achtergrond gemaakt (je krijgt een melding als het klaar is).',
    startupCheckWelcomeCreated: 'De welkomstnotitie is gemaakt in {path}',
    // v1.23.0 Phase 5.1.5: Multi-File Suggest modal (cmdIngestMultipleFiles).
    // The modal's title, hint, search placeholder, action buttons,
    // status labels and queue-empty placeholder all live here. Status
    // labels double as both the right-pane text and the data-attribute
    // keys for `updateLeftPaneSelections` to recognise, so they must
    // remain stable English strings.
    multiFileModalTitle: 'Meerdere bestanden inlezen',
    multiFileModalHint: 'Kies de bronnotities die je wilt inlezen. Rechts zie je de wachtrij en hoever het is.',
    multiFileSearchPlaceholder: 'Bestanden filteren op pad…',
    multiFileAddToQueue: 'Aan de wachtrij toevoegen',
    multiFileSelectAll: 'Alles kiezen',
    multiFileFileCount: '{count} bestand(en)',
    multiFileNoFilesAvailable: 'Er zijn geen bestanden om in te lezen.',
    multiFileNoFilesMatch: 'Geen bestand past bij "{q}".',
    multiFileQueueEmpty: 'De wachtrij is leeg. Vink links bestanden aan om ze toe te voegen.',
    multiFileStatusPending: 'In de wachtrij',
    multiFileStatusRunning: 'Bezig',
    multiFileStatusCompleted: 'Klaar',
    multiFileStatusFailed: 'Mislukt',
    multiFileCancelAria: 'Dit bestand overslaan',
    // #598: what the vault says about a row, resolved when the picker
    // opens. The queue only knows this session.
    multiFileRowIngested: 'Al ingelezen',
    multiFileRowDrifted: 'Notitie is gewijzigd na het inlezen',
    // v1.23.0 Phase 5.1.5: Multi-File Suggest modal action button
    // that removes every pending and running job from the ingest
    // queue. Completed and failed jobs are preserved so the user
    // still sees what happened.
    cancelAllQueueJobs: 'Alles stoppen',
} as const;
