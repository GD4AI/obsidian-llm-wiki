export const PL_TEXTS = {
    // Plugin Info
    pluginTitle: 'Ustawienia Karpathy LLM Wiki',
    pluginIntro: 'Ta wtyczka wprowadza do Obsidiana koncepcję {{link}}. Czyta twoje notatki, za pomocą AI wyodrębnia encje i pojęcia, a następnie buduje w twoim skarbcu uporządkowaną wiki z odsyłaczami.',
    karpathyLinkText: 'LLM Wiki Andreja Karpathy\'ego',

    // Features Section
    featuresTitle: 'Jak to działa',
    workflow1Title: '1. Wczytywanie',
    workflow1Desc: 'Wybierz notatkę. AI wyodrębnia z niej encje, pojęcia i zależności i zapisuje je na stronach wiki.',
    workflow2Title: '2. Pytania',
    workflow2Desc: 'Zadawaj pytania swojej wiki. Odpowiedzi opierają się na tym, co już wczytano.',
    workflow3Title: '3. Utrzymanie',
    workflow3Desc: 'Automatyczny indeks, wzajemne odsyłacze i kontrole lint utrzymują wiki w dobrej kondycji.',

    // Language Switcher
    languageTitle: 'Język interfejsu',
    languageDesc: 'Wybierz język panelu ustawień. Uruchom wtyczkę ponownie, aby zmiana objęła także paletę poleceń.',
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
    statusTitle: 'Stan klienta LLM',
    llmWikiStatusSection: 'Stan LLM Wiki',
    statusInitialized: 'Uruchomione',
    statusNotInitialized: 'Nie uruchomiono',
    statusReady: 'LLM gotowy',
    statusNotReady: 'LLM nieskonfigurowany — dokończ konfigurację i przejdź test połączenia',
    currentProvider: 'Obecny dostawca',

    // Provider Configuration
    providerSection: 'Konfiguracja LLM',
    providerName: 'Dostawca LLM',
    providerDesc: 'Wybierz gotowego dostawcę albo własną usługę zgodną z OpenAI. W przypadku pakietów takich jak Coding Plan wybierz Custom OpenAI/Anthropic i wpisz adres bazowy oraz klucz API dostawcy ręcznie',

    // API Key
    apiKeyName: 'Klucz API',
    apiKeyDesc: 'Klucz API. Przechowywany w menedżerze poświadczeń systemu, a nie w `data.json`.',
    apiKeyPlaceholder: 'Wpisz klucz API',
    // v1.25.4 #339: SecretStorage migration repair + failure Notice
    apiKeyMigrateToSecretStorageButton: 'Przenieś do SecretStorage',
    apiKeyMigratedToSecretStorageSuccess: 'Klucz API przywrócony z SecretStorage do ustawień.',
    apiKeyMigrationFailedNotice: 'Nie udało się zapisać klucza API w SecretStorage: {}',
    codexAuthName: 'Logowanie na plan ChatGPT',
    codexAuthDesc: 'Eksperymentalny dostęp do Codex przez OAuth, z twojego limitu w planie ChatGPT. Rozliczenia platformy OpenAI pozostają osobne.',
    codexAuthSignedOut: 'Nie zalogowano',
    codexAuthSignedIn: 'Zalogowano',
    codexAuthBrowserButton: 'Zaloguj się w przeglądarce',
    codexAuthDeviceButton: 'Użyj kodu jednorazowego',
    codexAuthDeviceInstructions: 'Wpisz ten kod na stronie OpenAI: {}',
    codexAuthCopyCode: 'Kopiuj kod',
    codexAuthSignOutButton: 'Wyloguj się',
    codexAuthBusy: 'Czekam na zgodę OpenAI...',
    codexAuthFailed: 'Logowanie do ChatGPT nie powiodło się: {}',
    codexAuthQuota: 'Limit Codex w planie ChatGPT został wyczerpany. Poczekaj do końca podanego okresu i spróbuj ponownie.',
    codexAuthExperimental: 'Funkcja eksperymentalna: dostępność zależy od logowania OpenAI Codex i zasad dotyczących modeli.',
    codexModelsRefreshName: 'Modele konta',
    codexModelsRefreshDesc: 'Pobierz listę modeli widocznych na liście wyboru z konta OpenAI Codex, na którym jesteś zalogowany.',
    codexModelsRefreshButton: 'Odśwież modele konta',
    codexModelsRefreshing: 'Odświeżanie...',
    codexModelsRefreshSuccess: 'Pobrano {} modeli konta.',
    codexModelsRefreshFailed: 'Nie udało się odświeżyć modeli konta; używana jest dostępna lista zapasowa. {}',

    // Base URL
    baseUrlName: 'Bazowy adres API',
    baseUrlDescCustom: 'Wymagane: adres twojej usługi zgodnej z OpenAI',
    baseUrlDescOverride: 'Opcjonalne: zastąp gotowy adres bazowy',

    // Issue #723: custom request headers (shown directly below the Base URL).
    customHeadersName: 'Własne nagłówki',
    customHeadersDesc: 'Jedna pozycja `Nazwa: wartość` w wierszu. Wysyłane z każdym żądaniem; puste wiersze i wiersze zaczynające się od `#` są pomijane.',
    customHeadersInvalid: '{} wierszy z błędem zostanie pominiętych.',

    // Ollama Hint
    ollamaHint: 'Ollama działa lokalnie, klucz API nie jest potrzebny',
    // LM Studio Hint
    lmstudioHint: 'LM Studio działa lokalnie, klucz API jest opcjonalny',

    // LLM execution cap
    maxTokensPerCallName: 'Maksymalna liczba tokenów wyjściowych na wywołanie',
    maxTokensPerCallDesc: 'Najwięcej, ile jedno wywołanie może napisać. Auto pyta model o jego własny limit; lokalny serwer, który go nie podaje, dostaje wartość domyślną wtyczki. Ta liczba podnosi i obniża to, co deklaruje wywołanie tworzące stronę, a tokeny rozumowania mieszczą się w tym samym limicie. To nie jest okno kontekstu.',
    contextWindowName: 'Okno kontekstu modelu',
    contextWindowDesc: 'Ile tokenów model trzyma naraz, wejście i wyjście razem. Gdy ta wartość jest ustawiona, odejmowany jest od niej prompt, więc odpowiedź nigdy nie przekracza tego, co zostało. Auto zostawia limit bez ograniczenia.',

    // Issue #111: slug casing
    slugCaseName: 'Wielkość liter w nazwach plików',
    slugCaseDesc: 'Decyduje, czy nazwy generowanych plików wiki są zapisywane małymi literami. "Zachowaj" jest zalecane w językach, w których małe litery zmieniają znaczenie, na przykład w rzeczownikach niemieckich.',
    slugCaseLower: 'Małe litery (domyślnie)',
    slugCasePreserve: 'Zachowaj wielkość liter',
    // Minimum alias length (Advanced settings, next to slug case).
    minAliasLengthName: 'Minimalna długość aliasu',
    minAliasLengthDesc: 'Aliasy krótsze niż ta wartość (po przycięciu spacji) nie są zapisywane na stronach wiki. Domyślna wartość 2 pozwala używać skrótów dwuliterowych (ML, AI, UI); ustaw 3, jeśli twój skarbiec zbiera aliasy różniące się tylko wielkością liter (Cr/CR). Zakres 2–6.',
    minAliasLengthClamped: 'Wartość poza zakresem (2–6), ustawiono {}',

    // Model Selection
    modelSection: 'Wybór modelu',
    fetchModelsName: 'Pobierz dostępne modele',
    fetchModelsDesc: 'Pobierz najnowszą listę modeli z API dostawcy',
    fetchModelsButton: 'Pobierz modele',
    fetchingModels: 'Pobieranie...',
    fetchSuccess: 'Udało się! Dostępnych modeli: {}',
    fetchFailed: 'Lista jest pusta lub pobranie się nie udało; wpisz nazwę modelu ręcznie',
    fetchNotSupported: 'Ten dostawca nie udostępnia listy modeli',
    fetchErrorAuth: 'Uwierzytelnianie nie powiodło się (HTTP 401/403). Sprawdź klucz API albo wpisz identyfikator modelu poniżej i kliknij Test połączenia.',
    fetchErrorEndpoint: 'Nie znaleziono adresu (HTTP 404). Sprawdź bazowy adres, albo wpisz identyfikator modelu i kliknij Test połączenia.',
    fetchErrorServer: 'Serwer dostawcy zwrócił błąd (HTTP 5xx). Spróbuj później albo wpisz identyfikator modelu i kliknij Test połączenia.',
    fetchErrorEmpty: 'Ten dostawca nie ma adresu z listą modeli. Wpisz identyfikator modelu poniżej i kliknij Test połączenia.',
    fetchErrorNetwork: 'Żądanie sieciowe nie powiodło się. Sprawdź połączenie z internetem, bazowy adres, ustawienia serwera proxy i klucz API. Możesz też wpisać identyfikator modelu poniżej i kliknąć Test połączenia.',

    selectModelName: 'Wybierz model',
    selectModelDesc: 'Wybierz spośród {} dostępnych modeli',
    customInputOption: 'Wpisz własny...',
    customInputHint: 'Aby użyć innego modelu, wybierz "Wpisz własny..."',

    modelName: 'Nazwa modelu',
    modelDescCustom: 'Używasz własnego modelu (kliknij przycisk powyżej, aby pobrać listę ponownie)',
    modelDescFetchFailed: 'Nie udało się pobrać listy modeli. Sprawdź klucz API i adres usługi, albo wpisz identyfikator modelu poniżej i kliknij Test połączenia.',
    modelInputPlaceholder: 'Wpisz identyfikator modelu, potem przetestuj połączenie',

    switchToDropdown: 'Wróć do listy wyboru',
    useDropdownButton: 'Użyj listy wyboru',

    // v1.24.0 #208: per-task model picker
    modelTaskModeName: 'Zakres wyboru modelu',
    modelTaskModeDesc: 'Wybierz, czy wszystkie zadania używają jednego modelu, czy każde ma własny (wczytywanie / lint / pytania). Wartości dla zadań pozostają zapisane po powrocie do jednego modelu.',
    modelTaskModeUnified: 'Jeden model do wszystkiego (domyślnie)',
    modelTaskModePerTask: 'Osobny model dla każdego zadania',
    perTaskIngestModelName: 'Model do wczytywania',
    perTaskIngestModelDesc: 'Używany do wczytywania notatek i rozmów, do utrzymania schematu oraz do tworzenia notatki powitalnej.',
    perTaskLintModelName: 'Model do lint',
    perTaskLintModelDesc: 'Używany do analizy lint, wykrywania duplikatów, zadań naprawiających i poprawiania osieroconych odsyłaczy.',
    perTaskQueryModelName: 'Model do pytań',
    perTaskQueryModelDesc: 'Używany do rozmowy w Query Wiki oraz do oceny przy zapisie do wiki.',

    // Test & Save
    testConnectionName: 'Test połączenia',
    testConnectionDesc: 'Sprawdź, czy konfiguracja pozwala wywołać API modelu',
    testButton: 'Test połączenia',
    testing: 'Testowanie...',

    saveSettingsName: 'Zapisz ustawienia',
    saveSettingsDesc: 'Zapisz obecną konfigurację',
    saveButton: 'Zapisz ustawienia',
    savedNotice: 'Ustawienia zapisane!',

    // v1.24.0 (Bug C 3.4 / plan C): gradual migration Notice — shown on
    // startup or after a mid-session wikiFolder change when chat history
    // contains links from a previous wiki folder.
    queryHistoryMigrationNotice: 'Historia Query Wiki zawiera odsyłacze z poprzedniego folderu wiki. Nowe pytania korzystają już automatycznie z najnowszego folderu. Aby odświeżyć wszystkie zapisane wiadomości, otwórz panel Query Wiki i kliknij tam przycisk czyszczenia historii.',

    // v1.24.0 Issue #251: Custom Query Instructions collapsible panel
    customInstructionsTitle: 'Własne instrukcje do pytań',
    customInstructionsDesc: 'Te instrukcje są dodawane do każdego promptu systemowego Query Wiki. Dotyczą tylko rozmowy w Query Wiki; wczytywanie, lint i tworzenie stron pozostają bez zmian.',
    customInstructionsPlaceholder: 'np. Potraktuj to jako badanie: szukaj szeroko, podawaj źródła i oddzielaj fakty od interpretacji...',
    customInstructionsApply: 'Zastosuj',
    customInstructionsClear: 'Wyczyść',
    customInstructionsCharCount: '{current}/{max} znaków',
    instructionsApplied: 'Własne instrukcje do pytań zapisane.',
    instructionsCleared: 'Własne instrukcje do pytań wyczyszczone.',

    // Test Connection
    testConnectionSuccessful: 'Połączenie działa',
    baseUrlUpdated: 'Bazowy adres ustawiony na {url}',
    testConnectionFailed: 'Połączenie nie powiodło się',
    testConnectionProvider: 'Dostawca: ',
    codexAuthRequired: 'Zaloguj się na plan ChatGPT, zanim przetestujesz połączenie.',
    bedrockSsoRequired: 'Najpierw zaloguj się przez AWS SSO (Ustawienia → Bedrock), potem przetestuj połączenie.',
    bedrockIamRequired: 'Najpierw wpisz klucze IAM (Ustawienia → Bedrock), potem przetestuj połączenie.',
    bedrockAuthMethodName: 'Uwierzytelnianie',
    bedrockAuthMethodDesc: 'Klucz API korzysta z klucza Bedrock; AWS SSO podpisuje żądania poświadczeniami IAM Identity Center; klucze IAM to stałe klucze dostępu.',
    bedrockAuthOptionApiKey: 'Klucz API',
    bedrockAuthOptionSso: 'AWS SSO',
    bedrockAuthOptionIam: 'Klucze IAM',
    bedrockSsoStartUrlName: 'Adres startowy SSO',
    bedrockSsoStartUrlDesc: 'Adres portalu twojej organizacji, np. https://d-xxxxxxxxx.awsapps.com/start',
    bedrockSsoAccountIdName: 'Identyfikator konta AWS',
    bedrockSsoAccountIdDesc: 'Konto o 12 cyfrach, którego rola zostanie przyjęta, np. 123456789012',
    bedrockSsoRoleNameName: 'Nazwa roli',
    bedrockSsoRoleNameDesc: 'Rola IAM przyjmowana na potrzeby dostępu do Bedrock, np. PowerUserAccess',
    bedrockSsoLoginButton: 'Zaloguj się przez AWS SSO',
    bedrockSsoSignOutButton: 'Wyloguj z AWS SSO',
    bedrockSsoStatusSignedIn: 'Zalogowano · wygasa {}',
    bedrockSsoStatusSignedOut: 'Nie zalogowano',
    bedrockSsoBusy: 'Trwa logowanie…',
    bedrockSsoUserCodeInstructions: 'Kod AWS SSO: {}. Otwórz odsyłacz i zatwierdź dostęp.',
    bedrockSsoCopyCode: 'Kopiuj kod',
    bedrockSsoFailed: 'Logowanie przez AWS SSO nie powiodło się: {}',
    bedrockSsoDetectedPrefill: 'Wykryte konto i rola: {}',
    bedrockIamKeyName: 'Identyfikator klucza dostępu',
    bedrockIamKeyDesc: 'Identyfikator klucza dostępu IAM, np. AKIA… lub ASIA…',
    bedrockIamSecretName: 'Tajny klucz dostępu',
    bedrockIamSecretDesc: 'Przechowywany wyłącznie w magazynie kluczy tego urządzenia, nigdy w data.json',
    bedrockIamSessionTokenName: 'Token sesji (opcjonalnie)',
    bedrockIamSessionTokenDesc: 'Potrzebny tylko dla poświadczeń tymczasowych (STS)',
    bedrockIamClearButton: 'Usuń zapisane klucze IAM',
    bedrockIamSaveFailed: 'Nie udało się zapisać kluczy IAM: {}',
    errorUnknown: 'Nieznany błąd',

    // Issue #137: LLM fallback notices (shown when thinking-dialect
    // fallback or param-stripping happens during a request).
    fallbackThinkingDialect: 'Sterowanie rozumowaniem: przełączono na wariant "{dialect}" (ten dostawca używa innego formatu tego sterowania). Odpowiedź się nie zmienia.',
    fallbackThinkingNone: 'Rozumowanie zostało dla tego dostawcy całkowicie wyłączone. W odpowiedzi nadal może pojawić się tekst rozumowania; w takim razie spróbuj innego modelu.',
    fallbackParamStripped: 'Ten dostawca nie obsługuje parametru "{field}". Parametr został usunięty z żądania; zachowanie może różnić się od konfiguracji.',

    // Wiki Init Status
    wikiInitStatusReady: 'Wiki utworzona',
    wikiInitStatusNotReady: 'Wiki jeszcze nie utworzona — powstanie automatycznie przy pierwszym wczytaniu',

    // Wiki Folder
    wikiSection: 'Konfiguracja wiki',
    wikiFolderName: 'Folder wiki',
    // v1.24.0: added the "restart Obsidian" hint because the wikiFolder
    // affects engine caches and Query Wiki panels that aren't fully
    // re-bound on settings change.
    wikiFolderDesc: 'Miejsce na generowane strony wiki. Po zmianie uruchom Obsidiana ponownie: pamięci podręczne silnika i otwarte panele Query Wiki muszą połączyć się od nowa.',
    wikiFolderPlaceholder: 'wiki',

    // Errors
    errorNoApiKey: 'Najpierw ustaw klucz API',
    errorNoModel: 'Najpierw wybierz model — kliknij Pobierz modele albo wpisz identyfikator modelu ręcznie',
    llmNotReady: 'LLM nie jest skonfigurowany. Przejdź do Ustawienia → Karpathy LLM Wiki, ustaw dostawcę, pobierz dostępne modele i przejdź test połączenia.',
    errorFetchFailed: 'Niepowodzenie: {}',

    // Query Settings
    querySectionTitle: 'Konfiguracja pytań do wiki',
    // v1.24.0: renamed from "Max Conversation History" to clarify the
    // semantics — this is a memory-window cap, not a hard storage limit
    // (history is itself a rolling buffer). 1 = each turn independent
    // (no cross-turn memory). Settings UI is a dropdown of presets, so
    // no "presets: 1/10/30/50/100/500" list is needed in the description.
    // v1.24.0: maxConversationHistoryHint was a dead i18n key (never
    // referenced from UI code); the recommendation text now lives inline
    // in the desc.
    maxConversationHistoryName: 'Rundy pamięci rozmowy',
    maxConversationHistoryDesc: 'Ile poprzednich rund rozmowy model widzi jako pamięć. 1 oznacza, że każda tura jest osobna, bez pamięci między turami; wyższe wartości pozwalają modelowi pamiętać wcześniejsze tury. Zalecane: 1 przy pojedynczych pytaniach, 10–50 przy dłuższym badaniu tematu.',
    numberRangeValidation: 'Wpisz liczbę od 1 do 50',
    numberRangeClamped: 'Wartość poza zakresem (1-500), ustawiono automatycznie na {}',

    // Query Modal UI
    queryModalTitle: 'Query Wiki — rozmowa o twojej wiki',
    queryModalPlaceholder: 'Zadaj pytanie...',
    queryModalSendButton: 'Wyślij',
    queryModalStopButton: 'Zatrzymaj',
    queryModalSaveButton: 'Zapisz do wiki',
    queryModalClearButton: 'Wyczyść historię',
    queryModalHistoryCount: 'Historia rozmowy: {}/{} rund',
    queryModalStreaming: 'Strumieniowanie...',
    queryModalFallbackStreaming: 'Ten dostawca nie obsługuje strumieniowania; przełączono na czekanie na całą odpowiedź. Chwilę cierpliwości...',
    queryPhaseSearching: 'Analiza indeksu wiki i wybór odpowiednich stron...',
    queryPhaseFoundPages: 'Znaleziono strony: {count} — {pages}',
    queryPhaseLoadingPages: 'Wczytywanie treści stron...',
    queryPhaseContextReady: 'Kontekst gotowy. Tworzenie odpowiedzi...',
    queryPhaseGenerating: 'Tworzenie... (minęło {time}s)',
    queryPhaseNonStreaming: 'Tryb bez strumieniowania, tworzenie odpowiedzi... (minęło {time}s)',
    queryModalErrorPrefix: 'Błąd: ',
    queryModalHint: 'Pytania dotyczą treści twojej wiki. Kliknij "Zapisz do wiki", aby zachować wartościową rozmowę jako strony wiki.',

    // v1.20.0: Query Wiki thinking-block collapsible summary
    queryThinkingSummary: 'Rozumowanie',
    queryThinkingSteps: 'kroki',

    // Error Messages
    errorLLMClientNotInit: 'Klient LLM nie został uruchomiony. Najpierw zapisz ustawienia.',
    errorIngestFailed: 'Wczytywanie nie powiodło się: ',
    errorQueryFailed: 'Pytanie nie powiodło się: ',
    fileWriteFailed: 'Nie udało się utworzyć lub zaktualizować pliku: {path}',

    // Success Messages
    ingestSuccess: 'Wczytano: utworzono {} stron, zaktualizowano {} stron',
    querySuccess: 'Pytanie zakończone',
    lintSuccess: 'Kontrola lint zakończona',
    lintReadingPages: 'Wczytywanie stron wiki: {count}...',
    lintReadingPagesProgress: 'Wczytywanie stron wiki: {current}/{total}...',
    lintScanningLinks: 'Szukanie martwych odsyłaczy...',
    lintScanningLinksProgress: 'Szukanie martwych odsyłaczy: {current}/{total}...',
    lintCheckingDuplicates: 'Szukanie zduplikowanych stron...',
    lintCheckingDuplicatesProgress: 'Sprawdzanie duplikatów: runda {current} ...',
    lintFixingPolluted: 'Naprawianie zanieczyszczonej strony {current}/{total}: {title} → {newTitle}',
    lintModalFixPolluted: '🧹 Napraw zanieczyszczone strony ({count})',
    lintDuplicateCheckFailed: 'Wykrywanie duplikatów nie powiodło się — szczegóły w konsoli',
    lintDuplicateCheckFailedDetail: 'Sprawdzanie duplikatów nie powiodło się na etapie {step}: {error}',
    lintMergeItemFailed: 'Scalanie nie powiodło się: {source} → {target} — {error}',
    lintAliasesMissing: 'Brakujące aliasy: {count} stron bez aliasów',
    lintAliasesSection: 'Strony bez aliasów [{count}]',
    lintAliasesItem: '- [[{page}]]',
    lintAliasesCompleteBtn: 'Uzupełnij aliasy ({count})',
    lintAliasesFilling: 'Tworzenie aliasów {current}/{total}: {page}',
    lintAliasesFilled: 'Aliasy uzupełnione. Wypełniono {filled}/{total} stron.',
    lintAliasesFillFailed: 'Tworzenie aliasów nie powiodło się: {page} — {error}',
    // Issue #85 v7: tag-violation retag notifications
    lintTagViolationFiring: 'Ponowne tagowanie {current}/{total}: {path}',
    lintTagViolationFailed: 'Ponowne tagowanie nie powiodło się dla {path}: {error}',
    lintTagViolationFixed: 'Tagowanie zakończone. Naprawiono {fixed}/{total} stron.',
    lintTagViolationFixedNone: 'Tagowanie zakończone. Żadna strona nie wymagała naprawy (model zachował obecne tagi).',
    lintTagViolationSection: 'Strony z tagami spoza listy [{count}]',
    lintTagViolationItem: '- [[{path}]] — nieprawidłowe: {tags}',
    lintTagViolationRetagBtn: '🏷️ Otaguj ponownie {count} stron za pomocą modelu',
    lintFixItemFailed: 'Naprawa nie powiodła się: [[{target}]] — {error}',
    lintLinkItemFailed: 'Podlinkowanie nie powiodło się: {page} — {error}',
    lintRetrying: 'Ponowna próba ({attempt}/{max}) po błędzie...',
    lintAnalyzingLLM: 'Model sprawdza kondycję wiki...',
    saveToWikiSuccess: 'Rozmowa zapisana do wiki!',
    querySaveAlreadyExists: 'Uwaga: nic nie zapisano (ta wiedza jest już w wiki):',
    saveSummary: '{entities} encji, {concepts} pojęć, {pages} stron',
    aliasAdded: 'Dodano alias \'{alias}\' do strony \'{page}\'',

    // Status Messages
    ingestingSources: 'Wczytywanie źródeł...',
    queryingWiki: 'Zadawanie pytań do wiki...',
    lintingWiki: 'Kontrola wiki...',
    savingToWiki: 'Zapisywanie rozmowy do wiki...',
    clearingHistory: 'Czyszczenie historii rozmowy...',

    // Buttons
    ingestButton: 'Wczytaj',
    queryButton: 'Pytaj',
    lintButton: 'Lint',
    cancelButton: 'Anuluj',

    // Links
    karpathyGistLink: 'Gist Karpathy\'ego o LLM Wiki',
    obsidianPluginAPI: 'Obsidian Plugin API',
    anthropicSDK: 'Anthropic SDK',
    openaiSDK: 'OpenAI SDK',

    // v1.24.1 PATCH Bedrock Stage 1
    bedrockRegionName: 'Region AWS',
    bedrockRegionDesc: 'Region Amazon Bedrock dla tego konta. Wyznacza adres punktu końcowego bedrock-mantle; bazowy adres nie może go nadpisać.',
    bedrockRegionHint: 'bedrock-mantle jest dostępny w 18 regionach; zestaw modeli różni się w zależności od regionu.',

    // Other
    availableModelsLoading: 'Wczytywanie dostępnych modeli...',
    noModelsAvailable: 'Brak dostępnych modeli',

    // LLM Language Hint
    llmLanguageHint: 'Odpowiadaj po polsku.',

    // Schema Configuration
    schemaSection: 'Konfiguracja schematu',
    enableSchemaName: 'Używaj schematu',
    enableSchemaDesc: 'Twórz plik schema/config.md i dołączaj go do każdego promptu, aby wiki miała stałą strukturę',
    viewSchemaButton: 'Pokaż lub edytuj schemat',
    regenerateSchemaButton: 'Utwórz schemat domyślny ponownie',
    schemaRegeneratedNotice: 'Schemat domyślny został utworzony ponownie.',
    schemaRegenerateFailed: 'Nie udało się utworzyć schematu',

    // Wiki Output Language
    wikiLanguageName: 'Język treści wiki',
    wikiLanguageDesc: 'Wszystkie generowane strony wiki, indeks, dziennik i odpowiedzi na pytania są w tym języku',
    customWikiLanguageOption: 'Wpisz własny...',
    customWikiLanguageHint: 'Wpisz nazwę języka (np. polski, arabski). Trafi do modelu jako polecenie dotyczące języka odpowiedzi.',
    customWikiLanguagePlaceholder: 'np. polski',

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
    extractionSectionTitle: 'Wyodrębnianie',
    extractionGranularityName: 'Ilość na źródło',
    extractionGranularityDesc: 'Określa, ile encji i pojęć wyodrębnia się z jednego pliku źródłowego. Więcej oznacza więcej stron i więcej tokenów API.\nDokładnie: głęboka analiza. Standardowo: codzienne notatki. Zgrubnie: szybki przegląd. Minimalnie: ponad 100 plików naraz (około 5 pozycji na źródło, bez szczegółów). Własne: ustaw własny limit (do 500).\nWskazówka: przy folderach z wieloma plikami wybierz Minimalnie lub Zgrubnie, żeby oszczędzić czas i koszty.',
    extractionGranularityFine: 'Dokładnie — głęboka analiza (≤100 pozycji)',
    extractionGranularityStandard: 'Standardowo — codzienne notatki (≤50 pozycji)',
    extractionGranularityCoarse: 'Zgrubnie — szybki przegląd (≤10 pozycji)',
    extractionGranularityMinimal: 'Minimalnie — ponad 100 plików naraz (≤5 pozycji)',
    extractionGranularityCustom: 'Własne — ustaw własne limity (1~500)',
    customEntityLimitName: 'Własny limit encji',
    customEntityLimitDesc: 'Maksymalna liczba encji wyodrębnianych z jednego pliku źródłowego (1-500)',
    customConceptLimitName: 'Własny limit pojęć',
    customConceptLimitDesc: 'Maksymalna liczba pojęć wyodrębnianych z jednego pliku źródłowego (1-500)',

    // Issue #85 v2: Tag Vocabulary (chip input UX, embedded in Wiki Configuration)
    tagVocabularyInlineDesc: 'Zamknięta lista tagów do pola frontmatter encji i pojęć. Zagnieżdżone tagi Obsidiana z "/" są zachowywane.',
    tagVocabularyModeName: 'Konfiguracja listy tagów',
    tagVocabularyModeDescDefault: 'Wartość domyślna korzysta z tagów wbudowanych: {}. Wybierz Własne, aby ustalić swoje.',
    tagVocabularyModeDescCustom: 'Własne: określ poniżej swoje tagi encji i pojęć. Wpisuj i zatwierdzaj Enterem lub przecinkiem, kliknij ×, aby usunąć.',
    // v1.25.10 PATCH Issue #368 — clarification, not enforcement. The custom
    // vocabulary is a SCHEMA INJECTION HINT for the LLM, not a write-time
    // gate. Small/local models may still emit out-of-vocabulary types; the
    // lint "out-of-vocabulary type" diagnostic surfaces those pages for review.
    tagVocabularyNotEnforcedHint: 'To tylko wskazówka dla schematu — model nadal może tworzyć tagi spoza listy. Uruchom lint, aby znaleźć i naprawić takie strony.',
    tagVocabularyModeDefault: 'Domyślne (wbudowane tagi podtypów)',
    tagVocabularyModeCustom: 'Własne (zdefiniowane przez użytkownika)',
    customEntityTagsName: 'Własne tagi encji',
    customEntityTagsDesc: 'Naciśnij Enter lub przecinek, aby dodać tag. Kliknij ×, aby usunąć. Zagnieżdżone tagi z "/" są zachowywane.',
    customEntityTagsPlaceholder: 'osoba, organizacja, projekt, miejsce',
    customConceptTagsName: 'Własne tagi pojęć',
    customConceptTagsDesc: 'Naciśnij Enter lub przecinek, aby dodać tag. Kliknij ×, aby usunąć. Zagnieżdżone tagi z "/" są zachowywane.',
    customConceptTagsPlaceholder: 'teoria, metoda, dziedzina, zjawisko, termin',
    chipDuplicateHint: 'Ten tag już był, pominięto',

    // v1.27.3: topic-scoped prompt customization (extraction focus + content requirements)
    promptFocusSectionName: 'Dostosowanie promptów',
    promptFocusOpenSchema: 'Przejdź do schematu',
    extractionFocusName: 'Ukierunkowanie wyodrębniania',
    extractionFocusDesc: 'Dowolny tekst dodawany do promptu wyodrębniania: którym encjom i pojęciom ta wiki ma dawać pierwszeństwo. Nie zmienia formatu JSON ani zasad tagowania. Puste pole oznacza wyłączone. Maksymalnie 4000 znaków.',
    extractionFocusPlaceholder: 'np. pomijaj wzmianki mimochodem; każda cytowana osoba dostaje stronę',
    contentRequirementsName: 'Wymagania dotyczące treści',
    contentRequirementsDesc: 'Dowolny tekst z wymaganiami stosowanymi **w obrębie sekcji, które strona już ma**: nacisk, zakres i kolejność. Nowa sekcja nie powstaje; o tym, co przetrwa zapis, decyduje lista sekcji wtyczki. Zasady cytowania i przeciwdziałania zmyślaniu treści pozostają po stronie systemu. Puste pole oznacza wyłączone. Maksymalnie 4000 znaków.',
    contentRequirementsPlaceholder: 'np. zaczynaj każdą sekcję jednym zdaniem podsumowania; trzymaj sekcje poniżej 150 słów',
    // Ingestion Acceleration
    accelerationSectionTitle: 'Przyspieszanie wczytywania',
    pageGenerationConcurrencyName: 'Równoległe wywołania modelu',
    pageGenerationConcurrencyDesc: 'Ile wywołań modelu działa naraz podczas wczytywania i lint. Wyższe wartości są szybsze, kosztują więcej i mogą trafić na limit dostawcy.',
    concurrencyValueSingular: 'Obecna równoległość: {} (po kolei — najbezpieczniej)',
    concurrencyValuePlural: 'Obecna równoległość: {} (równolegle)',
    batchDelayName: 'Przerwa między rundami (ms)',
    batchDelayDesc: 'Przerwa między równoległymi rundami, aby nie trafić na limit dostawcy (100-10000 ms). Teraz: {} ms. Zwiększ, jeśli pojawiają się błędy 429.',

    // Auto Maintenance
    autoMaintainSection: 'Automatyczne utrzymanie',
    autoMaintainBetaBadge: 'BETA — Funkcja eksperymentalna. Mogą w niej występować błędy. Zalecana tylko zaawansowanym użytkownikom.',
    autoWatchName: 'Obserwuj foldery',
    autoWatchDesc: 'Automatycznie wykrywaj nowe i zmienione pliki .md w obserwowanych folderach i powiadamiaj o nich lub wczytuj je bez pytania',
    watchedFoldersName: 'Obserwowane foldery',
    watchedFoldersDesc: 'Foldery wskazane jako źródła. Ich tagi tworzą listę tagów dziedzinowych proponowaną przy wczytywaniu, a przy włączonym obserwowaniu są też sprawdzane pod kątem nowej treści. Kliknij "Dodaj folder", aby wybrać folder ze skarbca.',
    addWatchedFolderButton: 'Dodaj folder',
    removeWatchedFolderButton: 'Usuń',
    webClipperPresetName: 'Obserwuj Clippings (Web Clipper)',
    webClipperPresetDesc: 'Dodaje folder Clippings/ używany przez Obsidian Web Clipper do listy obserwowanych. To, co wytniesz z sieci, trafi do wiki automatycznie.',
    noWatchedFoldersHint: 'Nie ustawiono żadnych folderów. Dodaj folder albo włącz ustawienie gotowe dla Clippings.',
    autoWatchModeName: 'Tryb obserwowania',
    autoWatchModeDesc: '"Tylko powiadamiaj" pokazuje pytanie. "Wczytuj automatycznie" robi to bez pytania.',
    watchModeNotify: 'Tylko powiadamiaj',
    watchModeAuto: 'Wczytuj automatycznie',
    autoWatchDebounceName: 'Czas oczekiwania (sekundy)',
    autoWatchDebounceDesc: 'Jak długo czekać po zmianie pliku, zanim rozpocznie się wczytywanie (1-60 sekund)',
    autoWatchDebounceClamped: 'Wartość poza zakresem (1-60), ustawiono automatycznie na {}',
    periodicLintName: 'Lint według harmonogramu',
    periodicLintDesc: 'Uruchamiaj kontrolę modelu według harmonogramu, ale tylko wtedy, gdy pliki źródłowe zmieniły się od ostatniej kontroli',
    periodicLintOff: 'Wyłączony',
    periodicLintDaily: 'Codziennie',
    periodicLintWeekly: 'Co tydzień',
    periodicLintMonthly: 'Co miesiąc',
    autoSmartFixName: 'Inteligentna automatyczna naprawa',
    autoSmartFixDesc: 'Podczas kontroli lint od razu stosuje wszystkie naprawy, bez pokazywania raportu. Podsumowanie napraw nadal pojawia się po zakończeniu.',
    autoSmartFixNotice: 'Inteligentna automatyczna naprawa: stosowanie wszystkich napraw...',

    autoIngestLevelName: 'Powiadomienie po automatycznym wczytaniu',
    autoIngestLevelDesc: 'Jak informować o zakończeniu automatycznego wczytywania. "Powiadomienie" jest krótkie i niczego nie blokuje. "Okno" otwiera pełny raport. Wyłączone, gdy tryb obserwowania to "Tylko powiadamiaj".',
    autoIngestLevelNotice: 'Powiadomienie (nie blokuje)',
    autoIngestLevelModal: 'Okno (pełny raport)',
    startupCheckName: 'Szybkie naprawy przy starcie',
    startupCheckDesc: 'Przy wczytaniu wtyczki naprawia drobne błędy formatu (źródła, podwójnie zagnieżdżone odsyłacze) i sprawdza strukturę folderów wiki. Domyślnie włączone.',
    startupCheckNoticeLevelName: 'Pokazuj wynik szybkich napraw',
    startupCheckNoticeLevelDesc: 'Szybkie naprawy działają zawsze przy starcie (notatka powitalna, struktura folderów, porządkowanie źródeł, niekompletne strony, nagłówek dziennika). Wybierz, czy po starcie ma się pojawić powiadomienie. W trybie cichym wynik trafia tylko do konsoli i do panelu historii.',
    startupCheckNoticeVisible: 'Widoczne (pokazuj powiadomienie)',
    startupCheckNoticeSilent: 'Cicho (bez powiadomienia)',
    suggestSchemaCommand: 'Propozycje zmian w schemacie',
    autoMaintainCostWarning: '⚠️ Uwaga o kosztach: automatyczne utrzymanie zużywa tokeny API. "Wczytuj automatycznie" wywołuje model przy każdej zmianie pliku źródłowego. "Lint według harmonogramu" uruchamia kontrolę według harmonogramu, ale tylko gdy wykryje zmiany w źródłach. Ustaw to rozważnie, aby uniknąć nieoczekiwanych opłat.',

    // Notices
    startupCheckSummary: 'Wiki ma {pages} stron ({entities} encji, {concepts} pojęć, {sources} źródeł)',
    watcherActiveNotice: 'Wiki: obserwowanie plików jest włączone — obserwowane foldery są sprawdzane',
    watchIngestNotice: 'Wiki: {count} plików w sources/ zostało zmienionych. Wybierz "Wczytaj źródła", aby je przetworzyć.',

    // Startup quick fixes detail (Issue #81)
    startupCheckTitle: 'Szybkie naprawy wiki zakończone',
    startupCheckStructureLabel: 'Struktura wiki',
    startupCheckStructureOk: 'kompletna',
    startupCheckStructureMissing: 'niekompletna — powstanie automatycznie przy pierwszym wczytaniu',
    startupCheckSourcesLabel: 'Źródła uporządkowane',
    startupCheckSourcesClean: 'były już w porządku',
    startupCheckSourcesCleaned: 'uporządkowano {files} plików, poprawiono {entries} pozycji',
    startupCheckIncompleteClean: 'niekompletne strony: brak',
    startupCheckIncompleteArchived: 'niekompletne strony: {count} przeniesiono do kosza (można odzyskać z .trash)',
    startupCheckDisableHint: 'Aby to wyłączyć, przejdź do Ustawienia → Automatyczne utrzymanie → Pokazuj wynik szybkich napraw',
    autoIngestRunning: 'Automatyczne wczytywanie zmienionych plików ({count})...',
    autoIngestComplete: 'Automatyczne wczytywanie zakończone: {success} udanych, {fail} nieudanych',
    scheduledLintRunning: 'Trwa zaplanowana kontrola wiki...',
    wikiLintStats: 'Lint wiki: {pages} stron ({entities} encji, {concepts} pojęć, {sources} źródeł)',
    wikiHealthStats: 'Kondycja wiki: {pages} stron ({entities} encji, {concepts} pojęć, {sources} źródeł){indexStatus}',
    lintWikiStart: 'Rozpoczynanie kontroli wiki...',
    lintWikiComplete: 'Kontrola wiki zakończona',
    lintWikiFailed: 'Kontrola wiki nie powiodła się',
    analyzingSchema: 'Analiza wiki i tworzenie propozycji schematu...',
    schemaSuggestionGenerated: 'Propozycje schematu są w pliku wiki/schema/suggestions.md',
    noSchemaUpdateNeeded: 'Schemat nie wymaga zmian.',
    schemaSuggestionFailed: 'Tworzenie propozycji schematu nie powiodło się',
    // v1.22.0 #97: Schema diff Modal — IDE-style preview + Apply/Regenerate
    schemaDiffTitle: 'Podgląd zmiany schematu',
    schemaDiffSummary: '+{add} / -{del} wierszy',
    schemaDiffRegenerateLabel: 'Dopracuj propozycję (opcjonalnie):',
    schemaDiffRegenerateBtn: 'Utwórz ponownie',
    schemaDiffOpenFileBtn: 'Otwórz plik',
    schemaDiffApplyBtn: 'Zastosuj',
    schemaDiffApplied: 'Schemat zaktualizowany. Kopia zapasowa: {path}',
    schemaDiffEmptyTitle: 'Nie proponuje się żadnych zmian',
    schemaDiffFailed: 'Zastosowanie schematu nie powiodło się: {reason}',
    schemaDiffRestoreHint: 'Kopia zapasowa jest w {path}. Aby wrócić, zmień w menedżerze plików nazwę tego pliku na "wiki/schema/config.md". Zachowywane są 3 najnowsze kopie.',
    schemaRegenerateNoBody: 'Ponowne utworzenie się udało, ale model nie zwrócił nowej treści.',
    schemaNotFoundNotice: 'Nie ma pliku schematu. Włącz schemat, aby go utworzyć.',
    selectFolderNoMdFiles: 'W tym folderze nie ma plików Markdown: {path}',
    batchIngestSkipNotice: 'Pomijanie {skipped} z {total} plików, które są już wczytane. Wczytywanie {new} nowych plików...',
    batchIngestAllIngested: 'Wszystkie {total} plików w tym folderze zostały już wczytane.',
    batchIngestStarting: 'Wczytywanie {count} plików z "{folder}" — to może potrwać kilka minut. Po zakończeniu pojawi się raport.',
    batchIngestComplete: 'Wczytywanie zbiorcze zakończone: {success}/{total} udanych, {fail} nieudanych',
    batchIngestFailedFiles: 'Pliki, które się nie udały:',
    historyTruncated: 'Historię skrócono do ostatnich {max} rund',
    historyCleared: 'Historia wyczyszczona',

    // User Feedback Loop
    reviewedPagePreserved: 'Treść sprawdzona przez ciebie zostaje zachowana dla: {}',

    // Query-to-Wiki feedback
    querySuggestSaveTitle: 'Zapisać do wiki?',
    querySuggestSaveDesc: 'Ta rozmowa zawiera wartościową wiedzę. Zapisać ją w wiki?',
    querySuggestSaveYes: 'Zapisz',
    querySuggestSaveNo: 'Nie teraz',

    // Ingestion Report
    ingestReportElapsedTime: 'Upłynęło',
    ingestReportSkippedFiles: 'Pominięte (już wczytane)',
    ingestReportRejectedFiles: 'Pominięte',
    rejectionReasonEmpty: 'pusty plik',
    rejectionReasonType: 'nieobsługiwany typ',
    rejectionReasonDuplicate: 'treść już istnieje',
    rejectionReasonPdfUnsupported: 'dostawca nie czyta PDF',
    rejectionReasonMineruPageLimit: 'przekracza limit stron MinerU',
    rejectionReasonMineruSizeLimit: 'przekracza limit rozmiaru MinerU',
    ingestReportFailedGuidance: 'Tych pozycji nie udało się utworzyć automatycznie. Możesz utworzyć odpowiednie strony ręcznie albo zmniejszyć ilość wyodrębnianą na źródło i wczytać plik ponownie.',

    // Command Names (sentence case per Obsidian Bot rule 1)
    cmdIngestSource: 'Wczytaj jedno źródło',
    cmdIngestFolder: 'Wczytaj z folderu',
    cmdIngestMultipleFiles: 'Wczytaj wiele plików',
    cmdQueryWiki: 'Zadaj pytanie do wiki',
    cmdLintWiki: 'Skontroluj wiki',
    cmdRegenerateIndex: 'Utwórz indeks ponownie',
    cmdSuggestSchema: 'Propozycje zmian w schemacie',
    cmdCancelIngestion: 'Zatrzymaj wczytywanie',
    cmdIngestActiveFile: 'Wczytaj bieżący plik',
    cmdViewHistory: 'Historia operacji',
    noActiveFile: 'Żaden plik nie jest otwarty',
    mdOnlyFile: 'Wczytywać można tylko pliki Markdown',

    // v1.26.3 PATCH (B2.5 follow-up): single-file ingest + batch-check
    // Toasts. These feed showProgressFor → persistent Notice (Toast), which
    // is separate from the status-bar channel — they were hardcoded English
    // ('Ingesting: <file>', 'Checking for already-ingested files...'),
    // producing English Toasts on non-English vaults.
    ingestSingleFileStart: 'Wczytywanie: {filename}',
    ingestCheckingExisting: 'Sprawdzanie, które pliki są już wczytane...',
    // Auto-lint completion Notice ("N findings" phrase — full phrase so
    // each locale can order/pluralize freely).
    lintFindingsSummary: '{total} ustaleń',

    // Ingestion status bar
    ingestionStatusBar: 'Wczytywanie... kliknij, aby zatrzymać',
    lintStatusBar: 'Kontrola... kliknij, aby zatrzymać',
    ingestStatusAnalyzing: 'Wczytywanie… (kliknij, aby zatrzymać)',
    lintStatusAnalyzing: 'Kontrola… (kliknij, aby zatrzymać)',
    // v1.25.11 PATCH #169 — fine-grained stage hints for the status bar.
    // These labels are ADD-only emission sandwiched between the page name
    // and the always-visible base label (e.g. "My Note · Generating summary ·
    // Ingesting… (click to cancel)"). They never replace the base label, so
    // the cancel affordance is preserved through every long-running stage.
    ingestStageAnalyze: 'Analiza źródła',
    ingestStageSummary: 'Tworzenie podsumowania',
    ingestStageEntity: 'Tworzenie encji',
    ingestStageConcept: 'Tworzenie pojęcia',
    ingestStageRetry: 'Ponowna próba dla nieudanej strony',
    ingestStageSave: 'Zapisywanie stron',
    ingestStageIndex: 'Tworzenie indeksu',
    pdfStageReading: 'Odczyt PDF',
    pdfStageConverting: 'Konwersja PDF',
    pdfStageSidecar: 'Zapisywanie pliku towarzyszącego',
    lintStagePrep: 'Wczytywanie stron',
    lintStageProgrammatic: 'Sprawdzanie odsyłaczy',
    lintStageAnalyzing: 'Model analizuje wiki',
    lintStageDedup: 'Wykrywanie duplikatów',
    lintStageContradiction: 'Wykrywanie sprzeczności',
    ingestionCancelling: 'Zatrzymywanie — bieżąca runda zostanie dokończona',
    ingestionCancelled: 'Wczytywanie zatrzymane',
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
    ingestBatchInitial: 'Analiza rundy 1/{total}...',
    ingestBatchProgress: 'Analiza rundy {current}/{total} (dotąd {entities} encji, {concepts} pojęć)...',
    ingestBatchProcessed: 'Runda {current} przeanalizowana, przetwarzanie...',
    ingestAnalyzing: 'Analiza: {filename}',
    ingestCreatingSummary: '[{step}/{totalSteps}] Tworzenie podsumowania...',
    ingestCreatingItem: '[{step}/{totalSteps}] {type}: {name}',
    ingestUpdating: '[{step}/{totalSteps}] Aktualizacja: {name}',
    ingestGeneratingIndex: '[{step}/{totalSteps}] Tworzenie indeksu...',
    ingestItemTypeEntity: 'Encja',
    ingestItemTypeConcept: 'Pojęcie',
    convAnalyzing: 'Analiza rozmowy...',
    convCheckingExisting: 'Sprawdzanie, czy ta wiedza już istnieje...',
    convAlreadyExists: 'Ta wiedza jest już w wiki',
    convCreatingSummary: 'Tworzenie strony podsumowania...',
    convGeneratingSummary: 'Tworzenie strony podsumowania...',
    convSavingEntity: 'Zapisywanie encji: {name}',
    convSavingConcept: 'Zapisywanie pojęcia: {name}',
    convGeneratingIndex: 'Tworzenie indeksu...',

    // Lint Report
    lintReportTitle: 'Raport z kontroli wiki',
    lintReportSummary: 'Stan wiki: {total} stron łącznie, {aliasesMissing} stron bez aliasów, {duplicates} zduplikowanych stron, {deadLinks} odsyłaczy do nieistniejących stron (w tym {deadLinkFromDup} związanych z duplikatami), {orphans} osieroconych stron (w tym {orphanFromDup} to duplikaty), {emptyPages} pustych stron, {ungroundedQuotes} cytatów bez pokrycia w tekście, {tagViolations} tagów spoza listy. Kontrola trwała {elapsedSeconds}s',

    // Advanced LLM Settings (v1.20.0: default = no provider-specific overrides).
    // v1.26.0 (#382 item 2): renamed advancedSettingsModeName →
    // advancedLlmModeName so the label scopes to LLM sampling params and is
    // not confused with the generic bottom "Advanced settings" panel.
    advancedLlmModeName: 'Zaawansowane parametry modelu',
    advancedLlmModeDesc: 'Tryb domyślny stosuje to, co zaleca dostawca modelu. Wybierz Własne tylko wtedy, gdy masz konkretny powód, by to zmienić — na przykład gdy model wymaga stałej temperatury albo chcesz wyłączyć tekst rozumowania w odpowiedzi.',
    advancedSettingsDefault: 'Domyślne (zgodnie z dostawcą)',
    advancedSettingsCustom: 'Własne (zastąp dostawcę)',
    // v1.26.0 (#382 item 2): bottom "Advanced settings" panel — generic
    // home for all advanced-user settings that are NOT LLM sampling params
    // (those live under advancedLlmModeName above). Off by default; the
    // toggle reveals lint thresholds, the Welcome note, and future knobs.
    advancedSettingsSection: 'Ustawienia zaawansowane',
    showAdvancedSettingsName: 'Pokaż ustawienia zaawansowane',
    showAdvancedSettingsDesc: 'Włącz, aby zobaczyć ustawienia zaawansowane poniżej. Wyłączenie ukrywa je i przywraca wartości domyślne.',
    disableThinkingName: 'Wyłącz rozumowanie',
    disableThinkingDesc: 'Wyłącza tekst rozumowania w odpowiedzi modelu. Domyślnie wyłączone — model sam decyduje, czy pokazać rozumowanie, i zwykle daje to najlepszą odpowiedź. Włącz tylko wtedy, gdy twój dostawca wrzuca surowe rozumowanie do odpowiedzi, a ty chcesz czystej odpowiedzi.',
    thinkingEffortName: 'Poziom rozumowania',
    thinkingEffortDesc: 'Ile model może rozumować, u dostawców, którzy udostępniają takie ustawienie. Domyślnie nic nie jest wysyłane i model wybiera sam. Wyższy poziom może dać lepszą odpowiedź i zawsze kosztuje więcej tokenów i czasu. Dostawcy tłumaczą poziom po swojemu, więc ta sama nazwa może znaczyć co innego przy różnych modelach.',
    thinkingEffortDefault: 'Domyślnie (decyduje dostawca)',
    thinkingEffortLow: 'Niski',
    thinkingEffortMedium: 'Średni',
    thinkingEffortHigh: 'Wysoki',
    taskPoliciesPlaceholder: 'Przykład: extract=text:off',
    taskPoliciesName: 'Tryb odpowiedzi i rozumowanie według kroku',
    taskPoliciesDesc: 'Jedna pozycja na krok potoku, `krok=tryb:rozumowanie`, oddzielone przecinkami — np. `extract=text:off`. Tryby: `-` (zostaw), `schema`, `json`, `text`; rozumowanie: `-`, `off`, `on`, `low`, `medium`, `high`. Nazwy kroków to między innymi extract, extract-retry, lemma-classify, merge-triage, source-stance, dedup, page-generate, related-page i lint-dedup; błędnie zapisana nazwa nie pasuje do niczego. Puste pole oznacza ustawienie wbudowane (wyodrębnianie w trybie tekstowym). Pozycja, której nie da się odczytać, nie zostanie zapisana.',
    // Issue #137: compatibility hints for advanced settings (kept short; no
    // provider list to avoid maintenance burden when providers change).
    extractionTemperatureName: 'Temperatura wyodrębniania',
    extractionTemperatureDesc: 'Określa, jak swobodnie czy jak wiernie model pisze strony encji i pojęć. Niższe wartości są bardziej powtarzalne i rzeczowe, wyższe dają więcej urozmaicenia. Większość użytkowników zostawia to puste.',
    chatTemperatureName: 'Temperatura odpowiedzi',
    chatTemperatureDesc: 'To samo pojęcie co przy wyodrębnianiu, ale dotyczy tylko odpowiedzi w Query Wiki. Niższe wartości dają odpowiedzi bardziej dosłowne, wyższe bardziej rozmowne. Większość użytkowników zostawia to puste.',
    repetitionPenaltyName: 'Kara za powtarzanie',
    repetitionPenaltyDesc: 'Zniechęca model do powtarzania tych samych słów lub zwrotów. Wyższe wartości oznaczają mniej powtórzeń. Używają tego tylko niektórzy dostawcy modeli lokalnych (Ollama, LM Studio, llama.cpp); dostawcy w chmurze ignorują to bez komunikatu. Większość użytkowników zostawia to puste. Wartości powyżej 1,0 mogą u małych modeli lokalnych powodować błędy w odpowiedzi podczas wyodrębniania; jeśli runda się nie uda, zmniejsz lub wyczyść tę wartość.',
    repetitionPenaltyErrorHint: 'Uwaga: ustawiono własną karę za powtarzanie {value}. Wartości powyżej 1,0 mogą u małych modeli lokalnych psuć wyodrębnianie z wymuszoną gramatyką. Zmniejsz lub wyczyść to ustawienie i spróbuj ponownie.',
    temperaturePlaceholder: 'puste = wartość domyślna dostawcy',
    // v1.26.0 (#382 item 2): Lint dedup threshold overrides (bottom
    // "Advanced settings" panel, showAdvancedSettings toggle on). The
    // "leave blank" placeholder above is reused so the input row reads the
    // same as the temperature rows in the Advanced section.
    lintDedupJaccardLinkThresholdName: 'Podobieństwo odsyłaczy',
    lintDedupJaccardLinkThresholdDesc: 'Zakres 0–1 (domyślnie 0,4). Dwie strony są oznaczane jako duplikaty, gdy odsyłacze wiki, na które obie wskazują, pokrywają się przynajmniej w takim stopniu. Niżej oznacza więcej bliskich duplikatów, w tym strony wskazujące tylko te same popularne strony; wyżej oznacza strony wskazujące prawie ten sam zestaw. Zwiększ, jeśli pojawiają się fałszywe trafienia między stronami, które przypadkiem wskazują tę samą stronę. Puste pole zostawia wartość domyślną.',
    lintDedupJaccardBodyGateName: 'Minimalne podobieństwo treści',
    lintDedupJaccardBodyGateDesc: 'Zakres 0–1 (domyślnie 0,2). Nawet gdy dwie strony mają te same odsyłacze wiki, są oznaczane jako duplikaty tylko wtedy, gdy ich treść pokrywa się przynajmniej w takim stopniu. Niżej oznacza, że więcej kandydatów trafia do modelu; wyżej oznacza, że zgłaszane są tylko prawie identyczne treści. Zwiększ, jeśli model dostaje strony, które wyraźnie nie są duplikatami. Puste pole zostawia wartość domyślną.',
    lintDedupBigramThresholdName: 'Podobieństwo tytułów',
    lintDedupBigramThresholdDesc: 'Zakres 0–1 (domyślnie 0,4). Dwie strony są oznaczane jako duplikaty, gdy znaki w ich tytułach lub aliasach pokrywają się przynajmniej w takim stopniu. Niżej oznacza, że łapane są warianty zapisu, literówki i tłumaczenia tego samego pojęcia; wyżej oznacza tylko prawie identyczne tytuły. Zwiększ, jeśli model ogląda strony o bardzo różnych nazwach, które nie są duplikatami. Puste pole zostawia wartość domyślną.',
    lintDeadLinkSection: 'Odsyłacze do nieistniejących stron (wykryte) [{count}]',
    lintEmptyPageSection: 'Puste strony (wykryte) [{count}]',
    lintOrphanSection: 'Osierocone strony (wykryte) [{count}]',
    lintContradictionSection: 'Sprzeczności (wykryte)',
    lintDuplicateSection: 'Zduplikowane strony (wykryte)',
    lintPollutedSection: 'Zanieczyszczone strony (wykryte) [{count}]',
    lintPollutedItem: '- [[{page}]] → powinno być "{clean}"',
    lintSourcesNormalizedSection: 'Źródła uporządkowane (naprawione automatycznie) [{files} plików / {entries} pozycji]',
    lintSourcesNormalizedItem: 'Uporządkowano {entries} zanieczyszczonych pozycji źródeł w {files} plikach: usunięto ścieżki zewnętrzne, końcówki .md i potoki aliasów oraz scalono duplikaty.',
    lintNoIssuesFound: 'Nie znaleziono duplikatów, odsyłaczy do nieistniejących stron, pustych stron, osieroconych stron ani cytatów bez pokrycia w tekście.',
    lintSourceDriftSection: 'Notatki źródłowe zmienione po wczytaniu [{count}]',
    lintSourceDriftItem: '- [[{page}]] — notatka źródłowa [[{note}]] została zmieniona po wczytaniu; strona może być nieaktualna',
    lintSourceDriftLinksOnlySection: 'Notatki źródłowe, w których zmieniły się tylko odsyłacze [{count}]',
    lintSourceDriftLinksOnlyItem: '- [[{page}]] — w [[{note}]] zmieniły się tylko ścieżki odsyłaczy (strona została przeniesiona); podsumowanie nie jest nieaktualne',
    lintContradictionMarkerSection: 'Strony oznaczone jako sprzeczne [{count}]',
    lintContradictionMarkerItem: '- [[{page}]] — sprzeczne źródła: {sources}; przejrzyj je i usuń oznaczenie contradictions:, gdy sprawa jest wyjaśniona',
    lintQuoteGroundingSection: 'Cytaty bez pokrycia w tekście (wykryte) [{count}]',
    lintQuoteGroundingItem: '- [[{page}]]{sourceHint}: "{quote}"',
    lintDeadLinkItem: '- [[{source}]] → **{target}** (taka strona nie istnieje){dupFlag}',
    lintDeadLinkMore: '- ... jeszcze {count} odsyłaczy do nieistniejących stron',
    lintEmptyPageItem: '- [[{page}]] — mniej niż 50 znaków treści',
    lintOrphanItem: '- [[{page}]] — żadna inna strona wiki tu nie prowadzi{dupFlag}',
    lintDuplicateItem: '- [[{target}]] i [[{source}]] — {reason}',
    lintDeadLinkAffectedByDup: ' (⚠️ dotyczy zduplikowanej strony)',
    lintOrphanIsDuplicate: ' (⚠️ zduplikowana strona)',
    lintHubLinkDensitySection: 'Węzły z nadmiarem odsyłaczy [#157 / #175] [{count}]',
    lintCrystallizedHubsSection: 'Wykrystalizowane węzły [{count}]',
    lintCrystallizedHubsIntro: 'Sąsiedzi tego węzła wskazują teraz na siebie, więc węzeł niczego już nie łączy. Jeśli oznaczasz węzły ręcznie, rola tego węzła się skończyła. Wtyczka ignoruje to oznaczenie i niczego nie zmienia. Sprawdzono {topN} węzłów o największej liczbie odsyłaczy.',
    lintCrystallizedHubRow: '{path} — {degree} odsyłaczy, percentyl skupienia {percentile}%',
    lintHubLinkDensityItem: '- [[{page}]] — {inDegree} odsyłaczy przychodzących, {relatedCount} odsyłaczy powiązanych, wyrazistość {distinctiveness} → {recommendation}{lowTargets}',
    lintHubLinkDensityStrip: '⚠️ usuń',
    lintHubLinkDensityReview: '🔍 przejrzyj',
    lintHubLinkDensityKeep: '✅ zostaw',
    lintHubLinkDensitySummary: 'Podsumowanie: przy {strip} stronach zaleca się usunięcie, przy {review} stronach przegląd.',
    lintHubLinkDensityIntro: 'To mierzy odsyłacze wychodzące węzła: czy prowadzą do stron, które jego sąsiedzi już pokrywają. Lista wykrystalizowanych węzłów mierzy coś innego — czy sąsiedzi wskazują na siebie. Obie listy mogą wskazywać różne strony i żadna nie wynika z drugiej.',
    lintHubLinkDensityNoRelated: ' (nie znaleziono sekcji ## Related)',
    lintContradictionOpen: 'Otwarte sprzeczności: {count}',
    lintContradictionItem: '- [{status}] [[{page}]] — {claim}',
    lintContradictionStatusDetected: 'Wykryto',

    // Lint Analysis Prompt

    // Lint Fix Progress
    lintFixProgress: 'Naprawianie {current}/{total}: [[{target}]]',
    lintFixDeadComplete: 'Odsyłacze do nieistniejących stron naprawione. Wykonano {fixed}/{total} pozycji.',
    lintFillProgress: 'Uzupełnianie {current}/{total}: {page}',
    lintFillComplete: 'Strony uzupełnione. Wypełniono {filled}/{total} stron.',
    lintDeleteCompleted: 'Usunięto {count} pustych stron bez treści',
    lintDeleteFailed: 'Nie udało się usunąć {failed}/{total} pustych stron bez treści (szczegóły w konsoli)',
    lintFillFailed: 'Uzupełnianie nie powiodło się: {page} — {error}',
    lintLinkProgress: 'Podlinkowywanie {current}/{total}: {page}',
    lintLinkComplete: 'Osierocone strony podlinkowane. Podlinkowano {linked} stron.',
    lintFixNoAction: 'Nic nie zrobiono (brak klienta)',
    lintFixIndexUpdated: 'Indeks wiki i dziennik zostały zaktualizowane.',
    lintFixAllComplete: 'Wszystkie naprawy zakończone. Szczegóły w dzienniku.',
    lintFixAllNoChanges: 'Nic nie zmieniono — każdy etap zgłosił 0 napraw. Szczegóły w wiki/log.md.',
    lintFixPhasesLabel: 'etapów zmieniono',
    lintPollutedFixed: 'Zanieczyszczone strony naprawione: {fixed}/{total}. Indeks utworzono ponownie.',
    regenerateIndexCompleted: 'Indeks utworzony ponownie',
    operationFailed: 'Niepowodzenie: ',

    // Lint Report Modal
    lintModalActionsTitle: 'Proponowane naprawy (zużywa tokeny modelu):',
    lintLogReference: 'Pełny raport zapisano w log.md',
    lintModalFixDeadLinks: 'Napraw odsyłacze do nieistniejących stron ({count})',
    lintModalExpandEmpty: 'Uzupełnij puste strony ({count})',
    lintModalDeleteEmpty: 'Usuń puste strony bez treści ({count})',
    lintModalLinkOrphans: 'Podlinkuj osierocone strony ({count})',
    lintModalAnalyzeSchema: 'Przeanalizuj schemat',
    lintModalMergeDuplicates: 'Scal duplikaty ({count})',
    lintModalFixAll: 'Napraw wszystko automatycznie ({count} problemów)',
    lintMergeProgress: 'Scalanie {current}/{total}: {source} → {target}',
    lintMergeComplete: 'Scalanie duplikatów zakończone. Scalono {merged}/{total} par.',

    // Ingest Report Modal
    ingestReportTitle: 'Raport z wczytywania',
    ingestReportSourceFile: 'Źródło',
    ingestReportCreated: 'Utworzone',
    ingestReportUpdated: 'Zaktualizowane',
    ingestReportContradictions: 'Znalezione sprzeczności',
    ingestReportFailedTitle: 'Wczytywanie nie powiodło się',
    ingestReportErrorDetail: 'Szczegóły błędu',
    ingestReportClose: 'Zamknij',
    ingestReportCreatedPages: 'Utworzone strony: {count}',
    ingestReportUpdatedPages: 'Zaktualizowane strony: {count}',
    ingestReportEmbeddedImages: 'Obrazy w notatce: przejrzano {analyzed}/{discovered}; wysłano {sent} z {queued} w kolejce, w {packages} pakietach; przekonwertowano {gifs} pierwszych klatek GIF; nieudane pakiety: {failed}',
    ingestReportEmbeddedEvidenceSaved: 'Materiał obrazowy zapisano na stronie źródłowej',
    ingestReportEmbeddedImageSkipped: 'Obrazy w notatce pominięto',
    embeddedImagesVisionUnsupported: 'Ten punkt końcowy odrzucił analizę obrazów. Wczytywanie tekstu trwa dalej; użyj modelu, który widzi obrazy, albo wyłącz analizę obrazów.',
    // v1.22.2: log.md header content (Operation History Panel hint)
    logHeaderTitle: 'Dziennik operacji wiki',
    logHeaderSubtitle: 'Każde wczytanie, każda kontrola lint i każda czynność utrzymaniowa są tu zapisywane automatycznie. Wygodniejszy jest panel **Historia operacji**:',
    logHeaderShortcut: (cmd: string) => `Cmd+P → "${cmd}"`,
    logHeaderSettingsShortcut: 'Możesz też otworzyć go przez Ustawienia → Automatyczne utrzymanie → Historia operacji',
    // v1.22.2: concise per-file ingest summary labels for Notice (no modal)
    ingestionCreatedPages: 'utworzone strony: {count}',
    ingestionUpdatedPages: 'zaktualizowane strony: {count}',
    ingestionNoticeHistoryHint: 'Szczegóły znajdziesz w historii operacji.',
    ingestReportEntitiesCount: 'encje: {count}',
    ingestReportConceptsCount: 'pojęcia: {count}',
    ingestReportContradictionsFound: 'Znalezione sprzeczności: {count}',
    ingestReportEntityType: 'Encja',
    ingestReportConceptType: 'Pojęcie',
    timeMinutes: 'min',
    timeSeconds: 's',

    // Rate Limit Warnings
    rateLimitDetected: '⚠️ Osiągnięto limit dostawcy: {count} stron nie powiodło się z błędem 429. Spróbuj tak: (1) zmniejsz równoległość do {suggestedConcurrency} lub do 1 (po kolei), (2) zwiększ przerwę między rundami do {suggestedDelay} ms, (3) przejdź na dostawcę z większymi limitami.',
    rateLimitDetectedShort: '⚠️ Osiągnięto limit dostawcy — zmniejsz równoległość albo zwiększ przerwę między rundami w Ustawienia → Przyspieszanie wczytywania.',

    // Long source warning
    sourceRejectedEmpty: '⏭️ "{filename}" nie ma treści do wczytania i został pominięty. Puste notatki lub notatki z samym frontmatter nie tworzą stron wiki.',
    sourceRejectedType: '⏭️ "{filename}" został pominięty: ten typ pliku nie jest obsługiwany. Wczytywać można tylko notatki tekstowe (np. .md, .txt).',
    sourceRejectedDuplicate: '⏭️ "{filename}" pominięty — ta treść jest już w wiki.',
    // v1.25.0 PDF Level 1 (cache-only architecture)
    pdfReadingInProgress: 'Odczyt PDF: {filename}',
    sourceRejectedPdfUnsupported: '⏭️ "{filename}" pominięty — twój obecny dostawca lub model nie przyjmuje PDF. Zmień dostawcę, włącz w Ustawienia → Konfiguracja LLM → Zaawansowane opcję "Zawsze próbuj PDF", albo wybierz MinerU jako konwerter (obsługuje też obrazy i pliki Office).',
    clearPdfCacheCommand: 'Wyczyść pamięć podręczną konwersji PDF',
    pdfCacheCleared: 'Pamięć podręczna konwersji PDF wyczyszczona (usunięto {count} pozycji).',
    // v1.25.0 PR3: Advanced PDF settings
    forcePdfSupportName: 'Zawsze próbuj PDF',
    forcePdfSupportDesc: 'Domyślnie wyłączone. Włącz, jeśli twój dostawca nie jest oznaczony jako obsługujący PDF, ale radzi sobie z takimi plikami. Po włączeniu PDF trafi do obecnego dostawcy; jeśli go odrzuci, zobaczysz wyraźny komunikat. Dostawcy obsługujący PDF natywnie (Anthropic, OpenAI, Bedrock) tego nie potrzebują.',
    writePdfMarkdownToVaultName: 'Zapisuj przekonwertowany Markdown w skarbcu',
    writePdfMarkdownToVaultDesc: 'Domyślnie wyłączone. Po włączeniu wynik każdej konwersji PDF trafia do pliku "<basename>.pdf.md" obok pliku PDF. Po wyłączeniu wynik zostaje tylko w pamięci podręcznej wtyczki i nie zostawia śladu w skarbcu.',
    analyzeEmbeddedImagesName: 'Analizuj obrazy w notatkach podczas wczytywania',
    analyzeEmbeddedImagesDesc: 'Domyślnie wyłączone. Analizuje każdy odpowiedni lokalny obraz w pakietach po 20 MiB; jeden obraz może mieć najwyżej 10 MiB. Obrazy z internetu nie są nigdy pobierane.',
    streamIngestName: 'Strumieniuj żądania wczytywania',
    streamIngestDesc: 'Jak żądania wczytywania docierają do modelu. Auto strumieniuje na urządzeniach mobilnych, bo platforma mobilna może przerwać żądanie, które nic nie otrzymuje, gdy model jeszcze pracuje; na komputerze, gdzie takiego limitu nie ma, odpowiedź jest odbierana w całości. Strumieniowanie trzyma połączenie zajęte, więc długa generacja nie zostaje po cichu przerwana. Nie jest szybsze i wysyła kilkakrotnie więcej bajtów, choć serwer proxy kompresujący strumień zdarzeń to zmniejsza. Zawsze strumieniuje na każdej platformie — dla wolnego modelu lokalnego za proxy z własnym limitem bezczynności. Nigdy nie odbiera w całości — dla kogoś na mobilnym transferze z limitem, kto godzi się, że długie wywołanie na telefonie się nie uda.',
    streamIngestAuto: 'Auto (zalecane)',
    streamIngestAlways: 'Zawsze',
    streamIngestNever: 'Nigdy',
    ingestHintReasoning: 'Model zużył cały limit wyjścia na rozumowanie, więc nie zostało nic na odpowiedź. Wyłącz rozumowanie dla tego kroku, obniż poziom rozumowania albo zwiększ "Maksymalną liczbę tokenów wyjściowych na wywołanie" w zaawansowanych parametrach modelu.',
    ingestHintMaxTokens: 'Model odrzucił wartość max_tokens. Zmniejsz "Maksymalną liczbę tokenów wyjściowych na wywołanie" w zaawansowanych parametrach modelu.',
    ingestHintContextWindow: 'Plik źródłowy jest za duży dla okna kontekstu tego modelu. Użyj modelu z większym oknem albo podziel plik.',
    ingestHintBadRequest: 'API odrzuciło żądanie. Sprawdź, czy nazwa modelu pasuje do tego dostawcy.',
    ingestHintAuth: 'Uwierzytelnianie nie powiodło się. Sprawdź klucz API w ustawieniach.',
    ingestHintRateLimit: 'Osiągnięto limit dostawcy. Poczekaj chwilę albo przejdź na dostawcę z większymi limitami.',
    ingestHintMobileTimeout: 'Żądanie zbyt długo milczało i platforma mobilna je zamknęła. Żądania wczytywania są strumieniowane, gdy dostawca na to pozwala, więc odpowiedź prawdopodobnie wstrzymuje proxy albo dostawca. Wyłącz buforowanie odpowiedzi w proxy albo użyj modelu, który strumieniuje.',
    ingestHintDesktopTimeout: 'Żądanie przekroczyło czas bez danych. Sprawdź adres dostawcy i każde proxy przed nim. Jeśli proxy zamyka bezczynne połączenia, ustaw "Strumieniuj żądania wczytywania" na Zawsze (ustawienia zaawansowane).',
    ingestHintStreamingOff: 'Strumieniowanie przy wczytywaniu jest wyłączone. Buforowane żądanie nie wysyła nic, dopóki cała odpowiedź nie będzie gotowa, więc platforma mobilna zamyka je wcześniej. Ustaw "Strumieniuj żądania wczytywania" na Auto (ustawienia zaawansowane).',
    ingestHintDefault: 'Sprawdź połączenie z siecią, klucz API i adres dostawcy w ustawieniach.',
    saveEmbeddedImageEvidenceName: 'Zapisuj materiał obrazowy na stronie źródłowej',
    saveEmbeddedImageEvidenceDesc: 'Domyślnie wyłączone. Zapisuje dla każdego obrazu otaczający go tekst i to, co zobaczył model obrazowy, w zwijanej sekcji strony źródłowej.',
    markdownConversionBackendName: 'Konwerter do Markdown',
    markdownConversionBackendDesc: 'Native korzysta z obsługi PDF u twojego dostawcy (zakres ograniczony: nie każdy dostawca i model radzi sobie z PDF, a każde użycie kosztuje tokeny). MinerU to usługa w internecie — szybka, bezpłatna do wyczerpania dziennego limitu, przyjmuje PDF, obrazy i pliki Office — ale wymaga tokenu API (wpisz go w polu poniżej).',
    markdownConversionBackendNative: 'PDF i obrazy przez dostawcę',
    markdownConversionBackendMineru: 'MinerU przez internet',
    mineruApiTokenName: 'Token API MinerU',
    mineruApiTokenDesc: 'Token otrzymasz na https://mineru.net/apiManage/token. MinerU przyjmuje pliki do 200 MB i do 200 stron. Token wygasa po około 90 dniach; odnow go, gdy konwersja zacznie się nie udawać z błędem 401.',
    mineruTokenExpired: 'MinerU odrzucił token API — prawdopodobnie wygasł (tokeny działają około 90 dni). Odbierz nowy na https://mineru.net/apiManage/token i zaktualizuj ustawienie tokenu MinerU.',
    mineruApiTokenPlaceholder: 'Wklej token API MinerU',
    mineruUploadingInProgress: 'Wysyłanie PDF do MinerU: {filename}',
    mineruWaitingInProgress: 'Czekanie na konwersję w MinerU: {filename}',
    mineruDownloadingInProgress: 'Pobieranie wyniku z MinerU: {filename}',
    markdownConversionComplete: 'Konwersja zakończona: {filename}',
    markdownConversionCompleteSaved: 'Konwersja zakończona — zapisano w {path}: {filename}',
    mineruPageLimitRejected: '{filename} przekracza limit stron MinerU ({limit}) — podziel plik i spróbuj ponownie',
    mineruSizeLimitRejected: '{filename} przekracza limit rozmiaru MinerU ({limit} MB)',
    ingestRejectedSummary: 'Pominięto {count} plików (puste, już wczytane lub nieobsługiwany typ).',
    reingestConfirmTitle: 'Wczytać ten plik ponownie?',
    reingestConfirmBody: 'Treść pliku "{filename}" jest już w wiki. Wczytać go ponownie?',
    reingestConfirmYes: 'Wczytaj ponownie',
    reingestConfirmNo: 'Pomiń',
    // v1.26.0 (#382 item 1, Batch 2): sources participate in dedup by
    // default via the sourceFingerprint signal (body-hash equality). Off
    // here to exclude source pages from lint duplicate-detection.
    lintDedupIncludeSourcesName: 'Uwzględniaj źródła przy wykrywaniu duplikatów',
    lintDedupIncludeSourcesDesc: 'Domyślnie włączone. Po włączeniu źródła o identycznej treści są podczas kontroli oznaczane jako duplikaty. Wyłącz, jeśli twoje źródła dają fałszywe trafienia.',
    legacyScorerName: 'Stary sposób szeregowania wyników',
    legacyScorerDesc: 'Domyślnie wyłączone. Po włączeniu szeregowanie wyników pytań korzysta ze starszej, ręcznie dostrajanej metody zamiast nowszej BM25F. Włącz, jeśli wyniki wyszukiwania pogorszyły się po aktualizacji.',
    // Issue #880: the answer context's token ceiling (bottom Advanced settings panel).
    queryContextBudgetName: 'Budżet tokenów kontekstu',
    queryContextBudgetDesc: 'Ogranicza liczbę tokenów stron wiki wysyłanych z jedną odpowiedzią. Wyłączone = 0. 8K pasuje do większości środowisk lokalnych; zwiększ dla dużego modelu w chmurze. Strony najniżej w rankingu odpadają pierwsze.',
    // Issue #514: opt-in candidate gate (bottom Advanced settings panel).
    skipMentionOnlyCandidatesName: 'Pomijaj kandydatów tylko wspomnianych',
    skipMentionOnlyCandidatesDesc: 'Domyślnie wyłączone. Po włączeniu wyodrębniona encja lub pojęcie, którego nazwa nie występuje w bieżącym tekście notatki — nie ma jej wcale albo jest tylko w nawiasach, w wyliczeniach lub w krótkich punktach listy — nie dostaje strony ani kolejnego wywołania modelu, a nazwa znika z list powiązanych innych kandydatów. Działa dla języków z profilem granic słów (niemiecki zmierzony; angielski, francuski, hiszpański, portugalski i niderlandzki oszacowane); dla pozostałych języków wczytywanie raz zgłasza, że nie da się tego zastosować. Zostaw wyłączone dla skarbców ze słownikami pojęć lub notatek w punktach, gdzie każdy nazwany termin ma dostać stronę.',
    createStubsForUnresolvableLinksName: 'Twórz puste strony dla odsyłaczy donikąd',
    createStubsForUnresolvableLinksDesc: 'Domyślnie włączone. Gdy naprawa odsyłaczy nie znajdzie żadnej istniejącej strony, tworzy pustą stronę i kieruje tam odsyłacz — nigdy nie wypełnianą przez model. Wyłącz, aby takie odsyłacze zostawić bez zmian: pozostaną widoczne w każdym raporcie lint, dopóki prawdziwe źródło ich nie zdefiniuje.',
    // v1.26.0 (#382 item 1, Batch 2): sub-heading for the dedup
    // sub-group at the bottom of the "Advanced settings" panel.
    lintDedupSectionHeading: 'Wykrywanie duplikatów',
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
    llmRetryRecoveredToast: 'Zadanie modelu: {count} rund wymagało ponowienia z powodu chwilowego problemu z odpowiedzią dostawcy. Szczegóły w konsoli. Jeśli to się powtarza, zmniejsz równoległość w ustawieniach dostawcy.',
    longSourceNotice: '📄 "{filename}" ma {lines} wierszy ({size}). Długie teksty są wyodrębniane etapami: model czyta cały dokument w kilku przejściach. To może potrwać kilka minut. Prosimy o cierpliwość.',
    longSourceNoticeShort: '📄 Wykryto duży plik ({lines} wierszy). Wczytywanie może chwilę potrwać.',

    // Ingestion History Panel (#122) — UI keys
    historyButton: 'Historia operacji',
    historyButtonDesc: 'Zobacz, co ostatnio działo się w twojej wiki: co wczytano, raporty lint i inne zmiany',
    historyButtonOpen: 'Pokaż historię',
    historyModalTitle: 'Historia operacji',
    historyModalSubtitle: 'Ostatnie operacje w twojej LLM Wiki',
    historyEmpty: 'Nic jeszcze nie zapisano. Wczytaj notatkę albo uruchom lint, aby zobaczyć tu wpisy.',
    historyReadError: 'Nie udało się odczytać dziennika: {error}',
    historyEntryKindIngest: 'Wczytywanie',
    historyEntryKindMaintenance: 'Utrzymanie',
    historyEntryKindFix: 'Naprawa',
    historyEntryKindOther: 'Operacja',
    historyEntryTime: '{date} · {time}',
    historyEntryTimeNoTime: '{date}',
    historyEntrySource: 'Źródło: {source}',
    historyEntrySourceUnknown: 'Wczytanie bez tytułu',
    historyEntryCreatedLabel: 'Utworzone',
    historyEntryUpdatedLabel: 'Zaktualizowane',
    historyEntryCreatedCount: 'utworzone: {count}',
    historyEntryUpdatedCount: 'zaktualizowane: {count}',
    historyEntryNoChanges: 'Brak zmian na stronach',
    historyEntryContradictions: '⚠️ sprzeczności: {count}',
    historyEntrySectionCreated: 'Utworzone strony',
    historyEntrySectionUpdated: 'Zaktualizowane strony',
    historyEntrySectionContradictions: 'Sprzeczności',
    historyEntrySectionDetails: 'Szczegóły',
    historyEntrySectionReport: 'Co wykryła kontrola',
    historyEntryOpenPage: 'Otwórz',
    historyEntryDetailsNoContradictions: 'Nie znaleziono sprzeczności',
    historySearchPlaceholder: '🔍 Szukaj po tytule źródła lub ścieżce strony…',
    historyFilterAll: 'Wszystko',
    historyFilterIngest: 'Tylko wczytywanie',
    historyFilterMaintenance: 'Tylko utrzymanie',
    historyFilterFix: 'Tylko naprawy',
    historyFilterContradictions: '⚠️ Ze sprzecznościami',
    historyRefreshButton: '⟳ Odśwież',
    historyExpandDay: 'Kliknij, aby rozwinąć',
    historyCollapseDay: 'Kliknij, aby zwinąć',
    historyShowMore: 'Pokaż starsze wpisy: {count}',
    historyNoMatch: 'Żadna operacja nie pasuje do wyszukiwania ani filtra.',
    historyCloseButton: 'Zamknij',
    historyLimit: 50,
    historyBadgeIngestShort: '📥',
    historyBadgeMaintenanceShort: '🔍',
    historyBadgeFixShort: '🔧',
    historyBadgeOtherShort: '📌',
    // KPI labels (Operation History Panel v2)
    historyKpiPages: 'Strony',
    historyKpiDeadLinks: 'Martwe odsyłacze',
    historyKpiOrphans: 'Osierocone',
    historyKpiEmpty: 'Puste',
    historyKpiDuplicates: 'Duplikaty',
    historyKpiTagViolations: 'Problemy z tagami',
    historyKpiUnsourced: 'Bez źródła',
    historyKpiDuration: 'Czas kontroli',
    historyKpiDurationSec: '{seconds}s',
    // Operation History v3 — rich section rendering
    historySectionDeadLinks: 'Martwe odsyłacze ({count})',
    historySectionTagViolations: 'Problemy z tagami ({count})',
    historySectionOrphans: 'Osierocone strony ({count})',
    historySectionEmptyPages: 'Puste strony ({count})',
    historySectionLlmAnalysis: 'Analiza modelu ({count})',
    historyDeadLinkSource: 'Źródło',
    historyDeadLinkTarget: 'Brak',
    historyOpenInLog: 'Otwórz w log.md',
    historyShowMoreItems: 'Pokaż więcej: {count}',
    historyTrendUp: '↗ {delta}',
    historyTrendDown: '↘ {delta}',
    historyTrendSame: '→ bez zmian',
    historyChipContradiction: 'Sprzeczność',
    historyChipOutdated: 'Nieaktualne',
    historyChipMissing: 'Brakuje',
    historyChipStructure: 'Struktura',
    historySeverityHigh: 'Wysoka',
    historySeverityMedium: 'Średnia',
    historySeverityLow: 'Niska',
    historyPageTypeEntity: '📦 encja',
    historyPageTypeConcept: '💡 pojęcie',
    historyPageTypeSource: '📄 źródło',
    historyGlobalInsight: 'Twoja wiki ma martwych odsyłaczy: {dead}, osieroconych stron: {orphans}, problemów z tagami: {tags}. Ostatnia kontrola trwała {duration}.',
    historyGlobalInsightClean: 'Twoja wiki jest w porządku — nie wykryto martwych odsyłaczy, osieroconych stron ani problemów z tagami.',
    historyGlobalInsightNoData: 'Nie ma jeszcze raportów utrzymania — uruchom lint, aby je zebrać.',
    // v3.1 — modal title, subtitle w/ count, time-range filter
    historyModalHeaderTitle: 'Historia operacji',
    historyModalSubtitleWithCount: 'Ostatnie operacje w twojej LLM Wiki · wpisów: {count}',
    historyTimeRangeAll: 'Cały okres',
    historyTimeRange1d: 'Ostatni dzień',
    historyTimeRange3d: 'Ostatnie 3 dni',
    historyTimeRange1w: 'Ostatni tydzień',
    historyTimeRange1m: 'Ostatni miesiąc',
    // v3.1 — ingest metric cards
    historyIngestTotal: 'Strony łącznie',
    historyIngestByType: 'Według rodzaju',
    historyIngestSource: 'Plik źródłowy',
    historyIngestNoTimestamp: 'Brak znacznika czasu',
    historyIngestFirstTime: 'Pierwsze wczytanie',
    historyIngestLatestTime: 'Ostatnie wczytanie',
    historyTimeRangeCustom: 'Własny okres',
    historyCustomRangeFrom: 'Od',
    historyCustomRangeTo: 'Do',
    historyCustomRangeApply: 'Zastosuj',
    historyCustomRangeClear: 'Wyczyść',
    // v1.23.0 — first-run welcome note (Phase 5.1.5)
    welcomeNoteTierANotice: 'Karpathy Wiki: skarbiec jest pusty. Utwórz pierwszą notatkę źródłową i wybierz Wczytaj, aby zacząć.',
    welcomeNoteTierBNotice: 'Karpathy Wiki: utworzono notatkę powitalną. Otwórz ją, aby wskazać swoje dziedziny i wybrać 2-3 notatki źródłowe, które zaczną budowę sieci odsyłaczy.',
    welcomeNoteRecreateCommand: 'Utwórz notatkę powitalną ponownie',
    welcomeNoteRecreateCommandTooltip: 'Tworzy notatkę powitalną ponownie jako <wikiFolder>/Welcome.md, z obecnymi dziedzinami i testem konfiguracji modelu. Istniejący plik zostanie nadpisany.',
    welcomeNoteSettingsToggle: 'Twórz notatkę powitalną przy pierwszym uruchomieniu',
    welcomeNoteSettingsToggleDesc: 'Przy pierwszym uruchomieniu, gdy folder wiki jest pusty, tworzy jedną stronę na start: <wikiFolder>/Welcome.md. Wyjaśnia, co robi LLM Wiki, prosi o wskazanie dziedziny i prowadzi przez wczytanie pierwszych 2-3 notatek źródłowych. Domyślnie notatka jest pisana po angielsku, a w języku wiki, gdy model jest skonfigurowany. Wyłącz to, jeśli znasz już działanie wtyczki i nie chcesz tej notatki w skarbcu.',
    welcomeNoteRunConfigTest: 'Notatka powitalna została napisana po angielsku. Przejdź do Ustawienia → Dostawca LLM → Test połączenia, aby przy kolejnym utworzeniu była w twoim języku.',
    welcomeNoteRecreated: 'Notatka powitalna utworzona ponownie w {path}',
    welcomeNoteNotRecreated: 'Notatka powitalna nie została utworzona ponownie. Sprawdź konfigurację modelu.',
    welcomeNoteGenerating: 'Notatka powitalna: tworzenie w tle — dostaniesz powiadomienie, gdy będzie gotowa.',
    welcomeNoteGenerationFailed: 'Tworzenie notatki powitalnej nie powiodło się: {error}',
    welcomeNoteFileName: 'Witaj w Karpathy LLM Wiki',
    startupCheckWelcomePending: 'Notatka powitalna: tworzenie w tle (dostaniesz powiadomienie, gdy będzie gotowa).',
    startupCheckWelcomeCreated: 'Notatka powitalna utworzona w {path}',
    // v1.23.0 Phase 5.1.5: Multi-File Suggest modal (cmdIngestMultipleFiles).
    // The modal's title, hint, search placeholder, action buttons,
    // status labels and queue-empty placeholder all live here. Status
    // labels double as both the right-pane text and the data-attribute
    // keys for `updateLeftPaneSelections` to recognise, so they must
    // remain stable English strings.
    multiFileModalTitle: 'Wczytaj wiele plików',
    multiFileModalHint: 'Wybierz notatki źródłowe do wczytania. Po prawej widać kolejkę i postęp.',
    multiFileSearchPlaceholder: 'Filtruj pliki po ścieżce…',
    multiFileAddToQueue: 'Dodaj do kolejki',
    multiFileSelectAll: 'Zaznacz wszystko',
    multiFileFileCount: 'plików: {count}',
    multiFileNoFilesAvailable: 'Nie ma plików do wczytania.',
    multiFileNoFilesMatch: 'Żaden plik nie pasuje do "{q}".',
    multiFileQueueEmpty: 'Kolejka jest pusta. Zaznacz pliki po lewej, aby je dodać.',
    multiFileStatusPending: 'W kolejce',
    multiFileStatusRunning: 'W toku',
    multiFileStatusCompleted: 'Gotowe',
    multiFileStatusFailed: 'Nieudane',
    multiFileCancelAria: 'Pomiń ten plik',
    // #598: what the vault says about a row, resolved when the picker
    // opens. The queue only knows this session.
    multiFileRowIngested: 'Już wczytana',
    multiFileRowDrifted: 'Notatka zmieniona po wczytaniu',
    // v1.23.0 Phase 5.1.5: Multi-File Suggest modal action button
    // that removes every pending and running job from the ingest
    // queue. Completed and failed jobs are preserved so the user
    // still sees what happened.
    cancelAllQueueJobs: 'Zatrzymaj wszystko',
} as const;
