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
- latest: v1.27.1 (PATCH — deterministic related lists, sourced-paragraph guard, vault-wide link repoint, stream-path thinking policy, local dates; 46 commits, 3993 tests)
- last-updated: 2026-09-06
- alternate-names: Karpathy LLM Wiki, LLM Wiki Obsidian, Obsidian wiki plugin, graph-based RAG, no-embedding RAG, Personalized PageRank retrieval, Obsidian second brain
- search-intents: "Obsidian RAG without embeddings", "Obsidian wiki plugin", "Personalized PageRank Obsidian", "graph-based note retrieval", "Karpathy LLM Wiki implementation", "Obsidian knowledge base auto-generation", "Obsidian graph view + AI", "Obsidian second brain plugin", "Obsidian note link graph AI", "Obsidian plugin 11 languages", "Obsidian plugin 16 LLM providers", "no-vector-DB RAG", "Obsidian PDF ingest AI", "Obsidian Codex OAuth", "Obsidian Bedrock plugin", "Obsidian Bedrock SSO", "Obsidian MinerU", "Obsidian Word PPT Excel ingest", "Obsidian IAM credentials"
- features: graph-based retrieval, Personalized PageRank (Haveliwala 2002), Monte Carlo PPR (Fogaras 2005), 5-stage seed-selection cascade, Tier 1/Tier 2 duplicate detection, 11-language UI + 11-language wiki output (independent), 16+ LLM providers (Anthropic, OpenAI, Bedrock [API key + SSO/IAM], Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, Codex OAuth), MinerU multi-format ingest (PDF + images + Office), PDF ingest (cache-only, OCR paths), lint health scan, Smart Fix All, source-page verbatim quotes, ingest candidate gate, per-step taskPolicies UI, Obsidian Graph View integration, zero-embedding zero-vector-DB architecture, local-first mode
- direct-competitors: nashsu/llm_wiki (Tauri desktop app), SamurAIGPT/llm-wiki-agent (Claude Code skill), sdyckjq/llm-wiki-skill (Codex skill), atomicstrata/llm-wiki-compiler (Python pipeline)
- readme-locale: ko
- canonical-readme: https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md
-->

![Karpathy LLM Wiki 플러그인 배너 — Obsidian 노트로부터 만들어진 상호 연결된 wiki 페이지 네트워크](assets/llm_wiki_banner.webp)

# 🧠 Karpathy LLM Wiki — Obsidian 플러그인

> 노트를 연결된 질의 가능한 지식베이스로 바꿔주는 Obsidian 플러그인 — [Andrej Karpathy의 LLM Wiki 개념](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)을, 여러분이 이미 글을 쓰고 있는 편집기에 구현했습니다.

**Obsidian 공식 마켓 만점 평가 • 제로 임베딩 그래프 검색 • 11개 언어 네이티브 지원 • 네이티브 PDF + 이미지 + Office 수집 • 모든 LLM 공급업체 호환 • 로컬 우선 • 백엔드 없음 • GDPR 친화**

