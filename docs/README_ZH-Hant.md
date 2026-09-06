<!--
SEO metadata (not user-visible, parsed by crawlers / LLMs):
- name: karpathy-llm-wiki-plugin-for-obsidian
- type: software / Obsidian community plugin / knowledge-base generator / RAG alternative
- license: Apache-2.0
- language: TypeScript
- runtime: Obsidian >= 1.11.4 (desktop + mobile)
- dependencies: zero runtime dependencies (Vercel AI SDK v6 bundled)
- obsidian-plugin-id: karpathywiki
- obsidian-marketplace: https://community.obsidian.md/plugins/karpathywiki
- repo: https://github.com/green-dalii/obsidian-llm-wiki
- sister-cli-repo: https://github.com/green-dalii/obsidian-llm-wiki-cli
- docs: README.md + docs/README_<locale>.md (11 locales) + docs/MODEL-GUIDE.md + docs/PDF-OCR-GUIDE.md
- first-published: 2025-09 (v0.1.0)
- latest: v1.27.1 (PATCH — 46 commits since v1.27.0: deterministic related lists, sourced-paragraph rewrite guard, vault-wide link repoint, stream-path thinking policy, local-date stamps, contradiction gates, deterministic shaping; 3993 tests)
- last-updated: 2026-09-06
- alternate-names: Karpathy LLM Wiki, LLM Wiki Obsidian, Obsidian wiki plugin, graph-based RAG, no-embedding RAG, Personalized PageRank retrieval, Obsidian second brain
- search-intents: "Obsidian RAG without embeddings", "Obsidian wiki plugin", "Personalized PageRank Obsidian", "graph-based note retrieval", "Karpathy LLM Wiki implementation", "Obsidian knowledge base auto-generation", "Obsidian graph view + AI", "Obsidian second brain plugin", "Obsidian note link graph AI", "Obsidian plugin 11 languages", "Obsidian plugin 16 LLM providers", "no-vector-DB RAG", "Obsidian PDF ingest AI", "Obsidian Codex OAuth", "Obsidian Bedrock plugin", "Obsidian Bedrock SSO", "Obsidian MinerU", "Obsidian Word PPT Excel ingest", "Obsidian IAM credentials"
- features: graph-based retrieval, Personalized PageRank (Haveliwala 2002), Monte Carlo PPR (Fogaras 2005), 5-stage seed-selection cascade, Tier 1/Tier 2 duplicate detection, 11-language UI + 11-language wiki output (independent), 16+ LLM providers (Anthropic, OpenAI, Bedrock [API key + SSO/IAM], Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, Codex OAuth), MinerU multi-format ingest (PDF + images + Office), PDF ingest (cache-only, OCR paths), lint health scan, Smart Fix All, source-page verbatim quotes, ingest candidate gate, per-step taskPolicies UI, Obsidian Graph View integration, zero-embedding zero-vector-DB architecture, local-first mode
- direct-competitors: nashsu/llm_wiki (Tauri desktop app), SamurAIGPT/llm-wiki-agent (Claude Code / Codex / OpenCode / Gemini CLI skill), atomicstrata/llm-wiki-compiler (TypeScript CLI, chunk-based retrieval)
- retrieval-benchmark: PPR @5 = 27.1% vs pure-kNN 24.1% (project corpus, only published number in this open-source LLM-wiki space)
- author: green-dalii / Greener-Dalii (https://github.com/green-dalii)
- co-maintainer: DocTpoint (https://github.com/DocTpoint)
- canonical: https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md
-->

![Karpathy LLM Wiki 外掛橫幅 — 由你的 Obsidian 筆記建構而成的互聯 Wiki 頁面網路](assets/llm_wiki_banner.webp)

# 🧠 Karpathy LLM Wiki — Obsidian 外掛

> 基於 [Andrej Karpathy 的 LLM Wiki 概念](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 實現的知識庫生成系統，自動從筆記中提取實體與概念，構建互聯的 Wiki 頁面。

**Obsidian 官方市集滿分評分 • 零嵌入圖譜檢索 • 11 種語言原生支援 • 原生 PDF + 圖片 + Office 擷取 • 相容所有 LLM 供應商 • 本機優先 • 無後端 • GDPR 友善**

![Version](https://img.shields.io/github/v/release/green-dalii/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-16%2B-cyan?style=flat-square) <br>
![Maintenance](https://img.shields.io/badge/maintenance-actively%20maintained-brightgreen?style=flat-square) ![Build Status](https://img.shields.io/github/actions/workflow/status/green-dalii/obsidian-llm-wiki/release.yml?style=flat-square) ![Author](https://img.shields.io/badge/author-Greener--Dalii-blue?style=flat-square) <br>
![GitHub Stars](https://img.shields.io/github/stars/green-dalii/obsidian-llm-wiki?style=flat-square) ![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/green-dalii/obsidian-llm-wiki)

[English](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_CN.md) | **繁體中文** | [日本語](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_KO.md) | [Deutsch](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_DE.md) | [Français](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_FR.md) | [Español](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ES.md) | [Português](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_PT.md) | [Italiano](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_IT.md) | [Русский](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[官網](https://llmwiki.greenerai.top/) | [Obsidian 插件市集](https://community.obsidian.md/plugins/karpathywiki) | [部落格](https://llmwiki.greenerai.top/zh/blog/) | [討論區](https://github.com/green-dalii/obsidian-llm-wiki/discussions)

🤔 [爲什麼選擇這個外掛？](#-爲什麼選擇這個外掛) | 🚀 [快速開始](#-快速開始) | ✨ [核心特性](#-核心特性) | 🌐 [生態](#-生態) | 🔍 [檢索原理](#-檢索原理) | 🤖 [模型](#-模型) | ❓ [FAQ](#-faq)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD) ← 如果你覺得這個專案幫到你，歡迎請我喝杯咖啡♥️，或為專案點亮一顆星🌟↗

---

## 🤔 爲什麼選擇這個外掛？

你寫筆記，它們躺在資料夾裡。要找出哪些內容彼此相關，你得回憶幾個月前已經忘記的線索。

**Karpathy 的 LLM Wiki 概念有其他開源實作，但沒有一個是一鍵安裝的 Obsidian 外掛。** 大部分是 CLI 工具、Claude Code 技能或獨立桌面應用；這個外掛直接跑在 Obsidian 裡——圖譜檢視、ribbon、命令面板通通照用。

### 同類比較

|  | **Karpathy LLM Wiki**（此外掛） | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|
| **交付與安裝** | ✅ **5 分鐘** — 一鍵 Obsidian 外掛：社群外掛市集 → 安裝 → 選 Provider → 攝入 | ❌ 30 分鐘以上 — 編譯/下載 Tauri 二進位檔，設定 CLI | ❌ 15 分鐘 — 需要 Claude Code 訂閱 + 安裝技能 | ❌ 30 分鐘以上 — pip 安裝 + Python SDK + 本地伺服器 |
| **架構與依賴** | ✅ **零依賴** — 無向量 DB、無嵌入模型、無外部程序（刻意設計，採用 PPR 檢索 `[[wiki-link]]` 圖譜） | 🟡 內建 Python 執行環境 + sigma.js + sqlite；嵌入模型可選，預設關閉 | 🟡 依賴 Claude Code 環境 — 非自包含；無嵌入 | ❌ 需要 Python + 嵌入模型 + 向量 DB（強制） |
| **國際化（UI + Wiki 輸出）** | ✅ 11 種語言（UI/Wiki 互相獨立） | 🟡 2 種（EN / 中文） | ❌ 僅英文 | ❌ 僅英文 |
| **LLM Provider** | ✅ 16 種以上（Anthropic、OpenAI、Bedrock、Gemini、DeepSeek、Qwen、Grok、Kimi、GLM、MiniMax、Step、Hunyuan、MiMo、Gemma、Codex OAuth、Ollama、LM Studio、OpenRouter、Anthropic 相容等） | 🟡 OpenAI 相容 | 🟡 透過 Claude Code 訂閱 | 🟡 透過 Claude Code / Codex 訂閱 | 🟡 OpenAI 相容 |
| **檢索與查詢管線** | ✅ **5 階段級聯** — Lex → LLM 關鍵詞 → 子字串掃描 → LLM KB 回退 → PPR 擴展（在第一個足夠信號處截斷）。Personalized PageRank（Haveliwala 2002）+ Monte Carlo（Fogaras 2005） | 🟡 僅 2 跳衰減（4 信號啟發式：Adamic-Adar + 2 跳） | ❌ 僅 Louvain 社群偵測 | ❌ 僅 k-hop 預覽（無 LLM 增強） | ❌ 基於區塊的 BM25 + 語義（無圖譜） |
| **圖譜視覺化** | ✅ Obsidian 原生圖譜檢視（內建，零額外體積） | ❌ 桌面應用中自訂 sigma.js + graphology | 🟡 vis.js graph.html（獨立檔案） | ❌ 自訂 sigma.js 離線 HTML | ❌ 唯讀瀏覽器檢視器 |
| **Wiki 誠實度** | ✅ 當查詢沒有匹配的 Wiki 來源時顯示「Stage FALLBACK」提示 | ❌ 無對應功能 | ❌ 無對應功能 | ❌ 無對應功能 | ❌ 無對應功能 |
| **公開檢索基準** | ✅ PPR @5 = 27.1% vs 純 kNN 24.1%（此領域唯一公開的數字） | ❌ 58% → 71% *僅在有嵌入時*，格式不可直接比較 | ❌ 未公開 | ❌ 未公開 | ❌ 未公開 |

### 我們刻意選擇的三件事

- **🪟 Obsidian 就是執行環境。** 不需要終端機、獨立應用、Docker 或 Python。從社群外掛市集安裝，按一下「攝入」，Wiki 從第一秒就存在你的 vault 中。Obsidian 原生的圖譜檢視會呈現你的 `[[wiki-link]]` 圖譜——內建功能，完全不增加套件體積。
- **🧭 簡潔且自包含。** 零依賴。不需要嵌入模型、向量資料庫或 pip 套件——單一外掛就能讀取筆記、與 LLM 溝通、並寫入 Wiki 頁面。一切都在 Obsidian 內部運作。
- **🔌 任何你已付費的模型都能用。** Anthropic、Bedrock、OpenAI、ChatGPT Plan (Codex OAuth)、Gemini、DeepSeek、Qwen、Grok、Kimi、GLM、MiniMax、Step、Hunyuan、MiMo、Gemma、Ollama、LM Studio、OpenRouter、Anthropic 相容、自訂端點——十六種以上的 Provider，沒有一個需要嵌入端點。

---

## 🎯 適合我嗎？

**✅ 適合，如果你：**

- **想要 5 分鐘設定，而不是 5 小時的專案。** 從社群外掛安裝 → 選擇 Provider → 攝入一則筆記。不需要 CLI、Python、獨立執行環境或向量 DB。幾秒內就能在 `wiki/` 中看到 Wiki 頁面。
- **想要簡潔且自包含的解決方案。** 此外掛完全零外部依賴：沒有嵌入模型、向量資料庫、pip 套件或 Docker 容器。它就是一個讀取筆記、與 LLM 溝通、並將 Wiki 頁面寫入 vault 的單一 Obsidian 外掛。一切都在 Obsidian 內部運作。
- **想要一個能從*你的筆記*中回答問題的對話式查詢**——而不是網際網路——每個回答都附帶 `[[wiki-links]]` 引回你的知識圖譜。
- **重視資料主權**——搭配 Ollama 或 LM Studio 可完全本地執行，永不觸網。
- **使用或閱讀 11 種支援語言中的任何一種**——UI 和 Wiki 輸出語言互相獨立（你的 Wiki 可以用中文，介面用英文）。
- **透過編寫 `[[wiki-links]]` 來維護圖譜**——你寫的每個連結都在增強檢索；不需要額外的標籤/嵌入/索引步驟。
- **想要一鍵維護**——Lint 健康掃描 + 一鍵智慧修復讓重複、斷鏈和孤立頁面保持整潔，無需手動整理。

**❌ 不適合，如果你：**

- **想要一個通用 ChatGPT 替代品**——答案只來自你的 vault，無法連網。
- **需要對大型外部語料庫（Confluence、Notion、arXiv、抓取的網頁）做 RAG**——此外掛攝入你的 vault 加獨立的 PDF/Office 檔案；批次外部語料庫 RAG 超出設計範圍。
- **正在尋找帶團隊協作的託管式 SaaS**——沒有後端、沒有伺服器、沒有共享狀態；一切都在你的 Obsidian 內本地執行。

---

## 🚀 快速開始

1. **安裝。** Obsidian → 設定 → 社群外掛 → 瀏覽 → 搜尋「Karpathy LLM Wiki」→ 安裝 → 啟用。或造訪 [社群外掛頁面](https://community.obsidian.md/plugins/karpathywiki) 點選 **Add to Obsidian**。
2. **設定 Provider。** 開啟設定 → Karpathy LLM Wiki → 選擇 Provider（OpenAI、Anthropic、Ollama、ChatGPT Plan (Codex OAuth) 等）→ 輸入 API Key（本地模型不需要）→ 點選 **測試連線** → 儲存。
3. **攝入一則筆記。** 兩種方式：
   - **⌨️ 鍵盤：** `Cmd+P/Ctrl+P` →「攝入單個源文件」→ 選擇任意 Markdown（或 PDF，v1.25.0+）檔案。
   - **🖱️ 工具列圖示：** 點擊 Obsidian 左側 ribbon 中的 **貼紙圖示**，即可一鍵攝入當前開啟的筆記——無需翻找選單。
   
   幾秒內你的第一篇 Wiki 頁面就會出現在 `wiki/sources/`、`wiki/entities/` 和 `wiki/concepts/` 中。
4. **查詢你的 Wiki。** 兩種方式：
   - **⌨️ 鍵盤：** `Cmd+P/Ctrl+P` →「查詢 Wiki」。
   - **🖱️ 工具列圖示：** 點擊 Obsidian 左側 ribbon 中的 **訊息圓形圖示**。
   
   一個右側停靠的側邊面板（類 Copilot 風格）會開啟，你可以在其中與 Wiki 對話。回答附帶 `[[wiki-links]]` 回鏈到你的知識圖譜。

![Obsidian 右側停靠的查詢 Wiki 側邊面板 — 對話介面，回答附帶回鏈知識圖譜的 wiki 連結](/docs/assets/query-side-panel.png)

就是這麼簡單。外掛不會修改你原本的筆記——只會在 `wiki/` 下建立新頁面。**攝入** 與 **查詢 Wiki** 都已固定在左側 ribbon 上，可隨時一鍵存取。（macOS 使用 `Cmd`，Windows/Linux 使用 `Ctrl`。）

### 核心指令

| 指令 | 功能說明 |
|------|----------|
| **📥 攝入單個源文件** | `Cmd+P/Ctrl+P` →「攝入單個源文件」— 選擇 Markdown 或 **PDF (v1.25.0+)** 檔案，產生實體/概念/Wiki 頁面。*也可：🖱️ 在當前筆記上點擊左側 ribbon 貼紙圖示。* |
| **📂 從文件夾攝入** | `Cmd+P/Ctrl+P` →「從文件夾攝入」— 批次處理資料夾內所有筆記，含智慧批次跳過 |
| **📑 多選文件攝入** | `Cmd+P/Ctrl+P` →「多選文件攝入」— 透過雙面板檔案樹選擇子集（含即時佇列 + 按檔案取消） |
| **🔍 查詢 Wiki** | `Cmd+P/Ctrl+P` →「查詢 Wiki」— 在右側停靠側邊欄與你的 Wiki 對話；回答附帶 `[[wiki-links]]`。*也可：🖱️ 點擊左側 ribbon 訊息圓形圖示。* |
| **🛠️ 維護 Wiki** | `Cmd+P/Ctrl+P` →「維護 Wiki」— 全面健康掃描：重複頁面、斷鏈、空頁面、孤立頁面、缺失別名、矛盾 |
| **⚡ 一鍵智慧修復** | 在 Lint Modal 內部 — 一鍵按因果順序修復，附各階段執行報告 |
| **📋 重新生成索引** | `Cmd+P/Ctrl+P` →「重新生成索引」— 以目前頁面和別名重建 `wiki/index.md` |
| **⏹ 取消** | `Cmd+P/Ctrl+P` →「取消目前提取」或點擊狀態列 — 在下一批次邊界安全停止 |
| **📊 檢視攝入歷史** | `Cmd+P/Ctrl+P` →「檢視攝入歷史」— 可搜尋 UI，瀏覽歷史攝入、Lint 報告和維護記錄 |

![命令面板 — 所有 LLM Wiki 指令都位於 Obsidian 的命令面板中](/docs/assets/command-panel.png)

| 之前 | 之後 |
|------|------|
| `notes/machine-learning.md`（一個平面檔案） | `wiki/concepts/supervised-learning.md` 含 `[[雙向鏈接]]`、別名、來源引用，以及 `wiki/index.md` 中的條目 |

> 📖 詳細操作指南請見 [GitHub Discussions → Guides](https://github.com/green-dalii/obsidian-llm-wiki/discussions/categories/guides)。覺得好用？歡迎 [到 GitHub 點顆 Star](https://github.com/green-dalii/obsidian-llm-wiki) 追蹤後續版本。

---

## ✨ 核心特性

### 📚 知識品質

- **🔍 實體與概念提取** — LLM 從筆記中提取實體（人物、組織、產品、事件等）和概念（理論、方法、術語等），生成獨立頁面。粒度可設定（極簡 → 精細，外加自訂），讓你在成本與深度之間取得平衡。
- **🏷️ 強制頁面別名** — 每個頁面至少包含一個別名（翻譯、縮寫、變體名），讓跨語言重複檢測能夠運作。
- **🔄 分級重複檢測** — Tier 1（直接名稱匹配：跨語言、縮寫、高相似度標題）全部驗證；Tier 2（共享鏈接、中等相似度）填補剩餘 token 預算。
- **🧩 智慧合併與矛盾狀態** — 重複頁面合併時保留別名；矛盾標記來源歸屬；`reviewed: true` 頁面受保護不被覆蓋。
- **🎨 自訂標籤詞彙** — 在設定 → Wiki → 標籤詞彙模式 → *自訂* 中定義自己的實體類型與概念類型標籤。詞彙表是 schema 注入提示，不是寫入時的強制閘門——小型/本機模型仍可能漂移（大約每十項會有一項回傳模型內建的分類）。剩下的由 Lint 揭露。Schema 強制校驗的設計錨點見 [Issue #328](https://github.com/green-dalii/obsidian-llm-wiki/issues/328)。

### 📄 文件 / PDF / 圖片擷取

五條入口，每次擷取都能切換：

1. **🆕 內建 MinerU 後端 (v1.27.0, #404)** — 設定 → Wiki Configuration → Markdown Conversion Backend → *MinerU*。PDF、圖片（PNG/JPG/JPEG/JP2/WebP/GIF/BMP）與 Office 文件（DOC/DOCX/PPT/PPTX/XLS/XLSX）皆交由 [MinerU 的 Precise 解析器](https://mineru.net/apiManage/docs) 處理。API token 存放於 Obsidian SecretStorage。對於科學論文、掃描文件，以及重視版面保留的 Office 檔案，這是最佳路徑。伺服器上限：每份 PDF 200 MB / 200 頁，每個壓縮檔 256 MB / 10,000 個檔案。
2. **☁️ 原生支援 PDF 的雲端 Provider** — Anthropic、OpenAI、Google Gemini 與 AWS Bedrock（Anthropic + OpenAI 變體）可直接把 PDF 當作 file part 讀取。除了選定 Provider 之外不需任何設定。
3. **🖥️ Apple Silicon 本機 OCR** — [oMLX](https://github.com/jundot/omlx) 內建 Microsoft Markitdown 作為 PDF→Markdown 後端。在 oMLX 中啟用 Markitdown，載入 [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR)（3B / 570M 活躍參數，2026-06 開源）作為視覺模型，把外掛指向 oMLX 作為 Custom OpenAI-Compatible Provider，開啟 **Force PDF Support**，再選擇 oMLX 正在服務的多模態模型。PDF 全程不離開你的機器。
4. **🛠️ 第三方提取器（MinerU 線上 UI）** — 不想接 API token 時，用 [MinerU Extractor 線上服務](https://mineru.net/OpenSourceTools/Extractor) 做快速手動轉換。下載轉好的 `.md` 檔，放到 wiki 資料夾之外的 vault 任意位置，再作為一般 Markdown 筆記擷取。
5. **🔌 Force PDF Support** — 對於其他任何接受 file part 的 OpenAI/Anthropic 相容端點，外掛會嘗試呼叫（設定 → LLM Configuration → Advanced）。成敗由端點決定；失敗會以本地化 Notice 呈現。

**Office 格式注意事項：** Obsidian 並不原生算繪 `.docx` / `.xlsx` / `.pptx`（[file-formats](https://obsidian.md/help/file-formats)），因此 Office 檔案的實際工作流程是：MinerU 將其轉為 `.md`，外掛把這個 `.md` 擷取成 Wiki 頁面，原始 Office 檔案僅作為參考保留。若需要內嵌預覽 Office 檔案，可搭配社群外掛如 Pandoc Plugin / Docxer / Md Importer / Office Reader。

**所有路徑共用的底層機制：**

- **🗄️ 有界快取** — `.obsidian/plugins/karpathywiki/pdf-cache/` 儲存以內容雜湊 + 模型 + converterVersion 為鍵值的轉換後 Markdown；總計 100 MB / 1000 條 / 單條 10 MB 上限，搭配 LRU-by-mtime 淘汰。
- **📝 可選 vault sidecar** — 設定 → Wiki Configuration → Wiki Folder → *Write PDF Markdown to Vault* 在來源 PDF 旁寫入 `<basename>.pdf.md`（預設關閉 — 僅快取是預設行為）。
- **🛡️ 逐字轉錄 Prompt** — OCR 風格的轉換，搭配 `[illegible]` / `[figure: ...]` 反幻覺標記；來自小型本機模型的 markdown 圍欄包裹會在寫入快取前自動清洗。
- **🔁 來源頁逐字引文 (v1.27.0, #496)** — 每個產生的 `sources/<slug>.md` 頁面現在都會帶有一個 `Mentions in Source` 區段，內容取自提取階段為各實體/概念所擷取的同一批逐字引文（也就是模型已證實自己確實看見的原文），讓底層文件成為唯一一個能真正回溯到來源文本、有實據可循的 Wiki 頁面。

📖 **所有路徑的完整設定教學**（雲端 Provider、oMLX 硬體分級、MinerU 安裝、快取維護）→ [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 查詢與維護

- **🧭 5 階段 PPR 級聯** — 參閱 [檢索原理](#-檢索原理)。在 `[[wiki-link]]` 圖譜上執行 Personalized PageRank，提供圖感知的多跳上下文。
- **🪟 右側停靠側邊欄** — 查詢 Wiki 以 Copilot 風格的右側 sidebar leaf 開啟（v1.22.1+），取代置中彈窗。
- **🔍 Lint 健康掃描** — 單一指令即可檢測：重複頁面、斷鏈、空頁面、孤立頁面、缺失別名、矛盾。
- **⚡ 一鍵智慧修復** — 按因果順序一鍵修復：補全別名 → 合併重複 → 修復斷鏈 → 鏈接孤立頁 → 擴充空頁面，附各階段執行報告。
- **🆕 修復斷鏈的「保留不動」選項 (v1.27.0, #485)** — 設定 → Advanced → *Create Stubs for Unresolvable Links*（預設開啟）讓你可以不再產生空的佔位頁面：關閉後，斷鏈會持續出現在每一份 Lint 報告中，直到有真正的來源定義它為止，而頁面則透過正常管道在攝入時建立。#197 引入的「絕不由 LLM 擴寫」閘門維持不變——這個新開關只決定佔位頁面*是否要被寫出來*。
- **📊 操作歷史面板** — 可搜尋、可篩選的 UI，瀏覽歷史攝入、Lint 報告和維護記錄。
- **🛡️ 攝入前置檢查** — 空檔案/純空白/僅含 frontmatter 的筆記會在 LLM 呼叫前被拒絕；內容雜湊去重可識別跨路徑的相同檔案。
- **🆕 攝入候選項閘門 (v1.27.0, #514 / PR #521)** — 需手動開啟的開關（`skipMentionOnlyCandidates`，預設關閉，位於 設定 → Advanced）。若來源語言已有實測輪廓（德文為實測；英/法/西/葡/荷/韓為估算並針對邊界情況做了固定處理；中文/日文的字符腳本門檻尚未實測），那些僅出現在括號、列舉或短列表項目中的候選項，會在耗費一個頁面外加去重與生成呼叫之前先被剪除。跨語言筆記不受此閘門限制；沒有語言輪廓的 Wiki 語言每次攝入僅回報一次，絕不靜默跳過。
- **🆕 逐步驟任務策略 (v1.27.0, #525 / #490)** — LLM Advanced → Task Policies 欄位，可在不改程式碼的情況下覆寫各步驟的文字模式／thinking 設定。你沒有列出的步驟，其內建基準值維持不變。

### 🔒 隱私

- **🚫 無後端、無追蹤、無分析。** 完全在 Obsidian 內部執行。網路僅用於與你設定的 LLM Provider 通訊。
- **📁 來源檔案為唯讀。** 外掛從不修改你原始的 vault 筆記——只會在 `wiki/` 下建立新頁面。
- **🦙 完全本地模式。** Ollama、LM Studio 或任何本地 OpenAI 相容端點 → 你的筆記永不離開你的機器。
- **🔐 最小化權限。** Vault 檔案存取用於 Wiki 管理。剪貼簿存取僅在你於查詢 Modal 中點選「複製」按鈕時使用。

### 🦙 本地優先

- **🖥️ Ollama、LM Studio、OpenRouter、自訂端點** — 開箱即用。本地模型可用於查詢（較小的上下文窗口）；2000 頁 vault 的攝入通常需要長上下文雲端模型。
- **📄 Apple Silicon 上 PDF OCR 路徑完全本機** — 請參閱上方 [文件 / PDF / 圖片擷取](#-文件--pdf--圖片擷取)。
- **🔐 ChatGPT Plan (Codex OAuth)** — 桌面端透過迴圈回呼，行動端透過裝置代碼；憑證僅存在 Obsidian SecretStorage 中。（完整的 Provider 邊界說明見下方 [Anthropic vs OpenAI vs Codex OAuth](#anthropic-vs-openai-vs-codex-oauth三者是不同的-provider)。）

### 🌐 語言

- **🌍 11 種 UI 語言** — 英文、簡體中文、繁體中文、日文、韓文、德文、法文、西班牙文、葡萄牙文、義大利文、俄文。UI 和 Wiki 輸出語言互相獨立——你的 Wiki 可以是中文而介面是英文。
- **📚 11 種 Wiki 輸出語言** — 同上；在設定 → Wiki Configuration 中選擇。*自訂輸入* 選項用於臨時提示。
- **UI 字串在每個語系都已完整翻譯** — 每個標籤、彈窗和通知。新增第 12 種語言由貢獻者驅動（PR #159 模式）。

---

## 🌐 生態

本外掛與你的其他 Obsidian 工具無縫協作——以下工具皆可直接接入 `[[wiki-link]]` 圖譜，無需任何程式碼改動。

- **📄 [MinerU 多格式後端](https://mineru.net/apiManage/docs)（v1.27.0 起內建）** —— 過去要另開 CLI／UI 的步驟，現在只是外掛裡的一個開關；完整路徑對照見 [文件 / PDF / 圖片擷取](#-文件--pdf--圖片擷取)。若你更偏好圖形介面而非 API token，[MinerU 線上服務](https://mineru.net/OpenSourceTools/Extractor) 仍可繼續使用；[自行部署 MinerU](https://github.com/opendatalab/mineru) 也是選項之一。
- **🕸️ Obsidian 原生關係圖譜** —— 在任何 Wiki 頁面開啟原生圖譜視圖；每個 `[[wiki-link]]` 成為節點，每條反向連結成為邊。內建功能，零額外體積。
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** —— 官方瀏覽器擴充功能。將網頁（文章、部落格文章、Reddit 串文、Hacker News、食譜、研究論文、YouTube 字幕（透過 Interpreter 取得））儲存到 vault 內任一資料夾，然後執行外掛的「從資料夾攝入」指令以批次萃取實體與概念。
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** —— 使用 DQL（`LIST FROM "wiki/entities" WHERE contains(tags, "person")`）或 JS API 像查詢資料庫一樣檢索 Wiki。外掛會在每個頁面寫入標準 frontmatter（`tags:`、`type:`、`aliases:`），Dataview 查詢開箱即可使用。
- **🌿 Git** —— 用任何 Git 客戶端對 vault 進行版本控制。外掛絕不重寫來源檔案，僅在 `wiki/` 下建立新頁面，因此 `git diff` 能清晰區分你的手動編輯與 LLM 生成內容。
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** —— 透過 Marp frontmatter（`marp: true`）將任何 Obsidian 筆記轉為投影片。Wiki 頁面為純 Markdown，無需額外轉換即可直接渲染為投影片。
- **🖼️ Canvas** —— Obsidian 原生無限畫布。把 Wiki 卡片拖到 Canvas 上，無需離開 vault 即可拼裝學習指南、心智圖或研究概覽，所有內容均透過 `[[wiki-links]]` 互聯。
- **🎤 [Obsidian Nous](https://github.com/AndyMDH/obsidian-nous)** —— 本地語音備忘錄與會議錄製（macOS 上使用 whisper.cpp，音訊資料不出本機）的配套外掛。產生帶說話者標記的轉錄檔案與自有 wiki 中心頁面。與本外掛相互獨立——可在同一 vault 共存而無需耦合。

## 🧰 無頭 CLI

**大多數使用者可跳過本節。** 外掛的面向使用者 CLI 位於獨立倉庫 [green-dalii/obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli) ——以 npm 套件 `karpathywiki-cli` 形式發佈。安裝：`npm i -g karpathywiki-cli`，執行 `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`。

本倉庫內 [`tools/dev-instrument/`](https://github.com/green-dalii/obsidian-llm-wiki/tree/main/tools/dev-instrument) 裝的是 **dev-only 無頭測量儀器** —— 給引擎貢獻者用，跑真正的 `WikiEngine.ingestSource`，無 Obsidian 執行環境，輸出每任務的 token + wall-clock 統計——與 CLAUDE.md 及發佈說明中的效能證據同一組數字。入口指令、env 變數、測量模式、退出碼規範詳見 [`tools/dev-instrument/README.md`](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/tools/dev-instrument/README.md)。

## 🔍 檢索原理

大多數「AI 搜尋」外掛會將你的筆記切成區塊並嵌入向量資料庫。我們不這麼做。[Karpathy 反對 RAG 的理由](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 是：區塊化破壞了 LLM 在整個知識圖譜上推理的能力——而這個論點在實務上是成立的。我們的做法是：在你透過編寫 `[[wiki-links]]` 已經維護的圖譜上直接走訪。

### 5 階段種子選擇級聯

當你問「誰創辦了 Microsoft？」時，查詢 Wiki 在生成任何答案之前會執行五個階段：

1. **Lex 快速路徑** — 直接對每個實體/概念標題與別名做 token 重疊匹配。免費、即時，且為後續階段的把關步驟。
2. **LLM 關鍵詞生成** — LLM 從你的查詢中提出 8–12 個跨語言關鍵詞（一次 LLM 呼叫即可處理同義詞、縮寫和 token 重疊不敏感的術語）。
3. **本地子字串掃描** — 每個生成的關鍵詞在本地對頁面標題、別名與正文片段重新匹配。無額外 LLM 呼叫；補滿雜訊容忍的召回。
4. **LLM KB 回退** — 當 lex + 關鍵詞掃描信號不足時，LLM 對 top-N 候選針對完整 wiki 重新做一次語義篩選。
5. **PPR 圖擴展** — 從候選種子集開始，在 `[[wiki-link]]` 圖譜上執行 Personalized PageRank（Haveliwala 2002）。這就是提供圖感知多跳上下文的機制：「比爾蓋茲」→「Microsoft」→「競爭對手」，而非僅靠字面標題重疊。

級聯會在第一個提供足夠信號的階段處截斷——沒有固定的 5 階段開銷；lex 足夠時無需 LLM 呼叫；只有在 lex 加關鍵詞掃描都不夠時才走語義回退。

### 規模化的 Personalized PageRank

我們使用 Monte Carlo PPR（Fogaras 2005）——3,000 條隨機漫步 × 每條 50 步——搭配 Haveliwala 2002 的 dead-end 規則。成本為 **O(K × L)**（K = 漫步條數，L = 每條漫步的步數），與頁面數量無關，因此 2000 頁的 vault 與 200 頁的 vault 有相同的擴展延遲。

**PPR @5 = 27.1% vs 純 kNN 基線 24.1%**——以專案自有基準語料庫測試（此開源 LLM-Wiki 領域唯一公開的檢索基準）。

### 爲什麼不使用嵌入

我們在 [Issue #175](https://github.com/green-dalii/obsidian-llm-wiki/issues/175) 中刻意拒絕了嵌入路徑。圖譜訊號已經存在——每個 `[[wiki-link]]` 都是一條手工維護的「這些內容相關」的邊，而且我們支援的大多數 Provider（Ollama、LM Studio、Anthropic、Bedrock、Kimi、GLM、MiniMax）根本沒有 `/v1/embeddings` 端點。加入嵌入模型意味著每次頁面下載、每個 Provider 適配器，而檢索品質上沒有任何提升。

---

## 🤖 模型

**支援的 Provider（16 種以上，2026-07 經 models.dev 交叉驗證）：**

| Provider | 系列 | 備註 |
|----------|------|------|
| **Anthropic** | Claude 5 系列 | 原生 PDF；`/v1/messages` 協定 |
| **OpenAI** | GPT-5.6 系列（Sol / Terra / Luna） | 原生 PDF；Platform API Key |
| **Google Gemini** | Gemini 3.6 系列 | 原生 PDF（自 1.5 起支援檔案部分）；OpenAI 相容端點 |
| **DeepSeek** | DeepSeek V4 系列 | OpenAI 相容；最低成本 |
| **Alibaba Qwen** | Qwen3.7/3.8 系列 | OpenAI 相容（DashScope） |
| **xAI Grok** | Grok 4 系列 | OpenAI 相容；長上下文 |
| **Moonshot Kimi** | Kimi K3 系列 | OpenAI 相容；2.8T MoE 前沿模型 |
| **Zhipu GLM** | GLM-5 系列 | OpenAI 相容；雙語能力強 |
| **MiniMax** | MiniMax M3 系列 | OpenAI 相容；1M 上下文 |
| **Step（階躍星辰）** | Step 3 系列（Flash） | OpenAI 相容；推理速度快 |
| **Tencent Hunyuan** | Hy3 系列 | OpenAI 相容；開源權重 MoE |
| **Xiaomi MiMo** | MiMo V2.5 系列 | MIT 開源；平價方案 |
| **Google Gemma** | Gemma 4 系列 | 開源權重；262K 上下文 |
| **AWS Bedrock** | Anthropic + OpenAI 變體 | VPC / 合規路徑；**API key + SSO + IAM**（v1.27.0, #425） |
| **ChatGPT Plan (Codex OAuth)** | Codex Responses API | 瀏覽器/裝置代碼登入；SecretStorage |
| **本地：Ollama、LM Studio、OpenRouter、Anthropic 相容** | 任何 OpenAI/Anthropic 協定模型 | Custom OpenAI-Compatible + Anthropic-Compatible（Token Plan / Coding Plan） |

此外掛在每次查詢時會將完整的 Wiki 上下文餵給 LLM——所以**長上下文模型勝出**。完整的分級表（雲端 + 本地）請見 [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)，已與 [models.dev](https://models.dev/) 交叉驗證以確保建議保持最新。

### 什麼才重要

- **🧠 上下文窗口 ≥ 200K tokens**——適用於超過 ~500 頁的 vault。低於 200K 時，級聯可能會捨棄較早的階段以塞進上下文。
- **⚖️ 指令遵循品質比原始 IQ 更重要**——提取任務選擇能正確遵循 schema 模板的模型，而不是排行榜上最大的數字。
- **🔌 嵌入端點無關緊要**——我們不使用嵌入。沒有 `/v1/embeddings` 的 Provider 完全沒問題（我們支援的 16 種以上 Provider 大多都沒提供）。
- **🦙 本機用於查詢，雲端用於擷取**——2000 頁 vault 的擷取通常需要長上下文雲端模型；262K 的本機模型可涵蓋大多數查詢。

關於 PDF／圖片／Office 擷取，請見核心特性中的 [文件 / PDF / 圖片擷取](#-文件--pdf--圖片擷取)——Anthropic、OpenAI、Bedrock 與 Gemini 可原生把 PDF 當作 file part 讀取；其餘則由內建 MinerU 後端（v1.27.0+）與 **Force PDF Support** 涵蓋。

### Anthropic vs OpenAI vs Codex OAuth——三者是不同的 Provider

- **Anthropic**（及其 Bedrock 變體）——單獨計費的 Anthropic Platform API Key。
- **OpenAI**——單獨計費的 OpenAI Platform API Key。
- **ChatGPT Plan (Codex OAuth)**——實驗性的獨立 Provider，在瀏覽器或裝置代碼登入後使用符合資格的 Codex 方案額度；可用性取決於 OpenAI Codex 的驗證和額度政策，而非僅憑方案名稱。這是第三方 Codex 相容功能，並非 OpenAI 合作項目或通用 ChatGPT API。

### AWS Bedrock——三種驗證模式 (v1.27.0, #425)

設定 → Provider → Bedrock（Anthropic / OpenAI）現在可從三種驗證模式中擇一；選定後，該 Provider 欄位只會索取該模式實際需要的輸入項：

- **API key**——原本的 Stage-1 bearer 路徑；行為與 v1.26.4 逐位元組完全相同，也是已經在付費使用 Bedrock API key 的使用者的建議選項。
- **SSO**——IAM Identity Center 裝置流程。點擊 *Sign in with AWS SSO*，在瀏覽器貼上驗證 URL 代碼，外掛便會透過 SecretStorage 中的 `karpathywiki-bedrock-sso` 取得 SSO token，將其換取為臨時角色憑證，並以自行實作的 SigV4 為每一次請求簽章（不引入 AWS SDK）。當 SSO 身分各只暴露一組時，帳號 ID 與角色名稱會自動偵測；否則請在 Provider 設定中手動填入。
- **IAM**——供沒有 SSO 的環境（CI、排程批次作業）使用的靜態存取金鑰。儲存於 SecretStorage 中的 `karpathywiki-bedrock-iam`；記憶體內快取會依存取金鑰做記憶化，讓 SigV4 簽章維持在有效期限之內。

三種模式共用同一套 Obsidian SecretStorage 紀律（憑證絕不出現在 `data.json`、日誌或文件中），也共用同一條零 AWS SDK、自行實作的 OIDC + SigV4 路徑。Bedrock 區域與驗證模式互相獨立，在同一個 Provider 欄位中設定。

> 📖 **完整選擇表**（雲端 + 本地 + PDF OCR + Codex OAuth + 量化 + 硬體分級）→ [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

---

## ❓ 常見問題 (FAQ)

### 此外掛到底能做什麼？

選擇任意筆記、資料夾或選取範圍；LLM 提取實體和概念，生成帶有 `[[雙向鏈接]]` 的互聯 Wiki。提出問題，獲得基於*你的*筆記的對話式答案——而非網際網路。你的原始 vault 筆記永遠不會被修改。

### 如何開始使用？

從 Obsidian 社群外掛安裝 → 選擇 Provider → **測試連線** → 在任何筆記上執行 **攝入單個源文件**。第一篇 Wiki 頁面在幾秒內就會出現。請見 [快速開始](#-快速開始)。

### 我現有的 Wiki 安全嗎？

✅ 自 v1.0.0 起向後相容。在任何頁面設定 `reviewed: true` 以保護不被覆蓋。從 v1.24.x 升級不會改寫你的 vault；v1.25.0 的 PDF 攝入預設為僅快取，v1.27.0 新增的 PDF + 圖片 + Office 攝入也不會改變磁碟上的 Wiki 佈局。

### 可以攝入 PDF、圖片和 Office 文件嗎？

✅ 可以。Anthropic、OpenAI、Bedrock 與 Gemini 可原生讀取 PDF；其餘則由內建的 MinerU 後端（v1.27.0）涵蓋（PDF + 圖片 + Office）。完整教學——雲端 Provider、Apple Silicon OCR、Force PDF Support、快取維護——見 [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)。

### 我的資料會被傳送到任何地方嗎？

🚫 沒有後端、沒有分析——此外掛完全在 Obsidian 內部執行。只有你明確用於攝入/查詢的文字會離開你的裝置，且僅發往你設定的 LLM Provider。如需完全資料本地化，請使用 Ollama 或 LM Studio。

### 可以用我的語言使用嗎？

🌍 **11 種語言**支援介面和 Wiki 輸出。介面語言和 Wiki 語言互相獨立。新增第 12 種語言由貢獻者驅動（PR #159 模式）。

### 這和 RAG 聊天機器人有何不同？

🚫 不切分區塊。🚫 不使用嵌入。🚫 不需要向量 DB。✅ 在你現有的 `[[wiki-link]]` 圖譜上執行 Personalized PageRank——圖感知的多跳上下文，零嵌入成本，完全支援本地模型。

### 該選哪個 LLM？

長上下文模型（≥200K tokens）效果最佳。[模型](#-模型) 章節涵蓋了選擇原則；完整的分級表請見 [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)。

### 有公開的基準測試嗎？

有——PPR @5 = 27.1% vs 純 kNN 基線 24.1%，基於專案自有語料庫。完整的管線和基準測試腳本請見 [檢索原理](#-檢索原理)。

### 如何控制 API 成本？

批次攝入時使用粗略或極簡提取粒度。智慧批次跳過自動偵測已處理的檔案。自動維護預設關閉。Lint 在執行修復前會顯示計數——不經你確認不會產生費用。

### 如何取消正在執行的操作？

點擊狀態列文字（顯示「攝入中… 點選取消」），或 `Cmd+P/Ctrl+P` →「取消目前提取」。在下一批次邊界安全停止，保留已完成的工作。

### 在哪裡獲得幫助？

[GitHub Issues](https://github.com/green-dalii/obsidian-llm-wiki/issues) 用於回報錯誤 · [GitHub Discussions](https://github.com/green-dalii/obsidian-llm-wiki/discussions) 用於提問和功能請求 · 開發者主控台（`Ctrl+Shift+I` / `Cmd+Option+I`）用於檢視外掛日誌。

---

## 🔒 隱私

此外掛已上架 Obsidian 社群外掛市集，並接受安全與權限的自動化審查。

- **🚫 無後端、無伺服器、無資料收集。** 純粹在 Obsidian 內部運行的本地軟體。此外掛不能也不會以任何方式收集、儲存或傳輸你的資料到任何伺服器——因為這樣的伺服器根本不存在。
- **🔐 網路存取為選擇性加入。** 僅用於與你設定的 LLM Provider 通訊。你選擇 Provider、你輸入 API Key、你決定資料前往何處。
- **📁 Vault 檔案存取**用於 Wiki 管理（讀取筆記、生成頁面、掃描斷鏈、檢測重複）。外掛從不修改你的來源檔案。
- **📋 剪貼簿存取**僅由查詢 Modal 中的「複製」按鈕使用——且僅在你點擊時使用。

如需完全資料本地化，請使用 Ollama 或 LM Studio。使用本地 Provider 時，你的資料永遠不會離開你的機器。

---

## 💖 支持專案

如果 LLM-Wiki 已成為你知識工作流程中重要的一部分：

- ☕ **[在 Ko-fi 上請我喝杯咖啡](https://ko-fi.com/greenerdalii)** — 一次性或月度支持
- 💳 **[透過 PayPal 打賞](https://paypal.me/greenerdalii)** — 一次性打賞

感謝以下贊助者對專案的支持：

[@jameses-cyber](https://github.com/jameses-cyber)、[@issaqua](https://github.com/issaqua)、Dikson Choi

---

## 🔭 其他專案

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — 無頭攝入 CLI，獨立倉庫以 npm 套件 `karpathywiki-cli` 形式發佈。對著磁碟上的 vault 跑同一套 `WikiEngine`，不需要算繪器。安裝：`npm i -g karpathywiki-cli`。本倉庫內的 `tools/dev-instrument/` 是 dev-only 測量工具，為此外掛的發佈說明提供每任務成本數據。
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — [pi-coding-agent](https://github.com/earendil-works/pi) 的任務級路由器。每輪開始前，一個小模型判定把你的訊息分成例行還是要緊，選中的檔位接管整輪。複雜任務還會更進一步：Smart 檔像 CTO 一樣規劃，把實作派發給 Fast 子代理，逐項審核並迭代。升檔立即生效，降檔要等趨勢穩住；每檔的回退鏈能扛住 429 和 5xx。零執行時相依，MIT。→ [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — pi-shift-router 的 DSH 分支，共享同樣的任務級路由設計，但面向 [dsh-coding-agent](https://github.com/earendil-works/dsh) 執行環境。同樣的判定驅動檔位選擇、同樣的每檔回退鏈，MIT。
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — DSH 版的 `obsidian-plugin-dev` 工作流配套：搭建 Obsidian 插件工作區、驅動 Red→Green TDD 迴圈、跑 Six-Gate 品質閉環（lint/tsc/test/build/css-lint），並在 `feat/*` 或 `fix/*` 分支上準備可發佈的 commit。讓跑 DSH 的貢獻者獲得與維護者同樣的腳手架 + gate 體驗，無需從 CLAUDE.md 複製貼上。

---

## 📜 許可證與致謝

Apache License, Version 2.0 — 詳見 [LICENSE](../LICENSE) 與 [NOTICE](../NOTICE)。

**基於以下專案建構：**
- 💡 [Andrej Karpathy 的 LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — 原始概念
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v6](https://ai-sdk.dev/)（`@ai-sdk/openai`、`@ai-sdk/anthropic`、`@ai-sdk/openai-compatible`）via Obsidian `requestUrl`
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) 與 [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — 檢索演算法

**維護者：** [@green-dalii](https://github.com/green-dalii)

[![Star History Chart](https://api.star-history.com/chart?repos=green-dalii/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
