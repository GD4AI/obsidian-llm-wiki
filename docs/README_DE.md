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

![Karpathy LLM Wiki Plugin-Banner — ein Netzwerk aus verbundenen Wiki-Seiten, erstellt aus deinen Obsidian-Notizen](assets/llm_wiki_banner.webp)

# 🧠 Karpathy LLM Wiki Plugin für Obsidian

> KI-gestützte strukturierte Wissensbasis — wandelt Notizen automatisch in ein Wiki um. Basierend auf [Andrej Karpathys LLM Wiki-Konzept](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

**Obsidian-Review Perfekte Bewertung • Null-Embedding-Graph-Suche • Native Unterstützung für 11 Sprachen • Nativer PDF-, Bild- und Office-Ingest • Kompatibel mit jedem LLM-Anbieter • Lokal zuerst • Kein Backend • DSGVO-freundlich**

![Version](https://img.shields.io/github/v/release/green-dalii/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-16%2B-cyan?style=flat-square) <br>
![Maintenance](https://img.shields.io/badge/maintenance-actively%20maintained-brightgreen?style=flat-square) ![Build Status](https://img.shields.io/github/actions/workflow/status/green-dalii/obsidian-llm-wiki/release.yml?style=flat-square) ![Author](https://img.shields.io/badge/author-Greener--Dalii-blue?style=flat-square) <br>
![GitHub Stars](https://img.shields.io/github/stars/green-dalii/obsidian-llm-wiki?style=flat-square) ![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/green-dalii/obsidian-llm-wiki)

[English](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_CN.md) | [繁體中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_KO.md) | **Deutsch** | [Français](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_FR.md) | [Español](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ES.md) | [Português](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_PT.md) | [Italiano](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_IT.md) | [Русский](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[Offizielle Website](https://llmwiki.greenerai.top/) | [Obsidian-Marktplatz](https://community.obsidian.md/plugins/karpathywiki) | [Blog](https://llmwiki.greenerai.top/blog/) | [Diskussionen](https://github.com/green-dalii/obsidian-llm-wiki/discussions)

🤔 [Warum dieses Plugin?](#-warum-dieses-plugin) | 🚀 [Schnellstart](#-schnellstart) | ✨ [Funktionen](#-funktionen) | 🌐 [Ökosystem](#-ökosystem) | 🔍 [Wie die Suche funktioniert](#-wie-die-suche-funktioniert) | 🤖 [Modelle](#-modelle) | ❓ [FAQ](#-faq)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD) ← Wenn dir dieses Plugin geholfen hat, lad mich gerne auf einen Kaffee♥️ ein oder vergib einen Stern🌟↗

---

---

## 🤔 Warum dieses Plugin?

Du schreibst Notizen. Sie liegen in Ordnern. Zusammenhänge zu finden bedeutet, sich an Fäden zu erinnern, die du vor Monaten verloren hast.

**Andere Open-Source-Neuimplementierungen von Karpathys LLM-Wiki-Idee existieren — aber keine davon ist ein One-Click-Obsidian-Plugin.** Die meisten sind CLI-Tools, Claude-Code-Skills oder separate Desktop-Apps; dieses Plugin läuft direkt in Obsidian — Graph View, Ribbons und Kommandopalette inklusive.

### Wie wir abschneiden

|  | **Karpathy LLM Wiki** (dieses Plugin) | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | sdyckjq / llm-wiki-skill | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|---|
| **Lieferung & Installation** | ✅ **5 Min.** — One-Click-Obsidian-Plugin: Community Plugins → Installieren → Provider wählen → Ingest | ❌ 30 Min.+ — Tauri-Binary kompilieren/herunterladen, CLI konfigurieren | ❌ 15 Min. — benötigt Claude-Code-Abo + Skill-Installation | ❌ 10 Min. — benötigt Claude-Code-/Codex-Abo + Skill-Einrichtung | ❌ 30 Min.+ — pip install + Python SDK + lokaler Server |
| **Architektur & Abhängigkeiten** | ✅ **Keine Abhängigkeiten** — keine Vektor-DB, kein Embedding-Modell, keine externen Prozesse (PPR über `[[wiki-link]]`-Graph, bewusst so gewählt) | 🟡 Eigenes Python-Runtime + sigma.js + sqlite; Embeddings optional, standardmäßig aus | 🟡 Nutzt Claude-Code-Umgebung — nicht eigenständig; keine Embeddings | 🟡 Erfordert separate Plattform-Laufzeitumgebung; keine Embeddings | ❌ Erfordert Python + Embedding-Modell + Vektor-DB (zwingend) |
| **i18n (UI + Wiki-Ausgabe)** | ✅ 10 Sprachen (unabhängige UI/Ausgabe) | 🟡 2 (EN / 中文) | ❌ Nur Englisch | ❌ Nur Englisch | ❌ Nur Englisch |
| **LLM-Anbieter** | ✅ 16+ (inkl. Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, Anthropic-Compatible) | 🟡 OpenAI-kompatibel | 🟡 Abo über Claude Code | 🟡 Abo über Claude Code / Codex | 🟡 OpenAI-kompatibel |
| **Suche & Query-Pipeline** | ✅ **5-Stufen-Kaskade** — Lex → LLM-Keywords → Substring-Scan → LLM-KB-Fallback → PPR-Expansion (bricht bei erstem ausreichendem Signal ab). Personalized PageRank (Haveliwala 2002) + Monte Carlo (Fogaras 2005) | 🟡 Nur 2-Hop-Decay (4-Signal-Heuristik: Adamic-Adar + 2-Hop) | ❌ Nur Louvain-Community-Erkennung | ❌ Nur k-Hop-Vorschauen (keine LLM-Erweiterung) | ❌ BM25 + semantisch über Chunks (kein Graph) |
| **Graph-Visualisierung** | ✅ Obsidians nativer Graph View (integriert, null zusätzliche Größe) | ❌ Benutzerdefiniertes sigma.js + graphology in Desktop-App | 🟡 vis.js graph.html (separate Datei) | ❌ Benutzerdefiniertes sigma.js offline HTML | ❌ Read-only-Browser-Viewer |
| **Wiki-Ehrlichkeit** | ✅ „Stage FALLBACK"-Banner, wenn keine Wiki-Quelle zur Abfrage passt | ❌ Kein Äquivalent | ❌ Kein Äquivalent | ❌ Kein Äquivalent | ❌ Kein Äquivalent |
| **Veröffentlichter Such-Benchmark** | ✅ PPR @5 = 27,1 % vs. reine-kNN 24,1 % (einzige veröffentlichte Zahl in diesem Bereich) | ❌ 58 % → 71 % *nur mit aktivierten Embeddings*, nicht in unserem Apples-to-Apples-Format | ❌ Nicht veröffentlicht | ❌ Nicht veröffentlicht | ❌ Nicht veröffentlicht |

### Drei Dinge, die wir bewusst gewählt haben

- **🪟 Obsidian ist die Laufzeitumgebung.** Kein Terminal, keine separate App, kein Docker, kein Python. Aus Community-Plugins installieren, auf Ingest klicken, das Wiki lebt von der ersten Sekunde an in deinem Vault. Obsidians nativer Graph View rendert deinen `[[wiki-link]]`-Graphen — integriert, null zusätzliche Bundle-Größe.
- **🧭 Sauber und autark.** Keine Abhängigkeiten. Kein Embedding-Modell, keine Vektor-Datenbank, kein pip-Paket — ein einziges Plugin, das deine Notizen liest, mit einem LLM spricht und Wiki-Seiten schreibt. Alles lebt innerhalb von Obsidian.
- **🔌 Jedes Modell, für das du bereits bezahlst.** Anthropic, Bedrock, OpenAI, ChatGPT Plan (Codex OAuth), Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-kompatibel, eigener Endpunkt — sechzehn-plus Anbieter, keiner davon benötigt einen Embedding-Endpunkt.

---

## 🎯 Ist es etwas für mich?

**✅ Ja, wenn du:**

- **Eine 5-Minuten-Einrichtung willst, kein 5-Stunden-Projekt.** Aus Community-Plugins installieren → Provider wählen → eine Notiz ingestieren. Kein CLI, kein Python, keine separate Laufzeitumgebung, keine Vektor-DB. Du siehst Wiki-Seiten in `wiki/` innerhalb von Sekunden.
- **Etwas Sauberes und Autarkes möchtest.** Das Plugin hat genau null externe Abhängigkeiten: kein Embedding-Modell, keine Vektor-Datenbank, kein pip-Paket, kein Docker-Container. Es ist ein einziges Obsidian-Plugin, das deine Notizen liest, mit einem LLM spricht und Wiki-Seiten in deinen Vault schreibt. Alles lebt innerhalb von Obsidian.
- **Einen befragbaren Chat möchtest, der aus *deinen* Notizen antwortet** — nicht aus dem Internet — wobei jede Antwort `[[wiki-links]]` zurück in deinen Wissensgraphen trägt.
- **Wert auf Datensouveränität legst** — läuft vollständig lokal mit Ollama oder LM Studio, ohne jemals das Internet zu berühren.
- **In einer von 10 unterstützten Sprachen schreibst oder liest** — UI und Wiki-Ausgabe sind unabhängig (dein Wiki kann auf Chinesisch sein, während die Oberfläche auf Englisch ist).
- **Den Graphen durch Schreiben von `[[wiki-links]]` pflegst** — jeder Link, den du setzt, bereichert bereits die Suche; kein separater Tagging-/Embedding-/Indexing-Schritt.
- **One-Click-Wartung möchtest** — Lint-Gesundheitsscan + Smart Fix All halten Duplikate, tote Links und verwaiste Seiten in Schach, ohne dass du von Hand kuratieren musst.

**❌ Nein, wenn du:**

- **Einen universellen ChatGPT-Ersatz willst** — Antworten kommen nur aus deinem Vault, nicht aus dem Internet.
- **RAG über große externe Korpora brauchst** (Confluence, Notion, arXiv, gescrapte Webseiten) — das Plugin ingestiert deinen Vault plus eigenständige PDF-/Office-Dateien; Massen-RAG über externe Korpora ist bewusst out of scope.
- **Ein gehostetes SaaS mit Team-Zusammenarbeit suchst** — es gibt kein Backend, keinen Server, keinen geteilten Zustand; alles läuft lokal in deinem Obsidian.

---

## 🚀 Schnellstart

1. **Installieren.** Obsidian → Einstellungen → Community-Plugins → Durchsuchen → „Karpathy LLM Wiki" suchen → Installieren → Aktivieren. Oder besuche die [Community-Plugin-Seite](https://community.obsidian.md/plugins/karpathywiki) und klicke auf **Zu Obsidian hinzufügen**.
2. **Provider konfigurieren.** Einstellungen → Karpathy LLM Wiki → Provider wählen (OpenAI, Anthropic, Ollama, ChatGPT Plan (Codex OAuth) usw.) → API-Key eingeben (nicht nötig bei lokalen Anbietern) → **Test Connection** klicken → Speichern.
3. **Eine Notiz ingestieren.** Zwei Wege:
   - **⌨️ Tastatur:** `Cmd+P/Ctrl+P` → „Ingest single source" → eine beliebige Markdown- (oder PDF-, v1.25.0+) Datei wählen.
   - **🖱️ Toolbar-Symbol:** Klicke auf das **Sticker-Symbol** im linken Ribbon von Obsidian, um die aktuell geöffnete Notiz sofort aufzunehmen — kein Menü-Suchen.
   
   Deine ersten Wiki-Seiten erscheinen innerhalb von Sekunden in `wiki/sources/`, `wiki/entities/`, `wiki/concepts/`.
4. **Wiki abfragen.** Zwei Wege:
   - **⌨️ Tastatur:** `Cmd+P/Ctrl+P` → „Query wiki".
   - **🖱️ Toolbar-Symbol:** Klicke auf das **Sprechblasen-Symbol** im linken Ribbon von Obsidian.
   
   Ein rechts angedocktes Seitenpanel im Copilot-Stil öffnet sich, in dem du mit deinem Wiki chatten kannst. Antworten enthalten `[[wiki-links]]`, die zurück in deinen Wissensgraphen führen.

![Rechts angedocktes Query-Wiki-Seitenpanel in Obsidian mit Chat-Interface und Wiki-Link-Antworten zurück in deinen Wissensgraphen](/docs/assets/query-side-panel.png)

Das war's. Das Plugin ändert nichts an deinen ursprünglichen Notizen — es erstellt nur neue Seiten unter `wiki/`. Sowohl **Ingest** als auch **Wiki abfragen** sind im linken Ribbon fixiert, jederzeit mit einem Klick erreichbar. (`Cmd` auf macOS, `Ctrl` auf Windows/Linux.)

### Kernbefehle

| Befehl | Beschreibung |
|---------|--------------|
| **📥 Einzelne Quelle aufnehmen** | `Cmd+P/Ctrl+P` → „Ingest single source" — wähle eine Markdown- oder **PDF (v1.25.0+)**-Datei, erhalte Entity-/Concept-/Wiki-Seiten. *Oder: 🖱️ Sticker-Symbol im linken Ribbon auf der aktiven Notiz anklicken.* |
| **📂 Aus Ordner aufnehmen** | `Cmd+P/Ctrl+P` → „Ingest from folder" — Batch-Aufnahme aller Notizen in einem Ordner, mit intelligentem Batch-Überspringen |
| **📑 Mehrere Dateien aufnehmen** | `Cmd+P/Ctrl+P` → „Ingest multiple files" — wähle eine Teilmenge über eine zweigeteilte Dateibaumansicht (mit Live-Queue + pro-Datei-Abbruch) |
| **🔍 Wiki abfragen** | `Cmd+P/Ctrl+P` → „Query wiki" — chatte mit deinem Wiki in einem rechts angedockten Seitenpanel; Antworten enthalten `[[wiki-links]]`. *Oder: 🖱️ Sprechblasen-Symbol im linken Ribbon anklicken.* |
| **🛠️ Wiki linten** | `Cmd+P/Ctrl+P` → „Lint wiki" — vollständiger Gesundheitsscan: Duplikate, tote Links, leere Seiten, verwaiste Seiten, fehlende Aliase, Widersprüche |
| **⚡ Smart Fix All** | innerhalb des Lint-Modals — One-Click-Reparatur in kausaler Reihenfolge mit Phasenbericht |
| **📋 Index neu generieren** | `Cmd+P/Ctrl+P` → „Regenerate index" — baue `wiki/index.md` mit aktuellen Seiten und Aliasen neu auf |
| **⏹ Abbrechen** | `Cmd+P/Ctrl+P` → „Cancel current ingestion" oder auf die Statusleiste klicken — stoppt sauber an der nächsten Batch-Grenze |
| **📊 Aufnahmeverlauf** | `Cmd+P/Ctrl+P` → „View Ingestion History" — durchsuchbare UI für vergangene Aufnahmen, Lint-Berichte und Wartungsläufe |

![Command panel — all LLM Wiki commands live in Obsidian's command palette](/docs/assets/command-panel.png)
| Vorher | Nachher |
|--------|-------|
| `notes/machine-learning.md` (eine flache Datei) | `wiki/concepts/supervised-learning.md` mit `[[bidirektionalen Links]]`, Aliasen, Quellenangabe und einem Eintrag in `wiki/index.md` |

> 📖 Ausführliche Anleitungen in [GitHub Discussions → Guides](https://github.com/green-dalii/obsidian-llm-wiki/discussions/categories/guides). Hat es dir geholfen? [Vergib einen Stern auf GitHub](https://github.com/green-dalii/obsidian-llm-wiki), um Releases zu folgen.

---

## ✨ Funktionen

### 📚 Wissensqualität

- **🔍 Entity- & Concept-Extraktion** — LLM extrahiert Entitäten (Personen, Organisationen, Produkte, Ereignisse) und Konzepte (Theorien, Methoden, Begriffe) in eigenständige Seiten. Die Granularität ist konfigurierbar (Minimal → Fein, plus Benutzerdefiniert), sodass du Kosten gegen Tiefe abwägen kannst.
- **🏷️ Obligatorische Aliase** — jede Seite wird mit mindestens einem Alias (Übersetzung, Abkürzung, Variante) ausgeliefert, damit sprachübergreifende Duplikaterkennung funktioniert.
- **🔄 Abgestufte Duplikaterkennung** — Stufe 1 (direkter Namensmatch: sprachübergreifend, Abkürzung, hohe Titelähnlichkeit) wird immer verifiziert; Stufe 2 (gemeinsame Links, mittlere Ähnlichkeit) füllt das verbleibende Token-Budget.
- **🧩 Intelligentes Zusammenführen & Widerspruchsstatus** — Duplikate werden unter Erhalt der Aliase zusammengeführt; Widersprüche werden mit Quellenangabe markiert; `reviewed: true`-Seiten sind vor Überschreibung geschützt.
- **🎨 Anpassbares Tag-Vokabular** — definiere eigene Entity-Typ- und Concept-Typ-Tags in Einstellungen → Wiki → Tag-Vokabular → *Custom*. Das Vokabular ist ein Schema-Injection-Hinweis, kein Wire-Level-Gate — kleine/lokale Modelle können weiterhin abdriften (etwa eins von zehn liefert die eingebaute Taxonomie des Modells). Lint meldet den Rest. Design-Anker für Schema-Enforcement: [Issue #328](https://github.com/green-dalii/obsidian-llm-wiki/issues/328).

### 📄 Dokument- / PDF- / Bild-Ingest

Fünf On-Ramps, pro Ingest umschaltbar:

1. **🆕 Integriertes MinerU-Backend (v1.27.0, #404)** — Einstellungen → Wiki Configuration → Markdown Conversion Backend → *MinerU*. PDF + Bilder (PNG/JPG/JPEG/JP2/WebP/GIF/BMP) + Office (DOC/DOCX/PPT/PPTX/XLS/XLSX) über [MinerUs Precise-Parser](https://mineru.net/apiManage/docs). Token in Obsidian SecretStorage. Bester Pfad für wissenschaftliche Arbeiten, gescannte Dokumente und Office-Dateien, bei denen Layouterhalt wichtig ist. Server-Limits: 200 MB / 200 Seiten pro PDF, 256 MB / 10.000 Dateien pro Archiv.
2. **☁️ Cloud-Provider mit nativem PDF** — Anthropic, OpenAI, Google Gemini und AWS Bedrock (Anthropic + OpenAI-Varianten) lesen PDFs ohne weitere Einrichtung als Datei-Parts.
3. **🖥️ Lokale OCR auf Apple Silicon** — [oMLX](https://github.com/jundot/omlx) integriert Microsoft Markitdown als eingebautes PDF→Markdown-Backend. Aktiviere Markitdown in oMLX, lade [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) (3B / 570M-aktiv, Open-Source seit 2026-06) als Vision-Modell, richte das Plugin auf oMLX als benutzerdefinierten OpenAI-kompatiblen Provider aus, aktiviere **Force PDF Support** und wähle das multimodale Modell, das oMLX bereitstellt. Die PDF verlässt niemals deinen Rechner.
4. **🛠️ Drittanbieter-Extraktor (MinerU Online-UI)** — nutze den [MinerU-Extractor-Onlinedienst](https://mineru.net/OpenSourceTools/Extractor) für eine schnelle manuelle UI, wenn du kein API-Token einrichten willst. Lade die konvertierte `.md`-Datei herunter, lege sie in deinem Vault außerhalb des Wiki-Ordners ab und ingestiere sie als reguläre Markdown-Notiz.
5. **🔌 Force PDF Support** — für jeden anderen OpenAI/Anthropic-kompatiblen Endpunkt, der Datei-Parts akzeptiert, versucht das Plugin den Aufruf (Einstellungen → LLM Configuration → Advanced). Der Endpunkt entscheidet; Fehler erscheinen als lokalisierter Hinweis.

**Hinweis zu Office-Formaten:** Obsidian rendert `.docx` / `.xlsx` / `.pptx` nicht nativ ([file-formats](https://obsidian.md/help/file-formats)). Der praxistaugliche Workflow für Office-Dateien ist daher: MinerU konvertiert nach `.md`, das Plugin nimmt diese `.md` in Wiki-Seiten auf, und die ursprüngliche Office-Datei bleibt nur als Referenz erhalten. Für Inline-Vorschau von Office-Dateien nutze Community-Plugins wie Pandoc Plugin / Docxer / Md Importer / Office Reader.

**Übergreifende Infrastruktur:**

- **🗄️ Begrenzter Cache** — `.obsidian/plugins/karpathywiki/pdf-cache/` speichert konvertiertes Markdown, verschlüsselt nach Content-Hash + Modell + Converter-Version; 100 MB gesamt / 1000 Einträge / 10 MB Einzel-Limit mit LRU-by-mtime-Eviction.
- **📝 Optionaler Vault-Sidecar** — Einstellungen → Wiki Configuration → Wiki Folder → *Write PDF Markdown to Vault* schreibt `<basename>.pdf.md` neben die Quell-PDF (standardmäßig aus — Nur-Cache ist der Standard).
- **🛡️ Verbatim-Transcriber-Prompt** — OCR-artige Konvertierung mit `[illegible]` / `[figure: ...]`-Anti-Halluzinations-Markern; Markdown-Fence-Einschluss von kleinen lokalen Modellen wird vor dem Cache-Schreiben automatisch bereinigt.
- **🔁 Source-Page-Verbatim-Zitate (v1.27.0, #496)** — jede generierte `sources/<slug>.md`-Seite trägt jetzt einen `Mentions in Source`-Abschnitt, der aus denselben wortgetreuen Zitaten aufgebaut ist, die die Extraktion pro Entity/Concept erfasst hat (jener Prosatext, den das Modell bereits bewiesenermaßen sehen konnte), sodass das zugrundeliegende Dokument die einzige Wiki-Seite mit einer echten, geerdeten Spur zurück zum Quelltext ist.

📖 **Vollständige Einrichtungsanleitungen** für alle Pfade (Cloud-Provider, oMLX-Hardware-Stufen, MinerU-Installation, Cache-Housekeeping) → [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 Abfrage & Wartung

- **🧭 5-Stufen-PPR-Kaskade** — siehe [Wie die Suche funktioniert](#-wie-die-suche-funktioniert). Personalized PageRank über `[[wiki-link]]` liefert graph-bewussten Multi-Hop-Kontext.
- **🪟 Rechts angedocktes Seitenpanel** — Query Wiki öffnet sich in einem Copilot-artigen rechten Sidebar-Blatt (v1.22.1+) statt einem zentrierten Modal.
- **🔍 Lint-Gesundheitsscan** — ein einziger Befehl erfasst: Duplikate, tote Links, leere Seiten, verwaiste Seiten, fehlende Aliase, Widersprüche.
- **⚡ Smart Fix All** — One-Click-Reparatur in kausaler Reihenfolge: Aliase ergänzen → Duplikate zusammenführen → tote Links reparieren → verwaiste Seiten verlinken → leere Seiten erweitern, mit Phasenbericht.
- **🆕 Fix Dead Links „Leave-it"-Ergebnis (v1.27.0, #485)** — Einstellungen → Advanced → *Create Stubs for Unresolvable Links* (standardmäßig AN) lässt dich leere Platzhalter-Seiten abwählen: ist die Option aus, bleibt der tote Link in jedem Lint-Bericht sichtbar, bis eine echte Quelle ihn definiert, und Ingest legt Seiten über den normalen Weg an. Das never-LLM-expand-Gate aus #197 bleibt unverändert — die neue Steuerung regelt nur, ob die Stub-Seite überhaupt *geschrieben* wird.
- **📊 Betriebsverlaufs-Panel** — durchsuchbare, filterbare UI für vergangene Aufnahmen, Lint-Berichte und Wartungsläufe.
- **🛡️ Pre-Ingest-Gate** — leere/Whitespace-/Nur-Frontmatter-Notizen werden vor jedem LLM-Aufruf abgelehnt; Content-Hash-Dedup erkennt identische Dateien über Pfade hinweg.
- **🆕 Ingest-Candidate-Gate (v1.27.0, #514 / PR #521)** — Opt-in-Toggle (`skipMentionOnlyCandidates`, standardmäßig aus, Einstellungen → Advanced). Für Quellen, deren Sprache ein gemessenes Profil hat (de gemessen; en/fr/es/pt/nl/ko geschätzt mit gepinnten Edge-Cases; zh/ja Schwellenwerte für Zeichensprachen ungemessen), werden Kandidaten, die nur innerhalb von Klammern / Aufzählungen / kurzen Listen-Items vorkommen, aussortiert, bevor sie eine Seite plus Dedup- und Generierungs-Aufrufe kosten. Sprachübergreifende Notizen werden nicht gegated; Wiki-Sprachen ohne Profil melden sich einmal pro Ingest und überspringen nie stillschweigend.
- **🆕 Per-Step-Task-Policies (v1.27.0, #525 / #490)** — LLM Advanced → Task Policies-Feld; überschreibt die Per-Step Text-Mode/Thinking-Einstellung ohne Code-Änderungen. Die eingebaute Baseline bleibt für nicht gelistete Steps unangetastet.

### 🔒 Privatsphäre

- **🚫 Kein Backend, kein Tracking, keine Analysen.** Läuft vollständig innerhalb von Obsidian. Netzwerk wird nur für die Kommunikation mit dem von dir konfigurierten LLM-Anbieter genutzt.
- **📁 Quelldateien sind schreibgeschützt.** Das Plugin ändert niemals deine ursprünglichen Vault-Notizen — es erstellt nur neue Seiten unter `wiki/`.
- **🦙 Vollständiger lokaler Modus.** Ollama, LM Studio oder ein beliebiger lokaler OpenAI-kompatibler Endpunkt → deine Notizen verlassen niemals deinen Rechner.
- **🔐 Minimale Berechtigungen.** Vault-Dateizugriff für die Wiki-Verwaltung. Zwischenablage-Zugriff nur, wenn du auf die Schaltfläche „Kopieren" im Abfrage-Modal klickst.

### 🦙 Lokal-first

- **🖥️ Ollama, LM Studio, OpenRouter, eigener Endpunkt** — sofort einsatzbereit. Lokale Modelle funktionieren für Abfragen (kleinere Kontextfenster); Ingest in einem 2.000-Seiten-Vault benötigt normalerweise ein Cloud-Modell mit langem Kontext.
- **📄 PDF-OCR-Pfad ist auf Apple Silicon vollständig lokal** — siehe [Dokument- / PDF- / Bild-Ingest](#-dokument---pdf---bild-ingest) oben.
- **🔐 ChatGPT Plan (Codex OAuth)** — Desktop-Loopback oder Mobil-Gerätecode; Anmeldeinformationen leben nur in Obsidian SecretStorage. (Siehe [Anthropic vs. OpenAI vs. Codex OAuth — es sind unterschiedliche Anbieter](#-anthropic-vs-openai-vs-codex-oauth--es-sind-unterschiedliche-anbieter) unten für die vollständige Provider-Grenzen-Erklärung.)

### 🌐 Sprache

- **🌍 11 UI-Sprachen** — English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano, Русский. UI und Wiki-Ausgabesprache sind unabhängig — dein Wiki kann auf Chinesisch sein, während die Oberfläche auf Englisch ist.
- **📚 10 Wiki-Ausgabesprachen** — dieselbe Auswahl; wähle in Einstellungen → Wiki Configuration. *Custom Input*-Option für Ad-hoc-Prompts.
- **Alle UI-Strings pro Locale übersetzt** — jedes Label, Modal und jeder Hinweis. Eine 12. Sprache hinzuzufügen ist beitragsgesteuert (PR #159-Muster).

---

## 🌐 Ökosystem

Das Plugin ergänzt sich mit dem Rest Ihres Obsidian-Stacks — jedes der folgenden Tools bindet sich ohne Code-Änderungen in den `[[wiki-link]]`-Graphen ein.

- **📄 [MinerU Multi-Format-Backend](https://mineru.net/apiManage/docs) (integriert seit v1.27.0)** — was früher ein separater CLI-/UI-Schritt war, ist jetzt ein Plugin-Schalter; die vollständige Pfadtabelle findest du unter [Dokument- / PDF- / Bild-Ingest](#-dokument---pdf---bild-ingest). Der [MinerU-Onlinedienst](https://mineru.net/OpenSourceTools/Extractor) bleibt für Nutzer verfügbar, die eine schnelle UI einem API-Token vorziehen; [MinerU selbst hosten](https://github.com/opendatalab/mineru) ist ebenfalls eine Option.
- **🕸️ Obsidian Graph View** — öffnen Sie die native Graphenansicht auf jeder Wiki-Seite; jeder `[[wiki-link]]` wird zu einem Knoten, jeder Backlink zu einer Kante. Bereits eingebaut, null zusätzliche Bundle-Größe.
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** — offizielle Browser-Erweiterung. Speichern Sie Webseiten (Artikel, Blogbeiträge, Reddit-Threads, Hacker News, Rezepte, Forschungsarbeiten, YouTube-Transkripte via Interpreter) in einem beliebigen Ordner Ihres Vaults und führen Sie anschließend den Plugin-Befehl „Aus Ordner aufnehmen" aus, um Entitäten und Konzepte stapelweise zu extrahieren.
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** — durchsuchen Sie das Wiki wie eine Datenbank mit DQL (`LIST FROM "wiki/entities" WHERE contains(tags, "person")`) oder der JS-API. Das Plugin schreibt standardmäßige Frontmatter (`tags:`, `type:`, `aliases:`) auf jede Seite, sodass Dataview-Abfragen sofort funktionieren.
- **🌿 Git** — versionieren Sie Ihren Vault (mit jedem Git-Client). Das Plugin überschreibt niemals Ihre Quelldateien; es legt nur neue Seiten unter `wiki/` an, sodass `git diff` klar zwischen Ihren Änderungen und vom LLM erzeugten Inhalten trennt.
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** — verwandeln Sie jede Obsidian-Notiz über Marp-Frontmatter (`marp: true`) in einen Foliensatz. Wiki-Seiten sind reines Markdown und rendern ohne zusätzliche Konvertierung als Folien.
- **🖼️ Canvas** — Obsidians native, unendliche Leinwand. Platzieren Sie Wiki-Karten auf einer Canvas, um Lernhilfen, Mindmaps oder Forschungsübersichten aus `[[wiki-links]]` zusammenzustellen — ohne den Vault zu verlassen.
- **🎤 [Obsidian Nous](https://github.com/AndyMDH/obsidian-nous)** — Begleit-Plugin für lokale Sprachmemo- und Meeting-Erfassung (whisper.cpp auf macOS; Audio verlässt das Gerät nicht). Erzeugt sprecherbeschriftete Transkripte und eigene Wiki-Hub-Seiten. Unabhängig von diesem Plugin — beide können dasselbe Vault ohne Kopplung nutzen.

---

## 🧰 Headless-CLI

**Die meisten Nutzer können diesen Abschnitt überspringen.** Die nutzerseitige CLI des Plugins liegt im Schwester-Repo [green-dalii/obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli) — Installation mit `npm i -g karpathywiki-cli`, dann `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`.

Was in diesem Repo unter `tools/dev-instrument/` liegt, ist das **reine Dev-Messinstrument** für Engine-Mitarbeiter — es führt den echten `WikiEngine.ingestSource` ohne Obsidian-Runtime gegen einen Vault auf der Festplatte aus, gibt pro Task Token- und Wall-Clock-Abrechnung aus — dieselben Zahlen, die die Performance-Belege in CLAUDE.md und den Release Notes liefern. Siehe [`tools/dev-instrument/README.md`](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/tools/dev-instrument/README.md) für Entry-Command, Env-Variablen, Mess-Modi und Exit-Code-Spezifikation.

---

## 🔍 Wie die Suche funktioniert

Die meisten „KI-Suche"-Plugins fragmentieren deine Notizen in Chunks und betten sie in eine Vektor-DB ein. Wir nicht. [Karpathys Argument gegen RAG](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) ist, dass Chunking die Fähigkeit des LLM bricht, über deinen gesamten Wissensgraphen hinweg zu reasoning — und dieses Argument bestätigt sich in der Praxis. Stattdessen durchlaufen wir den Graphen, den du bereits pflegst, indem du `[[wiki-links]]` schreibst.

### Die 5-Stufen-Seed-Selektions-Kaskade

Wenn du fragst „Wer hat Microsoft gegründet?", durchläuft Query Wiki fünf Stufen, bevor eine Antwort generiert wird:

1. **Lex-Schnellpfad** — direkter Token-Überlappungs-Check gegen jeden Entity-/Concept-Titel und alle Aliase. Kostenlos, sofort und das Tor für alles, was danach kommt.
2. **LLM-Keyword-Generierung** — das LLM schlägt 8–12 sprachübergreifende Keywords aus deiner Abfrage vor (behandelt Synonyme, Abkürzungen und token-resistente Begriffe in einem LLM-Aufruf).
3. **Lokaler Substring-Scan** — jedes generierte Keyword wird lokal erneut gegen Seitentitel, Aliase und Body-Ausschnitte gematcht. Kein zusätzlicher LLM-Aufruf; rundet die rauschtolerante Trefferquote ab.
4. **LLM-KB-Fallback** — wenn Lex + Keyword-Scan schwache Signale liefern, führt das LLM einen semantischen Durchlauf gegen das gesamte Wiki durch, um die Top-N-Kandidaten neu zu seeden.
5. **PPR-Graph-Expansion** — Personalized PageRank (Haveliwala 2002) über dem `[[wiki-link]]`-Graphen, startend von der Kandidaten-Seed-Menge. Dies liefert graph-bewussten Multi-Hop-Kontext: „Bill Gates" → „Microsoft" → „Wettbewerber", nicht nur wörtliche Titelüberlappung.

Die Kaskade bricht ab, sobald die erreichte Stufe genug Signal geliefert hat — keine fixen 5-Stufen-Kosten; keine LLM-Aufrufe wenn Lex ausreicht; semantischer Fallback nur, wenn Lex + Keyword-Scan allein nicht reicht.

### Personalized PageRank in großem Maßstab

Wir verwenden Monte-Carlo-PPR (Fogaras 2005) — 3.000 zufällige Walks × 50 Schritte — mit der Dead-End-Regel von Haveliwala 2002. Die Kosten sind **O(K × L)** (K = Walks, L = Schritte pro Walk), unabhängig von der Seitenzahl, sodass ein 2.000-Seiten-Vault die gleiche Expansionslatenz wie ein 200-Seiten-Vault hat.

**PPR @5 = 27,1 % vs. reine-kNN-Baseline 24,1 %** auf dem projekteigenen Benchmark-Korpus (dem einzigen veröffentlichten Such-Benchmark in diesem Open-Source-LLM-Wiki-Bereich).

### Warum keine Embeddings

Wir haben den Embedding-Pfad in [Issue #175](https://github.com/green-dalii/obsidian-llm-wiki/issues/175) bewusst abgelehnt. Das Graph-Signal ist bereits vorhanden — jeder `[[wiki-link]]` ist eine handkuratierte „diese sind verwandt"-Kante, und die meisten unserer unterstützten Anbieter (Ollama, LM Studio, Anthropic, Bedrock, Kimi, GLM, MiniMax) haben gar keinen `/v1/embeddings`-Endpunkt. Das Hinzufügen eines Embedding-Modells würde einen Download pro Seite, einen Adapter pro Anbieter und null Nutzen für die Suchqualität bedeuten.

---

## 🤖 Modelle

**Unterstützte Anbieter (16+, alle geprüft gegen models.dev 2026-07):**

| Anbieter | Serie | Hinweise |
|----------|-------|----------|
| **Anthropic** | Claude 5-Serie | Nativer PDF-Support; `/v1/messages`-Protokoll |
| **OpenAI** | GPT-5.6-Serie (Sol / Terra / Luna) | Nativer PDF-Support; Platform-API-Key |
| **Google Gemini** | Gemini 3.6-Serie | Nativer PDF-Support (Datei-Parts seit 1.5); OpenAI-kompatibler Endpunkt |
| **DeepSeek** | DeepSeek V4-Serie | OpenAI-kompatibel; günstigste Kostenstufe |
| **Alibaba Qwen** | Qwen3.7/3.8-Serie | OpenAI-kompatibel (DashScope) |
| **xAI Grok** | Grok 4-Serie | OpenAI-kompatibel; langer Kontext |
| **Moonshot Kimi** | Kimi K3-Serie | OpenAI-kompatibel; 2,8T MoE Frontier |
| **Zhipu GLM** | GLM-5-Serie | OpenAI-kompatibel; stark zweisprachig |
| **MiniMax** | MiniMax M3-Serie | OpenAI-kompatibel; 1M Kontext |
| **Step (阶跃星辰)** | Step 3-Serie (Flash) | OpenAI-kompatibel; schnelle Inferenz |
| **Tencent Hunyuan** | Hy3-Serie | OpenAI-kompatibel; Open-Weight MoE |
| **Xiaomi MiMo** | MiMo V2.5-Serie | MIT Open-Source; Flat-Pricing |
| **Google Gemma** | Gemma 4-Serie | Open-Weight; 262K Kontext |
| **AWS Bedrock** | Anthropic + OpenAI-Varianten | VPC/Compliance-Pfad; **API key + SSO + IAM** (v1.27.0, #425) |
| **ChatGPT Plan (Codex OAuth)** | Codex Responses API | Browser-/Gerätecode-Anmeldung; SecretStorage |
| **Lokal: Ollama, LM Studio, OpenRouter, Anthropic-Compatible** | Jedes OpenAI-/Anthropic-Protokoll-Modell | Custom OpenAI-Compatible + Anthropic-Compatible (Token Plan / Coding Plan) |

Dieses Plugin füttert dem LLM pro Abfrage den gesamten Wiki-Kontext — daher gewinnen **Modelle mit langem Kontextfenster**. Die vollständige Tabelle (Cloud + Lokal) befindet sich in [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md), geprüft gegen [models.dev](https://models.dev/), damit die Empfehlungen aktuell bleiben.

### Was zählt

- **🧠 Kontextfenster ≥ 200K Tokens** für Vaults über ~500 Seiten. Unter 200K kann die Kaskade frühere Stufen weglassen, um zu passen.
- **⚖️ Instruction-Following-Qualität** ist für die Extraktionsaufgabe wichtiger als roher IQ — wähle ein Modell, das der Schema-Vorlage folgt, nicht die größte Leaderboard-Zahl.
- **🔌 Embedding-Endpunkt ist irrelevant** — wir verwenden keine Embeddings. Ein Anbieter ohne `/v1/embeddings` ist in Ordnung (die meisten unserer 16+ Anbieter bieten keinen an).
- **🦙 Lokal für Abfragen, Cloud für Ingest** — Ingest in einem 2.000-Seiten-Vault benötigt normalerweise ein Cloud-Modell mit langem Kontext; ein 262K-lokales Modell deckt die meisten Abfragen ab.

### Anthropic vs. OpenAI vs. Codex OAuth — es sind unterschiedliche Anbieter

- **Anthropic** (und seine Bedrock-Variante) — separat abgerechneter Anthropic-Platform-API-Key.
- **OpenAI** — separat abgerechneter OpenAI-Platform-API-Key.
- **ChatGPT Plan (Codex OAuth)** — experimenteller, eigenständiger Anbieter, der nach Browser- oder Gerätecode-Anmeldung berechtigtes Codex-Kontingent nutzt; die Verfügbarkeit folgt den OpenAI-Codex-Authentifizierungs- und Kontingentrichtlinien, nicht dem Plannamen. Drittanbieter-Codex-Kompatibilität, keine OpenAI-Partnerschaft oder allgemeine ChatGPT-API.

### AWS Bedrock — drei Auth-Modi (v1.27.0, #425)

Einstellungen → Provider → Bedrock (Anthropic / OpenAI) wählt jetzt einen von drei Auth-Modi; die Provider-Zeile fragt dann nach den Inputs, die dieser Modus tatsächlich braucht:

- **API key** — der ursprüngliche Stage-1-Bearer-Pfad; das Verhalten ist byte-für-byte identisch zu v1.26.4 und die empfohlene Wahl für Nutzer, die bereits einen Bedrock-API-Key bezahlen.
- **SSO** — IAM Identity Center Device Flow. Klicke *Sign in with AWS SSO*, füge den Verifikations-URL-Code im Browser ein, das Plugin erhält ein SSO-Token über `karpathywiki-bedrock-sso` in SecretStorage, tauscht es gegen temporäre Rollen-Anmeldeinformationen und signiert jede Anfrage mit handgeschriebenem SigV4 (kein AWS-SDK hinzugefügt). Account-ID und Rollenname werden automatisch erkannt, wenn die SSO-Identität genau eine von jeder exponiert; sonst trage sie in den Provider-Einstellungen ein.
- **IAM** — statische Access-Keys für Umgebungen ohne SSO (CI, geplante Batch-Jobs). Gespeichert in `karpathywiki-bedrock-iam` in SecretStorage; der In-Memory-Cache memoisiert per Access-Key, um SigV4-Signing innerhalb der Ablauffrist zu halten.

Alle drei Modi teilen dieselbe Obsidian-SecretStorage-Disziplin (keine Anmeldeinformationen in `data.json`, Logs oder Docs) und denselben Zero-AWS-SDK-Pfad aus handgeschriebenem OIDC + SigV4. Die Bedrock-Region ist unabhängig vom Auth-Modus und wird in derselben Provider-Zeile konfiguriert.

> 📖 **Vollständige Auswahltabelle** (Cloud + Lokal + PDF-OCR + Codex OAuth + Quantisierung + Hardware-Stufen) → [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

---

## ❓ FAQ

### Was macht das Plugin genau?

Wähle eine beliebige Notiz, einen Ordner oder eine Auswahl; der LLM extrahiert Entitäten und Konzepte und generiert ein vernetztes Wiki mit `[[bidirektionalen Links]]`. Stelle Fragen und erhalte Antworten aus *deinen* Notizen — nicht aus dem Internet. Deine ursprünglichen Vault-Notizen werden nie verändert.

### Wie fange ich an?

Aus Obsidian Community-Plugins installieren → Provider wählen → **Test Connection** → **Ingest single source** auf einer beliebigen Notiz ausführen. Erste Wiki-Seiten erscheinen innerhalb von Sekunden. Siehe [Schnellstart](#-schnellstart).

### Ist mein bestehendes Wiki sicher?

✅ Rückwärtskompatibel seit v1.0.0. Setze `reviewed: true` auf einer Seite, um sie vor Überschreiben zu schützen. Das Upgrade von v1.24.x überschreibt deinen Vault nicht; der PDF-Ingest von v1.25.0 ist standardmäßig Nur-Cache, und v1.27.0 ergänzt nativen PDF- + Bild- + Office-Ingest, ohne das Wiki-Layout auf der Festplatte zu verändern.

### Kann ich PDFs, Bilder und Office-Dokumente ingestieren?

✅ Ja. Anthropic, OpenAI, Bedrock und Gemini lesen PDFs nativ; das integrierte MinerU-Backend (v1.27.0) deckt alles andere ab (PDF + Bilder + Office). Vollständige Anleitung — Cloud-Provider, Apple-Silicon-OCR, Force PDF Support, Cache-Housekeeping — in [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md).

### Werden meine Daten an Dritte gesendet?

🚫 Kein Backend, keine Analysen — das Plugin läuft vollständig in Obsidian. Nur Text, den du explizit zum Aufnehmen/Abfragen sendest, verlässt dein Gerät, und nur an den von dir konfigurierten LLM-Anbieter. Für vollständige Datenlokalität verwende Ollama oder LM Studio.

### Kann ich das Plugin in meiner Sprache nutzen?

🌍 11 Sprachen für sowohl UI als auch Wiki-Ausgabe. UI- und Wiki-Sprache sind unabhängig voneinander. Das Hinzufügen einer 12. Sprache ist beitragsgesteuert (PR #159-Muster).

### Worin unterscheidet sich das von einem RAG-Chatbot?

🚫 Kein Chunking. 🚫 Keine Embeddings. 🚫 Keine Vektor-DB. ✅ Personalized PageRank über deinen bestehenden `[[wiki-link]]`-Graphen — graph-bewusster Multi-Hop-Kontext, null Embedding-Kosten, vollständige Unterstützung lokaler Modelle.

### Welchen LLM soll ich wählen?

Modelle mit langem Kontext (≥200K Tokens) funktionieren am besten. Der Abschnitt [Modelle](#-modelle) erklärt die Prinzipien; die vollständige Tabelle befindet sich in [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md).

### Gibt es einen veröffentlichten Benchmark?

Ja — PPR @5 = 27,1 % vs. reine-kNN-Baseline 24,1 % auf dem projekteigenen Korpus. Die vollständige Pipeline und das Benchmark-Skript sind beschrieben unter [Wie die Suche funktioniert](#-wie-die-suche-funktioniert).

### Wie kontrolliere ich API-Kosten?

Verwende Grobe oder Minimale Extraktionsgranularität für Batch-Aufnahme. Smart Batch Skip erkennt bereits verarbeitete Dateien automatisch. Auto-Maintenance ist standardmäßig AUS. Lint zeigt Anzahl an, bevor Reparaturen ausgeführt werden — nichts wird ohne deine Zustimmung berechnet.

### Wie breche ich einen laufenden Vorgang ab?

Klicke auf die Statusleiste (zeigt „Ingesting… click to cancel") oder `Cmd+P/Ctrl+P` → „Cancel current ingestion". Stoppt sauber an der nächsten Batch-Grenze.

### Wo bekomme ich Hilfe?

[GitHub Issues](https://github.com/green-dalii/obsidian-llm-wiki/issues) für Fehlermeldungen · [GitHub Discussions](https://github.com/green-dalii/obsidian-llm-wiki/discussions) für Fragen und Funktionswünsche · Entwicklerkonsole (`Ctrl+Shift+I` / `Cmd+Option+I`) für Plugin-Logs.

---

## 🔒 Privatsphäre

Dieses Plugin ist im Obsidian Community Plugin Market gelistet und wird einer automatisierten Überprüfung auf Sicherheit und Berechtigungen unterzogen.

- **🚫 Kein Backend, kein Server, keine Datenerfassung.** Reine lokale Software, die innerhalb von Obsidian läuft. Das Plugin kann und wird deine Daten auf keine Weise sammeln, speichern oder an irgendeinen Server übertragen — weil ein solcher Server nicht existiert.
- **🔐 Netzwerkzugriff ist optional.** Wird nur für die Kommunikation mit dem von dir konfigurierten LLM-Anbieter verwendet. Du wählst den Anbieter, du gibst den API-Key ein, du entscheidest, wohin deine Daten gehen.
- **📁 Vault-Dateizugriff** wird für die Wiki-Verwaltung verwendet (Lesen von Notizen, Generieren von Seiten, Scannen auf tote Links, Erkennen von Duplikaten). Das Plugin ändert niemals deine Quelldateien.
- **📋 Zwischenablage-Zugriff** wird ausschließlich von der Schaltfläche „Kopieren" im Abfrage-Modal verwendet — und nur, wenn du darauf klickst.

Für vollständige Datenlokalität verwende Ollama oder LM Studio. Mit einem lokalen Anbieter verlassen deine Daten niemals deinen Rechner.

---

## 💖 Unterstützung

Wenn LLM-Wiki zu einem wichtigen Teil deines Wissens-Workflows geworden ist:

- ☕ **[Kauf mir einen Kaffee auf Ko-fi](https://ko-fi.com/greenerdalii)** — einmalig oder monatlich
- 💳 **[Trinkgeld via PayPal](https://paypal.me/greenerdalii)** — einmaliges Trinkgeld

Dank an die Folgenden für die Unterstützung des Projekts:

[@jameses-cyber](https://github.com/jameses-cyber), [@issaqua](https://github.com/issaqua), Dikson Choi

---

## 🔭 Weitere Projekte

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — die Headless-Ingest-CLI, als Schwester-Repo veröffentlicht und als npm-Paket `karpathywiki-cli` ausgeliefert. Führt dieselbe `WikiEngine` gegen einen Vault auf der Festplatte aus, ohne Renderer. Installation mit `npm i -g karpathywiki-cli`. Das In-Tree-Verzeichnis `tools/dev-instrument/` ist das reine Dev-Messinstrument, das die pro-Task-Kostenzahlen für die Release Notes dieses Plugins liefert.
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — ein Router auf Aufgabenebene für [pi-coding-agent](https://github.com/earendil-works/pi). Vor jedem Zug stuft ein kleiner LLM-Judge deine Nachricht als Routine oder als folgenreich ein, und die gewählte Stufe erledigt den ganzen Zug. Bei komplexen Aufgaben geht es weiter: Die Smart-Stufe arbeitet als CTO, plant die Arbeit, delegiert die Umsetzung an Fast-Subagents, prüft jedes Ergebnis und iteriert. Hochstufen passiert sofort, Herunterstufen erst bei anhaltendem Trend; Fallback-Ketten pro Stufe fangen 429 und 5xx ab. Keine Runtime-Abhängigkeiten, MIT. → [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — DSH-Fork des pi-shift-router, teilt dasselbe task-level Routing-Design, ist aber auf die [dsh-coding-agent](https://github.com/earendil-works/dsh)-Laufzeitumgebung zugeschnitten. Dieselben judge-gesteuerten Stufenwahlen, dieselben Fallback-Ketten pro Stufe, MIT.
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — DSH-Pendant zum `obsidian-plugin-dev`-Workflow (Claude-seitig): richtet einen Obsidian-Plugin-Workspace ein, treibt die Red→Green-TDD-Schleife, führt die Six-Gate-Qualitätskontrolle (lint/tsc/test/build/css-lint) aus und bereitet einen release-fähigen Branch auf `feat/*` oder `fix/*` vor. Gebaut, damit DSH-Nutzer dieselbe Scaffolding- + Gate-Erfahrung bekommen, ohne aus CLAUDE.md zu kopieren.

---

## 📜 Lizenz & Danksagungen

Apache License, Version 2.0 — siehe [LICENSE](../LICENSE) und [NOTICE](../NOTICE).

**Basiert auf:**
- 💡 [Andrej Karpathys LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — das ursprüngliche Konzept
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v6](https://ai-sdk.dev/) (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) via Obsidian `requestUrl`
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) und [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — Suchalgorithmen

**Betreuer:** [@green-dalii](https://github.com/green-dalii)

[![Star History Chart](https://api.star-history.com/chart?repos=green-dalii/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)