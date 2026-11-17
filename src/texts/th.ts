export const TH_TEXTS = {
    // Plugin Info
    pluginTitle: 'การตั้งค่า Karpathy LLM Wiki',
    pluginIntro: 'ปลั๊กอินนี้ทำให้แนวคิด {{link}} ใช้ได้ใน Obsidian โดยอ่านโน้ตของคุณ ใช้ AI สกัดเอนทิตีและแนวคิด แล้วสร้างวิกิที่มีโครงสร้างและเชื่อมโยงกันไว้ใน vault ของคุณ',
    karpathyLinkText: 'LLM Wiki ของ Andrej Karpathy',

    // Features Section
    featuresTitle: 'ขั้นตอนการทำงาน',
    workflow1Title: '1. นำเข้า',
    workflow1Desc: 'เลือกโน้ตหนึ่งฉบับ AI จะสกัดเอนทิตี แนวคิด และความสัมพันธ์ออกมาเป็นหน้าวิกิ',
    workflow2Title: '2. ถามตอบ',
    workflow2Desc: 'สนทนากับวิกิของคุณ คำตอบอ้างอิงจากความรู้ที่นำเข้าไว้แล้ว',
    workflow3Title: '3. ดูแลต่อ',
    workflow3Desc: 'ดัชนีอัตโนมัติ ลิงก์ถึงกัน และการตรวจ lint ช่วยให้วิกิอยู่ในสภาพดี',

    // Language Switcher
    languageTitle: 'ภาษาของหน้าจอ',
    languageDesc: 'เลือกภาษาของแผงการตั้งค่า ต้องรีสตาร์ตปลั๊กอินเพื่อให้ภาษาของชุดคำสั่งเปลี่ยนตาม',
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
    statusTitle: 'สถานะไคลเอนต์ LLM',
    llmWikiStatusSection: 'สถานะ LLM Wiki',
    statusInitialized: 'เริ่มทำงานแล้ว',
    statusNotInitialized: 'ยังไม่เริ่มทำงาน',
    statusReady: 'LLM พร้อมใช้',
    statusNotReady: 'ยังไม่ได้ตั้งค่า LLM — ตั้งค่าให้ครบแล้วผ่านการทดสอบการเชื่อมต่อ',
    currentProvider: 'ผู้ให้บริการปัจจุบัน',

    // Provider Configuration
    providerSection: 'การตั้งค่า LLM',
    providerName: 'ผู้ให้บริการ LLM',
    providerDesc: 'เลือกผู้ให้บริการที่ตั้งไว้ล่วงหน้า หรือบริการของคุณเองที่รองรับ OpenAI สำหรับแพ็กเกจอย่าง Coding Plan ให้เลือก Custom OpenAI/Anthropic แล้วกรอก Base URL และคีย์ API ของผู้ให้บริการเอง',

    // API Key
    apiKeyName: 'คีย์ API',
    apiKeyDesc: 'คีย์ API เก็บไว้ในตัวจัดการข้อมูลรับรองของระบบปฏิบัติการ ไม่ได้เก็บใน `data.json`',
    apiKeyPlaceholder: 'กรอกคีย์ API',
    // v1.25.4 #339: SecretStorage migration repair + failure Notice
    apiKeyMigrateToSecretStorageButton: 'ย้ายไปเก็บใน SecretStorage',
    apiKeyMigratedToSecretStorageSuccess: 'กู้คีย์ API จาก SecretStorage กลับมาที่การตั้งค่าแล้ว',
    apiKeyMigrationFailedNotice: 'บันทึกคีย์ API ลง SecretStorage ไม่สำเร็จ: {}',
    codexAuthName: 'ลงชื่อเข้าใช้ด้วยแพ็กเกจ ChatGPT',
    codexAuthDesc: 'การเข้าถึง Codex ผ่าน OAuth แบบทดลอง ใช้โควตาจากแพ็กเกจ ChatGPT ส่วนการคิดค่าบริการของแพลตฟอร์ม OpenAI แยกกันอยู่',
    codexAuthSignedOut: 'ยังไม่ลงชื่อเข้าใช้',
    codexAuthSignedIn: 'ลงชื่อเข้าใช้แล้ว',
    codexAuthBrowserButton: 'ลงชื่อเข้าใช้ผ่านเบราว์เซอร์',
    codexAuthDeviceButton: 'ใช้รหัสครั้งเดียว',
    codexAuthDeviceInstructions: 'กรอกรหัสนี้ในหน้าของ OpenAI: {}',
    codexAuthCopyCode: 'คัดลอกรหัส',
    codexAuthSignOutButton: 'ออกจากระบบ',
    codexAuthBusy: 'กำลังรอการอนุญาตจาก OpenAI...',
    codexAuthFailed: 'ลงชื่อเข้าใช้ ChatGPT ไม่สำเร็จ: {}',
    codexAuthQuota: 'โควตา Codex ของแพ็กเกจ ChatGPT หมดแล้ว รอจนครบระยะเวลาที่แสดงไว้แล้วลองใหม่',
    codexAuthExperimental: 'ยังเป็นคุณลักษณะทดลอง: ความพร้อมใช้ขึ้นกับการลงชื่อเข้าใช้ OpenAI Codex และนโยบายเรื่องโมเดล',
    codexModelsRefreshName: 'โมเดลของบัญชี',
    codexModelsRefreshDesc: 'ดึงรายการโมเดลที่แสดงในรายการเลือกจากบัญชี OpenAI Codex ที่คุณลงชื่อเข้าใช้อยู่',
    codexModelsRefreshButton: 'รีเฟรชโมเดลของบัญชี',
    codexModelsRefreshing: 'กำลังรีเฟรช...',
    codexModelsRefreshSuccess: 'ดึงโมเดลของบัญชีมาแล้ว {} รายการ',
    codexModelsRefreshFailed: 'รีเฟรชโมเดลของบัญชีไม่สำเร็จ จึงใช้รายการสำรองที่มีอยู่ {}',

    // Base URL
    baseUrlName: 'Base URL ของ API',
    baseUrlDescCustom: 'จำเป็น: ที่อยู่ของบริการของคุณเองที่รองรับ OpenAI',
    baseUrlDescOverride: 'ไม่บังคับ: แทนที่ Base URL ที่ตั้งไว้ล่วงหน้า',

    // Issue #723: custom request headers (shown directly below the Base URL).
    customHeadersName: 'ส่วนหัวที่กำหนดเอง',
    customHeadersDesc: 'หนึ่งบรรทัดต่อหนึ่งรายการในรูป `ชื่อ: ค่า` ส่งไปกับทุกคำขอ บรรทัดว่างและบรรทัดที่ขึ้นต้นด้วย `#` จะถูกข้าม',
    customHeadersInvalid: 'มี {} บรรทัดที่รูปแบบไม่ถูกต้อง จะถูกข้าม',

    // Ollama Hint
    ollamaHint: 'Ollama ทำงานในเครื่อง ไม่ต้องใช้คีย์ API',
    // LM Studio Hint
    lmstudioHint: 'LM Studio ทำงานในเครื่อง คีย์ API ไม่บังคับ',

    // LLM execution cap
    maxTokensPerCallName: 'จำนวนโทเคนเอาต์พุตสูงสุดต่อการเรียกหนึ่งครั้ง',
    maxTokensPerCallDesc: 'จำนวนมากที่สุดที่การเรียกหนึ่งครั้งเขียนได้ ค่า Auto จะถามขีดจำกัดของโมเดลเอง ถ้าเซิร์ฟเวอร์ในเครื่องไม่ระบุ ระบบจะใช้ค่าเริ่มต้นของปลั๊กอิน ตัวเลขนี้เพิ่มหรือลดสิ่งที่การเรียกสร้างหน้าประกาศไว้ และโทเคนที่ใช้คิดเหตุผลก็มาจากเพดานเดียวกัน ตัวเลขนี้ไม่ใช่ขนาดหน้าต่างบริบท',
    contextWindowName: 'หน้าต่างบริบทของโมเดล',
    contextWindowDesc: 'จำนวนโทเคนที่โมเดลถือได้ในเวลาเดียวกัน ทั้งอินพุตและเอาต์พุตรวมกัน เมื่อกำหนดค่านี้ ระบบจะหักพรอมต์ออก คำตอบจึงไม่ถูกขอเกินกว่าที่เหลืออยู่ ค่า Auto จะไม่จำกัดเพดาน',

    // Issue #111: slug casing
    slugCaseName: 'ตัวพิมพ์ในชื่อไฟล์',
    slugCaseDesc: 'กำหนดว่าชื่อไฟล์วิกิที่สร้างขึ้นจะเขียนด้วยตัวพิมพ์เล็กทั้งหมดหรือไม่ แนะนำให้เลือก "คงไว้" สำหรับภาษาที่ตัวพิมพ์เล็กเปลี่ยนความหมาย เช่น คำนามในภาษาเยอรมัน',
    slugCaseLower: 'ตัวพิมพ์เล็ก (ค่าเริ่มต้น)',
    slugCasePreserve: 'คงตัวพิมพ์เดิม',
    // Minimum alias length (Advanced settings, next to slug case).
    minAliasLengthName: 'ความยาวขั้นต่ำของ alias',
    minAliasLengthDesc: 'alias ที่สั้นกว่านี้ (หลังตัดช่องว่าง) จะไม่ถูกเขียนลงหน้าวิกิ ค่าเริ่มต้น 2 ทำให้ตัวย่อสองตัวอักษร (ML, AI, UI) ยังใช้ได้ ถ้า vault ของคุณมี alias ที่ต่างกันแค่ตัวพิมพ์ (Cr/CR) ให้ปรับเป็น 3 ช่วงค่าคือ 2–6',
    minAliasLengthClamped: 'ค่านอกช่วง (2–6) ตั้งเป็น {} แล้ว',

    // Model Selection
    modelSection: 'การเลือกโมเดล',
    fetchModelsName: 'ดึงรายการโมเดลที่มี',
    fetchModelsDesc: 'ดึงรายการโมเดลล่าสุดจาก API ของผู้ให้บริการ',
    fetchModelsButton: 'ดึงรายการโมเดล',
    fetchingModels: 'กำลังดึง...',
    fetchSuccess: 'สำเร็จ มีโมเดลให้ใช้ {} รายการ',
    fetchFailed: 'รายการว่างหรือดึงไม่สำเร็จ กรุณากรอกชื่อโมเดลเอง',
    fetchNotSupported: 'ผู้ให้บริการรายนี้ไม่รองรับการขอดูรายการโมเดล',
    fetchErrorAuth: 'ยืนยันตัวตนไม่สำเร็จ (HTTP 401/403) ตรวจสอบคีย์ API หรือกรอก ID ของโมเดลด้านล่างแล้วกดทดสอบการเชื่อมต่อ',
    fetchErrorEndpoint: 'ไม่พบที่อยู่ปลายทาง (HTTP 404) ตรวจสอบ Base URL หรือกรอก ID ของโมเดลแล้วกดทดสอบการเชื่อมต่อ',
    fetchErrorServer: 'เซิร์ฟเวอร์ของผู้ให้บริการผิดพลาด (HTTP 5xx) ลองใหม่ภายหลัง หรือกรอก ID ของโมเดลแล้วกดทดสอบการเชื่อมต่อ',
    fetchErrorEmpty: 'ผู้ให้บริการรายนี้ไม่มีที่อยู่สำหรับรายการโมเดล กรอก ID ของโมเดลด้านล่างแล้วกดทดสอบการเชื่อมต่อ',
    fetchErrorNetwork: 'คำขอผ่านเครือข่ายล้มเหลว ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต Base URL การตั้งค่าพร็อกซี และคีย์ API หรือจะกรอก ID ของโมเดลด้านล่างแล้วกดทดสอบการเชื่อมต่อก็ได้',

    selectModelName: 'เลือกโมเดล',
    selectModelDesc: 'เลือกจากโมเดลที่มี {} รายการ',
    customInputOption: 'กรอกเอง...',
    customInputHint: 'ถ้าต้องการโมเดลอื่น ให้เลือก "กรอกเอง..."',

    modelName: 'ชื่อโมเดล',
    modelDescCustom: 'คุณกำลังใช้โมเดลที่กำหนดเอง (กดปุ่มด้านบนเพื่อดึงรายการใหม่)',
    modelDescFetchFailed: 'ดึงรายการโมเดลไม่สำเร็จ ตรวจสอบคีย์ API และที่อยู่ของบริการ หรือกรอก ID ของโมเดลด้านล่างแล้วกดทดสอบการเชื่อมต่อ',
    modelInputPlaceholder: 'กรอก ID ของโมเดล แล้วทดสอบการเชื่อมต่อ',

    switchToDropdown: 'กลับไปใช้รายการเลือก',
    useDropdownButton: 'ใช้รายการเลือก',

    // v1.24.0 #208: per-task model picker
    modelTaskModeName: 'ขอบเขตการเลือกโมเดล',
    modelTaskModeDesc: 'เลือกว่าจะให้ทุกงานใช้โมเดลเดียวกัน หรือแยกโมเดลตามงาน (นำเข้า / lint / ถามตอบ) ค่าที่ตั้งไว้แยกตามงานจะยังอยู่เมื่อกลับมาใช้โมเดลเดียว',
    modelTaskModeUnified: 'ใช้โมเดลเดียวทุกงาน (ค่าเริ่มต้น)',
    modelTaskModePerTask: 'แยกโมเดลตามงาน',
    perTaskIngestModelName: 'โมเดลสำหรับนำเข้า',
    perTaskIngestModelDesc: 'ใช้กับการนำเข้าโน้ตและบทสนทนา การดูแลสคีมา และการสร้างโน้ตต้อนรับ',
    perTaskLintModelName: 'โมเดลสำหรับ lint',
    perTaskLintModelDesc: 'ใช้กับการวิเคราะห์ lint การหาหน้าซ้ำ งานซ่อมแซม และการแก้ลิงก์ที่ไม่มีปลายทาง',
    perTaskQueryModelName: 'โมเดลสำหรับถามตอบ',
    perTaskQueryModelDesc: 'ใช้กับบทสนทนาใน Query Wiki และการประเมินตอนบันทึกลงวิกิ',

    // Test & Save
    testConnectionName: 'ทดสอบการเชื่อมต่อ',
    testConnectionDesc: 'ตรวจสอบว่าการตั้งค่านี้เรียก API ของโมเดลได้จริง',
    testButton: 'ทดสอบการเชื่อมต่อ',
    testing: 'กำลังทดสอบ...',

    saveSettingsName: 'บันทึกการตั้งค่า',
    saveSettingsDesc: 'บันทึกการตั้งค่าปัจจุบัน',
    saveButton: 'บันทึกการตั้งค่า',
    savedNotice: 'บันทึกการตั้งค่าแล้ว!',

    // v1.24.0 (Bug C 3.4 / plan C): gradual migration Notice — shown on
    // startup or after a mid-session wikiFolder change when chat history
    // contains links from a previous wiki folder.
    queryHistoryMigrationNotice: 'ประวัติของ Query Wiki มีลิงก์จากโฟลเดอร์วิกิก่อนหน้า คำถามใหม่ใช้โฟลเดอร์ล่าสุดให้เองแล้ว ถ้าต้องการปรับข้อความที่เก็บไว้ทั้งหมด ให้เปิดแผง Query Wiki แล้วกดปุ่มล้างประวัติที่นั่น',

    // v1.24.0 Issue #251: Custom Query Instructions collapsible panel
    customInstructionsTitle: 'คำสั่งเพิ่มเติมสำหรับการถามตอบ',
    customInstructionsDesc: 'คำสั่งนี้จะถูกต่อท้ายพรอมต์ระบบของ Query Wiki ทุกครั้ง มีผลเฉพาะบทสนทนาใน Query Wiki ส่วนการนำเข้า lint และการสร้างหน้าไม่เปลี่ยน',
    customInstructionsPlaceholder: 'เช่น มองเรื่องนี้เป็นการวิจัย: ค้นให้กว้าง อ้างแหล่งข้อมูล และแยกข้อเท็จจริงออกจากการตีความ...',
    customInstructionsApply: 'ใช้',
    customInstructionsClear: 'ล้าง',
    customInstructionsCharCount: '{current}/{max} ตัวอักษร',
    instructionsApplied: 'บันทึกคำสั่งเพิ่มเติมแล้ว',
    instructionsCleared: 'ล้างคำสั่งเพิ่มเติมแล้ว',

    // Test Connection
    testConnectionSuccessful: 'เชื่อมต่อได้',
    baseUrlUpdated: 'เปลี่ยน Base URL เป็น {url} แล้ว',
    testConnectionFailed: 'เชื่อมต่อไม่สำเร็จ',
    testConnectionProvider: 'ผู้ให้บริการ: ',
    codexAuthRequired: 'ลงชื่อเข้าใช้แพ็กเกจ ChatGPT ก่อนทดสอบการเชื่อมต่อ',
    bedrockSsoRequired: 'ลงชื่อเข้าใช้ AWS SSO ก่อน (การตั้งค่า → Bedrock) แล้วจึงทดสอบการเชื่อมต่อ',
    bedrockIamRequired: 'กรอกคีย์ IAM ก่อน (การตั้งค่า → Bedrock) แล้วจึงทดสอบการเชื่อมต่อ',
    bedrockAuthMethodName: 'การยืนยันตัวตน',
    bedrockAuthMethodDesc: 'คีย์ API ใช้คีย์ของ Bedrock; AWS SSO ลงลายมือชื่อคำขอด้วยข้อมูลรับรองจาก IAM Identity Center; คีย์ IAM ใช้คีย์เข้าถึงแบบถาวร',
    bedrockAuthOptionApiKey: 'คีย์ API',
    bedrockAuthOptionSso: 'AWS SSO',
    bedrockAuthOptionIam: 'คีย์ IAM',
    bedrockSsoStartUrlName: 'URL เริ่มต้นของ SSO',
    bedrockSsoStartUrlDesc: 'ที่อยู่พอร์ทัลขององค์กรคุณ เช่น https://d-xxxxxxxxx.awsapps.com/start',
    bedrockSsoAccountIdName: 'รหัสบัญชี AWS',
    bedrockSsoAccountIdDesc: 'บัญชี 12 หลักที่จะใช้บทบาทของบัญชีนั้น เช่น 123456789012',
    bedrockSsoRoleNameName: 'ชื่อบทบาท',
    bedrockSsoRoleNameDesc: 'บทบาท IAM ที่ใช้เข้าถึง Bedrock เช่น PowerUserAccess',
    bedrockSsoLoginButton: 'ลงชื่อเข้าใช้ด้วย AWS SSO',
    bedrockSsoSignOutButton: 'ออกจาก AWS SSO',
    bedrockSsoStatusSignedIn: 'ลงชื่อเข้าใช้แล้ว · หมดอายุ {}',
    bedrockSsoStatusSignedOut: 'ยังไม่ลงชื่อเข้าใช้',
    bedrockSsoBusy: 'กำลังลงชื่อเข้าใช้…',
    bedrockSsoUserCodeInstructions: 'รหัส AWS SSO: {} เปิดลิงก์แล้วอนุมัติการเข้าถึง',
    bedrockSsoCopyCode: 'คัดลอกรหัส',
    bedrockSsoFailed: 'ลงชื่อเข้าใช้ AWS SSO ไม่สำเร็จ: {}',
    bedrockSsoDetectedPrefill: 'พบบัญชีและบทบาท: {}',
    bedrockIamKeyName: 'รหัสคีย์เข้าถึง',
    bedrockIamKeyDesc: 'รหัสคีย์เข้าถึงของ IAM เช่น AKIA… หรือ ASIA…',
    bedrockIamSecretName: 'คีย์เข้าถึงแบบลับ',
    bedrockIamSecretDesc: 'เก็บไว้ในที่เก็บคีย์ของเครื่องนี้เท่านั้น ไม่เคยเก็บใน data.json',
    bedrockIamSessionTokenName: 'โทเคนของเซสชัน (ไม่บังคับ)',
    bedrockIamSessionTokenDesc: 'จำเป็นเฉพาะข้อมูลรับรองชั่วคราว (STS)',
    bedrockIamClearButton: 'ล้างคีย์ IAM ที่บันทึกไว้',
    bedrockIamSaveFailed: 'บันทึกคีย์ IAM ไม่สำเร็จ: {}',
    errorUnknown: 'ข้อผิดพลาดที่ไม่รู้จัก',

    // Issue #137: LLM fallback notices (shown when thinking-dialect
    // fallback or param-stripping happens during a request).
    fallbackThinkingDialect: 'การควบคุมการใช้เหตุผล: เปลี่ยนไปใช้รูปแบบ "{dialect}" (ผู้ให้บริการรายนี้ใช้รูปแบบการควบคุมที่ต่างออกไป) ผลลัพธ์ไม่เปลี่ยน',
    fallbackThinkingNone: 'ปิดการใช้เหตุผลของผู้ให้บริการรายนี้ทั้งหมดแล้ว อาจยังมีข้อความการใช้เหตุผลในคำตอบ หากเป็นเช่นนั้นให้ลองโมเดลอื่น',
    fallbackParamStripped: 'ผู้ให้บริการรายนี้ไม่รองรับพารามิเตอร์ "{field}" จึงตัดออกจากคำขอ พฤติกรรมอาจต่างจากการตั้งค่า',

    // Wiki Init Status
    wikiInitStatusReady: 'สร้างวิกิแล้ว',
    wikiInitStatusNotReady: 'ยังไม่ได้สร้างวิกิ — ระบบจะสร้างให้อัตโนมัติเมื่อนำเข้าครั้งแรก',

    // Wiki Folder
    wikiSection: 'การตั้งค่าวิกิ',
    wikiFolderName: 'โฟลเดอร์วิกิ',
    // v1.24.0: added the "restart Obsidian" hint because the wikiFolder
    // affects engine caches and Query Wiki panels that aren't fully
    // re-bound on settings change.
    wikiFolderDesc: 'ที่เก็บหน้าวิกิที่สร้างขึ้น หลังเปลี่ยนแล้วให้รีสตาร์ต Obsidian เพราะแคชของเอนจินและแผง Query Wiki ที่เปิดอยู่ต้องผูกใหม่',
    wikiFolderPlaceholder: 'wiki',

    // Errors
    errorNoApiKey: 'กรุณาตั้งค่าคีย์ API ก่อน',
    errorNoModel: 'กรุณาเลือกโมเดลก่อน — กดดึงรายการโมเดล หรือกรอก ID ของโมเดลเอง',
    llmNotReady: 'ยังไม่ได้ตั้งค่า LLM ให้ไปที่การตั้งค่า → Karpathy LLM Wiki ตั้งค่าผู้ให้บริการ ดึงรายการโมเดล และผ่านการทดสอบการเชื่อมต่อ',
    errorFetchFailed: 'ไม่สำเร็จ: {}',

    // Query Settings
    querySectionTitle: 'การตั้งค่าการถามตอบจากวิกิ',
    // v1.24.0: renamed from "Max Conversation History" to clarify the
    // semantics — this is a memory-window cap, not a hard storage limit
    // (history is itself a rolling buffer). 1 = each turn independent
    // (no cross-turn memory). Settings UI is a dropdown of presets, so
    // no "presets: 1/10/30/50/100/500" list is needed in the description.
    // v1.24.0: maxConversationHistoryHint was a dead i18n key (never
    // referenced from UI code); the recommendation text now lives inline
    // in the desc.
    maxConversationHistoryName: 'จำนวนรอบความจำของบทสนทนา',
    maxConversationHistoryDesc: 'จำนวนรอบสนทนาก่อนหน้าที่โมเดลจะเห็นเป็นความจำ ค่า 1 หมายถึงแต่ละเทิร์นแยกจากกัน ไม่มีความจำข้ามเทิร์น ค่าที่สูงขึ้นทำให้โมเดลจำเทิร์นก่อนหน้าได้ แนะนำ 1 สำหรับถามตอบครั้งเดียว และ 10–50 สำหรับการค้นคว้าต่อเนื่อง',
    numberRangeValidation: 'กรุณากรอกตัวเลขระหว่าง 1 ถึง 50',
    numberRangeClamped: 'ค่านอกช่วง (1-500) ตั้งเป็น {} ให้อัตโนมัติแล้ว',

    // Query Modal UI
    queryModalTitle: 'Query Wiki — สนทนากับวิกิ',
    queryModalPlaceholder: 'พิมพ์คำถาม...',
    queryModalSendButton: 'ส่ง',
    queryModalStopButton: 'หยุด',
    queryModalSaveButton: 'บันทึกลงวิกิ',
    queryModalClearButton: 'ล้างประวัติ',
    queryModalHistoryCount: 'ประวัติบทสนทนา: {}/{} รอบ',
    queryModalStreaming: 'กำลังสตรีม...',
    queryModalFallbackStreaming: 'ที่นี่ไม่รองรับการสตรีม เปลี่ยนไปรอคำตอบทั้งก้อนแทน กรุณารอสักครู่...',
    queryPhaseSearching: 'กำลังวิเคราะห์ดัชนีวิกิและเลือกหน้าที่เกี่ยวข้อง...',
    queryPhaseFoundPages: 'พบ {count} หน้า: {pages}',
    queryPhaseLoadingPages: 'กำลังโหลดเนื้อหาของหน้า...',
    queryPhaseContextReady: 'บริบทพร้อมแล้ว กำลังสร้างคำตอบ...',
    queryPhaseGenerating: 'กำลังสร้าง... (ผ่านไป {time} วินาที)',
    queryPhaseNonStreaming: 'โหมดไม่สตรีม กำลังสร้างคำตอบ... (ผ่านไป {time} วินาที)',
    queryModalErrorPrefix: 'ข้อผิดพลาด: ',
    queryModalHint: 'คำถามอ้างอิงเนื้อหาในวิกิของคุณ กด "บันทึกลงวิกิ" เพื่อเก็บบทสนทนาที่มีค่าไว้เป็นหน้าวิกิ',

    // v1.20.0: Query Wiki thinking-block collapsible summary
    queryThinkingSummary: 'การใช้เหตุผล',
    queryThinkingSteps: 'ขั้น',

    // Error Messages
    errorLLMClientNotInit: 'ยังไม่ได้เริ่มไคลเอนต์ LLM กรุณาบันทึกการตั้งค่าก่อน',
    errorIngestFailed: 'นำเข้าไม่สำเร็จ: ',
    errorQueryFailed: 'ถามไม่สำเร็จ: ',
    fileWriteFailed: 'สร้างหรืออัปเดตไฟล์ไม่สำเร็จ: {path}',

    // Success Messages
    ingestSuccess: 'นำเข้าสำเร็จ: สร้าง {} หน้า อัปเดต {} หน้า',
    querySuccess: 'ถามตอบเสร็จแล้ว',
    lintSuccess: 'ตรวจ lint เสร็จแล้ว',
    lintReadingPages: 'กำลังอ่านหน้าวิกิ {count} หน้า...',
    lintReadingPagesProgress: 'กำลังอ่านหน้าวิกิ: {current}/{total}...',
    lintScanningLinks: 'กำลังหาลิงก์ที่ไม่มีปลายทาง...',
    lintScanningLinksProgress: 'กำลังหาลิงก์ที่ไม่มีปลายทาง: {current}/{total}...',
    lintCheckingDuplicates: 'กำลังหาหน้าที่ซ้ำกัน...',
    lintCheckingDuplicatesProgress: 'กำลังตรวจหน้าซ้ำ: รอบที่ {current} ...',
    lintFixingPolluted: 'กำลังซ่อมหน้า {current}/{total}: {title} → {newTitle}',
    lintModalFixPolluted: '🧹 ซ่อมหน้าที่มีรูปแบบผิด ({count})',
    lintDuplicateCheckFailed: 'การหาหน้าซ้ำไม่สำเร็จ — ดูรายละเอียดในคอนโซล',
    lintDuplicateCheckFailedDetail: 'การหาหน้าซ้ำไม่สำเร็จที่ขั้น {step}: {error}',
    lintMergeItemFailed: 'รวมหน้าไม่สำเร็จ: {source} → {target} — {error}',
    lintAliasesMissing: 'alias ที่ขาด: {count} หน้าไม่มี alias',
    lintAliasesSection: 'หน้าที่ไม่มี alias [{count}]',
    lintAliasesItem: '- [[{page}]]',
    lintAliasesCompleteBtn: 'เติม alias ({count})',
    lintAliasesFilling: 'กำลังสร้าง alias {current}/{total}: {page}',
    lintAliasesFilled: 'เติม alias เสร็จแล้ว เติมให้ {filled}/{total} หน้า',
    lintAliasesFillFailed: 'สร้าง alias ไม่สำเร็จ: {page} — {error}',
    // Issue #85 v7: tag-violation retag notifications
    lintTagViolationFiring: 'กำลังติดแท็กใหม่ {current}/{total}: {path}',
    lintTagViolationFailed: 'ติดแท็กใหม่ไม่สำเร็จสำหรับ {path}: {error}',
    lintTagViolationFixed: 'ติดแท็กใหม่เสร็จแล้ว แก้ไข {fixed}/{total} หน้า',
    lintTagViolationFixedNone: 'ติดแท็กใหม่เสร็จแล้ว ไม่มีหน้าใดต้องแก้ (โมเดลคงแท็กเดิมไว้)',
    lintTagViolationSection: 'หน้าที่มีแท็กนอกชุด [{count}]',
    lintTagViolationItem: '- [[{path}]] — ไม่ถูกต้อง: {tags}',
    lintTagViolationRetagBtn: '🏷️ ติดแท็กใหม่ {count} หน้าด้วยโมเดล',
    lintFixItemFailed: 'ซ่อมไม่สำเร็จ: [[{target}]] — {error}',
    lintLinkItemFailed: 'เชื่อมลิงก์ไม่สำเร็จ: {page} — {error}',
    lintRetrying: 'กำลังลองใหม่ ({attempt}/{max}) หลังเกิดข้อผิดพลาด...',
    lintAnalyzingLLM: 'โมเดลกำลังตรวจสุขภาพของวิกิ...',
    saveToWikiSuccess: 'บันทึกบทสนทนาลงวิกิแล้ว!',
    querySaveAlreadyExists: 'หมายเหตุ: ไม่ได้เขียนอะไรลงไป (วิกิมีความรู้นี้อยู่แล้ว):',
    saveSummary: '{entities} เอนทิตี {concepts} แนวคิด {pages} หน้า',
    aliasAdded: 'เพิ่ม alias \'{alias}\' ให้หน้า \'{page}\' แล้ว',

    // Status Messages
    ingestingSources: 'กำลังนำเข้าแหล่งข้อมูล...',
    queryingWiki: 'กำลังถามวิกิ...',
    lintingWiki: 'กำลังตรวจวิกิ...',
    savingToWiki: 'กำลังบันทึกบทสนทนาลงวิกิ...',
    clearingHistory: 'กำลังล้างประวัติบทสนทนา...',

    // Buttons
    ingestButton: 'นำเข้า',
    queryButton: 'ถาม',
    lintButton: 'Lint',
    cancelButton: 'ยกเลิก',

    // Links
    karpathyGistLink: 'Gist เรื่อง LLM Wiki ของ Karpathy',
    obsidianPluginAPI: 'Obsidian Plugin API',
    anthropicSDK: 'Anthropic SDK',
    openaiSDK: 'OpenAI SDK',

    // v1.24.1 PATCH Bedrock Stage 1
    bedrockRegionName: 'ภูมิภาค AWS',
    bedrockRegionDesc: 'ภูมิภาค Amazon Bedrock ของบัญชีนี้ ใช้กำหนดที่อยู่ปลายทาง bedrock-mantle และ Base URL แทนที่ไม่ได้',
    bedrockRegionHint: 'bedrock-mantle ใช้ได้ใน 18 ภูมิภาค โมเดลที่ใช้ได้ต่างกันตามภูมิภาค',

    // Other
    availableModelsLoading: 'กำลังโหลดรายการโมเดล...',
    noModelsAvailable: 'ไม่มีโมเดลให้ใช้',

    // LLM Language Hint
    llmLanguageHint: 'ตอบเป็นภาษาไทย',

    // Schema Configuration
    schemaSection: 'การตั้งค่าสคีมา',
    enableSchemaName: 'ใช้สคีมา',
    enableSchemaDesc: 'สร้างไฟล์ schema/config.md และแนบไปกับทุกพรอมต์ เพื่อให้วิกิมีโครงสร้างที่แน่นอน',
    viewSchemaButton: 'ดูหรือแก้ไขสคีมา',
    regenerateSchemaButton: 'สร้างสคีมาเริ่มต้นใหม่',
    schemaRegeneratedNotice: 'สร้างสคีมาเริ่มต้นใหม่แล้ว',
    schemaRegenerateFailed: 'สร้างสคีมาไม่สำเร็จ',

    // Wiki Output Language
    wikiLanguageName: 'ภาษาของเนื้อหาวิกิ',
    wikiLanguageDesc: 'หน้าวิกิทั้งหมด ดัชนี บันทึกการทำงาน และคำตอบจากคำถามจะใช้ภาษานี้',
    customWikiLanguageOption: 'กรอกเอง...',
    customWikiLanguageHint: 'กรอกชื่อภาษา (เช่น ไทย อาหรับ) ชื่อนี้จะถูกส่งให้โมเดลเป็นคำสั่งเรื่องภาษาของผลลัพธ์',
    customWikiLanguagePlaceholder: 'เช่น ไทย',

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
    extractionSectionTitle: 'การสกัดข้อมูล',
    extractionGranularityName: 'ปริมาณต่อแหล่งข้อมูล',
    extractionGranularityDesc: 'กำหนดจำนวนเอนทิตีและแนวคิดที่สกัดจากไฟล์ต้นทางหนึ่งไฟล์ ค่าที่สูงขึ้นหมายถึงหน้าจำนวนมากขึ้นและใช้โทเคนมากขึ้น\nละเอียด: วิเคราะห์เชิงลึก มาตรฐาน: โน้ตประจำวัน หยาบ: ภาพรวมเร็ว น้อยที่สุด: ไฟล์เกิน 100 ไฟล์ในครั้งเดียว (ประมาณ 5 รายการต่อแหล่ง ไม่ลงรายละเอียด) กำหนดเอง: ตั้งขีดจำกัดเอง (ถึง 500)\nเคล็ดลับ: โฟลเดอร์ที่มีไฟล์มากให้ใช้ น้อยที่สุด หรือ หยาบ เพื่อประหยัดเวลาและค่าใช้จ่าย',
    extractionGranularityFine: 'ละเอียด — วิเคราะห์เชิงลึก (ไม่เกิน 100 รายการ)',
    extractionGranularityStandard: 'มาตรฐาน — โน้ตประจำวัน (ไม่เกิน 50 รายการ)',
    extractionGranularityCoarse: 'หยาบ — ภาพรวมเร็ว (ไม่เกิน 10 รายการ)',
    extractionGranularityMinimal: 'น้อยที่สุด — ไฟล์เกิน 100 ไฟล์ในครั้งเดียว (ไม่เกิน 5 รายการ)',
    extractionGranularityCustom: 'กำหนดเอง — ตั้งขีดจำกัดเอง (1~500)',
    customEntityLimitName: 'ขีดจำกัดเอนทิตีที่กำหนดเอง',
    customEntityLimitDesc: 'จำนวนเอนทิตีสูงสุดที่สกัดจากไฟล์ต้นทางหนึ่งไฟล์ (1-500)',
    customConceptLimitName: 'ขีดจำกัดแนวคิดที่กำหนดเอง',
    customConceptLimitDesc: 'จำนวนแนวคิดสูงสุดที่สกัดจากไฟล์ต้นทางหนึ่งไฟล์ (1-500)',

    // Issue #85 v2: Tag Vocabulary (chip input UX, embedded in Wiki Configuration)
    tagVocabularyInlineDesc: 'ชุดแท็กที่กำหนดไว้ตายตัวสำหรับ frontmatter ของเอนทิตีและแนวคิด แท็กซ้อนของ Obsidian ที่ใช้ "/" จะถูกเก็บไว้',
    tagVocabularyModeName: 'การตั้งค่าชุดแท็ก',
    tagVocabularyModeDescDefault: 'ค่าเริ่มต้นใช้แท็กที่ให้มา: {} ถ้าต้องการกำหนดเองให้เลือก กำหนดเอง',
    tagVocabularyModeDescCustom: 'กำหนดเอง: ตั้งแท็กเอนทิตีและแนวคิดเองด้านล่าง พิมพ์แล้วกด Enter หรือเครื่องหมายจุลภาคเพื่อเพิ่ม กด × เพื่อลบ',
    // v1.25.10 PATCH Issue #368 — clarification, not enforcement. The custom
    // vocabulary is a SCHEMA INJECTION HINT for the LLM, not a write-time
    // gate. Small/local models may still emit out-of-vocabulary types; the
    // lint "out-of-vocabulary type" diagnostic surfaces those pages for review.
    tagVocabularyNotEnforcedHint: 'เป็นเพียงคำใบ้ให้สคีมา — โมเดลยังสร้างแท็กนอกชุดได้ ใช้ lint เพื่อหาและแก้หน้าที่เป็นเช่นนั้น',
    tagVocabularyModeDefault: 'ค่าเริ่มต้น (แท็กย่อยที่ให้มา)',
    tagVocabularyModeCustom: 'กำหนดเอง (ผู้ใช้กำหนด)',
    customEntityTagsName: 'แท็กเอนทิตีที่กำหนดเอง',
    customEntityTagsDesc: 'กด Enter หรือเครื่องหมายจุลภาคเพื่อเพิ่มแท็ก กด × เพื่อลบ แท็กซ้อนที่ใช้ "/" จะถูกเก็บไว้',
    customEntityTagsPlaceholder: 'บุคคล, องค์กร, โครงการ, สถานที่',
    customConceptTagsName: 'แท็กแนวคิดที่กำหนดเอง',
    customConceptTagsDesc: 'กด Enter หรือเครื่องหมายจุลภาคเพื่อเพิ่มแท็ก กด × เพื่อลบ แท็กซ้อนที่ใช้ "/" จะถูกเก็บไว้',
    customConceptTagsPlaceholder: 'ทฤษฎี, วิธี, สาขา, ปรากฏการณ์, คำศัพท์',
    chipDuplicateHint: 'มีแท็กนี้อยู่แล้ว จึงข้ามไป',

    // v1.27.3: topic-scoped prompt customization (extraction focus + content requirements)
    promptFocusSectionName: 'การปรับพรอมต์',
    promptFocusOpenSchema: 'ไปที่สคีมา',
    extractionFocusName: 'จุดเน้นในการสกัด',
    extractionFocusDesc: 'ข้อความอิสระที่ต่อท้ายพรอมต์การสกัด เพื่อบอกว่าวิกิควรให้ความสำคัญกับเอนทิตีและแนวคิดด้านใด ไม่เปลี่ยนรูปแบบ JSON หรือกฎเรื่องแท็ก ว่างหมายถึงปิด ใช้ได้ไม่เกิน 4000 ตัวอักษร',
    extractionFocusPlaceholder: 'เช่น ข้ามการกล่าวถึงผ่าน ๆ ทุกคนที่ถูกอ้างคำพูดได้หนึ่งหน้า',
    contentRequirementsName: 'ข้อกำหนดด้านเนื้อหา',
    contentRequirementsDesc: 'ข้อความอิสระที่ใช้ **ภายในส่วนที่มีอยู่แล้วในหน้า**: การเน้น ความครอบคลุม และลำดับ ไม่มีการเพิ่มส่วนใหม่ รายการส่วนที่ปลั๊กอินถืออยู่เป็นตัวกำหนดว่าอะไรจะอยู่รอดหลังการเขียน กฎเรื่องการอ้างอิงและกฎกันการแต่งเนื้อหายังเป็นของระบบ ว่างหมายถึงปิด ใช้ได้ไม่เกิน 4000 ตัวอักษร',
    contentRequirementsPlaceholder: 'เช่น ขึ้นต้นทุกส่วนด้วยประโยคสรุปหนึ่งประโยค และให้แต่ละส่วนยาวไม่เกิน 150 คำ',
    // Ingestion Acceleration
    accelerationSectionTitle: 'เร่งการนำเข้า',
    pageGenerationConcurrencyName: 'การเรียกโมเดลพร้อมกัน',
    pageGenerationConcurrencyDesc: 'จำนวนการเรียกโมเดลที่ทำพร้อมกันระหว่างนำเข้าและตรวจ lint ค่าที่สูงขึ้นเร็วขึ้น แต่เพิ่มค่าใช้จ่ายและอาจชนขีดจำกัดของผู้ให้บริการ',
    concurrencyValueSingular: 'จำนวนพร้อมกันปัจจุบัน: {} (ทีละรายการ — ปลอดภัยที่สุด)',
    concurrencyValuePlural: 'จำนวนพร้อมกันปัจจุบัน: {} (พร้อมกัน)',
    batchDelayName: 'หน่วงระหว่างรอบ (มิลลิวินาที)',
    batchDelayDesc: 'ระยะหน่วงระหว่างรอบที่ทำพร้อมกัน เพื่อไม่ให้ชนขีดจำกัดของผู้ให้บริการ (100-10000 มิลลิวินาที) ปัจจุบัน: {} มิลลิวินาที เพิ่มค่านี้ถ้าพบข้อผิดพลาด 429',

    // Auto Maintenance
    autoMaintainSection: 'การดูแลอัตโนมัติ',
    autoMaintainBetaBadge: 'เบต้า — คุณลักษณะทดลอง อาจมีข้อผิดพลาด แนะนำสำหรับผู้ใช้ขั้นสูงเท่านั้น',
    autoWatchName: 'เฝ้าดูโฟลเดอร์',
    autoWatchDesc: 'ตรวจจับไฟล์ .md ใหม่หรือที่เปลี่ยนแปลงในโฟลเดอร์ที่เฝ้าดูโดยอัตโนมัติ แล้วแจ้งหรือนำเข้าให้เลย',
    watchedFoldersName: 'โฟลเดอร์ที่เฝ้าดู',
    watchedFoldersDesc: 'โฟลเดอร์ที่คุณประกาศว่าเป็นแหล่งข้อมูล แท็กในโฟลเดอร์เหล่านี้ประกอบเป็นชุดแท็กตามโดเมนที่เสนอตอนนำเข้า และเมื่อเปิดการเฝ้าดู จะถูกตรวจหาเนื้อหาใหม่ด้วย กด "เพิ่มโฟลเดอร์" เพื่อเลือกจาก vault',
    addWatchedFolderButton: 'เพิ่มโฟลเดอร์',
    removeWatchedFolderButton: 'ลบ',
    webClipperPresetName: 'เฝ้าดู Clippings (Web Clipper)',
    webClipperPresetDesc: 'เพิ่มโฟลเดอร์ Clippings/ ที่ Obsidian Web Clipper ใช้ เข้าในรายการเฝ้าดู สิ่งที่คุณตัดจากเว็บจะถูกนำเข้าสู่วิกิอัตโนมัติ',
    noWatchedFoldersHint: 'ยังไม่ได้ตั้งโฟลเดอร์ เพิ่มโฟลเดอร์หรือเปิดค่าที่ตั้งไว้สำหรับ Clippings',
    autoWatchModeName: 'รูปแบบการเฝ้าดู',
    autoWatchModeDesc: '"แจ้งเท่านั้น" จะถามก่อน ส่วน "นำเข้าอัตโนมัติ" ทำให้เลยโดยไม่ถาม',
    watchModeNotify: 'แจ้งเท่านั้น',
    watchModeAuto: 'นำเข้าอัตโนมัติ',
    autoWatchDebounceName: 'ระยะรอก่อนทำงาน (วินาที)',
    autoWatchDebounceDesc: 'รอนานเท่าใดหลังไฟล์เปลี่ยนก่อนเริ่มนำเข้า (1-60 วินาที)',
    autoWatchDebounceClamped: 'ค่านอกช่วง (1-60) ตั้งเป็น {} ให้อัตโนมัติแล้ว',
    periodicLintName: 'ตรวจ lint ตามกำหนดเวลา',
    periodicLintDesc: 'ให้โมเดลตรวจวิกิตามกำหนดเวลา แต่ทำเฉพาะเมื่อไฟล์ต้นทางเปลี่ยนตั้งแต่ครั้งก่อน',
    periodicLintOff: 'ปิด',
    periodicLintDaily: 'ทุกวัน',
    periodicLintWeekly: 'ทุกสัปดาห์',
    periodicLintMonthly: 'ทุกเดือน',
    autoSmartFixName: 'ซ่อมอัตโนมัติอัจฉริยะ',
    autoSmartFixDesc: 'เมื่อตรวจ lint ให้ใช้การซ่อมทั้งหมดทันทีโดยไม่ต้องแสดงรายงานก่อน สรุปการซ่อมยังแสดงเมื่อเสร็จ',
    autoSmartFixNotice: 'ซ่อมอัตโนมัติอัจฉริยะ: กำลังใช้การซ่อมทั้งหมด...',

    autoIngestLevelName: 'การแจ้งเมื่อนำเข้าอัตโนมัติเสร็จ',
    autoIngestLevelDesc: 'จะแจ้งอย่างไรเมื่อการนำเข้าอัตโนมัติเสร็จ "ประกาศ" เป็นข้อความสั้นและไม่ขวางการทำงาน "หน้าต่าง" เปิดรายงานเต็ม ปิดไว้เมื่อรูปแบบการเฝ้าดูเป็น "แจ้งเท่านั้น"',
    autoIngestLevelNotice: 'ประกาศ (ไม่ขวางการทำงาน)',
    autoIngestLevelModal: 'หน้าต่าง (รายงานเต็ม)',
    startupCheckName: 'ซ่อมเร็วเมื่อเริ่มทำงาน',
    startupCheckDesc: 'ซ่อมปัญหาการจัดรูปแบบเล็กน้อยอัตโนมัติเมื่อโหลดปลั๊กอิน (แหล่งข้อมูล ลิงก์ซ้อนสองชั้น) และตรวจโครงสร้างโฟลเดอร์วิกิ เปิดไว้เป็นค่าเริ่มต้น',
    startupCheckNoticeLevelName: 'แสดงผลการซ่อมเร็ว',
    startupCheckNoticeLevelDesc: 'การซ่อมเร็วทำงานทุกครั้งที่เริ่มปลั๊กอิน (โน้ตต้อนรับ โครงสร้างโฟลเดอร์ การจัดระเบียบแหล่งข้อมูล หน้าที่ไม่สมบูรณ์ หัวบันทึก) เลือกว่าจะแสดงประกาศสรุปหลังเริ่มหรือไม่ โหมดเงียบจะเขียนลงคอนโซลและแผงประวัติเท่านั้น',
    startupCheckNoticeVisible: 'แสดง (มีประกาศ)',
    startupCheckNoticeSilent: 'เงียบ (ไม่มีประกาศ)',
    suggestSchemaCommand: 'เสนอการปรับสคีมา',
    autoMaintainCostWarning: '⚠️ เรื่องค่าใช้จ่าย: การดูแลอัตโนมัติใช้โทเคน API "นำเข้าอัตโนมัติ" เรียกโมเดลทุกครั้งที่ไฟล์ต้นทางเปลี่ยน "ตรวจ lint ตามกำหนดเวลา" ตรวจตามเวลาแต่เฉพาะเมื่อพบการเปลี่ยนแปลงของแหล่งข้อมูล ตั้งค่าให้รอบคอบเพื่อเลี่ยงค่าใช้จ่ายที่ไม่คาดคิด',

    // Notices
    startupCheckSummary: 'วิกิมี {pages} หน้า ({entities} เอนทิตี {concepts} แนวคิด {sources} แหล่งข้อมูล)',
    watcherActiveNotice: 'วิกิ: การเฝ้าดูไฟล์ทำงานอยู่ — กำลังติดตามโฟลเดอร์ที่เฝ้าดู',
    watchIngestNotice: 'วิกิ: มี {count} ไฟล์ใน sources/ เปลี่ยนแปลง เลือก "{command}" เพื่อประมวลผล',

    // Startup quick fixes detail (Issue #81)
    startupCheckTitle: 'การซ่อมเร็วของวิกิเสร็จแล้ว',
    startupCheckStructureLabel: 'โครงสร้างวิกิ',
    startupCheckStructureOk: 'ครบถ้วน',
    startupCheckStructureMissing: 'ยังไม่ครบ — จะสร้างให้อัตโนมัติเมื่อนำเข้าครั้งแรก',
    startupCheckSourcesLabel: 'จัดระเบียบแหล่งข้อมูลแล้ว',
    startupCheckSourcesClean: 'เรียบร้อยอยู่แล้ว',
    startupCheckSourcesCleaned: 'จัดระเบียบ {files} ไฟล์ แก้ไข {entries} รายการ',
    startupCheckIncompleteClean: 'หน้าที่ไม่สมบูรณ์: ไม่มี',
    startupCheckIncompleteArchived: 'หน้าที่ไม่สมบูรณ์: ย้าย {count} หน้าไปถังขยะแล้ว (กู้คืนได้จาก .trash)',
    startupCheckDisableHint: 'ถ้าต้องการปิด ให้ไปที่การตั้งค่า → การดูแลอัตโนมัติ → แสดงผลการซ่อมเร็ว',
    autoIngestRunning: 'กำลังนำเข้าไฟล์ที่เปลี่ยน {count} ไฟล์โดยอัตโนมัติ...',
    autoIngestComplete: 'นำเข้าอัตโนมัติเสร็จ: สำเร็จ {success} ล้มเหลว {fail}',
    scheduledLintRunning: 'กำลังตรวจวิกิตามกำหนดเวลา...',
    wikiLintStats: 'Lint วิกิ: {pages} หน้า ({entities} เอนทิตี {concepts} แนวคิด {sources} แหล่งข้อมูล)',
    wikiHealthStats: 'สุขภาพวิกิ: {pages} หน้า ({entities} เอนทิตี {concepts} แนวคิด {sources} แหล่งข้อมูล){indexStatus}',
    lintWikiStart: 'กำลังเริ่มตรวจวิกิ...',
    lintWikiComplete: 'ตรวจวิกิเสร็จแล้ว',
    lintWikiFailed: 'ตรวจวิกิไม่สำเร็จ',
    analyzingSchema: 'กำลังวิเคราะห์วิกิและสร้างข้อเสนอสำหรับสคีมา...',
    schemaSuggestionGenerated: 'ข้อเสนอสคีมาอยู่ใน wiki/schema/suggestions.md',
    noSchemaUpdateNeeded: 'สคีมายังไม่ต้องปรับ',
    schemaSuggestionFailed: 'สร้างข้อเสนอสคีมาไม่สำเร็จ',
    // v1.22.0 #97: Schema diff Modal — IDE-style preview + Apply/Regenerate
    schemaDiffTitle: 'ตัวอย่างการเปลี่ยนแปลงของสคีมา',
    schemaDiffSummary: '+{add} / -{del} บรรทัด',
    schemaDiffRegenerateLabel: 'ปรับข้อเสนอให้ละเอียดขึ้น (ไม่บังคับ):',
    schemaDiffRegenerateBtn: 'สร้างใหม่',
    schemaDiffOpenFileBtn: 'เปิดไฟล์',
    schemaDiffApplyBtn: 'ใช้',
    schemaDiffApplied: 'อัปเดตสคีมาแล้ว สำรองไว้ที่: {path}',
    schemaDiffEmptyTitle: 'ไม่มีข้อเสนอให้เปลี่ยนแปลง',
    schemaDiffFailed: 'ใช้สคีมาไม่สำเร็จ: {reason}',
    schemaDiffRestoreHint: 'สำรองไว้ที่ {path} ถ้าต้องการย้อนกลับ ให้เปลี่ยนชื่อไฟล์นั้นเป็น "wiki/schema/config.md" ในตัวจัดการไฟล์ ระบบเก็บสำรองไว้ 3 ชุดล่าสุด',
    schemaRegenerateNoBody: 'สร้างใหม่สำเร็จ แต่โมเดลไม่ได้ส่งเนื้อหาใหม่กลับมา',
    schemaNotFoundNotice: 'ไม่พบไฟล์สคีมา เปิดใช้สคีมาเพื่อสร้างไฟล์',
    selectFolderNoMdFiles: 'โฟลเดอร์นี้ไม่มีไฟล์ Markdown: {path}',
    batchIngestSkipNotice: 'ข้าม {skipped}/{total} ไฟล์ที่นำเข้าแล้ว กำลังนำเข้าไฟล์ใหม่ {new} ไฟล์...',
    batchIngestAllIngested: 'ไฟล์ทั้ง {total} ไฟล์ในโฟลเดอร์นี้นำเข้าแล้วทั้งหมด',
    batchIngestStarting: 'กำลังนำเข้า {count} ไฟล์จาก "{folder}" — อาจใช้เวลาหลายนาที เมื่อเสร็จจะมีรายงานแสดงขึ้น',
    batchIngestComplete: 'นำเข้าแบบกลุ่มเสร็จ: สำเร็จ {success}/{total} ล้มเหลว {fail}',
    batchIngestFailedFiles: 'ไฟล์ที่ล้มเหลว:',
    historyTruncated: 'ตัดประวัติเหลือ {max} รอบล่าสุด',
    historyCleared: 'ล้างประวัติแล้ว',

    // User Feedback Loop
    reviewedPagePreserved: 'เก็บเนื้อหาที่คุณตรวจแล้วไว้สำหรับ: {}',

    // Query-to-Wiki feedback
    querySuggestSaveTitle: 'บันทึกลงวิกิไหม',
    querySuggestSaveDesc: 'บทสนทนานี้มีความรู้ที่มีค่า ต้องการบันทึกลงวิกิหรือไม่',
    querySuggestSaveYes: 'บันทึก',
    querySuggestSaveNo: 'ไว้ก่อน',

    // Ingestion Report
    ingestReportElapsedTime: 'เวลาที่ใช้',
    ingestReportSkippedFiles: 'ข้าม (นำเข้าแล้ว)',
    ingestReportRejectedFiles: 'ข้าม',
    rejectionReasonEmpty: 'ว่างเปล่า',
    rejectionReasonType: 'ชนิดไฟล์ไม่รองรับ',
    rejectionReasonDuplicate: 'เนื้อหาซ้ำ',
    rejectionReasonPdfUnsupported: 'ผู้ให้บริการอ่าน PDF ไม่ได้',
    rejectionReasonMineruPageLimit: 'เกินขีดจำกัดจำนวนหน้าของ MinerU',
    rejectionReasonMineruSizeLimit: 'เกินขีดจำกัดขนาดไฟล์ของ MinerU',
    ingestReportFailedGuidance: 'รายการเหล่านี้สร้างให้อัตโนมัติไม่ได้ คุณสร้างหน้าเองได้ หรือลดปริมาณต่อแหล่งข้อมูลแล้วนำเข้าไฟล์นั้นใหม่',

    // Command Names (sentence case per Obsidian Bot rule 1)
    cmdIngestSource: 'นำเข้าแหล่งข้อมูลเดียว',
    cmdIngestFolder: 'นำเข้าจากโฟลเดอร์',
    cmdIngestMultipleFiles: 'นำเข้าหลายไฟล์',
    cmdQueryWiki: 'ถามวิกิ',
    cmdLintWiki: 'ตรวจวิกิ',
    cmdRegenerateIndex: 'สร้างดัชนีใหม่',
    cmdSuggestSchema: 'เสนอการปรับสคีมา',
    cmdCancelIngestion: 'หยุดการนำเข้าปัจจุบัน',
    cmdIngestActiveFile: 'นำเข้าไฟล์ที่เปิดอยู่',
    cmdViewHistory: 'ดูประวัติการทำงาน',
    noActiveFile: 'ยังไม่มีไฟล์ที่เปิดอยู่',
    mdOnlyFile: 'นำเข้าได้เฉพาะไฟล์ Markdown',

    // v1.26.3 PATCH (B2.5 follow-up): single-file ingest + batch-check
    // Toasts. These feed showProgressFor → persistent Notice (Toast), which
    // is separate from the status-bar channel — they were hardcoded English
    // ('Ingesting: <file>', 'Checking for already-ingested files...'),
    // producing English Toasts on non-English vaults.
    ingestSingleFileStart: 'กำลังนำเข้า: {filename}',
    ingestCheckingExisting: 'กำลังตรวจว่าไฟล์ใดนำเข้าแล้ว...',
    // Auto-lint completion Notice ("N findings" phrase — full phrase so
    // each locale can order/pluralize freely).
    lintFindingsSummary: '{total} ข้อที่พบ',

    // Ingestion status bar
    ingestionStatusBar: 'กำลังนำเข้า... กดเพื่อหยุด',
    lintStatusBar: 'กำลังตรวจ... กดเพื่อหยุด',
    ingestStatusAnalyzing: 'กำลังนำเข้า… (กดเพื่อหยุด)',
    lintStatusAnalyzing: 'กำลังตรวจ… (กดเพื่อหยุด)',
    // v1.25.11 PATCH #169 — fine-grained stage hints for the status bar.
    // These labels are ADD-only emission sandwiched between the page name
    // and the always-visible base label (e.g. "My Note · Generating summary ·
    // Ingesting… (click to cancel)"). They never replace the base label, so
    // the cancel affordance is preserved through every long-running stage.
    ingestStageAnalyze: 'กำลังวิเคราะห์แหล่งข้อมูล',
    ingestStageSummary: 'กำลังสร้างบทสรุป',
    ingestStageEntity: 'กำลังสร้างเอนทิตี',
    ingestStageConcept: 'กำลังสร้างแนวคิด',
    ingestStageRetry: 'ลองใหม่กับหน้าที่ล้มเหลว',
    ingestStageSave: 'กำลังบันทึกหน้า',
    ingestStageIndex: 'กำลังสร้างดัชนี',
    pdfStageReading: 'กำลังอ่าน PDF',
    pdfStageConverting: 'กำลังแปลง PDF',
    pdfStageSidecar: 'กำลังเขียนไฟล์เคียง',
    lintStagePrep: 'กำลังอ่านหน้า',
    lintStageProgrammatic: 'กำลังตรวจลิงก์',
    lintStageAnalyzing: 'โมเดลกำลังวิเคราะห์วิกิ',
    lintStageDedup: 'กำลังหาหน้าซ้ำ',
    lintStageContradiction: 'กำลังหาข้อขัดแย้ง',
    ingestionCancelling: 'กำลังหยุด — จะหยุดหลังรอบปัจจุบันเสร็จ',
    ingestionCancelled: 'หยุดการนำเข้าแล้ว',
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
    ingestBatchInitial: 'กำลังวิเคราะห์รอบที่ 1/{total}...',
    ingestBatchProgress: 'กำลังวิเคราะห์รอบที่ {current}/{total} (ถึงตอนนี้ {entities} เอนทิตี {concepts} แนวคิด)...',
    ingestBatchProcessed: 'วิเคราะห์รอบที่ {current} แล้ว กำลังประมวลผล...',
    ingestAnalyzing: 'กำลังวิเคราะห์: {filename}',
    ingestCreatingSummary: '[{step}/{totalSteps}] กำลังสร้างบทสรุป...',
    ingestCreatingItem: '[{step}/{totalSteps}] {type}: {name}',
    ingestUpdating: '[{step}/{totalSteps}] กำลังอัปเดต: {name}',
    ingestGeneratingIndex: '[{step}/{totalSteps}] กำลังสร้างดัชนี...',
    ingestItemTypeEntity: 'เอนทิตี',
    ingestItemTypeConcept: 'แนวคิด',
    convAnalyzing: 'กำลังวิเคราะห์บทสนทนา...',
    convCheckingExisting: 'กำลังตรวจว่ามีความรู้นี้อยู่แล้วหรือไม่...',
    convAlreadyExists: 'ความรู้นี้มีอยู่ในวิกิแล้ว',
    convCreatingSummary: 'กำลังสร้างหน้าบทสรุป...',
    convGeneratingSummary: 'กำลังสร้างหน้าบทสรุป...',
    convSavingEntity: 'กำลังบันทึกเอนทิตี: {name}',
    convSavingConcept: 'กำลังบันทึกแนวคิด: {name}',
    convGeneratingIndex: 'กำลังสร้างดัชนี...',

    // Lint Report
    lintReportTitle: 'รายงานการตรวจวิกิ',
    lintReportSummary: 'ภาพรวมวิกิ: ทั้งหมด {total} หน้า, {aliasesMissing} หน้าไม่มี alias, {duplicates} หน้าซ้ำ, {deadLinks} ลิงก์ที่ไม่มีปลายทาง (ในนั้น {deadLinkFromDup} เกี่ยวกับหน้าซ้ำ), {orphans} หน้าที่ไม่มีใครลิงก์ถึง ({orphanFromDup} เป็นหน้าซ้ำ), {emptyPages} หน้าว่าง, {ungroundedQuotes} คำอ้างที่ไม่มีข้อความรองรับ, {tagViolations} แท็กนอกชุด การตรวจใช้เวลา {elapsedSeconds} วินาที',

    // Advanced LLM Settings (v1.20.0: default = no provider-specific overrides).
    // v1.26.0 (#382 item 2): renamed advancedSettingsModeName →
    // advancedLlmModeName so the label scopes to LLM sampling params and is
    // not confused with the generic bottom "Advanced settings" panel.
    advancedLlmModeName: 'พารามิเตอร์ LLM ขั้นสูง',
    advancedLlmModeDesc: 'โหมดเริ่มต้นทำตามที่ผู้ให้บริการโมเดลแนะนำ ให้เลือก กำหนดเอง เฉพาะเมื่อมีเหตุผลชัดเจน เช่น โมเดลหนึ่งต้องการอุณหภูมิคงที่ หรือคุณต้องการตัดข้อความการใช้เหตุผลออกจากคำตอบ',
    advancedSettingsDefault: 'ค่าเริ่มต้น (ตามผู้ให้บริการ)',
    advancedSettingsCustom: 'กำหนดเอง (แทนที่ผู้ให้บริการ)',
    // v1.26.0 (#382 item 2): bottom "Advanced settings" panel — generic
    // home for all advanced-user settings that are NOT LLM sampling params
    // (those live under advancedLlmModeName above). Off by default; the
    // toggle reveals lint thresholds, the Welcome note, and future knobs.
    advancedSettingsSection: 'การตั้งค่าขั้นสูง',
    showAdvancedSettingsName: 'แสดงการตั้งค่าขั้นสูง',
    showAdvancedSettingsDesc: 'เปิดเพื่อแสดงการตั้งค่าขั้นสูงด้านล่าง ปิดแล้วจะซ่อนและกลับไปใช้ค่าเริ่มต้น',
    disableThinkingName: 'ปิดการใช้เหตุผล',
    disableThinkingDesc: 'ปิดข้อความการใช้เหตุผลของโมเดลในคำตอบ ค่าเริ่มต้นคือปิดอยู่ เพราะโมเดลตัดสินเองว่าจะแสดงการใช้เหตุผลหรือไม่ และมักให้คำตอบที่ดีกว่า เปิดเฉพาะเมื่อผู้ให้บริการของคุณใส่ข้อความการใช้เหตุผลดิบลงในคำตอบและคุณต้องการคำตอบที่สะอาด',
    thinkingEffortName: 'ระดับการใช้เหตุผล',
    thinkingEffortDesc: 'โมเดลใช้เหตุผลได้มากเท่าใด สำหรับผู้ให้บริการที่มีการตั้งค่านี้ ค่าเริ่มต้นไม่ส่งอะไรไปและให้โมเดลเลือกเอง ระดับที่สูงขึ้นอาจให้คำตอบที่ดีขึ้นและใช้โทเคนกับเวลามากขึ้นเสมอ ผู้ให้บริการแปลระดับนี้เอง ชื่อเดียวกันจึงอาจหมายถึงปริมาณที่ต่างกันในแต่ละโมเดล',
    thinkingEffortDefault: 'ค่าเริ่มต้น (ผู้ให้บริการเป็นผู้ตัดสิน)',
    thinkingEffortLow: 'ต่ำ',
    thinkingEffortMedium: 'ปานกลาง',
    thinkingEffortHigh: 'สูง',
    taskPoliciesPlaceholder: 'ตัวอย่าง: extract=text:off',
    taskPoliciesName: 'โหมดผลลัพธ์และการใช้เหตุผลรายขั้น',
    taskPoliciesDesc: 'หนึ่งรายการต่อหนึ่งขั้นของกระบวนการ ในรูป `ขั้น=โหมด:การใช้เหตุผล` คั่นด้วยเครื่องหมายจุลภาค เช่น `extract=text:off` โหมด: `-` (คงไว้), `schema`, `json`, `text`; การใช้เหตุผล: `-`, `off`, `on`, `low`, `medium`, `high` ชื่อขั้นมี extract, extract-retry, lemma-classify, merge-triage, source-stance, dedup, page-generate, related-page และ lint-dedup ชื่อที่พิมพ์ผิดจะไม่ตรงกับขั้นใด ว่างไว้เพื่อใช้ค่าพื้นฐานในตัว (สกัดแบบข้อความ) รายการที่อ่านไม่ได้จะไม่ถูกบันทึก',
    // Issue #137: compatibility hints for advanced settings (kept short; no
    // provider list to avoid maintenance burden when providers change).
    extractionTemperatureName: 'อุณหภูมิในการสกัด',
    extractionTemperatureDesc: 'กำหนดว่าโมเดลเขียนหน้าเอนทิตีและแนวคิดอย่างอิสระหรือยึดตามต้นทางมากน้อยเพียงใด ค่าต่ำให้ผลซ้ำได้และตรงข้อเท็จจริงมากกว่า ค่าสูงให้ความหลากหลายมากกว่า ผู้ใช้ส่วนใหญ่เว้นว่างไว้',
    chatTemperatureName: 'อุณหภูมิในการตอบคำถาม',
    chatTemperatureDesc: 'แนวเดียวกับอุณหภูมิในการสกัด แต่มีผลเฉพาะคำตอบใน Query Wiki ค่าต่ำให้คำตอบตรงตัวกว่า ค่าสูงให้เป็นกันเองกว่า ผู้ใช้ส่วนใหญ่เว้นว่างไว้',
    repetitionPenaltyName: 'บทลงโทษการพูดซ้ำ',
    repetitionPenaltyDesc: 'ลดการที่โมเดลพูดคำหรือวลีเดิมซ้ำ ค่าสูงหมายถึงซ้ำน้อยลง ผู้ให้บริการโมเดลในเครื่องบางรายเท่านั้นที่ใช้ค่านี้ (Ollama, LM Studio, llama.cpp) ผู้ให้บริการบนคลาวด์จะไม่สนใจค่านี้โดยไม่แจ้ง ผู้ใช้ส่วนใหญ่เว้นว่างไว้ ค่าที่มากกว่า 1.0 อาจทำให้ผลลัพธ์ผิดพลาดระหว่างการสกัดบนโมเดลในเครื่องขนาดเล็ก ถ้ารอบหนึ่งล้มเหลว ให้ลดหรือล้างค่านี้',
    repetitionPenaltyErrorHint: 'หมายเหตุ: มีการตั้งบทลงโทษการพูดซ้ำเป็น {value} ค่าที่มากกว่า 1.0 อาจทำให้การสกัดแบบกำหนดไวยากรณ์บนโมเดลในเครื่องขนาดเล็กพัง ให้ลดหรือล้างค่านี้แล้วลองใหม่',
    temperaturePlaceholder: 'เว้นว่าง = ค่าเริ่มต้นของผู้ให้บริการ',
    // v1.26.0 (#382 item 2): Lint dedup threshold overrides (bottom
    // "Advanced settings" panel, showAdvancedSettings toggle on). The
    // "leave blank" placeholder above is reused so the input row reads the
    // same as the temperature rows in the Advanced section.
    lintDedupJaccardLinkThresholdName: 'ความคล้ายของลิงก์',
    lintDedupJaccardLinkThresholdDesc: 'ช่วง 0–1 (ค่าเริ่มต้น 0.4) สองหน้าถือว่าซ้ำเมื่อลิงก์วิกิที่ทั้งคู่ชี้ไปทับกันอย่างน้อยในสัดส่วนนี้ ค่าต่ำลงหมายถึงจับหน้าคล้ายกันได้มากขึ้น (รวมหน้าที่ชี้ไปยังหน้าเดียวกันซึ่งเป็นที่นิยม) ค่าสูงขึ้นหมายถึงจับเฉพาะหน้าที่ชี้ไปยังชุดเดียวกันเกือบทั้งหมด เพิ่มค่านี้ถ้าพบการแจ้งผิดระหว่างหน้าที่บังเอิญชี้ไปที่หน้าเดียวกัน เว้นว่างไว้เพื่อใช้ค่าเริ่มต้น',
    lintDedupJaccardBodyGateName: 'ความคล้ายของเนื้อหาขั้นต่ำ',
    lintDedupJaccardBodyGateDesc: 'ช่วง 0–1 (ค่าเริ่มต้น 0.2) แม้สองหน้าจะมีลิงก์วิกิร่วมกัน ก็ถือว่าซ้ำเมื่อเนื้อหาทับกันอย่างน้อยในสัดส่วนนี้ ค่าต่ำลงหมายถึงมีผู้สมัครมากขึ้นที่ถูกส่งให้โมเดลตรวจ ค่าสูงขึ้นหมายถึงแจ้งเฉพาะเนื้อหาที่เกือบเหมือนกัน เพิ่มค่านี้ถ้าโมเดลถูกถามถึงหน้าที่ชัดเจนว่าไม่ซ้ำ เว้นว่างไว้เพื่อใช้ค่าเริ่มต้น',
    lintDedupBigramThresholdName: 'ความคล้ายของชื่อ',
    lintDedupBigramThresholdDesc: 'ช่วง 0–1 (ค่าเริ่มต้น 0.4) สองหน้าถือว่าซ้ำเมื่อตัวอักษรในชื่อหรือ alias ทับกันอย่างน้อยในสัดส่วนนี้ ค่าต่ำลงหมายถึงจับรูปแบบการเขียนที่ต่างกัน คำพิมพ์ผิด และคำแปลของแนวคิดเดียวกัน ค่าสูงขึ้นหมายถึงจับเฉพาะชื่อที่เกือบเหมือนกัน เพิ่มค่านี้ถ้าโมเดลกำลังดูหน้าที่มีชื่อต่างกันมากและไม่ได้ซ้ำกัน เว้นว่างไว้เพื่อใช้ค่าเริ่มต้น',
    lintDeadLinkSection: 'ลิงก์ที่ไม่มีปลายทาง (ตรวจพบ) [{count}]',
    lintEmptyPageSection: 'หน้าว่าง (ตรวจพบ) [{count}]',
    lintOrphanSection: 'หน้าที่ไม่มีใครลิงก์ถึง (ตรวจพบ) [{count}]',
    lintContradictionSection: 'ข้อขัดแย้ง (ตรวจพบ)',
    lintDuplicateSection: 'หน้าซ้ำ (ตรวจพบ)',
    lintPollutedSection: 'หน้าที่มีรูปแบบผิด (ตรวจพบ) [{count}]',
    lintPollutedItem: '- [[{page}]] → ควรเป็น "{clean}"',
    lintSourcesNormalizedSection: 'จัดระเบียบแหล่งข้อมูลแล้ว (ซ่อมอัตโนมัติ) [{files} ไฟล์ / {entries} รายการ]',
    lintSourcesNormalizedItem: 'จัดระเบียบ {entries} รายการที่ผิดในแหล่งข้อมูล รวม {files} ไฟล์ (ตัดที่อยู่ภายนอก นามสกุล .md และเครื่องหมายคั่น alias ออก แล้วรวมรายการซ้ำ)',
    lintNoIssuesFound: 'ไม่พบหน้าซ้ำ ลิงก์ที่ไม่มีปลายทาง หน้าว่าง หน้าที่ไม่มีใครลิงก์ถึง หรือคำอ้างที่ไม่มีข้อความรองรับ',
    lintSourceDriftSection: 'โน้ตต้นทางที่เปลี่ยนหลังนำเข้า [{count}]',
    lintSourceDriftItem: '- [[{page}]] — โน้ตต้นทาง [[{note}]] ถูกแก้หลังนำเข้า หน้าอาจล้าสมัย',
    lintSourceDriftLinksOnlySection: 'โน้ตต้นทางที่เปลี่ยนเฉพาะลิงก์ เนื้อหาไม่เปลี่ยน [{count}]',
    lintSourceDriftLinksOnlyItem: '- [[{page}]] — ใน [[{note}]] เปลี่ยนเฉพาะที่อยู่ของลิงก์ (มีการย้ายหน้า) บทสรุปไม่ได้ล้าสมัย',
    lintContradictionMarkerSection: 'หน้าที่ถูกทำเครื่องหมายว่าขัดแย้ง [{count}]',
    lintContradictionMarkerItem: '- [[{page}]] — แหล่งข้อมูลที่ขัดกัน: {sources}; ตรวจแล้วลบเครื่องหมาย contradictions: ออกเมื่อเรียบร้อย',
    lintQuoteGroundingSection: 'คำอ้างที่ไม่มีข้อความรองรับ (ตรวจพบ) [{count}]',
    lintQuoteGroundingItem: '- [[{page}]]{sourceHint}: "{quote}"',
    lintDeadLinkItem: '- [[{source}]] → **{target}** (ไม่มีหน้านี้){dupFlag}',
    lintDeadLinkMore: '- ... ลิงก์ที่ไม่มีปลายทางอีก {count} รายการ',
    lintEmptyPageItem: '- [[{page}]] — มีเนื้อหาสาระน้อยกว่า 50 ตัวอักษร',
    lintOrphanItem: '- [[{page}]] — ไม่มีหน้าวิกิอื่นลิงก์มาที่นี่{dupFlag}',
    lintDuplicateItem: '- [[{target}]] และ [[{source}]] — {reason}',
    lintDeadLinkAffectedByDup: ' (⚠️ เกี่ยวกับหน้าซ้ำ)',
    lintOrphanIsDuplicate: ' (⚠️ หน้าซ้ำ)',
    lintHubLinkDensitySection: 'ฮับที่มีลิงก์หนาแน่นเกินไป [#157 / #175] [{count}]',
    lintCrystallizedHubsSection: 'ฮับที่ตกผลึกแล้ว [{count}]',
    lintCrystallizedHubsIntro: 'เพื่อนบ้านของฮับนี้ลิงก์ถึงกันเองแล้ว ฮับจึงไม่ใช่ตัวเชื่อมอีกต่อไป ถ้าคุณทำเครื่องหมายฮับด้วยมือ บทบาทของฮับนี้จบแล้ว ปลั๊กอินไม่สนใจเครื่องหมายนั้นและไม่แก้อะไร ตรวจฮับที่มีลิงก์มากที่สุด {topN} แห่ง',
    lintCrystallizedHubRow: '{path} — {degree} ลิงก์, เปอร์เซ็นไทล์การเกาะกลุ่ม {percentile}%',
    lintHubLinkDensityItem: '- [[{page}]] — ลิงก์เข้า {inDegree}, ลิงก์ที่เกี่ยวข้อง {relatedCount}, ความโดดเด่น {distinctiveness} → {recommendation}{lowTargets}',
    lintHubLinkDensityStrip: '⚠️ ตัดออก',
    lintHubLinkDensityReview: '🔍 ตรวจดู',
    lintHubLinkDensityKeep: '✅ เก็บไว้',
    lintHubLinkDensitySummary: 'สรุป: แนะนำให้ตัดออก {strip} หน้า และให้ตรวจดู {review} หน้า',
    lintHubLinkDensityIntro: 'ตัวนี้วัดลิงก์ออกของฮับว่าไปยังหน้าที่เพื่อนบ้านครอบคลุมอยู่แล้วหรือไม่ รายการฮับที่ตกผลึกแล้ววัดอีกเรื่องหนึ่ง คือเพื่อนบ้านลิงก์ถึงกันเองหรือไม่ สองรายการอาจระบุหน้าต่างกัน และรายการหนึ่งไม่ได้แปลว่าอีกรายการจะตามมา',
    lintHubLinkDensityNoRelated: ' (ไม่พบส่วน ## Related)',
    lintContradictionOpen: 'ข้อขัดแย้งที่ยังเปิดอยู่: {count}',
    lintContradictionItem: '- [{status}] [[{page}]] — {claim}',
    lintContradictionStatusDetected: 'ตรวจพบ',

    // Lint Analysis Prompt

    // Lint Fix Progress
    lintFixProgress: 'กำลังซ่อม {current}/{total}: [[{target}]]',
    lintFixDeadComplete: 'ซ่อมลิงก์ที่ไม่มีปลายทางเสร็จแล้ว ทำไป {fixed}/{total} รายการ',
    lintFillProgress: 'กำลังเติม {current}/{total}: {page}',
    lintFillComplete: 'เติมเนื้อหาหน้าเสร็จแล้ว เติม {filled}/{total} หน้า',
    lintDeleteCompleted: 'ลบหน้าว่างที่ไม่มีเนื้อหาแล้ว {count} หน้า',
    lintDeleteFailed: 'ลบหน้าว่างที่ไม่มีเนื้อหาไม่สำเร็จ {failed}/{total} หน้า (ดูรายละเอียดในคอนโซล)',
    lintFillFailed: 'เติมเนื้อหาไม่สำเร็จ: {page} — {error}',
    lintLinkProgress: 'กำลังใส่ลิงก์ {current}/{total}: {page}',
    lintLinkComplete: 'ใส่ลิงก์ให้หน้าที่ไม่มีใครลิงก์ถึงเสร็จแล้ว ใส่ลิงก์ {linked} หน้า',
    lintFixNoAction: 'ไม่ได้ทำอะไร (ไม่มีไคลเอนต์)',
    lintFixIndexUpdated: 'อัปเดตดัชนีวิกิและบันทึกการทำงานแล้ว',
    lintFixAllComplete: 'ซ่อมทั้งหมดเสร็จแล้ว ดูรายละเอียดในบันทึก',
    lintFixAllNoChanges: 'ไม่มีการเปลี่ยนแปลง — ทุกขั้นรายงานว่าซ่อม 0 จุด ดูรายละเอียดใน wiki/log.md',
    lintFixPhasesLabel: 'ขั้นที่แก้ไข',
    lintPollutedFixed: 'ซ่อมหน้าที่มีรูปแบบผิดแล้ว: {fixed}/{total} สร้างดัชนีใหม่แล้ว',
    regenerateIndexCompleted: 'สร้างดัชนีใหม่แล้ว',
    operationFailed: 'ไม่สำเร็จ: ',

    // Lint Report Modal
    lintModalActionsTitle: 'ข้อเสนอการซ่อม (ใช้โทเคนของโมเดล):',
    lintLogReference: 'บันทึกรายงานฉบับเต็มไว้ใน log.md',
    lintModalFixDeadLinks: 'ซ่อมลิงก์ที่ไม่มีปลายทาง ({count})',
    lintModalExpandEmpty: 'เติมหน้าว่าง ({count})',
    lintModalDeleteEmpty: 'ลบหน้าว่างที่ไม่มีเนื้อหา ({count})',
    lintModalLinkOrphans: 'ใส่ลิงก์ให้หน้าที่ไม่มีใครลิงก์ถึง ({count})',
    lintModalAnalyzeSchema: 'วิเคราะห์สคีมา',
    lintModalMergeDuplicates: 'รวมหน้าซ้ำ ({count})',
    lintModalFixAll: 'ซ่อมทั้งหมดอัตโนมัติ ({count} ปัญหา)',
    lintMergeProgress: 'กำลังรวม {current}/{total}: {source} → {target}',
    lintMergeComplete: 'รวมหน้าซ้ำเสร็จแล้ว รวม {merged}/{total} คู่',

    // Ingest Report Modal
    ingestReportTitle: 'รายงานการนำเข้า',
    ingestReportSourceFile: 'แหล่งข้อมูล',
    ingestReportCreated: 'สร้าง',
    ingestReportUpdated: 'อัปเดต',
    ingestReportContradictions: 'ข้อขัดแย้งที่พบ',
    ingestReportFailedTitle: 'นำเข้าไม่สำเร็จ',
    ingestReportErrorDetail: 'รายละเอียดข้อผิดพลาด',
    ingestReportClose: 'ปิด',
    ingestReportCreatedPages: 'หน้าที่สร้าง: {count}',
    ingestReportUpdatedPages: 'หน้าที่อัปเดต: {count}',
    ingestReportEmbeddedImages: 'ภาพในโน้ต: ตรวจ {analyzed}/{discovered} ภาพ; ส่ง {sent} จาก {queued} ในคิว เป็น {packages} ชุด; แปลงเฟรมแรกของ GIF {gifs} ไฟล์; ชุดที่ล้มเหลว {failed}',
    ingestReportEmbeddedEvidenceSaved: 'บันทึกหลักฐานภาพไว้ในหน้าต้นทางแล้ว',
    ingestReportEmbeddedImageSkipped: 'ข้ามภาพในโน้ต',
    embeddedImagesVisionUnsupported: 'ปลายทางนี้ปฏิเสธการวิเคราะห์ภาพ การนำเข้าข้อความยังดำเนินต่อ ใช้โมเดลที่มองเห็นภาพหรือปิดการวิเคราะห์ภาพในโน้ต',
    // v1.22.2: log.md header content (Operation History Panel hint)
    logHeaderTitle: 'บันทึกการทำงานของวิกิ',
    logHeaderSubtitle: 'ทุกครั้งที่นำเข้า ทุกการตรวจ lint และทุกงานดูแลระบบจะถูกบันทึกไว้ที่นี่โดยอัตโนมัติ แผง **ประวัติการทำงาน** ใช้ง่ายกว่า:',
    logHeaderShortcut: (cmd: string) => `Cmd+P → "${cmd}"`,
    logHeaderSettingsShortcut: 'หรือเปิดจาก การตั้งค่า → การดูแลอัตโนมัติ → ประวัติการทำงาน',
    // v1.22.2: concise per-file ingest summary labels for Notice (no modal)
    ingestionCreatedPages: 'สร้าง {count} หน้า',
    ingestionUpdatedPages: 'อัปเดต {count} หน้า',
    ingestionNoticeHistoryHint: 'ดูรายละเอียดได้ในประวัติการทำงาน',
    ingestReportEntitiesCount: '{count} เอนทิตี',
    ingestReportConceptsCount: '{count} แนวคิด',
    ingestReportContradictionsFound: 'ข้อขัดแย้งที่พบ: {count}',
    ingestReportEntityType: 'เอนทิตี',
    ingestReportConceptType: 'แนวคิด',
    timeMinutes: 'นาที',
    timeSeconds: 'วินาที',

    // Rate Limit Warnings
    rateLimitDetected: '⚠️ ถึงขีดจำกัดของผู้ให้บริการ: {count} หน้าล้มเหลวด้วยข้อผิดพลาด 429 ลองทำอย่างนี้: (1) ลดจำนวนพร้อมกันเหลือ {suggestedConcurrency} หรือ 1 (ทีละรายการ), (2) เพิ่มระยะหน่วงเป็น {suggestedDelay} มิลลิวินาที, (3) เปลี่ยนไปใช้ผู้ให้บริการที่มีขีดจำกัดสูงกว่า',
    rateLimitDetectedShort: '⚠️ ถึงขีดจำกัดของผู้ให้บริการ — ลดจำนวนพร้อมกันหรือเพิ่มระยะหน่วงที่ การตั้งค่า → เร่งการนำเข้า',

    // Long source warning
    sourceRejectedEmpty: '⏭️ "{filename}" ไม่มีเนื้อหาให้นำเข้า จึงข้ามไป โน้ตว่างหรือโน้ตที่มีแต่ frontmatter จะไม่สร้างหน้าวิกิ',
    sourceRejectedType: '⏭️ ข้าม "{filename}" เพราะไม่รองรับชนิดไฟล์นี้ นำเข้าได้เฉพาะโน้ตข้อความ (เช่น .md, .txt)',
    sourceRejectedDuplicate: '⏭️ ข้าม "{filename}" — เนื้อหานี้อยู่ในวิกิแล้ว',
    // v1.25.0 PDF Level 1 (cache-only architecture)
    pdfReadingInProgress: 'กำลังอ่าน PDF: {filename}',
    sourceRejectedPdfUnsupported: '⏭️ ข้าม "{filename}" — ผู้ให้บริการหรือโมเดลปัจจุบันไม่รับ PDF เปลี่ยนผู้ให้บริการ หรือเปิด "บังคับให้รองรับ PDF" ที่ การตั้งค่า → การตั้งค่า LLM → ขั้นสูง หรือเปลี่ยนตัวแปลงเป็น MinerU (รองรับภาพและไฟล์ Office ด้วย)',
    clearPdfCacheCommand: 'ล้างแคชการแปลง PDF',
    pdfCacheCleared: 'ล้างแคชการแปลง PDF แล้ว ({count} รายการ)',
    // v1.25.0 PR3: Advanced PDF settings
    forcePdfSupportName: 'บังคับให้รองรับ PDF',
    forcePdfSupportDesc: 'ปิดไว้เป็นค่าเริ่มต้น เปิดเมื่อผู้ให้บริการของคุณไม่ได้ระบุว่ารองรับ PDF แต่ทำได้ เมื่อเปิด PDF จะถูกส่งไปยังผู้ให้บริการปัจจุบัน ถ้าถูกปฏิเสธคุณจะเห็นข้อความชัดเจน ผู้ให้บริการที่รองรับ PDF ในตัว (Anthropic, OpenAI, Bedrock) ไม่ต้องใช้ตัวนี้',
    writePdfMarkdownToVaultName: 'เขียน Markdown ที่แปลงแล้วลง vault',
    writePdfMarkdownToVaultDesc: 'ปิดไว้เป็นค่าเริ่มต้น เมื่อเปิด ผลลัพธ์ของการแปลง PDF แต่ละครั้งจะถูกเขียนเป็นไฟล์ "<basename>.pdf.md" ข้างไฟล์ PDF ต้นทาง เมื่อปิด ผลลัพธ์จะอยู่ในแคชของปลั๊กอินเท่านั้นและไม่ทิ้งไฟล์ไว้ใน vault',
    analyzeEmbeddedImagesName: 'วิเคราะห์ภาพในโน้ตระหว่างนำเข้า Markdown',
    analyzeEmbeddedImagesDesc: 'ปิดไว้เป็นค่าเริ่มต้น วิเคราะห์ภาพในเครื่องที่เข้าเกณฑ์ทุกภาพเป็นชุดละ 20 MiB ภาพเดียวจำกัดที่ 10 MiB ไม่มีการดาวน์โหลดภาพจากอินเทอร์เน็ต',
    streamIngestName: 'สตรีมคำขอนำเข้า',
    streamIngestDesc: 'คำขอนำเข้าไปถึงโมเดลอย่างไร ค่า Auto จะสตรีมบนมือถือ เพราะแพลตฟอร์มมือถือตัดคำขอที่ไม่ได้รับข้อมูลระหว่างที่โมเดลยังทำงานได้ บนคอมพิวเตอร์ซึ่งไม่มีข้อจำกัดนั้น ระบบจะรอรับคำตอบทั้งก้อน การสตรีมทำให้การเชื่อมต่อไม่ว่าง งานสร้างที่ยาวจึงไม่ถูกตัดเงียบ ๆ ไม่ได้เร็วขึ้น และส่งไบต์มากกว่าหลายเท่า แม้พร็อกซีที่บีบอัดสตรีมเหตุการณ์จะลดส่วนนั้นลงได้ ค่าเสมอจะสตรีมบนทุกแพลตฟอร์ม สำหรับโมเดลในเครื่องที่ช้าอยู่หลังพร็อกซีที่มีเวลาว่างจำกัดของตัวเอง ค่าไม่เคยจะรอรับทั้งก้อนทุกที่ สำหรับผู้ใช้ที่ใช้ข้อมูลมือถือแบบจำกัดและยอมรับว่าการเรียกยาวบนมือถือจะล้มเหลว',
    streamIngestAuto: 'Auto (แนะนำ)',
    streamIngestAlways: 'เสมอ',
    streamIngestNever: 'ไม่เคย',
    ingestHintReasoning: 'โมเดลใช้โควตาผลลัพธ์ทั้งหมดไปกับการใช้เหตุผล จึงไม่เหลือที่สำหรับคำตอบ ปิดการใช้เหตุผลสำหรับขั้นนี้ ลดระดับการใช้เหตุผล หรือเพิ่ม "จำนวนโทเคนเอาต์พุตสูงสุดต่อการเรียกหนึ่งครั้ง" ในพารามิเตอร์ LLM ขั้นสูง',
    ingestHintMaxTokens: 'โมเดลปฏิเสธค่า max_tokens ลด "จำนวนโทเคนเอาต์พุตสูงสุดต่อการเรียกหนึ่งครั้ง" ในพารามิเตอร์ LLM ขั้นสูง',
    ingestHintContextWindow: 'ไฟล์ต้นทางใหญ่เกินหน้าต่างบริบทของโมเดลนี้ ใช้โมเดลที่หน้าต่างใหญ่กว่าหรือแบ่งไฟล์',
    ingestHintBadRequest: 'API ปฏิเสธคำขอ ตรวจสอบว่าชื่อโมเดลถูกต้องสำหรับผู้ให้บริการรายนี้',
    ingestHintAuth: 'ยืนยันตัวตนไม่สำเร็จ ตรวจสอบคีย์ API ในการตั้งค่า',
    ingestHintRateLimit: 'ถึงขีดจำกัดของผู้ให้บริการแล้ว รอสักครู่หรือเปลี่ยนไปใช้ผู้ให้บริการที่มีขีดจำกัดสูงกว่า',
    ingestHintMobileTimeout: 'คำขอเงียบนานเกินไปจนแพลตฟอร์มมือถือปิดมัน คำขอนำเข้าจะสตรีมเมื่อผู้ให้บริการอนุญาต พร็อกซีหรือผู้ให้บริการจึงน่าจะกั้นคำตอบไว้ ปิดการบัฟเฟอร์คำตอบที่พร็อกซี หรือใช้โมเดลที่สตรีมได้',
    ingestHintDesktopTimeout: 'คำขอหมดเวลาโดยไม่มีข้อมูล ตรวจสอบที่อยู่ของผู้ให้บริการและพร็อกซีที่อยู่ข้างหน้า ถ้าพร็อกซีปิดการเชื่อมต่อที่ว่าง ให้ตั้ง "สตรีมคำขอนำเข้า" เป็น เสมอ (การตั้งค่าขั้นสูง)',
    ingestHintStreamingOff: 'การสตรีมตอนนำเข้าปิดอยู่ คำขอแบบบัฟเฟอร์ไม่ส่งอะไรจนกว่าคำตอบทั้งก้อนจะพร้อม แพลตฟอร์มมือถือจึงปิดมันก่อน ตั้ง "สตรีมคำขอนำเข้า" เป็น Auto (การตั้งค่าขั้นสูง)',
    ingestHintDefault: 'ตรวจสอบการเชื่อมต่อเครือข่าย คีย์ API และที่อยู่ของผู้ให้บริการในการตั้งค่า',
    saveEmbeddedImageEvidenceName: 'บันทึกหลักฐานภาพลงหน้าต้นทาง',
    saveEmbeddedImageEvidenceDesc: 'ปิดไว้เป็นค่าเริ่มต้น บันทึกข้อความรอบภาพแต่ละภาพและสิ่งที่โมเดลภาพเห็น ไว้ในส่วนที่ย่อได้ของหน้าต้นทาง',
    markdownConversionBackendName: 'ตัวแปลงเป็น Markdown',
    markdownConversionBackendDesc: 'แบบ Native ใช้การรองรับ PDF ของผู้ให้บริการคุณ (ขอบเขตจำกัด ไม่ใช่ทุกผู้ให้บริการหรือทุกโมเดลที่ทำได้ และใช้โทเคน) MinerU เป็นบริการออนไลน์ — เร็ว ฟรีจนหมดโควตารายวัน รองรับ PDF ภาพ และไฟล์ Office — แต่ต้องใช้โทเคน API (กรอกในช่องด้านล่าง)',
    markdownConversionBackendNative: 'PDF และภาพผ่านผู้ให้บริการ',
    markdownConversionBackendMineru: 'MinerU ผ่านอินเทอร์เน็ต',
    mineruApiTokenName: 'โทเคน API ของ MinerU',
    mineruApiTokenDesc: 'รับโทเคนได้ที่ https://mineru.net/apiManage/token MinerU รับไฟล์ถึง 200 MB และถึง 200 หน้า โทเคนหมดอายุราว 90 วัน ให้ต่ออายุเมื่อการแปลงเริ่มล้มเหลวด้วยรหัส 401',
    mineruTokenExpired: 'MinerU ปฏิเสธโทเคน API — น่าจะหมดอายุแล้ว (โทเคนใช้ได้ราว 90 วัน) รับโทเคนใหม่ที่ https://mineru.net/apiManage/token แล้วอัปเดตการตั้งค่าโทเคน MinerU',
    mineruApiTokenPlaceholder: 'วางโทเคน API ของ MinerU',
    mineruUploadingInProgress: 'กำลังอัปโหลด PDF ไปยัง MinerU: {filename}',
    mineruWaitingInProgress: 'กำลังรอ MinerU แปลง: {filename}',
    mineruDownloadingInProgress: 'กำลังดาวน์โหลดผลจาก MinerU: {filename}',
    markdownConversionComplete: 'แปลงเสร็จ: {filename}',
    markdownConversionCompleteSaved: 'แปลงเสร็จ — เขียนลง {path}: {filename}',
    mineruPageLimitRejected: '{filename} เกินขีดจำกัด {limit} หน้าของ MinerU — แบ่งไฟล์แล้วลองใหม่',
    mineruSizeLimitRejected: '{filename} เกินขีดจำกัดขนาด {limit} MB ของ MinerU',
    ingestRejectedSummary: 'ข้าม {count} ไฟล์ (ว่าง ซ้ำ หรือชนิดไฟล์ไม่รองรับ)',
    reingestConfirmTitle: 'นำเข้าไฟล์นี้ใหม่ไหม',
    reingestConfirmBody: 'เนื้อหาของ "{filename}" อยู่ในวิกิแล้ว ต้องการนำเข้าใหม่หรือไม่',
    reingestConfirmYes: 'นำเข้าใหม่',
    reingestConfirmNo: 'ข้าม',
    // v1.26.0 (#382 item 1, Batch 2): sources participate in dedup by
    // default via the sourceFingerprint signal (body-hash equality). Off
    // here to exclude source pages from lint duplicate-detection.
    lintDedupIncludeSourcesName: 'รวมแหล่งข้อมูลในการหาหน้าซ้ำ',
    lintDedupIncludeSourcesDesc: 'เปิดไว้เป็นค่าเริ่มต้น เมื่อเปิด แหล่งข้อมูลที่มีเนื้อหาเหมือนกันทุกตัวอักษรจะถูกทำเครื่องหมายว่าซ้ำระหว่างการตรวจ lint ปิดถ้าแหล่งข้อมูลของคุณทำให้แจ้งผิดบ่อย',
    legacyScorerName: 'วิธีจัดอันดับแบบเดิม',
    legacyScorerDesc: 'ปิดไว้เป็นค่าเริ่มต้น เมื่อเปิด การจัดอันดับผลการค้นหาจะใช้วิธีเดิมที่ปรับด้วยมือแทน BM25F ที่ใหม่กว่า เปิดถ้าผลการค้นหาแย่ลงหลังอัปเดต',
    // Issue #880: the answer context's token ceiling (bottom Advanced settings panel).
    queryContextBudgetName: 'งบโทเคนของบริบท',
    queryContextBudgetDesc: 'จำกัดจำนวนโทเคนของหน้าวิกิที่ส่งไปกับคำตอบหนึ่งครั้ง ปิด = 0 ค่า 8K เหมาะกับสภาพแวดล้อมในเครื่องส่วนใหญ่ เพิ่มสำหรับโมเดลขนาดใหญ่บนคลาวด์ หน้าที่อันดับท้ายที่สุดจะถูกตัดออกก่อน',
    // Issue #514: opt-in candidate gate (bottom Advanced settings panel).
    skipMentionOnlyCandidatesName: 'ข้ามผู้สมัครที่แหล่งข้อมูลเพียงกล่าวถึง',
    skipMentionOnlyCandidatesDesc: 'ปิดไว้เป็นค่าเริ่มต้น เมื่อเปิด เอนทิตีหรือแนวคิดที่สกัดได้แต่ชื่อไม่ปรากฏในเนื้อความของโน้ต — ไม่มีเลย หรืออยู่เพียงในวงเล็บ ในรายการแจงนับ หรือในข้อสั้น ๆ ของรายการ — จะไม่ได้หน้าและไม่มีการเรียกโมเดลต่อ และชื่อนั้นถูกนำออกจากรายการที่เกี่ยวข้องของผู้สมัครรายอื่น ใช้ได้กับภาษาที่มีโครงเรื่องขอบเขตคำ (วัดกับภาษาเยอรมัน แล้วประเมินสำหรับอังกฤษ ฝรั่งเศส สเปน โปรตุเกส และดัตช์) ภาษาอื่นจะมีการแจ้งครั้งหนึ่งตอนนำเข้าว่าใช้ไม่ได้ ปล่อยปิดไว้สำหรับ vault ที่เป็นอภิธานศัพท์หรือโน้ตแบบข้อย่อย ซึ่งทุกคำที่ถูกเอ่ยควรได้หน้า',
    createStubsForUnresolvableLinksName: 'สร้างหน้าเปล่าสำหรับลิงก์ที่ไม่มีปลายทาง',
    createStubsForUnresolvableLinksDesc: 'เปิดไว้เป็นค่าเริ่มต้น เมื่อการซ่อมลิงก์หาหน้าปลายทางไม่ได้ ระบบจะสร้างหน้าเปล่าและให้ลิงก์ชี้ไปที่นั่น — ไม่มีการเติมเนื้อหาด้วยโมเดล ปิดถ้าต้องการปล่อยลิงก์เช่นนั้นไว้: ลิงก์จะยังปรากฏในรายงาน lint ทุกครั้งจนกว่าแหล่งข้อมูลจริงจะนิยามมัน',
    // v1.26.0 (#382 item 1, Batch 2): sub-heading for the dedup
    // sub-group at the bottom of the "Advanced settings" panel.
    lintDedupSectionHeading: 'การหาหน้าซ้ำ',
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
    llmRetryRecoveredToast: 'งานของโมเดล: {count} รอบต้องลองใหม่เพราะผู้ให้บริการตอบผิดปกติชั่วคราว ดูรายละเอียดในคอนโซล ถ้าเกิดซ้ำ ให้ลดจำนวนพร้อมกันในการตั้งค่าผู้ให้บริการ',
    longSourceNotice: '📄 "{filename}" มี {lines} บรรทัด ({size}) ข้อความยาวจะถูกสกัดเป็นรอบ ๆ โดยโมเดลอ่านเอกสารทั้งหมดหลายรอบ อาจใช้เวลาหลายนาที กรุณารอ',
    longSourceNoticeShort: '📄 พบไฟล์ขนาดใหญ่ ({lines} บรรทัด) การนำเข้าอาจใช้เวลาสักครู่',

    // Ingestion History Panel (#122) — UI keys
    historyButton: 'ประวัติการทำงาน',
    historyButtonDesc: 'ดูสิ่งที่วิกิของคุณทำในช่วงที่ผ่านมา: นำเข้าอะไรไปแล้ว รายงาน lint และการเปลี่ยนแปลงอื่น ๆ',
    historyButtonOpen: 'ดูประวัติ',
    historyModalTitle: 'ประวัติการทำงาน',
    historyModalSubtitle: 'งานล่าสุดใน LLM Wiki ของคุณ',
    historyEmpty: 'ยังไม่มีบันทึก นำเข้าโน้ตหรือตรวจ lint เพื่อให้มีรายการที่นี่',
    historyReadError: 'อ่านบันทึกการทำงานไม่ได้: {error}',
    historyEntryKindIngest: 'นำเข้า',
    historyEntryKindMaintenance: 'ดูแลระบบ',
    historyEntryKindFix: 'ซ่อม',
    historyEntryKindOther: 'การทำงาน',
    historyEntryTime: '{date} · {time}',
    historyEntryTimeNoTime: '{date}',
    historyEntrySource: 'แหล่งข้อมูล: {source}',
    historyEntrySourceUnknown: 'การนำเข้าที่ไม่มีชื่อ',
    historyEntryCreatedLabel: 'สร้าง',
    historyEntryUpdatedLabel: 'อัปเดต',
    historyEntryCreatedCount: 'สร้าง {count}',
    historyEntryUpdatedCount: 'อัปเดต {count}',
    historyEntryNoChanges: 'ไม่มีหน้าใดเปลี่ยน',
    historyEntryContradictions: '⚠️ ข้อขัดแย้ง {count} จุด',
    historyEntrySectionCreated: 'หน้าที่สร้าง',
    historyEntrySectionUpdated: 'หน้าที่อัปเดต',
    historyEntrySectionContradictions: 'ข้อขัดแย้ง',
    historyEntrySectionDetails: 'รายละเอียด',
    historyEntrySectionReport: 'สิ่งที่การตรวจพบ',
    historyEntryOpenPage: 'เปิด',
    historyEntryDetailsNoContradictions: 'ไม่พบข้อขัดแย้ง',
    historySearchPlaceholder: '🔍 ค้นหาจากชื่อแหล่งข้อมูลหรือที่อยู่ของหน้า…',
    historyFilterAll: 'ทั้งหมด',
    historyFilterIngest: 'เฉพาะการนำเข้า',
    historyFilterMaintenance: 'เฉพาะการดูแลระบบ',
    historyFilterFix: 'เฉพาะการซ่อม',
    historyFilterContradictions: '⚠️ ที่มีข้อขัดแย้ง',
    historyRefreshButton: '⟳ รีเฟรช',
    historyExpandDay: 'กดเพื่อขยาย',
    historyCollapseDay: 'กดเพื่อย่อ',
    historyShowMore: 'แสดงรายการเก่าอีก {count} รายการ',
    historyNoMatch: 'ไม่มีรายการที่ตรงกับการค้นหาหรือตัวกรอง',
    historyCloseButton: 'ปิด',
    historyLimit: 50,
    historyBadgeIngestShort: '📥',
    historyBadgeMaintenanceShort: '🔍',
    historyBadgeFixShort: '🔧',
    historyBadgeOtherShort: '📌',
    // KPI labels (Operation History Panel v2)
    historyKpiPages: 'หน้า',
    historyKpiDeadLinks: 'ลิงก์ตาย',
    historyKpiOrphans: 'ไม่มีใครลิงก์ถึง',
    historyKpiEmpty: 'ว่าง',
    historyKpiDuplicates: 'ซ้ำ',
    historyKpiTagViolations: 'ปัญหาแท็ก',
    historyKpiUnsourced: 'ไม่มีแหล่งที่มา',
    historyKpiDuration: 'เวลาที่ใช้ตรวจ',
    historyKpiDurationSec: '{seconds} วินาที',
    // Operation History v3 — rich section rendering
    historySectionDeadLinks: 'ลิงก์ตาย ({count})',
    historySectionTagViolations: 'ปัญหาแท็ก ({count})',
    historySectionOrphans: 'หน้าที่ไม่มีใครลิงก์ถึง ({count})',
    historySectionEmptyPages: 'หน้าว่าง ({count})',
    historySectionLlmAnalysis: 'การวิเคราะห์ของโมเดล ({count})',
    historyDeadLinkSource: 'แหล่งข้อมูล',
    historyDeadLinkTarget: 'ไม่มี',
    historyOpenInLog: 'เปิดใน log.md',
    historyShowMoreItems: 'แสดงอีก {count} รายการ',
    historyTrendUp: '↗ {delta}',
    historyTrendDown: '↘ {delta}',
    historyTrendSame: '→ เท่าเดิม',
    historyChipContradiction: 'ข้อขัดแย้ง',
    historyChipOutdated: 'ล้าสมัย',
    historyChipMissing: 'ขาดหาย',
    historyChipStructure: 'โครงสร้าง',
    historySeverityHigh: 'สูง',
    historySeverityMedium: 'ปานกลาง',
    historySeverityLow: 'ต่ำ',
    historyPageTypeEntity: '📦 เอนทิตี',
    historyPageTypeConcept: '💡 แนวคิด',
    historyPageTypeSource: '📄 แหล่งข้อมูล',
    historyGlobalInsight: 'วิกิของคุณมีลิงก์ตาย {dead} แห่ง หน้าที่ไม่มีใครลิงก์ถึง {orphans} หน้า และปัญหาแท็ก {tags} จุด การตรวจครั้งล่าสุดใช้เวลา {duration}',
    historyGlobalInsightClean: 'วิกิของคุณเรียบร้อย — ไม่พบลิงก์ตาย หน้าที่ไม่มีใครลิงก์ถึง หรือปัญหาแท็ก',
    historyGlobalInsightNoData: 'ยังไม่มีรายงานการดูแลระบบ — ตรวจ lint เพื่อให้มีข้อมูล',
    // v3.1 — modal title, subtitle w/ count, time-range filter
    historyModalHeaderTitle: 'ประวัติการทำงาน',
    historyModalSubtitleWithCount: 'งานล่าสุดใน LLM Wiki ของคุณ · {count} รายการ',
    historyTimeRangeAll: 'ทุกช่วงเวลา',
    historyTimeRange1d: 'วันล่าสุด',
    historyTimeRange3d: '3 วันล่าสุด',
    historyTimeRange1w: 'สัปดาห์ล่าสุด',
    historyTimeRange1m: 'เดือนล่าสุด',
    // v3.1 — ingest metric cards
    historyIngestTotal: 'หน้าทั้งหมด',
    historyIngestByType: 'แยกตามชนิด',
    historyIngestSource: 'ไฟล์ต้นทาง',
    historyIngestNoTimestamp: 'ไม่มีเวลา',
    historyIngestFirstTime: 'นำเข้าครั้งแรก',
    historyIngestLatestTime: 'นำเข้าล่าสุด',
    historyTimeRangeCustom: 'ช่วงเวลาที่กำหนดเอง',
    historyCustomRangeFrom: 'ตั้งแต่',
    historyCustomRangeTo: 'ถึง',
    historyCustomRangeApply: 'ใช้',
    historyCustomRangeClear: 'ล้าง',
    // v1.23.0 — first-run welcome note (Phase 5.1.5)
    welcomeNoteTierANotice: 'Karpathy Wiki: vault ของคุณยังว่าง สร้างโน้ตต้นทางฉบับแรกแล้วเลือก นำเข้า เพื่อเริ่มต้น',
    welcomeNoteTierBNotice: 'Karpathy Wiki: สร้างโน้ตต้อนรับแล้ว เปิดโน้ตนั้นเพื่อระบุโดเมนของคุณและเลือกโน้ตต้นทาง 2-3 ฉบับเพื่อเริ่มโครงข่ายลิงก์',
    welcomeNoteRecreateCommand: 'สร้างโน้ตต้อนรับของวิกิใหม่',
    welcomeNoteRecreateCommandTooltip: 'สร้างโน้ตต้อนรับใหม่ที่ <wikiFolder>/Welcome.md ด้วยโดเมนปัจจุบันและการทดสอบการตั้งค่า LLM ไฟล์เดิมจะถูกเขียนทับ',
    welcomeNoteSettingsToggle: 'สร้างโน้ตต้อนรับเมื่อใช้งานครั้งแรก',
    welcomeNoteSettingsToggleDesc: 'เมื่อใช้งานครั้งแรกสุด (ตอนโฟลเดอร์วิกิยังว่าง) จะสร้างหน้าเริ่มต้นหนึ่งหน้าไว้ที่ <wikiFolder>/Welcome.md หน้านี้อธิบายว่า LLM Wiki ทำอะไร ขอให้คุณระบุโดเมนที่สนใจ และพาคุณนำเข้าโน้ตต้นทาง 2-3 ฉบับแรก โน้ตจะเขียนเป็นภาษาอังกฤษเป็นค่าเริ่มต้น หรือเป็นภาษาวิกิของคุณถ้าตั้งค่า LLM แล้ว ปิดตัวนี้ถ้าคุณรู้วิธีใช้ปลั๊กอินอยู่แล้วและไม่ต้องการโน้ตแนะนำใน vault',
    welcomeNoteRunConfigTest: 'โน้ตต้อนรับเขียนเป็นภาษาอังกฤษ ไปที่ การตั้งค่า → ผู้ให้บริการ LLM → ทดสอบการเชื่อมต่อ เพื่อให้ครั้งต่อไปเป็นภาษาของคุณ',
    welcomeNoteRecreated: 'สร้างโน้ตต้อนรับใหม่ที่ {path} แล้ว',
    welcomeNoteNotRecreated: 'ไม่ได้สร้างโน้ตต้อนรับใหม่ ตรวจสอบการตั้งค่า LLM',
    welcomeNoteGenerating: 'โน้ตต้อนรับ: กำลังสร้างเบื้องหลัง — จะมีประกาศเมื่อเสร็จ',
    welcomeNoteGenerationFailed: 'สร้างโน้ตต้อนรับไม่สำเร็จ: {error}',
    welcomeNoteFileName: 'ยินดีต้อนรับสู่ Karpathy LLM Wiki',
    startupCheckWelcomePending: 'โน้ตต้อนรับ: กำลังสร้างเบื้องหลัง (จะมีประกาศเมื่อเสร็จ)',
    startupCheckWelcomeCreated: 'สร้างโน้ตต้อนรับที่ {path} แล้ว',
    // v1.23.0 Phase 5.1.5: Multi-File Suggest modal (cmdIngestMultipleFiles).
    // The modal's title, hint, search placeholder, action buttons,
    // status labels and queue-empty placeholder all live here. Status
    // labels double as both the right-pane text and the data-attribute
    // keys for `updateLeftPaneSelections` to recognise, so they must
    // remain stable English strings.
    multiFileModalTitle: 'นำเข้าหลายไฟล์',
    multiFileModalHint: 'เลือกโน้ตต้นทางที่จะนำเข้า แผงด้านขวาแสดงคิวและความคืบหน้า',
    multiFileSearchPlaceholder: 'กรองไฟล์ตามที่อยู่…',
    multiFileAddToQueue: 'เพิ่มเข้าคิว',
    multiFileSelectAll: 'เลือกทั้งหมด',
    multiFileFileCount: '{count} ไฟล์',
    multiFileNoFilesAvailable: 'ไม่มีไฟล์ให้นำเข้า',
    multiFileNoFilesMatch: 'ไม่มีไฟล์ที่ตรงกับ "{q}"',
    multiFileQueueEmpty: 'คิวว่างอยู่ ติ๊กไฟล์ทางซ้ายเพื่อเพิ่มเข้าคิว',
    multiFileStatusPending: 'รอคิว',
    multiFileStatusRunning: 'กำลังทำงาน',
    multiFileStatusCompleted: 'เสร็จแล้ว',
    multiFileStatusFailed: 'ไม่สำเร็จ',
    multiFileCancelAria: 'ข้ามไฟล์นี้',
    // #598: what the vault says about a row, resolved when the picker
    // opens. The queue only knows this session.
    multiFileRowIngested: 'นำเข้าแล้ว',
    multiFileRowDrifted: 'โน้ตเปลี่ยนหลังนำเข้า',
    // v1.23.0 Phase 5.1.5: Multi-File Suggest modal action button
    // that removes every pending and running job from the ingest
    // queue. Completed and failed jobs are preserved so the user
    // still sees what happened.
    cancelAllQueueJobs: 'หยุดทั้งหมด',
} as const;