![Version](https://img.shields.io/github/v/release/green-dalii/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-16%2B-cyan?style=flat-square) <br>
![Maintenance](https://img.shields.io/badge/maintenance-actively%20maintained-brightgreen?style=flat-square) ![Build Status](https://img.shields.io/github/actions/workflow/status/green-dalii/obsidian-llm-wiki/release.yml?style=flat-square) ![Author](https://img.shields.io/badge/author-Greener--Dalii-blue?style=flat-square) <br>
![GitHub Stars](https://img.shields.io/github/stars/green-dalii/obsidian-llm-wiki?style=flat-square) ![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/green-dalii/obsidian-llm-wiki)

[English](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_CN.md) | [繁體中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_JA.md) | **한국어** | [Deutsch](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_DE.md) | [Français](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_FR.md) | [Español](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ES.md) | [Português](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_PT.md) | [Italiano](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_IT.md) | [Русский](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[공식 사이트](https://llmwiki.greenerai.top/) | [옵시디언 마켓플레이스](https://community.obsidian.md/plugins/karpathywiki) | [블로그](https://llmwiki.greenerai.top/blog/) | [Discussions](https://github.com/green-dalii/obsidian-llm-wiki/discussions)

🤔 [이 플러그인이 필요한 이유?](#-이-플러그인이-필요한-이유) | 🚀 [빠른 시작](#-빠른-시작) | ✨ [주요 기능](#-주요-기능) | 🌐 [생태계](#-생태계) | 🔍 [검색 작동 방식](#-검색-작동-방식) | 🤖 [모델](#-모델) | ❓ [FAQ](#-faq)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD) ← 이 플러그인이 도움이 되었다면, 커피 한 잔♥️ 사주시거나 별표🌟 하나 부탁드려요↗

---

## 🤔 이 플러그인이 필요한 이유?

여러분은 노트를 작성합니다. 그 노트들은 폴더에 쌓여갑니다. 무엇이 무엇과 연결되는지 찾으려면 몇 달 전에 잊어버린 맥락을 기억해야 합니다.

**Karpathy의 LLM Wiki 아이디어를 구현한 다른 오픈소스 프로젝트도 존재합니다 — 하지만 그중 어느 것도 원클릭 Obsidian 플러그인으로 제공되지는 않습니다.** 대부분은 CLI 도구, Claude Code 스킬, 또는 별도의 데스크톱 앱이며, 본 플러그인은 Obsidian 내부에서 동작합니다 — Graph View, 리본, 명령 팔레트까지 포함됩니다.

### 경쟁 제품과의 비교

|  | **Karpathy LLM Wiki** (이 플러그인) | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | sdyckjq / llm-wiki-skill | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|---|
| **제공 형태 및 설치** | ✅ **5분** — 원클릭 Obsidian 플러그인: 커뮤니티 플러그인 → 설치 → 공급자 선택 → 수집 | ❌ 30분+ — Tauri 바이너리 컴파일/다운로드, CLI 설정 | ❌ 15분 — Claude Code 구독 + 스킬 설치 필요 | ❌ 10분 — Claude Code/Codex 구독 + 스킬 설정 필요 | ❌ 30분+ — pip 설치 + Python SDK + 로컬 서버 |
| **아키텍처 및 의존성** | ✅ **의존성 제로** — 벡터 DB, 임베딩 모델, 외부 프로세스 불필요 (설계상 `[[wiki-link]]` 그래프를 PPR로 탐색) | 🟡 자체 Python 런타임 + sigma.js + sqlite 내장; 임베딩은 선택 사항, 기본 꺼짐 | 🟡 Claude Code 환경 사용 — 자체 완결적이지 않음; 임베딩 불필요 | 🟡 별도 플랫폼 런타임 필요; 임베딩 불필요 | ❌ Python + 임베딩 모델 + 벡터 DB 필요 (필수) |
| **i18n (UI + Wiki 출력)** | ✅ 10개 언어 (UI/출력 독립) | 🟡 2개 (EN / 中文) | ❌ 영어 전용 | ❌ 영어 전용 | ❌ 영어 전용 |
| **LLM 공급자** | ✅ 16+ (Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, Anthropic-Compatible 포함) | 🟡 OpenAI 호환 | 🟡 Claude Code를 통한 구독 | 🟡 Claude Code / Codex를 통한 구독 | 🟡 OpenAI 호환 |
| **검색 및 쿼리 파이프라인** | ✅ **5단계 캐스케이드** — Lex → LLM 키워드 → 부분문자열 스캔 → LLM KB 폴백 → PPR 확장 (첫 충분 신호에서 절단). Personalized PageRank (Haveliwala 2002) + Monte Carlo (Fogaras 2005) | 🟡 2홉 감쇠만 사용 (4-신호 휴리스틱: Adamic-Adar + 2홉) | ❌ Louvain 커뮤니티 탐지만 사용 | ❌ k홉 미리보기만 사용 (LLM 보강 없음) | ❌ BM25 + 시맨틱 (그래프 없음) |
| **그래프 시각화** | ✅ Obsidian 네이티브 Graph View (내장, 추가 크기 제로) | ❌ 데스크톱 앱 내 커스텀 sigma.js + graphology | 🟡 vis.js graph.html (별도 파일) | ❌ 커스텀 sigma.js 오프라인 HTML | ❌ 읽기 전용 브라우저 뷰어 |
| **Wiki 정직성** | ✅ 쿼리와 일치하는 Wiki 소스가 없을 때 "Stage FALLBACK" 배너 표시 | ❌ 동등 기능 없음 | ❌ 동등 기능 없음 | ❌ 동등 기능 없음 | ❌ 동등 기능 없음 |
| **검색 벤치마크 공개** | ✅ PPR @5 = 27.1% vs 순수 kNN 24.1% (이 분야 유일한 공개 수치) | ❌ 임베딩 활성화 시에만 58% → 71%, 동등 비교 불가 | ❌ 미공개 | ❌ 미공개 | ❌ 미공개 |

### 의도적으로 선택한 세 가지 설계 원칙

- **🪟 Obsidian이 런타임입니다.** 터미널, 별도 앱, Docker, Python이 필요 없습니다. 커뮤니티 플러그인에서 설치하고, 수집을 클릭하면 Wiki가 첫 순간부터 볼트 안에 만들어집니다. Obsidian 네이티브 Graph View가 여러분의 `[[wiki-link]]` 그래프를 렌더링합니다 — 내장 기능이며 번들 크기가 전혀 늘어나지 않습니다.
- **🧭 깔끔하고 자체 완결적입니다.** 의존성이 전혀 없습니다. 임베딩 모델, 벡터 데이터베이스, pip 패키지가 없습니다 — 노트를 읽고 LLM과 통신하며 Wiki 페이지를 작성하는 단일 플러그인입니다. 모든 것이 Obsidian 안에서 동작합니다.
- **🔌 이미 비용을 지불하고 있는 어떤 모델이든 사용 가능합니다.** Anthropic, Bedrock, OpenAI, ChatGPT Plan (Codex OAuth), Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-compatible, 커스텀 엔드포인트 — 16개 이상의 공급자 중 어느 것도 임베딩 엔드포인트를 가질 필요가 없습니다.

---

## 🎯 이런 분들께 추천합니다

**✅ 네, 다음에 해당한다면:**

- **5시간 프로젝트가 아닌 5분 설정을 원하신다면.** 커뮤니티 플러그인에서 설치 → 공급자 선택 → 노트 하나 수집. CLI, Python, 별도 런타임, 벡터 DB가 필요 없습니다. 몇 초 만에 `wiki/`에 Wiki 페이지가 나타납니다.
- **깔끔하고 자체 완결적인 무언가를 원하신다면.** 플러그인의 외부 의존성은 정확히 0개입니다: 임베딩 모델, 벡터 데이터베이스, pip 패키지, Docker 컨테이너가 없습니다. 노트를 읽고, LLM과 통신하며, 볼트에 Wiki 페이지를 작성하는 단일 Obsidian 플러그인입니다. 모든 것이 Obsidian 안에 있습니다.
- **인터넷이 아닌 *여러분의 노트*에서 답변하는 질의 가능한 채팅** — 모든 답변에 `[[wiki-links]]`가 포함되어 지식 그래프로 연결됩니다.
- **데이터 주권을 중요시한다면** — Ollama나 LM Studio와 함께 완전히 로컬에서 실행되며, 인터넷에 전혀 연결되지 않습니다.
- **지원되는 10개 언어 중 하나로 글을 쓰거나 읽는다면** — UI와 Wiki 출력 언어는 독립적입니다 (Wiki는 중국어로, 인터페이스는 영어로 유지 가능).
- **`[[wiki-links]]`를 작성하여 그래프를 유지 관리한다면** — 여러분이 작성하는 모든 링크가 이미 검색을 풍부하게 합니다; 별도의 태깅/임베딩/인덱싱 단계가 필요 없습니다.
- **원클릭 유지관리를 원하신다면** — Lint 상태 검사 + Smart Fix All로 중복, 데드 링크, 고아 페이지를 직접 관리하지 않고도 관리할 수 있습니다.

**❌ 아니오, 다음에 해당한다면:**

- **범용 ChatGPT 대체품을 원하신다면** — 답변은 vault에서만 오지, 인터넷에서는 오지 않습니다.
- **대규모 외부 코퍼스(Confluence, Notion, arXiv, 스크래핑한 웹 페이지)에 대한 RAG가 필요합니다** — 플러그인은 vault와 독립적인 PDF/Office 파일을 수집하며, 대량 외부 코퍼스 RAG는 설계 범위 밖입니다.
- **팀 협업 기능을 갖춘 호스팅형 SaaS를 원하신다면** — 백엔드도 서버도 공유 상태도 없습니다. 모든 것이 여러분의 Obsidian 안에서 로컬로 동작합니다.

---

## 🚀 빠른 시작

1. **설치.** Obsidian → 설정 → 커뮤니티 플러그인 → 찾아보기 → "Karpathy LLM Wiki" 검색 → 설치 → 활성화. 또는 [커뮤니티 플러그인 페이지](https://community.obsidian.md/plugins/karpathywiki)에서 **Add to Obsidian** 클릭.
2. **공급자 설정.** 설정 → Karpathy LLM Wiki 열기 → 공급자 선택 (OpenAI, Anthropic, Ollama, ChatGPT Plan (Codex OAuth) 등) → API 키 입력 (로컬은 불필요) → **Test Connection** 클릭 → 저장.
3. **노트 하나 수집.** 두 가지 방법:
   - **⌨️ 키보드:** `Cmd+P/Ctrl+P` → "Ingest single source" → Markdown (또는 PDF, v1.25.0+) 파일 선택.
   - **🖱️ 도구 모음 아이콘:** Obsidian 왼쪽 리본의 **스티커 아이콘**을 클릭하면 현재 열려 있는 노트를 즉시 수집합니다 — 메뉴를 뒤질 필요 없음.
   
   몇 초 안에 첫 Wiki 페이지가 `wiki/sources/`, `wiki/entities/`, `wiki/concepts/`에 생성됩니다.
4. **Wiki 질의.** 두 가지 방법:
   - **⌨️ 키보드:** `Cmd+P/Ctrl+P` → "Query wiki".
   - **🖱️ 도구 모음 아이콘:** Obsidian 왼쪽 리본의 **말풍선 아이콘**을 클릭.
   
   Copilot 스타일의 우측 도킹 사이드 패널이 열리며, 그 안에서 Wiki와 대화할 수 있습니다. 답변에는 지식 그래프로 다시 연결되는 `[[wiki-links]]` 가 포함됩니다.

![Obsidian의 우측 도킹 Query Wiki 사이드 패널 — 지식 그래프로 다시 연결되는 wiki-link 답변이 포함된 채팅 인터페이스](/docs/assets/query-side-panel.png)

이게 전부입니다. 플러그인은 원본 노트를 전혀 수정하지 않습니다 — `wiki/` 아래에 새 페이지만 생성합니다. **수집** 과 **Wiki 질의** 모두 왼쪽 리본에 고정되어 있어 언제든지 한 번의 클릭으로 접근할 수 있습니다. (`Cmd`는 macOS, `Ctrl`은 Windows/Linux.)

### 핵심 명령어

| 명령어 | 기능 |
|--------|------|
| **📥 단일 소스 수집** | `Cmd+P/Ctrl+P` → "Ingest single source" — Markdown 또는 **PDF (v1.25.0+)** 파일을 선택하여 Entity/Concept/Wiki 페이지 생성. *또는: 🖱️ 활성 노트에서 왼쪽 리본의 스티커 아이콘 클릭.* |
| **📂 폴더에서 수집** | `Cmd+P/Ctrl+P` → "Ingest from folder" — 폴더의 모든 노트를 스마트 배치 스킵과 함께 일괄 수집 |
| **📑 여러 파일 수집** | `Cmd+P/Ctrl+P` → "Ingest multiple files" — 2패널 파일 트리에서 하위 집합 선택 (라이브 큐 + 파일별 취소) |
| **🔍 Wiki 질의** | `Cmd+P/Ctrl+P` → "Query wiki" — 우측 도킹 사이드 패널에서 Wiki와 대화; 답변에 `[[wiki-links]]` 포함. *또는: 🖱️ 왼쪽 리본의 말풍선 아이콘 클릭.* |
| **🛠️ Wiki 린트** | `Cmd+P/Ctrl+P` → "Lint wiki" — 전체 상태 검사: 중복, 데드 링크, 빈 페이지, 고아, 누락된 alias, 모순 |
| **⚡ Smart Fix All** | Lint 모달 내부 — 원클릭 인과순서 수리, 단계별 보고서 제공 |
| **📋 인덱스 재생성** | `Cmd+P/Ctrl+P` → "Regenerate index" — 현재 페이지와 alias로 `wiki/index.md` 재구축 |
| **⏹ 작업 취소** | `Cmd+P/Ctrl+P` → "Cancel current ingestion" 또는 상태 표시줄 클릭 — 다음 배치 경계에서 깔끔하게 중지 |
| **📊 수집 기록** | `Cmd+P/Ctrl+P` → "View Ingestion History" — 과거 수집, lint 보고서, 유지보수 실행을 검색 가능한 UI로 조회 |

![Command panel — all LLM Wiki commands live in Obsidian's command palette](/docs/assets/command-panel.png)
| 전 | 후 |
|---|------|
| `notes/machine-learning.md` (평범한 파일) | `wiki/concepts/supervised-learning.md` — `[[양방향 링크]]`, alias, 출처 정보, `wiki/index.md` 항목 포함 |

> 📖 상세 가이드는 [GitHub Discussions → Guides](https://github.com/green-dalii/obsidian-llm-wiki/discussions/categories/guides)에서 확인하세요. 도움이 되셨다면 [GitHub에 Star](https://github.com/green-dalii/obsidian-llm-wiki)를 눌러 릴리스를 팔로우하세요.

---

## ✨ 주요 기능

### 📚 지식 품질

- **🔍 Entity/Concept 추출** — LLM이 Entity(인물, 조직, 제품, 이벤트)와 Concept(이론, 방법, 용어)을 독립 페이지로 추출합니다. 세분화 설정 가능 (Minimal ~ Fine, Custom 포함)으로 비용과 깊이를 조절할 수 있습니다.
- **🏷️ 필수 Alias** — 생성된 각 페이지에 최소 1개의 alias(번역, 약어, 변형)를 포함하여 교차 언어 중복 감지가 작동합니다.
- **🔄 계층형 중복 감지** — Tier 1 (직접 이름 일치: 교차 언어, 약어, 높은 유사도 제목)은 항상 검증됩니다. Tier 2 (공유 링크, 중간 유사도)는 남은 토큰 예산을 채웁니다.
- **🧩 스마트 병합 및 모순 상태** — 중복 병합 시 alias 보존; 모순은 출처와 함께 표시; `reviewed: true` 페이지는 덮어쓰기에서 보호됩니다.
- **🎨 사용자 정의 태그 어휘** — 설정 → Wiki → Tag Vocabulary → *Custom*에서 자체 Entity/Concept 타입 태그를 정의할 수 있습니다. 어휘는 스키마 주입 힌트일 뿐, 쓰기 시점 강제 게이트는 아닙니다 — 소형/로컬 모델은 여전히 어휘 밖으로 새어나갈 수 있습니다 (대략 10건 중 1건이 모델의 내장 분류를 반환). Lint가 나머지를 보고합니다. 스키마 강제 검증 설계 앵커: [Issue #328](https://github.com/green-dalii/obsidian-llm-wiki/issues/328).

### 📄 문서 / PDF / 이미지 수집

수집 시 전환 가능한 다섯 가지 경로:

1. **🆕 내장 MinerU 백엔드 (v1.27.0, #404)** — 설정 → Wiki Configuration → Markdown Conversion Backend → *MinerU*. [MinerU의 Precise 파서](https://mineru.net/apiManage/docs)를 통해 PDF + 이미지(PNG/JPG/JPEG/JP2/WebP/GIF/BMP) + Office(DOC/DOCX/PPT/PPTX/XLS/XLSX)를 처리. 토큰은 Obsidian SecretStorage에 보관. 레이아웃 보존이 중요한 과학 논문, 스캔 문서, Office 파일에 가장 적합한 경로. 서버 한도: PDF당 200 MB / 200 페이지, 아카이브당 256 MB / 10,000 파일.
2. **☁️ PDF를 네이티브로 지원하는 클라우드 공급자** — Anthropic, OpenAI, Google Gemini, AWS Bedrock (Anthropic + OpenAI 변형)이 PDF를 추가 설정 없이 file part로 직접 읽음.
3. **🖥️ Apple Silicon 로컬 OCR** — [oMLX](https://github.com/jundot/omlx)가 Microsoft Markitdown을 내장 PDF→Markdown 백엔드로 통합. oMLX에서 Markitdown 활성화, [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) (3B / 570M 활성, 2026-06 오픈소스)을 비전 모델로 로드, 플러그인을 Custom OpenAI-Compatible 공급자로 oMLX에 연결, **Force PDF Support** 켜기, oMLX가 서빙하는 멀티모달 모델 선택. PDF가 기기를 떠나지 않습니다.
4. **🛠️ 서드파티 추출기 (MinerU 온라인 UI)** — API 토큰 연결을 원하지 않을 때 [MinerU Extractor 온라인 서비스](https://mineru.net/OpenSourceTools/Extractor)로 빠르게 수동 UI 사용. 변환된 `.md`를 다운로드하여 wiki 폴더 밖 vault 어디든 두고 일반 Markdown 노트로 수집.
5. **🔌 Force PDF Support** — file part를 허용하는 다른 모든 OpenAI/Anthropic 호환 엔드포인트에 대해 플러그인이 호출을 시도 (설정 → LLM Configuration → Advanced). 성공 여부는 엔드포인트가 결정; 실패는 locale화된 Notice로 표시됩니다.

**Office 포맷 관련 주의사항:** Obsidian은 `.docx` / `.xlsx` / `.pptx`를 기본적으로 렌더링하지 않으므로([file-formats](https://obsidian.md/help/file-formats)), Office 파일의 실질적인 워크플로는 MinerU가 `.md`로 변환 → 플러그인이 그 `.md`를 Wiki 페이지로 수집 → 원본 Office 파일은 참고용으로 보존. Office 파일을 인라인 미리보려면 Pandoc Plugin / Docxer / Md Importer / Office Reader 같은 커뮤니티 플러그인을 사용하세요.

**모든 경로에 공통으로 적용되는 Plumbing:**

- **🗄️ 제한된 캐시** — `.obsidian/plugins/karpathywiki/pdf-cache/`에 변환된 Markdown을 콘텐츠 해시 + 모델 + converter 버전으로 키 지정하여 저장; 총 100MB / 1000개 항목 / 단일 10MB 상한, LRU-by-mtime 축출.
- **📝 선택적 볼트 사이드카** — 설정 → Wiki Configuration → Wiki Folder → *Write PDF Markdown to Vault*를 켜면 소스 PDF 옆에 `<basename>.pdf.md`를 작성 (기본값 꺼짐 — 캐시 전용이 기본).
- **🛡️ Verbatim 트랜스크립터 프롬프트** — OCR 스타일 변환, `[illegible]` / `[figure: ...]` 반환각 마커 포함; 소형 로컬 모델의 markdown 펜스 래핑은 캐시 쓰기 전에 자동 정리됩니다.
- **🔁 소스 페이지 verbatim 인용 (v1.27.0, #496)** — 생성된 모든 `sources/<slug>.md` 페이지에 이제 추출 단계에서 캡처한 것과 동일한 verbatim 인용문으로 만든 `Mentions in Source` 섹션이 포함됩니다 (모델이 실제로 읽을 수 있다고 입증한 산문). 따라서 원본 문서는 소스 텍스트로 다시 추적 가능한 진짜 근거 흔적을 가진 유일한 wiki 페이지가 됩니다.

📖 **모든 경로에 대한 전체 설정 워크스루** (클라우드 공급자, oMLX 하드웨어 계층, MinerU 설치, 캐시 하우스키핑) → [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 조회 및 유지관리

- **🧭 5단계 PPR 캐스케이드** — [검색 작동 방식](#-검색-작동-방식) 참조. `[[wiki-link]]` 그래프 위의 Personalized PageRank가 그래프 인지 멀티홉 컨텍스트를 제공합니다.
- **🪟 우측 도킹 사이드 패널** — Query Wiki가 중앙 팝업 대신 Copilot 스타일의 우측 사이드바 리프에서 열립니다 (v1.22.1+).
- **🔍 Lint 상태 검사** — 단일 명령어로 감지: 중복, 데드 링크, 빈 페이지, 고아, 누락된 alias, 모순.
- **⚡ Smart Fix All** — 원클릭 인과순서 수리: alias 채우기 → 중복 병합 → 데드 링크 수정 → 고아 연결 → 빈 페이지 확장, 단계별 보고서 포함.
- **🆕 Fix Dead Links leave-it 결과 (v1.27.0, #485)** — 설정 → Advanced → *Create Stubs for Unresolvable Links* (기본 ON) 옵션으로 빈 placeholder 페이지 생성을 거부할 수 있습니다. 꺼두면 데드 링크가 실제 소스가 정의할 때까지 모든 lint 보고서에 그대로 남아 있고, 수집은 일반 채널을 통해 페이지를 만듭니다. #197의 "절대 LLM으로 확장하지 않음" 게이트는 변경되지 않습니다 — 새 컨트롤은 stub 페이지가 *작성되는지 여부*만 결정합니다.
- **📊 작업 이력 패널** — 과거 수집, lint 보고서, 유지보수 실행을 검색 및 필터링 가능한 UI로 조회.
- **🛡️ 사전 수집 게이트** — 빈/공백/frontmatter 전용 노트는 LLM 호출 전에 거부됨; 콘텐츠 해시 중복 제거가 경로 간 동일 파일을 감지합니다.
- **🆕 수집 후보 게이트 (v1.27.0, #514 / PR #521)** — 옵트인 토글 (`skipMentionOnlyCandidates`, 기본 꺼짐, 설정 → Advanced). 측정된 언어 프로파일이 있는 소스에 대해 (de 측정됨; en/fr/es/pt/nl/ko는 고정된 엣지 케이스로 추정됨; zh/ja 문자 스크립트 임계값은 미측정) 괄호 / 열거 / 짧은 목록 항목 안에서만 언급된 후보는 페이지 + dedup + 생성 호출 비용이 발생하기 전에 가지치기됩니다. 크로스 언어 노드는 게이트되지 않으며; 프로파일이 없는 wiki 언어는 수집당 한 번 보고하고 절대 자동으로 건너뛰지 않습니다.
- **🆕 단계별 task policies (v1.27.0, #525 / #490)** — LLM Advanced → Task Policies 필드; 코드 변경 없이 단계별 text-mode/thinking 설정을 오버라이드합니다. 나열하지 않은 단계의 기본 baseline은 그대로 유지됩니다.

### 🔒 개인정보

- **🚫 백엔드 없음, 추적 없음, 분석 없음.** 완전히 Obsidian 내부에서 실행됩니다. 네트워크는 설정한 LLM 공급자와의 통신에만 사용됩니다.
- **📁 소스 파일은 읽기 전용입니다.** 플러그인은 원본 볼트 노트를 절대 수정하지 않습니다 — `wiki/` 아래에 새 페이지만 생성합니다.
- **🦙 완전 로컬 모드.** Ollama, LM Studio, 또는 모든 로컬 OpenAI 호환 엔드포인트 → 노트가 기기를 떠나지 않습니다.
- **🔐 최소 권한.** Wiki 관리를 위한 볼트 파일 접근. Query 모달의 "Copy" 버튼 클릭 시에만 클립보드 접근.

### 🦙 로컬 우선

- **🖥️ Ollama, LM Studio, OpenRouter, 커스텀 엔드포인트** — 즉시 사용 가능. 로컬 모델은 조회에 적합 (작은 컨텍스트 창); 2000페이지 볼트 수집은 보통 긴 컨텍스트 클라우드 모델이 필요합니다.
- **📄 Apple Silicon에서 PDF OCR 경로 완전 로컬 지원** — 위 [문서 / PDF / 이미지 수집](#-문서--pdf--이미지-수집) 참조.
- **🔐 ChatGPT Plan (Codex OAuth)** — 데스크톱 루프백 또는 모바일 기기 코드; 자격 증명은 Obsidian SecretStorage에만 저장됩니다. (전체 공급자 경계 설명은 아래 [Anthropic vs OpenAI vs Codex OAuth](#-anthropic-vs-openai-vs-codex-oauth--서로-다른-공급자입니다) 참조.)

### 🌐 언어

- **🌍 10개 UI 언어** — English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano. UI와 Wiki 출력 언어는 독립적입니다 — Wiki는 중국어로, 인터페이스는 영어로 유지 가능합니다.
- **📚 10개 Wiki 출력 언어** — 동일한 세트; 설정 → Wiki Configuration에서 선택. *Custom input* 옵션으로 임시 프롬프트 사용 가능.
- **모든 UI 문자열이 locale 별로 번역됨** — 모든 라벨, 모달, Notice. 12번째 언어 추가는 기여자 주도입니다 (PR #159 패턴).

---

## 🌐 생태계

이 플러그인은 Obsidian의 다른 도구들과 함께 작동합니다 — 아래 도구들은 모두 코드 변경 없이 `[[wiki-link]]` 그래프와 연동됩니다.

- **📄 [MinerU 멀티 포맷 백엔드](https://mineru.net/apiManage/docs) (v1.27.0부터 내장)** — 별도 CLI/UI 단계였던 것이 이제 플러그인 스위치가 되었습니다; 전체 경로 표는 [문서 / PDF / 이미지 수집](#-문서--pdf--이미지-수집) 참조. API 토큰 대신 빠른 UI를 선호하는 사용자를 위해 [MinerU 온라인 서비스](https://mineru.net/OpenSourceTools/Extractor)는 계속 이용 가능; [MinerU 셀프 호스팅](https://github.com/opendatalab/mineru)도 선택지입니다.
- **🕸️ Obsidian Graph View** — 모든 Wiki 페이지에서 네이티브 그래프를 열 수 있습니다. 모든 `[[wiki-link]]` 가 노드가 되고, 모든 역방향 링크가 엣지가 됩니다. 기본 내장, 추가 번들 크기 0.
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** — 공식 브라우저 확장. 기사, 블로그 게시물, Reddit 스레드, Hacker News, 레시피, 연구 논문, YouTube 자막(Interpreter 경유)을 vault 내 임의 폴더에 저장한 다음, 플러그인의 「폴더에서 수집」 명령을 실행하여 엔티티와 개념을 일괄 추출합니다.
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** — DQL(`LIST FROM "wiki/entities" WHERE contains(tags, "person")`) 또는 JS API로 Wiki를 데이터베이스처럼 쿼리할 수 있습니다. 플러그인은 모든 페이지에 표준 frontmatter(`tags:`, `type:`, `aliases:`)를 작성하므로 Dataview 쿼리는 별도 설정 없이 바로 작동합니다.
- **🌿 Git** — 어떤 Git 클라이언트로든 vault를 버전 관리하세요. 플러그인은 원본 파일을 절대 다시 작성하지 않으며, `wiki/` 아래에 새 페이지만 생성합니다. 따라서 `git diff` 로 수동 편집과 LLM 생성 콘텐츠를 명확히 구분할 수 있습니다.
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** — Marp frontmatter(`marp: true`)로 임의의 Obsidian 노트를 슬라이드로 변환합니다. Wiki 페이지는 순수 Markdown이므로 추가 변환 없이 슬라이드로 렌더링됩니다.
- **🖼️ Canvas** — Obsidian의 기본 무한 캔버스. Wiki 카드를 Canvas에 배치하여 vault를 벗어나지 않고 학습 가이드, 마인드 맵, 연구 개요를 `[[wiki-links]]` 로 조립할 수 있습니다.
- **🎤 [Obsidian Nous](https://github.com/AndyMDH/obsidian-nous)** — 로컬 음성 메모 및 회의 캡처(macOS에서 whisper.cpp 사용, 오디오는 기기를 떠나지 않음) 동반 플러그인. 화자 라벨이 붙은 전사 파일과 자체 wiki 허브 페이지를 생성합니다. 본 플러그인과는 독립적이며, 같은 vault를 공유해도 결합이 필요 없습니다.

---

## 🧰 헤드리스 CLI

**대부분의 사용자는 이 섹션을 건너뛰어도 됩니다.** 본 플러그인의 사용자용 CLI는 형제 리포지토리 [green-dalii/obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)에 있습니다 — `karpathywiki-cli` npm 패키지로 배포됩니다. `npm i -g karpathywiki-cli`로 설치하고 `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`로 실행하세요.

본 리포지토리의 `tools/dev-instrument/`에 들어 있는 것은 엔진 기여자용 **dev-only 헤드리스 측정 도구**입니다. Obsidian 런타임 없이 실제 `WikiEngine.ingestSource`를 vault에 대해 실행하고, 작업 단위 토큰 + wall-clock 집계를 출력합니다 — CLAUDE.md 및 릴리스 노트의 perf evidence에 사용되는 수치입니다. 진입 명령, 환경 변수, 측정 모드, 종료 코드 사양은 [`tools/dev-instrument/README.md`](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/tools/dev-instrument/README.md)를 참조하세요.

---

## 🔍 검색 작동 방식

대부분의 "AI 검색" 플러그인은 노트를 청크로 분할하고 벡터 DB에 임베딩합니다. 저희는 그렇게 하지 않습니다. [Karpathy가 RAG에 반한 이유](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)는 청킹이 LLM의 전체 지식 그래프 추론 능력을 저해하기 때문이며 — 이 주장은 실제로도 유효합니다. 대신, 여러분이 `[[wiki-links]]`를 작성하여 이미 유지 관리하고 있는 그래프를 탐색합니다.

### 5단계 시드 선택 캐스케이드

"Microsoft 창업자는 누구인가?"라고 질문하면, Query Wiki는 답변 생성 전에 5단계를 실행합니다:

1. **Lex 빠른 경로** — 모든 Entity/Concept 제목 및 alias에 대한 직접 토큰 중복 체크. 무료, 즉시, 이후 모든 단계의 게이트 역할.
2. **LLM 키워드 생성** — LLM이 쿼리로부터 8–12개의 다국어 키워드 생성 (동의어, 약어, 토큰 중복에 취약한 용어를 단일 LLM 호출로 처리).
3. **로컬 부분문자열 스캔** — 생성된 각 키워드를 페이지 제목, alias, 본문 스니펫에 대해 로컬에서 재매칭. 추가 LLM 호출 없음, 노이즈 허용 재현율 보완.
4. **LLM KB 폴백** — lex + 키워드 스캔의 신호가 약할 때, LLM이 전체 Wiki에 대해 top-N 후보를 한 번 의미적으로 재시드.
5. **PPR 그래프 확장** — 후보 시드 집합에서 `[[wiki-link]]` 그래프 위 Personalized PageRank (Haveliwala 2002) 실행. 이것이 그래프 인지 멀티홉 컨텍스트를 제공합니다: "Bill Gates" → "Microsoft" → "경쟁사", 단순한 제목 일치가 아닌.

캐스케이드는 충분한 신호를 반환한 단계에서 자동으로 절단됩니다 — 고정된 5단계 비용 없음; lex로 충분할 때는 LLM 호출 없음; 의미 폴백은 lex + 키워드 스캔만으로 충분하지 않을 때만 적용됩니다.

### 규모에 맞는 Personalized PageRank

Monte Carlo PPR (Fogaras 2005)을 사용합니다 — 3,000개의 랜덤 워크 × 각 50단계, Haveliwala 2002의 데드엔드 규칙 적용. 비용은 **O(K × L)** (K = 워크 수, L = 워크당 단계 수)로 페이지 수와 무관하므로, 2000페이지 볼트에서도 200페이지 볼트와 동일한 확장 지연 시간을 보입니다.

**PPR @5 = 27.1% vs 순수 kNN 기준 24.1%** (이 오픈소스 LLM-Wiki 분야에서 유일하게 공개된 검색 벤치마크).

### 임베딩을 사용하지 않는 이유

[Issue #175](https://github.com/green-dalii/obsidian-llm-wiki/issues/175)에서 임베딩 경로를 의도적으로 거부했습니다. 그래프 신호는 이미 존재합니다 — 모든 `[[wiki-link]]`는 "이것들은 서로 관련있다"는 직접 큐레이팅된 엣지이며, 저희가 지원하는 대부분의 공급자(Ollama, LM Studio, Anthropic, Bedrock, Kimi, GLM, MiniMax)는 `/v1/embeddings` 엔드포인트를 전혀 제공하지 않습니다. 임베딩 모델을 추가하면 페이지당 다운로드, 공급자별 어댑터가 필요하고 검색 품질에는 이점이 전혀 없을 것입니다.

---

## 🤖 모델

**지원 공급자 (16+, 2026-07 기준 models.dev 교차 확인):**

| 공급자 | 시리즈 | 비고 |
|--------|--------|------|
| **Anthropic** | Claude 5 시리즈 | 네이티브 PDF; `/v1/messages` 프로토콜 |
| **OpenAI** | GPT-5.6 시리즈 (Sol / Terra / Luna) | 네이티브 PDF; Platform API 키 |
| **Google Gemini** | Gemini 3.6 시리즈 | 네이티브 PDF (1.5부터 파일 파트); OpenAI 호환 엔드포인트 |
| **DeepSeek** | DeepSeek V4 시리즈 | OpenAI 호환; 최저 비용 계층 |
| **Alibaba Qwen** | Qwen3.7/3.8 시리즈 | OpenAI 호환 (DashScope) |
| **xAI Grok** | Grok 4 시리즈 | OpenAI 호환; 긴 컨텍스트 |
| **Moonshot Kimi** | Kimi K3 시리즈 | OpenAI 호환; 2.8T MoE 프론티어 |
| **Zhipu GLM** | GLM-5 시리즈 | OpenAI 호환; 강력한 이중 언어 |
| **MiniMax** | MiniMax M3 시리즈 | OpenAI 호환; 1M 컨텍스트 |
| **Step (阶跃星辰)** | Step 3 시리즈 (Flash) | OpenAI 호환; 빠른 추론 |
| **Tencent Hunyuan** | Hy3 시리즈 | OpenAI 호환; 오픈웨이트 MoE |
| **Xiaomi MiMo** | MiMo V2.5 시리즈 | MIT 오픈소스; 플랫 가격 |
| **Google Gemma** | Gemma 4 시리즈 | 오픈웨이트; 262K 컨텍스트 |
| **AWS Bedrock** | Anthropic + OpenAI 변형 | VPC / 규정 준수 경로; **API key + SSO + IAM** (v1.27.0, #425) |
| **ChatGPT Plan (Codex OAuth)** | Codex Responses API | 브라우저/기기 코드 로그인; SecretStorage |
| **로컬: Ollama, LM Studio, OpenRouter, Anthropic-Compatible** | 모든 OpenAI/Anthropic 프로토콜 모델 | Custom OpenAI-Compatible + Anthropic-Compatible (Token Plan / Coding Plan) |

이 플러그인은 LLM에 전체 Wiki 컨텍스트를 제공하므로 — **긴 컨텍스트 모델이 유리합니다**. 전체 계층형 표 (클라우드 + 로컬)는 [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)에 있으며, [models.dev](https://models.dev/)와 교차 확인되어 최신 상태를 유지합니다.

### 중요한 요소

- **🧠 컨텍스트 창 ≥ 200K 토큰** — 약 500페이지 이상의 볼트에서 필요. 200K 미만이면 캐스케이드가 맞추기 위해 앞쪽 단계를 건너뛸 수 있습니다.
- **⚖️ 명령 수행 품질** — 추출 작업에서는 원시 IQ보다 명령 수행 능력이 더 중요합니다. 스키마 템플릿을 따르는 모델을 선택하세요, 가장 큰 리더보드 숫자가 아닙니다.
- **🔌 임베딩 엔드포인트는 무관합니다** — 저희는 임베딩을 사용하지 않습니다. `/v1/embeddings`가 없는 공급자도 괜찮습니다 (저희 16+ 공급자 대부분이 이를 제공하지 않습니다).
- **🦙 조회는 로컬, 수집은 클라우드** — 2000페이지 볼트 수집은 보통 긴 컨텍스트 클라우드 모델이 필요합니다; 262K 로컬 모델은 대부분의 조회를 커버합니다.

### Anthropic vs OpenAI vs Codex OAuth — 서로 다른 공급자입니다

- **Anthropic** (및 Bedrock 변형) — 별도 청구되는 Anthropic Platform API 키.
- **OpenAI** — 별도 청구되는 OpenAI Platform API 키.
- **ChatGPT Plan (Codex OAuth)** — 실험적, 별도 공급자로 브라우저 또는 기기 코드 로그인 후 적격 Codex 사용 한도를 사용합니다. 사용 가능 여부는 OpenAI Codex 인증 및 사용 한도 정책을 따르며, 플랜 이름으로 보장되지 않습니다. 서드파티 Codex 호환 기능이며, OpenAI 파트너십이나 범용 ChatGPT API가 아닙니다.

### AWS Bedrock — 세 가지 인증 모드 (v1.27.0, #425)

설정 → Provider → Bedrock (Anthropic / OpenAI)에서 이제 세 가지 인증 모드 중 하나를 선택합니다; provider 행은 해당 모드가 실제로 필요로 하는 입력 항목을 요청합니다:

- **API key** — 기존 Stage-1 bearer 경로. 동작은 v1.26.4와 바이트 단위로 동일하며, 이미 Bedrock API 키를 지불하고 있는 사용자에게 권장됩니다.
- **SSO** — IAM Identity Center device flow. *Sign in with AWS SSO* 클릭 후 브라우저에서 verification URL 코드를 붙여넣으면, 플러그인이 SecretStorage의 `karpathywiki-bedrock-sso`를 통해 SSO 토큰을 받고, 이를 임시 role 자격 증명으로 교환한 뒤, 모든 요청을 자체 구현한 SigV4 (AWS SDK 미추가)로 서명합니다. Account ID와 role 이름은 SSO identity가 각각 정확히 하나를 노출할 때 자동 감지됩니다; 그렇지 않으면 provider 설정에서 입력하세요.
- **IAM** — SSO가 없는 환경 (CI, 예약된 배치 작업)을 위한 static access key. SecretStorage의 `karpathywiki-bedrock-iam`에 저장됨; in-memory 캐시는 SigV4 서명이 만료 내에 머무르도록 access-key별로 메모이즈합니다.

세 모드 모두 동일한 Obsidian SecretStorage 규율(`data.json`, 로그, docs에 자격 증명 없음)과 동일한 zero-AWS-SDK 자체 구현 OIDC + SigV4 경로를 공유합니다. Bedrock region은 인증 모드와 독립적이며, 동일한 provider 행에서 설정됩니다.

> 📖 **전체 선택 표** (클라우드 + 로컬 + PDF OCR + Codex OAuth + 양자화 + 하드웨어 계층) → [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

---

## ❓ FAQ

### 이 플러그인은 실제로 무엇을 하나요?

노트, 폴더, 선택 항목을 고르면 LLM이 Entity와 Concept을 추출하고 `[[양방향 링크]]`로 연결된 Wiki를 생성합니다. 질문하면 *여러분의 노트*에 기반한 대화형 답변을 받습니다 — 인터넷이 아닙니다. 원본 볼트 노트는 절대 수정되지 않습니다.

### 어떻게 시작하나요?

Obsidian 커뮤니티 플러그인에서 설치 → 공급자 선택 → **Test Connection** → 아무 노트에 대해 **Ingest single source** 실행. 첫 Wiki 페이지가 몇 초 안에 나타납니다. [빠른 시작](#-빠른-시작) 참조.

### PDF, 이미지, Office 문서를 수집할 수 있나요?

✅ 가능합니다. Anthropic, OpenAI, Bedrock, Gemini가 PDF를 기본 처리합니다; 내장 MinerU 백엔드(v1.27.0)가 그 외 모든 항목(PDF + 이미지 + Office)을 처리합니다. 전체 워크스루 — 클라우드 공급자, Apple Silicon OCR, Force PDF Support, 캐시 하우스키핑 — 은 [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md) 참조.

### 기존 Wiki는 안전한가요?

✅ v1.0.0 이후 하위 호환성 유지. 덮어쓰기로부터 보호하려면 페이지에 `reviewed: true`를 설정하세요. v1.24.x에서 업그레이드해도 볼트가 다시 작성되지 않습니다; v1.25.0의 PDF 수집은 기본적으로 캐시 전용이며, v1.27.0에서 추가된 PDF + 이미지 + Office 수집은 디스크 상의 Wiki 레이아웃을 변경하지 않습니다.

### 내 데이터가 외부로 전송되나요?

🚫 백엔드 없음, 분석 없음 — 플러그인은 완전히 Obsidian 내부에서 실행됩니다. 수집/조회를 위해 명시적으로 보낸 텍스트만 기기를 떠나며, 설정한 LLM 공급자에게만 전송됩니다. 완전한 데이터 로컬리티를 위해 Ollama나 LM Studio를 사용하세요.

### 내 언어로 사용할 수 있나요?

🌍 UI와 Wiki 출력 모두 11개 언어 지원. UI와 Wiki 언어는 독립적입니다. 12번째 언어 추가는 기여자 주도입니다 (PR #159 패턴).

### RAG 챗봇과 어떻게 다른가요?

🚫 청킹 없음. 🚫 임베딩 없음. 🚫 벡터 DB 없음. ✅ 기존 `[[wiki-link]]` 그래프 위의 Personalized PageRank — 그래프 인지 멀티홉 컨텍스트, 임베딩 비용 제로, 로컬 모델 완전 지원.

### 어떤 LLM을 사용해야 하나요?

긴 컨텍스트 모델(≥200K 토큰)이 가장 적합합니다. [모델 섹션](#-모델)에서 원칙을 다루고, 전체 계층형 표는 [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)에 있습니다.

### 공개된 벤치마크가 있나요?

네 — PPR @5 = 27.1% vs 순수 kNN 기준 24.1% (프로젝트 자체 코퍼스 기준). 전체 파이프라인과 벤치마크 스크립트는 [검색 작동 방식](#-검색-작동-방식)에 설명되어 있습니다.

### API 비용을 어떻게 관리하나요?

배치 수집에는 Coarse 또는 Minimal 추출 세분화를 사용하세요. Smart Batch Skip이 이미 수집된 파일을 자동 감지합니다. Auto-Maintenance는 기본적으로 꺼져 있습니다. Lint는 수정 실행 전에 건수를 표시합니다 — 승인 없이 비용이 청구되지 않습니다.

### 실행 중인 작업을 취소하려면?

상태 표시줄 클릭 ("수집 중… 클릭하여 취소" 표시) 또는 `Cmd+P/Ctrl+P` → "Cancel current ingestion". 다음 배치 경계에서 깔끔하게 중지됩니다.

### 도움은 어디서 받나요?

[GitHub Issues](https://github.com/green-dalii/obsidian-llm-wiki/issues) — 버그 신고 · [GitHub Discussions](https://github.com/green-dalii/obsidian-llm-wiki/discussions) — 질문 및 기능 요청 · 개발자 콘솔 (`Ctrl+Shift+I` / `Cmd+Option+I`) — 플러그인 로그 확인.

---

## 🔒 개인정보

이 플러그인은 Obsidian 커뮤니티 플러그인 마켓에 등록되어 있으며 보안 및 권한에 대한 자동 검토를 받습니다.

- **🚫 백엔드 없음, 서버 없음, 데이터 수집 없음.** Obsidian 내에서 실행되는 순수 로컬 소프트웨어입니다. 플러그인은 데이터를 수집, 저장, 전송할 수 없으며 실제로 그러지 않습니다 — 그러한 서버가 존재하지 않기 때문입니다.
- **🔐 네트워크 접근은 옵트인입니다.** 설정한 LLM 공급자와의 통신에만 사용됩니다. 공급자를 선택하고, API 키를 입력하고, 데이터가 어디로 갈지 결정하는 것은 여러분입니다.
- **📁 볼트 파일 접근**은 Wiki 관리에 사용됩니다 (노트 읽기, 페이지 생성, 데드 링크 스캔, 중복 감지). 플러그인은 소스 파일을 절대 수정하지 않습니다.
- **📋 클립보드 접근**은 Query 모달의 "Copy" 버튼에서만 사용됩니다 — 클릭할 때만입니다.

완전한 데이터 로컬리티를 위해 Ollama 또는 LM Studio를 사용하세요. 로컬 공급자를 사용하면 데이터가 기기를 떠나지 않습니다.

---

## 💖 프로젝트 지원하기

LLM-Wiki가 여러분의 지식 워크플로에서 중요한 부분이 되었다면:

- ☕ **[Ko-fi에서 커피 한 잔 사기](https://ko-fi.com/greenerdalii)** — 일회성 또는 월간 지원
- 💳 **[PayPal로 팁 보내기](https://paypal.me/greenerdalii)** — 일회성 팁

프로젝트를 지원해 주신 분들께 감사드립니다：

[@jameses-cyber](https://github.com/jameses-cyber)、[@issaqua](https://github.com/issaqua)、Dikson Choi

---

## 🔭 다른 프로젝트

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — 헤드리스 인제스트 CLI로, `karpathywiki-cli` npm 패키지로 배포된 형제 리포지토리입니다. 디스크의 vault를 대상으로 같은 `WikiEngine`을 실행하며 렌더러가 필요 없습니다. 설치: `npm i -g karpathywiki-cli`. 이 저장소 안의 `tools/dev-instrument/`는 dev-only 측정 도구로, 본 플러그인의 릴리스 노트에 나오는 작업 단위 비용 수치의 산출원입니다.
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — [pi-coding-agent](https://github.com/earendil-works/pi)를 위한 작업 단위 라우터입니다. 매 턴 전에 작은 LLM 심판이 메시지를 일상적인 일과 중요한 일로 나누고, 선택된 단이 그 턴 전체를 맡습니다. 복잡한 작업에서는 한 걸음 더 나아가 Smart 단이 CTO처럼 계획을 세우고 구현을 Fast 서브에이전트에 위임한 뒤 결과를 하나씩 검토하며 반복합니다. 상향은 즉시, 하향은 추세가 이어질 때만 이루어지고, 단별 폴백 체인이 429와 5xx를 감당합니다. 런타임 의존성 없음, MIT. → [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — pi-shift-router의 DSH 포크. 같은 작업 단위 라우팅 설계를 공유하지만 [dsh-coding-agent](https://github.com/earendil-works/dsh) 런타임을 대상으로 합니다. 같은 심판 기반 단 선택, 같은 단별 폴백 체인, MIT.
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — Claude 측 `obsidian-plugin-dev` 워크플로의 DSH 버전. Obsidian 플러그인 작업 공간을 스캐폴드하고, Red→Green TDD 루프를 구동하며, Six-Gate 품질 마감(lint/tsc/test/build/css-lint)을 실행하고, `feat/*` 또는 `fix/*` 브랜치에서 릴리스 준비된 커밋을 준비합니다. DSH를 사용하는 기여자가 CLAUDE.md를 복사·붙여넣기 하지 않고도 동일한 스캐폴드 + 게이트 경험을 얻도록 만들어졌습니다.

---

## 📜 라이선스 및 크레딧

Apache License, Version 2.0 — [LICENSE](../LICENSE) 및 [NOTICE](../NOTICE) 참조.

**다음을 기반으로 구축되었습니다:**
- 💡 [Andrej Karpathy의 LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — 원본 개념
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v6](https://ai-sdk.dev/) (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) via Obsidian `requestUrl`
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) 및 [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — 검색 알고리즘

**유지관리자:** [@green-dalii](https://github.com/green-dalii)

[![Star History Chart](https://api.star-history.com/chart?repos=green-dalii/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
