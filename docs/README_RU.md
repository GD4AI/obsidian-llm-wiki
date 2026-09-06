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

![Баннер плагина Karpathy LLM Wiki — сеть взаимосвязанных wiki-страниц, построенных на основе ваших заметок Obsidian](assets/llm_wiki_banner.webp)

# 🧠 Плагин Karpathy LLM Wiki для Obsidian

> Плагин для Obsidian, который превращает ваши заметки в связанную, запрашиваемую базу знаний — идея [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), встроенная в редактор, в котором вы уже пишете.

**Идеальная оценка обзора Obsidian • Графовый поиск без эмбеддингов • Родная поддержка 11 языков • Нативный импорт PDF + изображений + Office • Работает с любым провайдером • Локально-ориентированный • Без бэкенда • Соответствует GDPR**

![Version](https://img.shields.io/github/v/release/green-dalii/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-16%2B-cyan?style=flat-square) <br>
![Maintenance](https://img.shields.io/badge/maintenance-actively%20maintained-brightgreen?style=flat-square) ![Build Status](https://img.shields.io/github/actions/workflow/status/green-dalii/obsidian-llm-wiki/release.yml?style=flat-square) ![Author](https://img.shields.io/badge/author-Greener--Dalii-blue?style=flat-square) <br>
![GitHub Stars](https://img.shields.io/github/stars/green-dalii/obsidian-llm-wiki?style=flat-square) ![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/green-dalii)

[English](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_CN.md) | [繁體中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_KO.md) | [Deutsch](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_DE.md) | [Français](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_FR.md) | [Español](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ES.md) | [Português](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_PT.md) | [Italiano](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_IT.md) | **Русский**

[Официальный сайт](https://llmwiki.greenerai.top/) | [Маркетплейс Obsidian](https://community.obsidian.md/plugins/karpathywiki) | [Блог](https://llmwiki.greenerai.top/blog/) | [Обсуждения](https://github.com/green-dalii/obsidian-llm-wiki/discussions)

🤔 [Зачем этот плагин?](#-зачем-этот-плагин) | 🚀 [Быстрый старт](#-быстрый-старт) | ✨ [Возможности](#-возможности) | 🌐 [Экосистема](#-экосистема) | 🔍 [Как работает поиск](#-как-работает-поиск) | 🤖 [Модели](#-модели) | ❓ [FAQ](#-faq)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD) ← Если этот плагин помог вам, не стесняйтесь угостить меня кофе♥️ или поставить звёздочку🌟↗

---

## 🤔 Зачем этот плагин?

Вы пишете заметки. Они лежат в папках. Чтобы найти, что с чем связано, нужно помнить нити, которые вы забыли месяцы назад.

**Существуют другие открытые реализации идеи Karpathy LLM Wiki — но ни одна из них не поставляется как плагин Obsidian в один клик.** Большинство — это CLI-инструменты, навыки Claude Code или отдельные десктопные приложения; этот работает внутри Obsidian — Graph View, ribbons и палитра команд включены.

### Как мы сравниваемся

|  | **Karpathy LLM Wiki** (этот плагин) | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | sdyckjq / llm-wiki-skill | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|---|
| **Доставка и установка** | ✅ **5 мин** — Плагин Obsidian в один клик: Community Plugins → Install → выбор провайдера → Ingest | ❌ 30 мин+ — Компиляция/загрузка Tauri-бинарника, настройка CLI | ❌ 15 мин — Подписка Claude Code + установка навыка | ❌ 10 мин — Подписка Claude Code/Codex + настройка навыка | ❌ 30 мин+ — pip install + Python SDK + локальный сервер |
| **Архитектура и зависимости** | ✅ **Ноль зависимостей** — нет векторной БД, нет модели эмбеддингов, нет внешних процессов (PPR по графу `[[wiki-link]]`, по замыслу) | 🟡 Встраивает Python-рантайм + sigma.js + sqlite; опциональные эмбеддинги выкл по умолчанию | 🟡 Использует окружение Claude Code — не самодостаточный; без эмбеддингов | 🟡 Требует отдельный рантайм платформы; без эмбеддингов | ❌ Требует Python + модель эмбеддингов + векторную БД (обязательно) |
| **i18n (UI + вывод Wiki)** | ✅ 11 языков (UI / вывод независимы) | 🟡 2 (EN / 中文) | ❌ Только английский | ❌ Только английский | ❌ Только английский |
| **Провайдеры LLM** | ✅ 16+ (Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, ...) | 🟡 OpenAI-compatible | 🟡 Подписка через Claude Code | 🟡 Подписка через Claude Code / Codex | 🟡 OpenAI-compatible |
| **Извлечение и конвейер запросов** | ✅ **5-ступенчатый каскад** — Lex → LLM-ключевые слова → substring-скан → LLM KB fallback → PPR-расширение (усечение на первом достаточном сигнале). Personalized PageRank (Haveliwala 2002) + Monte Carlo (Fogaras 2005) | 🟡 2-hop decay (4-сигнальная эвристика: Adamic-Adar + 2-hop) | ❌ Только обнаружение сообществ Louvain | ❌ Только k-hop предпросмотры (без LLM-усиления) | ❌ BM25 + семантика по чанкам (без графа) |
| **Визуализация графа** | ✅ Нативный Graph View от Obsidian (встроенный, нулевой размер) | ❌ Кастомный sigma.js + graphology в десктоп-приложении | 🟡 vis.js graph.html (отдельный файл) | ❌ Кастомный sigma.js офлайн HTML | ❌ Read-only браузерный вьюер |
| **Честность Wiki** | ✅ Баннер «Stage FALLBACK», когда ни один источник Wiki не соответствует вашему запросу | ❌ Нет эквивалента | ❌ Нет эквивалента | ❌ Нет эквивалента | ❌ Нет эквивалента |
| **Опубликованный бенчмарк поиска** | ✅ PPR @5 = 27,1% против pure-kNN 24,1% (единственное опубликованное число в этой области) | ❌ 58% → 71% *только с включёнными эмбеддингами*, не в нашем формате сравнения | ❌ Не опубликовано | ❌ Не опубликовано | ❌ Не опубликовано |

### Три вещи, которые мы выбрали намеренно, а не случайно

- **🪟 Obsidian — это среда выполнения.** Никакого терминала, никакого отдельного приложения, никакого Docker, никакого Python. Установите из Community Plugins, нажмите Ingest — Wiki живёт в вашем хранилище с первой секунды. Нативный Graph View от Obsidian отображает ваш граф `[[wiki-link]]` — встроенный, нулевой дополнительный размер бандла.
- **🧭 Чисто и самодостаточно.** Ноль зависимостей. Никакой модели эмбеддингов, никакой векторной базы данных, никакого pip-пакета — один плагин, который читает ваши заметки, общается с LLM и пишет страницы Wiki. Всё живёт внутри Obsidian.
- **🔌 Любая модель, за которую вы уже платите.** Anthropic, Bedrock, OpenAI, ChatGPT Plan (Codex OAuth), Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-compatible, пользовательский эндпоинт — более шестнадцати провайдеров, ни один из которых не обязан иметь эндпоинт эмбеддингов.

---

## 🎯 Подходит ли он мне?

**✅ Да, если вы:**

- **Хотите настройку за 5 минут, а не проект на 5 часов.** Установите из Community Plugins → выберите провайдера → Ingest одну заметку. Без CLI, без Python, без отдельного рантайма, без векторной БД. Вы увидите страницы Wiki в `wiki/` через секунды.
- **Хотите что-то чистое и самодостаточное.** У плагина ровно ноль внешних зависимостей: нет модели эмбеддингов, нет векторной базы данных, нет pip-пакета, нет Docker-контейнера. Это один плагин Obsidian, который читает ваши заметки, общается с LLM и пишет страницы Wiki в ваше хранилище. Всё живёт внутри Obsidian.
- **Хотите чат с возможностью запросов, который отвечает на основе *ваших* заметок** — не интернета — с каждым ответом, несущим `[[wiki-links]]` обратно в ваш граф знаний.
- **Заботитесь о суверенитете данных** — полностью работает локально с Ollama или LM Studio, никогда не касаясь интернета.
- **Пишете или читаете на любом из 11 поддерживаемых языков** — язык UI и язык вывода Wiki независимы (ваша Wiki может быть на китайском, а интерфейс — на английском).
- **Поддерживаете граф, записывая `[[wiki-links]]`** — каждая написанная вами ссылка уже обогащает поиск; никакого отдельного шага разметки/эмбеддингов/индексирования.
- **Хотите обслуживание в один клик** — Lint-сканирование здоровья + Smart Fix All поддерживают дубликаты, мёртвые ссылки и висячие страницы под контролем без ручной курации.

**❌ Нет, если вы:**

- **Хотите замену ChatGPT общего назначения** — ответы приходят только из вашего хранилища, а не из интернета.
- **Нужен RAG по большим внешним корпусам** (Confluence, Notion, arXiv, скачанные веб-страницы) — плагин импортирует ваше хранилище плюс отдельные PDF/Office-файлы; массовый RAG по внешним корпусам выходит за рамки дизайна.
- **Ищете хостируемый SaaS с командным взаимодействием** — нет бэкенда, нет сервера, нет общего состояния; всё работает локально внутри вашего Obsidian.

---

## 🚀 Быстрый старт

1. **Установите.** Obsidian → Настройки → Сторонние плагины → Обзор → найдите «Karpathy LLM Wiki» → Установить → Включить. Или посетите [страницу плагина сообщества](https://community.obsidian.md/plugins/karpathywiki) и нажмите **Add to Obsidian**.
2. **Настройте провайдера.** Откройте Настройки → Karpathy LLM Wiki → выберите провайдера (OpenAI, Anthropic, Ollama, ChatGPT Plan (Codex OAuth) и т.д.) → введите API Key (не нужен для локальных) → нажмите **Проверить подключение** → Сохранить.
3. **Импортируйте одну заметку.** Два способа:
   - **⌨️ Клавиатура:** `Cmd+P/Ctrl+P` → «Импорт одного источника» → выберите любой Markdown (или PDF, v1.25.0+) файл.
   - **🖱️ Значок на панели:** Нажмите **значок стикера** в левой ленте Obsidian, чтобы мгновенно импортировать текущую открытую заметку — без поиска в меню.
   
   Ваши первые страницы Wiki появятся в `wiki/sources/`, `wiki/entities/`, `wiki/concepts/` через секунды.
4. **Запросите вашу Wiki.** Два способа:
   - **⌨️ Клавиатура:** `Cmd+P/Ctrl+P` → «Запрос к Wiki».
   - **🖱️ Значок на панели:** Нажмите **значок сообщения** в левой ленте Obsidian.
   
   Справа откроется боковая панель (в стиле Copilot), где вы можете общаться с вашей Wiki. Ответы несут `[[wiki-links]]` обратно в ваш граф знаний.

![Боковая панель запросов, пристыкованная справа в Obsidian, с интерфейсом чата, ответы которого содержат wiki-ссылки обратно в ваш граф знаний](/docs/assets/query-side-panel.png)

Вот и всё. Плагин ничего не изменяет в ваших исходных заметках — только создаёт новые страницы в `wiki/`. И **Импорт**, и **Запрос к Wiki** закреплены на левой ленте для доступа в один клик в любое время. (`Cmd` на macOS, `Ctrl` на Windows/Linux.)

### Основные команды

| Команда | Что делает |
|---------|--------------|
| **📥 Импорт одного источника** | `Cmd+P/Ctrl+P` → «Импорт одного источника» — выберите файл Markdown или **PDF (v1.25.0+)**, получите страницы сущностей/концепций/Wiki. *Также: 🖱️ значок стикера на активной заметке.* |
| **📂 Импорт из папки** | `Cmd+P/Ctrl+P` → «Импорт из папки» — пакетный импорт каждой заметки в папке с умным пропуском |
| **📑 Импорт нескольких файлов** | `Cmd+P/Ctrl+P` → «Импорт нескольких файлов» — выберите подмножество через двухпанельное дерево файлов (с живой очередью и отменой по файлам) |
| **🔍 Запрос к Wiki** | `Cmd+P/Ctrl+P` → «Запрос к Wiki» — общайтесь с вашей Wiki в боковой панели справа; ответы несут `[[wiki-links]]`. *Также: 🖱️ значок сообщения на ленте.* |
| **🛠️ Lint Wiki** | `Cmd+P/Ctrl+P` → «Lint Wiki» — полное сканирование здоровья: дубликаты, мёртвые ссылки, пустые страницы, висячие, отсутствующие псевдонимы, противоречия |
| **⚡ Smart Fix All** | внутри Lint Modal — одно кликовое причинно-следственное восстановление с отчётом по фазам |
| **📋 Перегенерировать индекс** | `Cmd+P/Ctrl+P` → «Перегенерировать индекс» — перестроить `wiki/index.md` с текущими страницами и псевдонимами |
| **⏹ Отмена** | `Cmd+P/Ctrl+P` → «Отменить текущий импорт» или нажмите на строку статуса — останавливается чисто на границе следующего пакета |
| **📊 История импорта** | `Cmd+P/Ctrl+P` → «Просмотр истории импорта» — UI с поиском для прошлых импортов, отчётов lint, операций обслуживания |

![Панель команд — все команды LLM Wiki живут в палитре команд Obsidian](/docs/assets/command-panel.png)

| До | После |
|--------|-------|
| `notes/machine-learning.md` (плоский файл) | `wiki/concepts/supervised-learning.md` с `[[двунаправленными ссылками]]`, псевдонимами, атрибуцией источника и записью в `wiki/index.md` |

> 📖 Руководства в [GitHub Discussions → Guides](https://github.com/green-dalii/obsidian-llm-wiki/discussions/categories/guides). Нашлось полезным? [Поставьте звезду в репо](https://github.com/green-dalii/obsidian-llm-wiki), чтобы следить за релизами.

---

## ✨ Возможности

### 📚 Качество знаний

- **🔍 Извлечение сущностей и концепций** — LLM извлекает сущности (люди, организации, продукты, события) и концепции (теории, методы, термины) в отдельные страницы. Гранулярность настраивается (Minimal → Fine, плюс Custom), чтобы вы могли торговать стоимостью и глубиной.
- **🏷️ Обязательные псевдонимы** — каждая страница поставляется как минимум с одним псевдонимом (перевод, аббревиатура, вариант), чтобы межъязыковое обнаружение дубликатов работало.
- **🔄 Многоуровневое обнаружение дубликатов** — Tier 1 (прямое совпадение имён: межъязыковое, аббревиатура, высокое сходство заголовков) всегда проверяется; Tier 2 (общие ссылки, среднее сходство) заполняет оставшийся бюджет токенов.
- **🧩 Smart merge & состояние противоречий** — дубликаты сливаются с сохранением псевдонимов; противоречия помечаются с атрибуцией источника; страницы с `reviewed: true` защищены от перезаписи.
- **🎨 Пользовательский словарь тегов** — определите свои списки тегов типов сущностей и концепций в Настройки → Wiki → Словарь тегов → *Custom*. Словарь — это **подсказка для внедрения схемы** для LLM, а не шлюз принуждения при записи — маленькие/локальные модели всё ещё могут отклоняться (примерно одна из десяти возвращает встроенную таксономию модели). Lint обнаруживает остальное. Якорь дизайна для принуждения схемы: [Issue #328](https://github.com/green-dalii/obsidian-llm-wiki/issues/328).

### 📄 Импорт документов / PDF / изображений

Пять путей, переключаемых по импорту:

1. **🆕 Встроенный бэкенд MinerU (v1.27.0, #404)** — Настройки → Конфигурация Wiki → Бэкенд конвертации Markdown → *MinerU*. PDF + изображения (PNG/JPG/JPEG/JP2/WebP/GIF/BMP) + Office-документы (DOC/DOCX/PPT/PPTX/XLS/XLSX) через [Precise-парсер MinerU](https://mineru.net/apiManage/docs). Токен в Obsidian SecretStorage. Лучший путь для научных работ, сканированных документов и Office-файлов, где важно сохранение вёрстки. Лимиты сервера: 200 МБ / 200 страниц на PDF, 256 МБ / 10 000 файлов на архив.
2. **☁️ Облачные провайдеры с нативным PDF** — Anthropic, OpenAI, Google Gemini и AWS Bedrock (варианты Anthropic + OpenAI) читают PDF как file parts из коробки. Никакой настройки кроме выбора провайдера.
3. **🖥️ Локальный OCR на Apple Silicon** — [oMLX](https://github.com/jundot/omlx) интегрирует Microsoft Markitdown как встроенный бэкенд PDF→Markdown. Включите Markitdown в oMLX, загрузите [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) (3B / 570M-активных, open-source с 2026-06) как модель зрения, укажите плагину на oMLX как Custom OpenAI-Compatible провайдера, включите **Force PDF Support** и выберите мультимодальную модель, которую обслуживает oMLX. PDF никогда не покидает вашу машину.
4. **🛠️ Сторонний экстрактор (онлайн-интерфейс MinerU)** — используйте [онлайн-сервис MinerU Extractor](https://mineru.net/OpenSourceTools/Extractor) для быстрого ручного UI, когда не хотите настраивать API-токен. Скачайте сконвертированный `.md`, поместите его в ваше хранилище вне папки Wiki и импортируйте как обычную Markdown-заметку.
5. **🔌 Force PDF Support** — для любого другого OpenAI/Anthropic-совместимого эндпоинта, принимающего file parts, плагин пытается выполнить вызов (Настройки → Конфигурация LLM → Расширенные). Решение принимает эндпоинт; ошибки показываются как локализованное Notice.

**Важно про Office-форматы:** Obsidian не рендерит `.docx` / `.xlsx` / `.pptx` нативно ([file-formats](https://obsidian.md/help/file-formats)), поэтому практический рабочий процесс для Office-файлов таков: MinerU конвертирует в `.md`, плагин импортирует этот `.md` в страницы Wiki, а исходный Office-файл остаётся для справки. Для встроенного предпросмотра Office-файлов используйте сторонние плагины вроде Pandoc Plugin / Docxer / Md Importer / Office Reader.

**Общая инфраструктура для всех путей:**

- **🗄️ Ограниченный кэш** — `.obsidian/plugins/karpathywiki/pdf-cache/` хранит конвертированный Markdown, ключ — хеш содержимого + модель + версия конвертера; лимиты 100 МБ всего / 1000 записей / 10 МБ одна запись с вытеснением LRU по mtime.
- **📝 Опциональный sidecar в хранилище** — Настройки → Конфигурация Wiki → Папка Wiki → *Записать конвертированный Markdown в хранилище* записывает `<basename>.pdf.md` рядом с исходным PDF (выкл по умолчанию — по умолчанию только кэш).
- **🛡️ Промпт дословного транскрибера** — конвертация в стиле OCR с маркерами анти-галлюцинации `[illegible]` / `[figure: ...]`; обёртывание в markdown-fence от маленьких локальных моделей автоматически очищается перед записью в кэш.
- **🔁 Дословные цитаты со страницы-источника (v1.27.0, #496)** — каждая сгенерированная страница `sources/<slug>.md` теперь содержит секцию `Mentions in Source`, собранную из тех же дословных цитат, которые извлечение захватило для каждой сущности/концепции (проза, в которой модель уже доказала, что видит), так что исходный документ — единственная страница Wiki с реальным, обоснованным следом обратно к своему исходному тексту.

📖 **Полные руководства по настройке** для всех путей (облачные провайдеры, аппаратные уровни oMLX, установка MinerU, обслуживание кэша) → [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 Запросы и обслуживание

- **🧭 5-ступенчатый каскад PPR** — см. [Как работает поиск](#-как-работает-поиск). Personalized PageRank по `[[wiki-link]]` даёт графо-осведомлённый многошаговый контекст.
- **🪟 Боковая панель справа** — Запрос к Wiki открывается в боковой панели в стиле Copilot (v1.22.1+) вместо центрированного модального окна.
- **🔍 Lint-сканирование здоровья** — одна команда обнаруживает: дубликаты, мёртвые ссылки, пустые страницы, висячие, отсутствующие псевдонимы, противоречия.
- **⚡ Smart Fix All** — одно кликовое причинно-следственное восстановление: заполнить псевдонимы → слить дубликаты → исправить мёртвые ссылки → привязать висячие → расширить пустые страницы, с отчётом по фазам.
- **🆕 Исход «оставить как есть» для исправления мёртвых ссылок (v1.27.0, #485)** — Настройки → Расширенные → *Создавать заглушки для неразрешимых ссылок* (по умолчанию ВКЛ) позволяет отказаться от пустых страниц-заглушек: когда выключено, мёртвая ссылка остаётся видимой в каждом отчёте lint, пока её не определит реальный источник, а импорт создаёт страницы обычным путём. Гейт «никогда не расширять через LLM» из #197 не изменился — новая настройка управляет лишь тем, пишется ли страница-заглушка вообще.
- **📊 Панель истории операций** — UI с поиском и фильтрацией для прошлых импортов, отчётов lint и операций обслуживания.
- **🛡️ Предварительный шлюз импорта** — пустые / только-whitespace / только-frontmatter заметки отклоняются до любого вызова LLM; дедупликация по хешу содержимого обнаруживает идентичные файлы по разным путям.
- **🆕 Шлюз кандидатов импорта (v1.27.0, #514 / PR #521)** — opt-in переключатель (`skipMentionOnlyCandidates`, по умолчанию выкл, Настройки → Расширенные). Для источников, язык которых имеет измеренный профиль (de измерен; en/fr/es/pt/nl/ko оценены с закреплёнными крайними случаями; пороги для zh/ja по системам письма не измерены), кандидаты, названные только в скобках / перечислениях / коротких пунктах списка, отсекаются до того, как они потребуют страницу плюс вызовы дедупликации и генерации. Межъязыковые заметки не шлюзуются; языки Wiki без профиля сообщают один раз за импорт и никогда не пропускаются молча.
- **🆕 Пошаговые политики задач (v1.27.0, #525 / #490)** — LLM Advanced → поле Task Policies; переопределяйте настройку пошагового режим-текста/thinking без изменения кода. Встроенный базовый уровень остаётся нетронутым для шагов, которые вы не перечислили.

### 🔒 Приватность

- **🚫 Нет бэкенда, нет отслеживания, нет аналитики.** Работает полностью внутри Obsidian. Сеть используется только для связи с настроенным вами провайдером LLM.
- **📁 Исходные файлы только для чтения.** Плагин никогда не изменяет ваши исходные заметки — только создаёт новые страницы в `wiki/`.
- **🦙 Полный локальный режим.** Ollama, LM Studio или любой локальный OpenAI-совместимый эндпоинт → ваши заметки никогда не покидают вашу машину.
- **🔐 Минимальные разрешения.** Доступ к файлам хранилища для управления Wiki. Доступ к буферу обмена только когда вы нажимаете кнопку «Копировать» в модальном окне запросов.

### 🦙 Локально-ориентированный

- **🖥️ Ollama, LM Studio, OpenRouter, пользовательский эндпоинт** — из коробки. Локальные модели работают для запросов (меньшие контекстные окна); импорт в хранилище с 2000 страниц обычно требует облачную модель с длинным контекстом.
- **📄 Путь OCR PDF полностью локальный на Apple Silicon** — см. [Импорт документов / PDF / изображений](#-импорт-документов--pdf--изображений) выше.
- **🔐 ChatGPT Plan (Codex OAuth)** — loopback на десктопе или device-code на мобильном; учётные данные живут только в Obsidian SecretStorage. (См. [Anthropic vs OpenAI vs Codex OAuth](#-anthropic-vs-openai-vs-codex-oauth--это-разные-провайдеры) ниже для полного объяснения границ между провайдерами.)

### 🌐 Язык

- **🌍 11 языков UI** — English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano, Русский. UI и язык вывода Wiki независимы — ваша Wiki может быть на китайском, а интерфейс на английском.
- **📚 11 языков вывода Wiki** — тот же набор; выберите в Настройки → Конфигурация Wiki. Опция *Пользовательский ввод* для специальных промптов.
- **Все UI-строки переведены для каждого locale** — каждая метка, модальное окно и уведомление. Добавление 12-го языка — через контрибьюторов (паттерн PR #159).

---

## 🌐 Экосистема

Плагин работает вместе с остальной частью вашего стека Obsidian — каждый инструмент ниже подключается к графу `[[wiki-link]]` без изменения кода.

- **📄 [Мультиформатный бэкенд MinerU](https://mineru.net/apiManage/docs) (встроен с v1.27.0)** — то, что раньше было отдельным шагом CLI/UI, теперь переключатель плагина; см. [Импорт документов / PDF / изображений](#-импорт-документов--pdf--изображений) для полной таблицы путей. [Онлайн-сервис MinerU](https://mineru.net/OpenSourceTools/Extractor) остаётся доступным для пользователей, которые предпочитают быстрый UI вместо API-токена; [самостоятельный хостинг MinerU](https://github.com/opendatalab/mineru) также возможен.
- **🕸️ Obsidian Graph View** — откройте нативный граф на любой странице Wiki; каждая `[[wiki-link]]` становится узлом, каждая обратная ссылка — ребром. Встроенный, нулевой дополнительный размер бандла.
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** — официальное браузерное расширение. Сохраняйте веб-страницы (статьи, посты блогов, треды Reddit, Hacker News, рецепты, исследовательские работы, расшифровки YouTube через Interpreter) в любую папку вашего хранилища, затем запустите команду плагина `Импорт из папки` для пакетного извлечения сущностей и концепций.
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** — запрашивайте Wiki как базу данных с DQL (`LIST FROM "wiki/entities" WHERE contains(tags, "person")`) или JS API. Плагин записывает стандартный frontmatter (`tags:`, `type:`, `aliases:`) на каждой странице, так что запросы Dataview работают из коробки.
- **🌿 Git** — версионируйте ваше хранилище (любой Git-клиент). Плагин никогда не перезаписывает ваши исходные файлы; только создаёт новые страницы в `wiki/`, так что `git diff` чисто разделяет ваши правки от LLM-сгенерированного контента.
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** — превращайте любую заметку Obsidian в слайды через Marp frontmatter (`marp: true`). Страницы Wiki — это чистый Markdown, поэтому они рендерятся как слайды без дополнительной конвертации.
- **🖼️ Canvas** — нативный бесконечный холст Obsidian. Перетаскивайте карточки Wiki на Canvas, чтобы собрать учебные руководства, ментальные карты или исследовательские обзоры из `[[wiki-links]]`, не покидая хранилище.
- **🎤 [Obsidian Nous](https://github.com/AndyMDH/obsidian-nous)** — сопутствующий плагин для локальных голосовых заметок и захвата встреч (whisper.cpp на macOS; аудио никогда не покидает машину). Генерирует транскрипты с метками говорящих и собственные хаб-страницы Wiki. Независим от этого плагина — оба могут разделять одно хранилище без связывания.

---

## 🧰 Headless CLI

**Большинству пользователей этот раздел можно пропустить.** Пользовательская CLI плагина живёт в родственном репозитории [green-dalii/obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli) — установите через `npm i -g karpathywiki-cli` и выполните `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`.

То, что поставляется в этом репозитории в `tools/dev-instrument/`, — это **dev-only headless измерительный инструмент** для контрибьюторов движка — он запускает настоящий `WikiEngine.ingestSource` против хранилища на диске без Obsidian-окружения, выводит учёт токенов и wall-clock по задачам — те же цифры, что стоят за свидетельствами производительности в `CLAUDE.md` и примечаниях к релизу. См. [`tools/dev-instrument/README.md`](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/tools/dev-instrument/README.md) для входной команды, переменных окружения, измерительных режимов и спецификации кодов выхода.

---

## 🔍 Как работает поиск

Большинство плагинов «ИИ-поиска» фрагментируют ваши заметки на чанки и вкладывают их в векторную БД. Мы этого не делаем. [Аргумент Карпатого против RAG](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) состоит в том, что фрагментация ломает способность LLM рассуждать по всему вашему графу знаний — и этот аргумент работает на практике. Вместо этого мы идём по графу, который вы уже поддерживаете, записывая `[[wiki-links]]`.

### 5-ступенчатый каскад выбора затравки

Когда вы спрашиваете «Кто основал Microsoft?», Запрос к Wiki запускает пять стадий до любой генерации ответа:

1. **Быстрый путь Lex** — прямое перекрытие токенов с каждым заголовком сущности/концепции и псевдонимами. Бесплатно, мгновенно и ступень шлюзования для всего, что следует.
2. **Генерация ключевых слов LLM** — LLM предлагает 8–12 межъязыковых ключевых слов из вашего запроса (обрабатывает синонимы, аббревиатуры и термины, устойчивые к перекрытию токенов, за один вызов LLM).
3. **Локальный substring-скан** — каждое сгенерированное ключевое слово повторно сопоставляется локально с заголовками страниц, псевдонимами и фрагментами тела. Никаких дополнительных вызовов LLM; округляет устойчивый к шуму отзыв.
4. **LLM KB fallback** — когда lex + скан ключевых слов возвращает слабые сигналы, LLM повторно засевает топ-N кандидатов против полной Wiki для одного семантического прохода.
5. **Расширение PPR по графу** — Personalized PageRank (Haveliwala 2002) по графу `[[wiki-link]]`, начиная с набора затравок-кандидатов. Это то, что даёт графо-осведомлённый многошаговый контекст: «Bill Gates» → «Microsoft» → «конкуренты», а не просто литеральное перекрытие заголовков.

Каскад усекается на той стадии, которая вернула достаточно сигнала — нет фиксированной стоимости 5 стадий; нет вызовов LLM когда lex достаточен; семантический fallback только когда lex + скан ключевых слов по отдельности недостаточны.

### Personalized PageRank в масштабе

Мы используем Monte Carlo PPR (Fogaras 2005) — 3000 случайных блужданий × 50 шагов каждый — с правилом тупиков из Haveliwala 2002. Стоимость — **O(K × L)** (K = блуждания, L = шаги на блуждание), независимо от количества страниц, так что хранилище с 2000 страниц видит ту же задержку расширения, что и с 200 страницами.

**PPR @5 = 27,1% против pure-kNN baseline 24,1%** на собственном бенчмарк-корпусе проекта (единственный опубликованный бенчмарк поиска в этом пространстве LLM-Wiki с открытым исходным кодом).

### Почему без эмбеддингов

Мы намеренно отвергли путь эмбеддингов в [Issue #175](https://github.com/green-dalii/obsidian-llm-wiki/issues/175). Графовый сигнал уже там — каждая `[[wiki-link]]` — это вручную созданное ребро «это связано», и большинство поддерживаемых нами провайдеров (Ollama, LM Studio, Anthropic, Bedrock, Kimi, GLM, MiniMax) вообще не предоставляют эндпоинт `/v1/embeddings`. Добавление модели эмбеддингов означало бы загрузку на страницу, адаптер на провайдера и нулевую выгоду по качеству поиска.

---

## 🤖 Модели

**Поддерживаемые провайдеры (16+, всё проверено по models.dev на 2026-07):**

| Провайдер | Серия | Примечания |
|----------|--------|-------|
| **Anthropic** | Claude 5 series | Нативный PDF; протокол `/v1/messages` |
| **OpenAI** | GPT-5.6 series (Sol / Terra / Luna) | Нативный PDF; Platform API key |
| **Google Gemini** | Gemini 3.6 series | Нативный PDF (file parts с 1.5); OpenAI-совместимый эндпоинт |
| **DeepSeek** | DeepSeek V4 series | OpenAI-совместимый; самый низкий ценовой уровень |
| **Alibaba Qwen** | Qwen3.7/3.8 series | OpenAI-совместимый (DashScope) |
| **xAI Grok** | Grok 4 series | OpenAI-совместимый; длинный контекст |
| **Moonshot Kimi** | Kimi K3 series | OpenAI-совместимый; 2.8T MoE frontier |
| **Zhipu GLM** | GLM-5 series | OpenAI-совместимый; сильный двуязычный |
| **MiniMax** | MiniMax M3 series | OpenAI-совместимый; 1M контекст |
| **Step (阶跃星辰)** | Step 3 series (Flash) | OpenAI-совместимый; быстрый инференс |
| **Tencent Hunyuan** | Hy3 series | OpenAI-совместимый; open-weight MoE |
| **Xiaomi MiMo** | MiMo V2.5 series | MIT open-source; плоское ценообразование |
| **Google Gemma** | Gemma 4 series | Open-weight; 262K контекст |
| **AWS Bedrock** | Anthropic + OpenAI варианты | Путь VPC / комплаенс; **API key + SSO + IAM** (v1.27.0, #425) |
| **ChatGPT Plan (Codex OAuth)** | Codex Responses API | Вход через браузер/device-code; SecretStorage |
| **Локальные: Ollama, LM Studio, OpenRouter, Anthropic-Compatible** | Любая модель с протоколом OpenAI-/Anthropic | Custom OpenAI-Compatible + Anthropic-Compatible (Token Plan / Coding Plan) |

Этот плагин подаёт LLM ваш полный контекст Wiki за каждый запрос — поэтому **выигрывают модели с длинным контекстом**. Полная многоуровневая таблица (облако + локальные) живёт в [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md), проверено по [models.dev](https://models.dev/), чтобы выбор оставался актуальным.

### Что важно

- **🧠 Контекстное окно ≥ 200K токенов** для хранилищ с более чем ~500 страниц. Ниже 200K каскад может отбросить более ранние стадии, чтобы вместиться.
- **⚖️ Качество следования инструкциям** важнее сырого IQ для задачи извлечения — выберите модель, которая следует шаблону схемы, а не самый большой номер лидерборда.
- **🔌 Эндпоинт эмбеддингов не имеет значения** — мы не используем эмбеддинги. Провайдер без `/v1/embeddings` подходит (большинство наших 16+ провайдеров его не предоставляют).
- **🦙 Локальные работают для запросов, облачные для импорта** — импорт в хранилище с 2000 страниц обычно требует облачную модель с длинным контекстом; локальная модель с 262K покрывает большинство запросов.

Для импорта PDF / изображений / Office-документов см. [Импорт документов / PDF / изображений](#-импорт-документов--pdf--изображений) в Возможностях — Anthropic, OpenAI, Bedrock и Gemini читают PDF как file parts нативно; встроенный бэкенд MinerU (v1.27.0+) и **Force PDF Support** покрывают всё остальное.

### Anthropic vs OpenAI vs Codex OAuth — это разные провайдеры

- **Anthropic** (и его вариант Bedrock) — отдельно тарифицируемый Anthropic Platform API key.
- **OpenAI** — отдельно тарифицируемый OpenAI Platform API key.
- **ChatGPT Plan (Codex OAuth)** — экспериментальный, отдельный провайдер, использующий подходящее пособие Codex после входа через браузер или device-code; доступность следует политикам аутентификации и пособия OpenAI Codex, а не имени тарифа. Сторонняя совместимость с Codex, не партнёрство с OpenAI и не общий ChatGPT API.

### AWS Bedrock — три режима аутентификации (v1.27.0, #425)

Настройки → Провайдер → Bedrock (Anthropic / OpenAI) теперь выбирает один из трёх режимов аутентификации; строка провайдера затем запрашивает данные, которые нужны именно этому режиму:

- **API key** — оригинальный bearer-путь Stage-1; поведение побайтно идентично v1.26.4, рекомендуемый выбор для пользователей, которые уже оплачивают API key Bedrock.
- **SSO** — device-flow IAM Identity Center. Нажмите *Sign in with AWS SSO*, вставьте код URL верификации в браузер, плагин получает SSO-токен через `karpathywiki-bedrock-sso` в SecretStorage, обменивает его на временные учётные данные роли и подписывает каждый запрос самописным SigV4 (без AWS SDK). Account ID и имя роли определяются автоматически, когда SSO-идентичность предоставляет ровно по одному; иначе введите их в настройках провайдера.
- **IAM** — статические access-ключи для сред без SSO (CI, запланированные пакетные задачи). Хранятся в `karpathywiki-bedrock-iam` в SecretStorage; внутрипроцессный кэш мемоизирует per access-key, чтобы SigV4-подпись укладывалась в срок действия.

Все три режима разделяют одну и ту же дисциплину Obsidian SecretStorage (без учётных данных в `data.json`, логах или документации) и один и тот же самописный OIDC + SigV4-путь без AWS SDK. Регион Bedrock не зависит от режима аутентификации и настраивается в той же строке провайдера.

> 📖 **Полная таблица выбора** (облако + локальные + OCR PDF + Codex OAuth + квантизация + аппаратные уровни) → [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

## ❓ FAQ

### Что на самом деле делает плагин?

Выберите любую заметку, папку или выделение; LLM извлекает сущности и концепции и генерирует взаимосвязанную Wiki с `[[двунаправленными ссылками]]`. Задавайте вопросы и получайте разговорные ответы, основанные на *ваших* заметках, а не интернете. Ваши исходные заметки никогда не изменяются.

### Как мне начать?

Установите из Community Plugins Obsidian → выберите провайдера → **Проверить подключение** → запустите **Импорт одного источника** на любой заметке. Первые страницы Wiki появятся через секунды. См. [Быстрый старт](#-быстрый-старт).

### Могу ли я импортировать PDF, изображения и Office-документы?

✅ Да. Anthropic, OpenAI, Bedrock и Gemini читают PDF нативно; встроенный мультиформатный бэкенд MinerU (v1.27.0) покрывает всё остальное (PDF + изображения + Office). Полное руководство — облачные провайдеры, OCR на Apple Silicon, Force PDF Support, обслуживание кэша — в [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md).

### Безопасна ли моя существующая Wiki?

✅ Обратная совместимость с v1.0.0. Установите `reviewed: true` на любой странице, чтобы защитить её от перезаписи. Обновление с v1.24.x не перезаписывает ваше хранилище; импорт PDF в v1.25.0 — только кэш по умолчанию, а v1.27.0 добавляет нативный импорт PDF + изображений + Office без изменения макета Wiki на диске.

### Отправляются ли мои данные куда-нибудь?

🚫 Нет бэкенда, нет аналитики — плагин работает полностью внутри Obsidian. Только текст, который вы явно отправляете для импорта/запроса, покидает ваше устройство, и только настроенному вами провайдеру LLM. Для полной локальности данных используйте Ollama или LM Studio.

### Могу ли я использовать плагин на своём языке?

🌍 11 языков как для UI, так и для вывода Wiki. Язык UI и языка Wiki независимы. Добавление 12-го языка — через контрибьюторов (паттерн PR #159).

### Чем это отличается от чатбота RAG?

🚫 Никакого фрагментирования. 🚫 Никаких эмбеддингов. 🚫 Никакой векторной БД. ✅ Personalized PageRank по вашему существующему графу `[[wiki-link]]` — графо-осведомлённый многошаговый контекст, нулевая стоимость эмбеддингов, полная поддержка локальных моделей.

### Какую LLM мне использовать?

Модели с длинным контекстом (≥200K токенов) работают лучше всего. Раздел [Модели](#-модели) охватывает принципы; полная многоуровневая таблица в [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md).

### Есть ли опубликованный бенчмарк?

Да — PPR @5 = 27,1% против pure-kNN baseline 24,1% на собственном корпусе проекта. Полный конвейер и скрипт бенчмарка описаны в [Как работает поиск](#-как-работает-поиск).

### Как мне контролировать расходы на API?

Используйте гранулярность извлечения Coarse или Minimal для пакетного импорта. Smart Batch Skip автоматически обнаруживает уже импортированные файлы. Авто-обслуживание ВЫКЛ по умолчанию. Lint показывает счётчики перед запуском исправлений — ничего не тарифицируется без вашего одобрения.

### Как мне отменить выполняющуюся операцию?

Нажмите на строку статуса (показывает «Импорт… нажмите для отмены») или `Cmd+P/Ctrl+P` → «Отменить текущий импорт». Останавливается чисто на границе следующего пакета.

### Где получить помощь?

[GitHub Issues](https://github.com/green-dalii/obsidian-llm-wiki/issues) для отчётов об ошибках · [GitHub Discussions](https://github.com/green-dalii/obsidian-llm-wiki/discussions) для вопросов и запросов функций · Консоль разработчика (`Ctrl+Shift+I` / `Cmd+Option+I`) для логов плагина.

---

## 🔒 Приватность

Этот плагин указан на Маркетплейсе Community Plugin Obsidian и проходит автоматическую проверку безопасности и разрешений.

- **🚫 Нет бэкенда, нет сервера, нет сбора данных.** Чисто локальное программное обеспечение, работающее внутри Obsidian. Плагин не может и не собирает, не хранит и не передаёт ваши данные ни на какой сервер — потому что такого сервера не существует.
- **🔐 Доступ к сети — opt-in.** Используется только для связи с настроенным вами провайдером LLM. Вы выбираете провайдера, вы вводите API Key, вы решаете, куда идут ваши данные.
- **📁 Доступ к файлам хранилища** используется для управления Wiki (чтение заметок, генерация страниц, сканирование мёртвых ссылок, обнаружение дубликатов). Плагин никогда не изменяет ваши исходные файлы.
- **📋 Доступ к буферу обмена** используется исключительно кнопкой «Копировать» в модальном окне запросов — и только когда вы её нажимаете.

Для полной локальности данных используйте Ollama или LM Studio. С локальным провайдером ваши данные никогда не покидают вашу машину.

---

## 💖 Поддержка

Если LLM-Wiki стала значимой частью вашего рабочего процесса работы со знаниями:

- ☕ **[Купить мне Ko-fi](https://ko-fi.com/greenerdalii)** — разово или ежемесячно
- 💳 **[Чаевые через PayPal](https://paypal.me/greenerdalii)** — разовые чаевые

Спасибо следующим за поддержку проекта:

[@jameses-cyber](https://github.com/jameses-cyber), [@issaqua](https://github.com/issaqua), Dikson Choi

---

## 🔭 Другие проекты

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — headless CLI для импорта, родственный репозиторий, опубликованный как npm-пакет `karpathywiki-cli`. Запускает тот же `WikiEngine` против хранилища на диске, без рендерера. Установка: `npm i -g karpathywiki-cli`. Внутри репозитория `tools/dev-instrument/` — это dev-only измерительный инструмент, который генерирует цифры стоимости по задачам для примечаний к релизам этого плагина.
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — маршрутизатор уровня задачи для [pi-coding-agent](https://github.com/earendil-works/pi). Перед каждым ходом небольшой LLM-судья относит ваше сообщение к рутинным или к важным, и выбранный уровень выполняет ход целиком. На сложных задачах он идёт дальше: уровень Smart работает как CTO — планирует работу, поручает реализацию субагентам уровня Fast, проверяет каждый результат и повторяет цикл. Повышение уровня мгновенное, понижение — только после устойчивой тенденции, а цепочки резервных моделей на каждом уровне гасят 429 и 5xx. Ноль зависимостей во время выполнения, MIT. → [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — DSH-форк pi-shift-router, разделяющий тот же дизайн маршрутизации на уровне задачи, но нацеленный на среду выполнения [dsh-coding-agent](https://github.com/earendil-works/dsh). Те же выбираемые судьёй уровни, те же цепочки отката на каждом уровне, MIT.
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — DSH-аналог рабочего процесса `obsidian-plugin-dev` для Claude: разворачивает рабочее пространство плагина Obsidian, ведёт цикл TDD Red→Green, прогоняет замыкание качества Six-Gate (lint/tsc/test/build/css-lint) и подготавливает готовую к релизу ветку на `feat/*` или `fix/*`. Сделано для того, чтобы контрибьюторы на DSH получали тот же опыт скаффолдинга и gate без копирования из CLAUDE.md.

---

## 📜 Лицензия и благодарности

Apache License, Version 2.0 — см. [LICENSE](../LICENSE) и [NOTICE](../NOTICE).

**Построено на:**
- 💡 [Karpathy LLM Wiki Андрея Карпатого](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — оригинальная концепция
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v6](https://ai-sdk.dev/) (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) через Obsidian `requestUrl`
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) и [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — алгоритмы поиска

**Сопровождающий:** [@green-dalii](https://github.com/green-dalii)

[![Star History Chart](https://api.star-history.com/chart?repos=green-dalii/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)