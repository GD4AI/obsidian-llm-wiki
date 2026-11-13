<!--
SEO metadata (not user-visible, parsed by crawlers / LLMs):
- name: karpathy-llm-wiki-plugin-for-obsidian
- type: software / Obsidian community plugin / knowledge-base generator / RAG alternative
- license: Apache-2.0
- language: TypeScript
- runtime: Obsidian >= 1.11.4 (desktop + mobile)
- dependencies: zero runtime dependencies (Vercel AI SDK v7 bundled)
- obsidian-plugin-id: karpathywiki
- obsidian-marketplace: https://community.obsidian.md/plugins/karpathywiki
- repo: https://github.com/GD4AI/obsidian-llm-wiki
- sister-cli-repo: https://github.com/green-dalii/obsidian-llm-wiki-cli
- docs: README.md + docs/README_<locale>.md (11 locales) + docs/MODEL-GUIDE.md + docs/PDF-OCR-GUIDE.md
- first-published: 2025-09 (v0.1.0)
- latest: v1.31.0
- release-notes: https://github.com/GD4AI/obsidian-llm-wiki/releases
- previous: v1.30.0 (MINOR — eine Token-Obergrenze für den Antwortkontext, Extraction Focus in den Einstellungen und ein Bericht über kristallisierte Hubs)
- last-updated: 2026-11-12
- alternate-names: Karpathy LLM Wiki, LLM Wiki Obsidian, Obsidian wiki plugin, graph-based RAG, no-embedding RAG, Personalized PageRank retrieval, Obsidian second brain
- search-intents: "Obsidian RAG without embeddings", "Obsidian wiki plugin", "Personalized PageRank Obsidian", "graph-based note retrieval", "Karpathy LLM Wiki implementation", "Obsidian knowledge base auto-generation", "Obsidian graph view + AI", "Obsidian second brain plugin", "Obsidian note link graph AI", "Obsidian plugin 11 languages", "Obsidian plugin 15 LLM providers", "no-vector-DB RAG", "Obsidian PDF ingest AI", "Obsidian Codex OAuth", "Obsidian Bedrock plugin", "Obsidian Bedrock SSO", "Obsidian MinerU", "Obsidian Word PPT Excel ingest", "Obsidian IAM credentials"
- features: graph-based retrieval, Personalized PageRank (Haveliwala 2002), Monte Carlo PPR (Fogaras 2005), 5-stage seed-selection cascade, Tier 1/Tier 2 duplicate detection, 11-language UI + 11-language wiki output (independent), 15+ LLM providers (Anthropic, OpenAI, Bedrock [API key + SSO/IAM], Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, Codex OAuth), MinerU multi-format ingest (PDF + images + Office), PDF ingest (cache-only, OCR paths), lint health scan, Smart Fix All, source-page verbatim quotes, ingest candidate gate, per-step taskPolicies UI, Obsidian Graph View integration, zero-embedding zero-vector-DB architecture, local-first mode
- direct-competitors: nashsu/llm_wiki (Tauri desktop app), SamurAIGPT/llm-wiki-agent (Claude Code / Codex / OpenCode / Gemini CLI skill), atomicstrata/llm-wiki-compiler (TypeScript CLI, chunk-based retrieval)
- retrieval-benchmark: PPR @5 = 27.1% vs pure-kNN 24.1% (ein Korpus aus einem Projekt-Vault, kein öffentlicher Benchmark-Datensatz)
- author: green-dalii / Greener-Dalii (https://github.com/green-dalii)
- co-maintainer: DocTpoint (https://github.com/DocTpoint)
- canonical: https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md
-->

![Karpathy LLM Wiki Plugin-Banner — ein Netz aus verbundenen Wiki-Seiten, aufgebaut aus deinen Obsidian-Notizen](assets/llm_wiki_banner.webp)

# 🧠 Karpathy LLM Wiki Plugin für Obsidian

> Ein Obsidian-Plugin, das deine Notizen in eine vernetzte, abfragbare Wissensbasis verwandelt — die Idee des [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), eingebaut in den Editor, in dem du ohnehin schreibst.

**Obsidian-Review mit voller Punktzahl • Null-Embedding-Graph-Suche • 11 Sprachen nativ • Nativer PDF-, Bild- und Office-Ingest • Läuft mit jedem Anbieter • Lokal zuerst • Kein Backend • DSGVO-freundlich**

![Version](https://img.shields.io/github/v/release/GD4AI/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-15%2B-cyan?style=flat-square) <br>
![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml)

[English](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_CN.md) | [繁體中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_KO.md) | **Deutsch** | [Français](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_FR.md) | [Español](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ES.md) | [Português](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_PT.md) | [Italiano](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_IT.md) | [Русский](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[Offizielle Website](https://llmwiki.greenerai.top/) | [Obsidian-Marktplatz](https://community.obsidian.md/plugins/karpathywiki) | [Blog](https://llmwiki.greenerai.top/blog/) | [Diskussionen](https://github.com/GD4AI/obsidian-llm-wiki/discussions)

🤔 [Warum dieses Plugin?](#-warum-dieses-plugin) | 🚀 [Schnellstart](#-schnellstart) | ✨ [Funktionen](#-funktionen) | 🌐 [Ökosystem](#-ökosystem) | 🔍 [Wie die Suche funktioniert](#-wie-die-suche-funktioniert) | 🤖 [Modelle](#-modelle) | ❓ [FAQ](#-faq) | 🔒 [Privatsphäre](#-privatsphäre)

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD)

> Karpathy LLM Wiki ist kostenlos, selbst gehostet und hat kein eigenes Backend. Wenn es dir Zeit spart, hält ein einmaliger Kaffee die Wartung am Laufen — und ein ⭐ hilft genauso.

---

## 🤔 Warum dieses Plugin?

Du schreibst Notizen. Sie liegen in Ordnern. Um zu finden, was zusammengehört, musst du dich an Fäden erinnern, die du vor Monaten verloren hast.

**Es gibt andere Open-Source-Umsetzungen von Karpathys LLM-Wiki-Idee — aber keine davon ist ein Obsidian-Plugin für einen Klick.** Die meisten sind CLI-Tools, Claude-Code-Skills oder eigene Desktop-Apps. Dieses Plugin läuft in Obsidian: Graph View, Ribbon und Befehlspalette inklusive.

### Wie wir abschneiden

|  | **Karpathy LLM Wiki** (dieses Plugin) | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|
| **Bereitstellung** | ✅ Obsidian-Plugin, ein Klick | 🟡 Tauri-Desktop-App | 🟡 Skill für Claude Code / Codex / OpenCode / Gemini CLI | 🟡 TypeScript-CLI-Pipeline |
| **Abhängigkeiten** | ✅ Keine — nur das Plugin | 🟡 Python-Laufzeit + sqlite | 🟡 Claude-Code-/Codex-/OpenCode-Laufzeit | ❌ Embedding-Modell + Vektor-DB (laut deren Doku) |
| **i18n (UI + Wiki-Ausgabe)** | ✅ 11 Sprachen | 🟡 EN / 中文 | ❌ Nur EN | ❌ Nur EN |
| **LLM-Anbieter** | ✅ 15+ (Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, Anthropic-kompatibel, …) | 🟡 OpenAI-kompatibel | 🟡 Abo über Claude Code / Codex | 🟡 OpenAI-kompatibel |
| **Suche und Abfrage-Pipeline** | ✅ **PPR + Monte Carlo** über den `[[wiki-link]]`-Graphen | 🟡 2-Hop-Decay (4-Signal-Heuristik) | 🟡 Louvain-Community-Erkennung | 🟡 BM25 + semantisch über Chunks |
| **Graph-Visualisierung** | ✅ Obsidians nativer Graph View (eingebaut, keine zusätzliche Bundle-Größe) | 🟡 Eigenes sigma.js + graphology in der Desktop-App | 🟡 vis.js `graph.html` (separate Datei) | ❌ Browser-Viewer ohne Schreibzugriff |
| **Ingest-Formate** | ✅ **Markdown + PDF + Bilder + Office (DOCX/PPTX/XLSX)** — ein Schalter wechselt zwischen nativem PDF (Anthropic / OpenAI / Bedrock / Gemini) und dem eingebauten MinerU-Backend für mehrere Formate | 🟡 Markdown + PDF | 🟡 Nur Markdown und Codedateien | 🟡 Nur Markdown |

### Drei Dinge, die wir bewusst gewählt haben

- **🪟 Obsidian ist die Laufzeit.** Kein Terminal, keine separate App, kein Docker, kein Python. Aus den Community-Plugins installieren, auf Aufnehmen klicken, und das Wiki lebt ab der ersten Sekunde in deinem Vault. Obsidians nativer Graph View rendert deinen `[[wiki-link]]`-Graphen — eingebaut, ohne zusätzliche Bundle-Größe.
- **🧭 Sauber und autark.** Keine Abhängigkeiten: kein Embedding-Modell, keine Vektor-Datenbank, kein pip-Paket. Ein einziges Plugin liest deine Notizen, spricht mit einem LLM und schreibt Seiten in deinen Vault.
- **🔌 Jedes Modell, für das du ohnehin bezahlst.** Anthropic, Bedrock, OpenAI, ChatGPT Plan (Codex OAuth), Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-kompatibel, eigener Endpunkt — mehr als fünfzehn Anbieter, und keiner davon braucht einen Embedding-Endpunkt.

### Für wen es gedacht ist

- **Du willst in fünf Minuten eingerichtet sein.** Aus den Community-Plugins installieren → Anbieter wählen → eine Notiz aufnehmen. Wiki-Seiten stehen in Sekunden in `wiki/`, ohne CLI, ohne Python und ohne Vektor-Datenbank, die du vorher aufbauen musst.
- **Du willst Antworten aus deinen eigenen Notizen,** und jede Antwort nennt die Seiten, aus denen sie stammt. Ollama oder LM Studio halten den ganzen Aufruf auf deinem Rechner.
- **Du schreibst oder liest in einer von 11 Sprachen.** Oberfläche und Wiki-Ausgabe sind unabhängig: ein chinesisches Wiki hinter einer englischen Oberfläche ist eine unterstützte Kombination.
- **Du willst Wartung mit einem Klick.** Lint-Gesundheitsscan und Smart Fix All halten Duplikate, tote Links und verwaiste Seiten in Schach, ohne dass du von Hand kuratierst.

**Dafür ist es nicht gedacht:** allgemeiner ChatGPT-Ersatz, RAG über fremde Korpora wie Confluence oder arXiv, gehosteter Dienst mit Team-Zusammenarbeit. Antworten kommen aus deinem Vault, die Aufnahme deckt ihn plus einzelne Dateien ab, und es gibt kein Backend, das du teilen könntest.

---

## 🚀 Schnellstart

**Voraussetzungen:** Obsidian 1.11.4 oder neuer, Desktop oder Mobil. Sonst nichts — kein Node, kein Python, kein Container. Dein eigener API-Schlüssel, oder ein lokales Modell ganz ohne Schlüssel. Anmeldeinformationen liegen in Obsidian SecretStorage; deshalb ist 1.11.4 die Untergrenze.

1. **Installieren.** Obsidian → Einstellungen → Community-Plugins → Durchsuchen → „Karpathy LLM Wiki“ suchen → Installieren → Aktivieren. Oder öffne die [Community-Plugin-Seite](https://community.obsidian.md/plugins/karpathywiki) und klicke auf **Zu Obsidian hinzufügen**.
   
   ![Karpathy LLM Wiki ist in Obsidians Liste der Community-Plugins installiert und aktiviert](assets/readme/readme-02-install.webp)
2. **Anbieter einrichten.** Einstellungen → Karpathy LLM Wiki → Anbieter wählen (OpenAI, Anthropic, Ollama, ChatGPT Plan (Codex OAuth) und weitere) → API-Schlüssel eintragen (bei lokalen Anbietern nicht nötig) → **Verbindung testen** → Speichern.
3. **Eine Notiz aufnehmen.** Zwei Wege:
   - **⌨️ Tastatur:** `Cmd+P/Ctrl+P` → „Einzelne Quelle aufnehmen“ → eine beliebige Markdown-Datei wählen (oder PDF, seit v1.25.0).
   - **🖱️ Symbol in der Werkzeugleiste:** Klicke auf das **Sticker-Symbol** im linken Ribbon von Obsidian, um die geöffnete Notiz sofort aufzunehmen — ohne Menüsuche.
   
   Deine ersten Wiki-Seiten erscheinen in Sekunden in `wiki/sources/`, `wiki/entities/` und `wiki/concepts/`.
   
   ![Links die Notiz, rechts die daraus erzeugte Seite — Eigenschaften, Beschreibung und verwandte Konzepte](assets/readme/readme-01-before-after.webp)
4. **Dein Wiki abfragen.** Zwei Wege:
   - **⌨️ Tastatur:** `Cmd+P/Ctrl+P` → „Wiki anfragen“.
   - **🖱️ Symbol in der Werkzeugleiste:** Klicke auf das **Sprechblasen-Symbol** im linken Ribbon von Obsidian.
   
   Ein rechts angedocktes Seitenpanel im Copilot-Stil öffnet sich, in dem du mit deinem Wiki chatten kannst. Antworten tragen `[[wiki-links]]` zurück in deinen Wissensgraphen.

![Eine Antwort von Query Wiki im rechts angedockten Seitenpanel; jede Aussage ist auf die Wiki-Seite verlinkt, aus der sie stammt](assets/readme/readme-07-query-citations.webp)

Das war es. Das Plugin ändert nichts an deinen ursprünglichen Notizen — es legt nur neue Seiten unter `wiki/` an. **Aufnehmen** und **Wiki anfragen** liegen beide im linken Ribbon und sind jederzeit mit einem Klick erreichbar. (`Cmd` auf macOS, `Ctrl` unter Windows und Linux.)

### Kernbefehle

| Befehl | Was er tut |
|---------|--------------|
| **📥 Einzelne Quelle aufnehmen** | `Cmd+P/Ctrl+P` → „Einzelne Quelle aufnehmen“ — wähle eine Markdown- oder **PDF-Datei (v1.25.0+)**, und du bekommst Entity-, Concept- und Wiki-Seiten. *Ebenfalls: 🖱️ Sticker-Symbol im Ribbon, wirkt auf die aktive Notiz.* |
| **📂 Aus Ordner aufnehmen** | `Cmd+P/Ctrl+P` → „Aus Ordner aufnehmen“ — jede Notiz eines Ordners stapelweise aufnehmen, mit intelligentem Überspringen |
| **📑 Mehrere Dateien aufnehmen** | `Cmd+P/Ctrl+P` → „Mehrere Dateien aufnehmen“ — eine Teilmenge über einen zweigeteilten Dateibaum wählen (mit Live-Warteschlange und Abbruch pro Datei) |
| **🔍 Wiki anfragen** | `Cmd+P/Ctrl+P` → „Wiki anfragen“ — chatte mit deinem Wiki in einem rechts angedockten Seitenpanel; Antworten tragen `[[wiki-links]]`. *Ebenfalls: 🖱️ Sprechblasen-Symbol im Ribbon.* |
| **🛠️ Wiki prüfen** | `Cmd+P/Ctrl+P` → „Wiki prüfen“ — vollständiger Gesundheitsscan: Duplikate, tote Links, leere Seiten, verwaiste Seiten, fehlende Aliase, Widersprüche |
| **⚡ Smart Fix All** | im Lint-Modal — Reparatur in kausaler Reihenfolge mit einem Klick, mit Bericht pro Phase |
| **📋 Index neu generieren** | `Cmd+P/Ctrl+P` → „Index neu generieren“ — baut `wiki/index.md` mit den aktuellen Seiten und Aliasen neu auf |
| **⏹ Abbrechen** | `Cmd+P/Ctrl+P` → „Aktuelle Aufnahme abbrechen“ oder Klick auf die Statusleiste — hält sauber an der nächsten Stapelgrenze an |
| **📊 Aufnahmeverlauf** | `Cmd+P/Ctrl+P` → „Ingestionsverlauf anzeigen“ — durchsuchbare Oberfläche für vergangene Aufnahmen, Lint-Berichte und Wartungsläufe |

![Alle Befehle von Karpathy LLM Wiki stehen in Obsidians Befehlspalette unter einem gemeinsamen Präfix](assets/readme/readme-03-commands.webp)

| Vorher | Nachher |
|--------|-------|
| `notes/machine-learning.md` (eine flache Datei) | `wiki/concepts/supervised-learning.md` mit `[[bidirektionalen Links]]`, Aliasen, Quellenangabe und einem Eintrag in `wiki/index.md` |

> 📖 Schritt-für-Schritt-Anleitungen in [GitHub Discussions → Guides](https://github.com/GD4AI/obsidian-llm-wiki/discussions/categories/guides). Hat es dir geholfen? [Gib dem Repo einen Stern](https://github.com/GD4AI/obsidian-llm-wiki), um Releases zu verfolgen.

---

## ✨ Funktionen

### 📚 Wissensqualität

- **🔍 Entity- und Concept-Extraktion** — das LLM zieht Entitäten (Personen, Organisationen, Produkte, Ereignisse) und Konzepte (Theorien, Methoden, Begriffe) in eigenständige Seiten. Die Granularität ist einstellbar (Minimal → Fein, dazu Benutzerdefiniert), sodass du Kosten gegen Tiefe abwägst.
- **🏷️ Pflicht-Aliase** — jede Seite kommt mit mindestens einem Alias (Übersetzung, Kürzel, Variante), damit die sprachübergreifende Duplikaterkennung greift.
- **🔄 Duplikaterkennung in zwei Stufen** — Stufe 1 (direkter Namensgleichklang: sprachübergreifend, Kürzel, sehr ähnliche Titel) wird immer geprüft; Stufe 2 (gemeinsame Links, mittlere Ähnlichkeit) füllt das restliche Token-Budget.
- **🧩 Intelligentes Zusammenführen und Widerspruchsstatus** — Duplikate werden zusammengeführt und behalten ihre Aliase; Widersprüche werden mit Quellenangabe markiert; Seiten mit `reviewed: true` sind vor dem Überschreiben geschützt.
- **🎨 Ein Tag-Vokabular, und es gehört dir** — welche Tags eine Seite tragen darf, kommt aus den verschachtelten Tags deiner Notizen, aus den Tags, die schon auf Wiki-Seiten stehen, und aus der Liste *Benutzerdefiniert* unter Einstellungen → Wiki-Konfiguration → Tag-Vokabular. Prompt, Schreibtor, Lint und Retag lesen dieselbe Liste; was dem Modell angeboten wird, landet auch auf der Platte. Ein Wert außerhalb der Liste wird verworfen und nie geschrieben. Kleine Modelle driften trotzdem (etwa ein Lauf von zehn liefert die eigene Taxonomie des Modells) — das Tor fängt es ab, und Lint meldet die Seite. Design-Anker: [Issue #328](https://github.com/GD4AI/obsidian-llm-wiki/issues/328).

![Eine erzeugte Konzeptseite: das Vokabular-Tag, mit dem sie geschrieben wurde, ihre Aliase AF und AFib, ihre Definition und die verwandten Seiten](assets/readme/readme-04-entity-page.webp)

### 📄 Dokument-, PDF- und Bild-Ingest

Sechs Wege, pro Aufnahme umschaltbar:

1. **🧾 Eingebautes MinerU-Backend** — Einstellungen → Wiki-Konfiguration → Markdown-Konvertierungs-Backend → *MinerU-Online-API*. PDF, Bilder (PNG/JPG/WebP/GIF/BMP und mehr) und Office (DOC/DOCX/PPT/PPTX/XLS/XLSX) über [MinerUs Precise-Parser](https://mineru.net/apiManage/docs). Das Token liegt in SecretStorage und läuft nach etwa 90 Tagen ab; ein 401 heißt also, das Token ist wahrscheinlich abgelaufen, und nennt die Seite zum Erneuern. Die Grenzen liegen bei 200 MB / 200 Seiten pro PDF und 256 MB / 10.000 Dateien pro Archiv. Der Pfad für gescannte Arbeiten und Office-Dateien, bei denen das Layout zählt.
2. **☁️ Cloud-Anbieter mit nativem PDF** — Anthropic, OpenAI, Google Gemini und AWS Bedrock (Anthropic- und OpenAI-Variante) lesen PDFs ohne weitere Einrichtung als Datei-Parts.
3. **🖥️ Lokale OCR auf Apple Silicon** — [oMLX](https://github.com/jundot/omlx) bringt Microsoft Markitdown als eingebautes PDF→Markdown-Backend mit. Aktiviere Markitdown in oMLX, lade [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) (3B / 570M aktiv, Open Source seit 2026-06) als Vision-Modell, richte das Plugin auf oMLX als benutzerdefinierten OpenAI-kompatiblen Anbieter aus, schalte **PDF-Unterstützung erzwingen** ein und wähle das multimodale Modell, das oMLX ausliefert. Das PDF verlässt deinen Rechner nie.
4. **🛠️ Fremder Extraktor (MinerU-Weboberfläche)** — nimm den [MinerU-Extractor als Onlinedienst](https://mineru.net/OpenSourceTools/Extractor), wenn du eine schnelle Oberfläche willst und kein API-Token einrichten möchtest. Lade die konvertierte `.md` herunter, lege sie in deinem Vault außerhalb des Wiki-Ordners ab und nimm sie als gewöhnliche Markdown-Notiz auf.
5. **🔌 PDF-Unterstützung erzwingen** — für jeden anderen OpenAI- oder Anthropic-kompatiblen Endpunkt, der Datei-Parts annimmt, versucht das Plugin den Aufruf (Einstellungen → LLM-Konfiguration → Erweitert). Der Endpunkt entscheidet; ein Fehlschlag erscheint als lokalisierter Hinweis.
6. **🖼️ Eingebettete Markdown-Bilder** — schalte *Eingebettete Bilder bei der Markdown-Aufnahme analysieren* in den erweiterten Einstellungen ein, um jedes geeignete lokale `![[bild.png]]`- und `![alt](bild.png)`-Embed zu analysieren. Jedes Bild wird mit seinen nächsten Markdown-Absätzen analysiert, in Paketen zu 20 MiB verschickt und bei 10 MiB gedeckelt; entfernte URLs werden nie heruntergeladen. Wenn du die Ausgabe pro Bild prüfen willst, aktiviere zusätzlich *Visuelle Evidenz eingebetteter Bilder auf Quellseite speichern*; das hängt einen einklappbaren Prüfabschnitt an die erzeugte Quellseite.

**Vorbehalt zu Office-Formaten:** Obsidian rendert `.docx`, `.xlsx` und `.pptx` nicht selbst ([file-formats](https://obsidian.md/help/file-formats)). Der praktische Weg für Office-Dateien ist deshalb: MinerU konvertiert nach `.md`, das Plugin nimmt diese `.md` in Wiki-Seiten auf, und die ursprüngliche Office-Datei bleibt als Referenz liegen. Für eine Vorschau direkt in Obsidian brauchst du ein Community-Plugin wie Pandoc Plugin, Docxer, Md Importer oder Office Reader.

**Gemeinsame Infrastruktur aller Wege:**

- **🗄️ Begrenzter Cache** — `.obsidian/plugins/karpathywiki/pdf-cache/` hält konvertiertes Markdown, verschlüsselt nach Inhalts-Hash + Modell + Konverter-Version; Grenzen bei 100 MB gesamt, 1000 Einträgen und 10 MB pro Eintrag, mit LRU-Verdrängung nach Änderungszeit.
- **📝 Optionaler Sidecar im Vault** — Einstellungen → Wiki-Konfiguration → Wiki-Ordner → *Konvertiertes Markdown in Vault schreiben* legt `<basename>.pdf.md` neben das Quell-PDF (standardmäßig aus — nur der Cache ist der Standard).
- **🛡️ Prompt für wortgetreue Transkription** — Konvertierung im OCR-Stil mit den Anti-Halluzinations-Markern `[illegible]` und `[figure: ...]`; ein Markdown-Fence, den kleine lokale Modelle um die Ausgabe legen, wird vor dem Schreiben in den Cache entfernt.
- **🔁 Wortgetreue Zitate auf der Quellseite (v1.27.0, #496)** — jede erzeugte Seite `sources/<slug>.md` trägt jetzt einen Abschnitt `Mentions in Source`, der aus denselben wortgetreuen Zitaten gebaut ist, die die Extraktion pro Entity und Concept festgehalten hat (jener Prosatext, von dem das Modell schon bewiesen hat, dass es ihn sieht). Damit ist das zugrunde liegende Dokument die eine Wiki-Seite mit einer echten, belegten Spur zurück in ihren Quelltext.

📖 **Vollständige Einrichtungsanleitungen** für alle Wege (Cloud-Anbieter, oMLX-Hardwarestufen, MinerU-Installation, Cache-Pflege) → [docs/PDF-OCR-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 Abfrage und Wartung

**Suche und Antworten**

- **🧭 PPR-Kaskade in fünf Stufen** — siehe [Wie die Suche funktioniert](#-wie-die-suche-funktioniert). Personalized PageRank über `[[wiki-link]]` liefert graphbewussten Multi-Hop-Kontext.
- **🔤 Lexikales Scoring, das den Fließtext liest** — der Schnellpfad bewertet Titel, Aliase, Zusammenfassung **und Fließtext** mit BM25F, sodass der längste Text einer Seite den Scorer erreicht. Das ist die größte Recall-Änderung, die dieses Projekt je gemacht hat.
- **🧩 Zugeschnittene Related-Listen** — eine Hub-Seite zieht nicht mehr jede andere Seite zu sich. Related-Listen werden bei jedem Schreiben aus den verbliebenen Namen neu berechnet, sortiert und begrenzt.
- **🔁 Umschalter für den alten Abfrage-Scorer** — Einstellungen → Erweiterte Einstellungen → *Älterer Such-Scorer* fährt wieder das frühere handabgestimmte lineare Ranking. Standardmäßig aus; das neue Ranking ist der Standard, und der Umschalter ist der Weg zurück.
- **📏 Das Antwortbudget liegt bei 16.000 Tokens, und die Pipeline sagt, wenn es aufgebraucht ist** — die Antwort endet nicht mehr still an der Budgetgrenze. Der Kontext wird vor dem Zusammenbau auf ein Seitenbudget gepasst, sodass 20 Seiten planmäßig im Prompt stehen und nicht durch Zufall.
- **🔖 Zitate stehen in akademischer Form** — das Eingabefeld wächst mit dem Inhalt, und *Verlauf leeren* leert die Aufzeichnung.
- **🪟 Rechts angedocktes Seitenpanel** — Query Wiki öffnet sich in einem rechten Sidebar-Blatt im Copilot-Stil (seit v1.22.1) statt in einem zentrierten Modal.

**Wartung und Reparatur**

- **🔍 Lint-Gesundheitsscan** — ein einziger Befehl erfasst Duplikate, tote Links, leere Seiten, verwaiste Seiten, fehlende Aliase und Widersprüche. Er listet außerdem Hub-Seiten, deren Nachbarschaft sich kristallisiert hat: ein Hub, der für Verbindungen einsteht, die der Inhalt nicht mehr herstellen kann.
- **⚡ Smart Fix All** — Reparatur in kausaler Reihenfolge mit einem Klick: Aliase füllen → Duplikate zusammenführen → tote Links reparieren → verwaiste Seiten verlinken → leere Seiten erweitern, mit Bericht pro Phase.
  
  ![Der Lint-Bericht des Wikis: die Statuszeile, die gefundenen toten Links und die Schaltfläche Smart Fix All, die sie in einem Durchlauf repariert](assets/readme/readme-08-lint-report.webp)
- **🚧 Ergebnis „stehen lassen“ bei defekten Links** — Einstellungen → Erweitert → *Stub-Seiten für nicht auflösbare Links anlegen* (standardmäßig an). Schaltest du es aus, bleibt ein toter Link in jedem Lint-Bericht sichtbar, bis eine echte Quelle ihn definiert, statt zu einer leeren Platzhalterseite zu werden. Das Gate aus #197 — nie erweitern ohne Quelle — bleibt unverändert; diese Steuerung entscheidet nur, ob die Stub-Seite überhaupt geschrieben wird.
- **📊 Panel für den Betriebsverlauf** — durchsuchbare, filterbare Oberfläche für vergangene Aufnahmen, Lint-Berichte und Wartungsläufe.

**Gates, die laufen, bevor ein Aufruf bezahlt wird**

- **🛡️ Gate vor der Aufnahme** — leere Notizen, reine Whitespace-Notizen und Notizen mit nichts als Frontmatter werden abgelehnt, bevor ein LLM-Aufruf passiert; die Dedup über den Inhalts-Hash erkennt identische Dateien auf verschiedenen Pfaden.
- **🚦 Gate für Ingest-Kandidaten** — optional (`skipMentionOnlyCandidates`, standardmäßig aus). Ein Kandidat, der nur in einer Klammer, in einer Aufzählung oder in einem kurzen Listenpunkt vorkommt, fliegt raus, bevor er eine Generierung und einen Dedup-Aufruf kostet. Das gilt nur für Sprachen mit gemessenem Profil; eine Sprache ohne Profil wird nie stillschweigend gefiltert, und sprachübergreifende Notizen werden gar nicht gefiltert.
- **🎛️ Ausgabemodus und Reasoning je Schritt** — Feld *Ausgabemodus und Reasoning je Schritt* unter LLM-erweiterte Parameter; du überschreibst Textmodus oder Denkstufe eines Schritts ohne Codeänderung. Für Schritte, die du nicht auflistest, bleibt die eingebaute Vorgabe unangetastet.

### 🦙 Lokal zuerst

- **🖥️ Ollama, LM Studio, OpenRouter, eigener Endpunkt** — sofort einsatzbereit. Lokale Modelle tragen die Abfrage (mit kleinerem Kontextfenster); die Aufnahme eines Vaults mit 2.000 Seiten braucht in der Regel ein Cloud-Modell mit langem Kontext.
- **📄 Der PDF-OCR-Weg ist auf Apple Silicon vollständig lokal** — siehe [Dokument-, PDF- und Bild-Ingest](#-dokument--pdf--und-bild-ingest) oben.
- **🔐 ChatGPT Plan (Codex OAuth)** — Desktop-Loopback oder Gerätecode auf Mobilgeräten; Anmeldeinformationen liegen nur in Obsidian SecretStorage. (Siehe [Anthropic vs. OpenAI vs. Codex OAuth](#anthropic-vs-openai-vs-codex-oauth--es-sind-unterschiedliche-anbieter) unten für die vollständige Erklärung der Anbietergrenzen.)

### 🌐 Sprache

- **🌍 11 Sprachen für die Oberfläche** — English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano, Русский. Oberflächensprache und Ausgabesprache des Wikis sind unabhängig — dein Wiki kann auf Chinesisch laufen, während die Oberfläche Englisch ist.
  
  ![Oberflächensprache und Wiki-Ausgabesprache sind zwei getrennte Einstellungen; ein chinesisches Wiki kann hinter einer englischen Oberfläche laufen](assets/readme/readme-06-language-settings.webp)
- **📚 11 Ausgabesprachen für das Wiki** — dieselbe Auswahl; einzustellen unter Einstellungen → Wiki-Konfiguration. Die Option *Benutzerdefinierte Eingabe* deckt Ad-hoc-Prompts ab.
- **Alle Oberflächentexte je Sprache übersetzt** — jedes Label, jedes Modal, jeder Hinweis. Eine zwölfte Sprache kommt aus der Community (Muster: PR #159).
- **🔧 Eigene Header je Anbieter** — ein Freitextfeld direkt unter der Basis-URL. Eine Zeile `Name: wert` pro Zeile, mit jeder Anfrage gesendet. Ein OpenCode-Preset und eine `(Responses)`-Variante für Endpunkte, die `/v1/responses` sprechen, liegen bei.
- **📡 Ein Stream, der einen blockierten Origin übersteht** — wird eine Cross-Origin-Anfrage abgelehnt, läuft der Stream über einen `node:https`-Transport auf dem Desktop erneut, statt zu einer gepufferten Antwort zu verkommen; ein gescheiterter Rückfallweg wird festgehalten und nicht verschluckt.

### ⚙️ Einstellungen, die einen Lauf prägen

Das meiste entscheidet das Plugin für dich. Diese acht Einstellungen ändern das, und jede ist die Antwort auf einen Fehler, den jemand erlebt hat.

| Einstellung | Wo | Was sie ändert |
|---|---|---|
| **Streaming für Ingest-Anfragen** | Erweitert | `Automatisch` streamt auf Mobilgeräten, `Immer` und `Nie` erzwingen die Wahl. Streaming ist es, was eine lange Aufnahme unter der Leerlaufgrenze eines Anbieters hält. |
| **Denkstufe** | LLM-erweiterte Parameter | Default / Niedrig / Mittel / Hoch. Das AI SDK übersetzt die Stufe je Anbieter, deshalb ist kein handgeschriebenes Anbieterfeld im Spiel. |
| **Max. Ausgabe-Token pro Aufruf** | LLM-erweiterte Parameter | Wirkt jetzt in beide Richtungen: erhöhen, wenn ein Reasoning-Modell das Budget vor dem Schreiben verbraucht; senken, um Kosten zu deckeln. Leer überlässt dem Modell seine eigene Obergrenze. |
| **Kontextfenster des Modells** | LLM-erweiterte Parameter | Die Obergrenze kann das Fenster nicht mehr überschreiten, sodass ein kleines lokales Modell nie eine Zahl bekommt, die es nicht annehmen kann. |
| **LLM-Parallelität** | Anbieter | 1–20 gleichzeitige Aufrufe. Höher bringt eine große Aufnahme früher zu Ende; niedriger hält ein lokales Modell in seinem Speicher. |
| **Extraktionsschwerpunkt** und **Inhaltsanforderungen** | Erweiterte Einstellungen | Freitext, der in `schema/config.md` geschrieben wird. Beides formt, was das Modell extrahiert, ohne dass du das Schema von Hand bearbeitest. |
| **Ausgabemodus und Reasoning je Schritt** | LLM-erweiterte Parameter | Überschreibt Textmodus oder Denkstufe für einen Schritt — Extraktion, Zusammenführen, Abfrage —, ohne die anderen zu ändern. |
| **Ausgeschlossene Dateien** | Obsidians eigene Liste | Ordner-Aufnahme, Dateiwächter und der automatische Pfad halten sich an die Ausschlüsse, die du in Obsidian setzt. Plugin und Obsidian sind sich also einig, was außerhalb liegt. |

---

## 🌐 Ökosystem

Das Plugin fügt sich in den Rest deines Obsidian-Stacks — jedes Werkzeug unten hängt sich ohne Codeänderung in den `[[wiki-link]]`-Graphen.

- **📄 [MinerU-Backend für mehrere Formate](https://mineru.net/apiManage/docs) (seit v1.27.0 eingebaut)** — was früher ein eigener CLI- oder UI-Schritt war, ist jetzt ein Schalter im Plugin; die vollständige Tabelle der Wege steht unter [Dokument-, PDF- und Bild-Ingest](#-dokument--pdf--und-bild-ingest). Der [MinerU-Onlinedienst](https://mineru.net/OpenSourceTools/Extractor) bleibt für alle da, die eine schnelle Oberfläche einem API-Token vorziehen; [MinerU selbst hosten](https://github.com/opendatalab/mineru) ist ebenfalls möglich.
- **🕸️ Obsidian Graph View** — öffne den nativen Graphen auf jeder Wiki-Seite; jeder `[[wiki-link]]` wird ein Knoten, jeder Rücklink eine Kante. Eingebaut, ohne zusätzliche Bundle-Größe.
  
  ![Obsidians nativer Graph View über einem erzeugten Wiki: Quell-, Entitäts- und Konzeptseiten als ein zusammenhängender Graph](assets/readme/readme-05-graph-view.webp)
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** — die offizielle Browser-Erweiterung. Speichere Webseiten (Artikel, Blogbeiträge, Reddit-Threads, Hacker News, Rezepte, Facharbeiten, YouTube-Transkripte über Interpreter) in einen beliebigen Ordner deines Vaults und führe danach den Befehl „Aus Ordner aufnehmen“ aus, um Entitäten und Konzepte stapelweise zu ziehen.
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** — frag das Wiki wie eine Datenbank ab, mit DQL (`LIST FROM "wiki/entities" WHERE contains(tags, "person")`) oder über die JS-API. Das Plugin schreibt auf jeder Seite Standard-Frontmatter (`tags:`, `type:`, `aliases:`), deshalb laufen Dataview-Abfragen sofort.
- **🌿 Git** — versioniere deinen Vault mit einem beliebigen Git-Client. Das Plugin schreibt deine Quelldateien nie um; es legt nur neue Seiten unter `wiki/` an, sodass `git diff` deine Änderungen sauber von der LLM-Ausgabe trennt.
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** — mach aus jeder Obsidian-Notiz einen Foliensatz, über Marp-Frontmatter (`marp: true`). Wiki-Seiten sind reines Markdown und rendern als Folien ohne zusätzliche Konvertierung.
- **🖼️ Canvas** — Obsidians unendliche Leinwand. Zieh Wiki-Karten auf ein Canvas und baue Lerneinheiten, Mindmaps oder Forschungsübersichten aus `[[wiki-links]]`, ohne den Vault zu verlassen.

---

## 🔍 Wie die Suche funktioniert

Die meisten „KI-Suche“-Plugins zerlegen deine Notizen in Chunks und betten sie in einer Vektor-DB ein. Wir nicht. [Karpathys Argument gegen RAG](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) lautet, dass Chunking dem LLM die Fähigkeit nimmt, über den ganzen Wissensgraphen hinweg zu schließen — und das Argument hält der Praxis stand. Stattdessen gehen wir den Graphen ab, den du ohnehin pflegst, indem du `[[wiki-links]]` schreibst.

### Die Kaskade mit fünf Stufen

Wenn du fragst „Wer hat Microsoft gegründet?“, läuft Query Wiki fünf Stufen durch, bevor eine Antwort generiert wird:

1. **Lexikaler Schnellpfad** — BM25F über jeden Entity- und Concept-Titel, die Aliase, die Zusammenfassung **und den Fließtext**, mit Sättigung pro Feld und IDF aus einer echten Dokumentfrequenztabelle. Kostenlos, sofort da, und das Tor für alles, was folgt.
2. **Keyword-Generierung durch das LLM** — das LLM schlägt 8–12 sprachübergreifende Keywords aus deiner Abfrage vor; Synonyme, Kürzel und Begriffe, die gegen Token-Überlappung resistent sind, erledigt ein einziger LLM-Aufruf.
3. **Lokaler Substring-Scan** — jedes erzeugte Keyword wird lokal erneut gegen Seitentitel, Aliase und Textausschnitte geprüft. Kein weiterer LLM-Aufruf; rundet den Recall gegen Rauschen ab.
4. **Rückfall auf die Wissensbasis des LLM** — liefern Lex und Keyword-Scan nur schwache Signale, setzt das LLM die Top-N-Kandidaten in einem semantischen Durchlauf gegen das ganze Wiki neu.
5. **Graph-Expansion mit PPR** — Personalized PageRank (Haveliwala 2002) über den `[[wiki-link]]`-Graphen, gestartet aus der Kandidatenmenge. Das liefert graphbewussten Multi-Hop-Kontext: „Bill Gates“ → „Microsoft“ → „Wettbewerber“, nicht nur wörtliche Titelüberlappung.

Die Kaskade bricht bei der Stufe ab, die genug Signal geliefert hat — keine festen Kosten über fünf Stufen, keine LLM-Aufrufe, wenn Lex reicht, und ein semantischer Rückfallweg nur dann, wenn Lex plus Keyword-Scan allein nicht reichen.

### Query-Erweiterung, und ein Weg zurück

Erreicht die Kaskade die Graphstufe, wird die Abfrage zweimal erweitert, bevor die Seeds gewählt werden: einmal mit den Begriffen des Wikis, dann mit Begriffen, die das LLM vorschlägt. Jeder Durchgang ist gewichtet, und der Zugewinn ist auf den eigenen Vaults des Projekts gemessen statt angenommen — auf den beiden Vaults, die die aktuelle Version geschrieben hat, ist die Erweiterung bei r@10 **+0.086** und **+0.113** wert, und in beiden Fällen schließt das Intervall die Null aus. Die Aussage ist bewusst eng: Die gewichtete Form ist **nicht** messbar besser als die schlichte Verkettung, und der Umschalter auf den früheren Scorer steht für alle bereit, deren Ergebnisse schlechter geworden sind.

Einstellungen → Erweiterte Einstellungen → *Älterer Such-Scorer* fährt stattdessen das frühere handabgestimmte lineare Ranking. Das neue Ranking ist der Standard; der Umschalter ist der Weg zurück.

### Personalized PageRank in großem Maßstab

Wir verwenden Monte-Carlo-PPR (Fogaras 2005) — 3.000 zufällige Läufe zu je 50 Schritten — mit der Dead-End-Regel aus Haveliwala 2002. Die Kosten sind **O(K × L)** (K = Läufe, L = Schritte pro Lauf) und unabhängig von der Seitenzahl; ein Vault mit 2.000 Seiten sieht also dieselbe Expansionslatenz wie einer mit 200.

**PPR @5 = 27,1 % gegenüber einer reinen kNN-Baseline von 24,1 %** auf einem Vault des Projekts. Der Korpus ist nicht öffentlich; lies die Zahl deshalb als den Vergleich, den das Projekt für sich selbst gemessen hat, und nicht als Aussage über deinen Vault. `tools/dev-instrument/run-recall-harness.mjs` ist das Messwerkzeug, das den Recall gegen einen Vault misst.

### Warum keine Embeddings

Wir haben den Embedding-Weg in [Issue #175](https://github.com/GD4AI/obsidian-llm-wiki/issues/175) bewusst verworfen. Das Graph-Signal ist schon da — jeder `[[wiki-link]]` ist eine von Hand kuratierte Kante „diese beiden gehören zusammen“ —, und die meisten Anbieter, die wir unterstützen (Ollama, LM Studio, Anthropic, Bedrock, Kimi, GLM, MiniMax), haben gar keinen `/v1/embeddings`-Endpunkt. Ein Embedding-Modell hieße: ein Download pro Seite, ein Adapter pro Anbieter und null Gewinn bei der Suchqualität.

---

## 🤖 Modelle

Fünfzehn namentlich genannte Anbieter, dazu jeder OpenAI- oder Anthropic-kompatible Endpunkt. Die Tabelle nach Stufe — Cloud, lokal, OCR, Quantisierung, Hardware — steht in [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md), zuletzt am 2026-11-06 gegen [models.dev](https://models.dev/) geprüft.

- **Frontier-Cloud** — Anthropic, OpenAI, Google Gemini, xAI Grok, Moonshot Kimi, Zhipu GLM, MiniMax. Natives PDF bei Anthropic, OpenAI und Gemini.
- **Günstig und Open Weight** — DeepSeek, Alibaba Qwen, Step, Tencent Hunyuan, Xiaomi MiMo, Google Gemma.
- **Enterprise** — AWS Bedrock (Anthropic- und OpenAI-Variante, mit API-Schlüssel, SSO oder IAM) und ChatGPT Plan über Codex OAuth.
- **Lokal und Gateways** — Ollama, LM Studio, OpenRouter, Anthropic-kompatible Gateways.

Dieses Plugin gibt dem LLM pro Abfrage den vollen Wiki-Kontext. Deshalb gewinnen **Modelle mit langem Kontext**.

### Worauf es ankommt

- **🧠 Kontextfenster ≥ 200K Tokens** für Vaults über rund 500 Seiten. Darunter lässt die Kaskade womöglich frühere Stufen weg, damit es passt.
- **⚖️ Qualität bei der Befehlsbefolgung** zählt für die Extraktion mehr als rohe Intelligenz — wähle ein Modell, das der Schema-Vorlage folgt, nicht die größte Zahl auf dem Leaderboard.
- **🔌 Ein Embedding-Endpunkt ist irrelevant** — wir verwenden keine Embeddings. Ein Anbieter ohne `/v1/embeddings` ist in Ordnung (die meisten unserer 15+ Anbieter haben keinen).
- **🦙 Lokal für die Abfrage, Cloud für die Aufnahme** — die Aufnahme eines Vaults mit 2.000 Seiten braucht in der Regel ein Cloud-Modell mit langem Kontext; ein lokales Modell mit 262K deckt die meisten Abfragen ab.

Für PDF-, Bild- und Office-Ingest siehe [Dokument-, PDF- und Bild-Ingest](#-dokument--pdf--und-bild-ingest) unter Funktionen — Anthropic, OpenAI, Bedrock und Gemini lesen PDFs von Haus aus als Datei-Parts; das eingebaute MinerU-Backend (v1.27.0+) und **PDF-Unterstützung erzwingen** decken alles Übrige ab.

### Anthropic vs. OpenAI vs. Codex OAuth — es sind unterschiedliche Anbieter

- **Anthropic** (und die Bedrock-Variante) — ein eigener, separat abgerechneter API-Schlüssel der Anthropic Platform.
- **OpenAI** — ein eigener, separat abgerechneter API-Schlüssel der OpenAI Platform.
- **ChatGPT Plan (Codex OAuth)** — ein experimenteller, eigener Anbieter, der nach der Anmeldung im Browser oder per Gerätecode das berechtigte Codex-Kontingent nutzt; die Verfügbarkeit folgt der Authentifizierungs- und Kontingentrichtlinie von OpenAI Codex, nicht dem Namen des Tarifs. Kompatibilität mit Codex von Dritter Seite, keine Partnerschaft mit OpenAI und keine allgemeine ChatGPT-API.

### AWS Bedrock — drei Arten der Anmeldung (v1.27.0, #425)

Einstellungen → Anbieter → Bedrock (Anthropic / OpenAI) wählt jetzt eine von drei Anmeldearten; die Anbieterzeile fragt danach genau die Eingaben ab, die diese Art braucht:

- **API-Schlüssel** — der ursprüngliche Bearer-Weg aus Stufe 1; das Verhalten ist Byte für Byte identisch zu v1.26.4 und die empfohlene Wahl für alle, die bereits einen Bedrock-API-Schlüssel bezahlen.
- **SSO** — Geräteablauf im IAM Identity Center. Klicke auf *Sign in with AWS SSO*, gib den Code aus der Bestätigungs-URL im Browser ein, und das Plugin erhält ein SSO-Token über `karpathywiki-bedrock-sso` in SecretStorage, tauscht es gegen temporäre Rollen-Anmeldeinformationen und signiert jede Anfrage mit selbst geschriebenem SigV4 (kein AWS-SDK kommt hinzu). Konto-ID und Rollenname werden automatisch erkannt, wenn die SSO-Identität genau eine von jeder preisgibt; sonst trägst du sie in den Anbieter-Einstellungen ein.
- **IAM** — statische Zugriffsschlüssel für Umgebungen ohne SSO (CI, geplante Stapelaufträge). Gespeichert unter `karpathywiki-bedrock-iam` in SecretStorage; der Cache im Speicher merkt sich pro Zugriffsschlüssel, damit die SigV4-Signatur innerhalb der Gültigkeit bleibt.

Alle drei Arten teilen dieselbe Disziplin von Obsidian SecretStorage (keine Anmeldeinformationen in `data.json`, in Logs oder in der Doku) und denselben Weg ohne AWS-SDK, mit selbst geschriebenem OIDC und SigV4. Die Bedrock-Region ist von der Anmeldeart unabhängig und wird in derselben Anbieterzeile gesetzt.

> 📖 **Vollständige Auswahltabelle** (Cloud + lokal + PDF-OCR + Codex OAuth + Quantisierung + Hardwarestufen) → [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

## ❓ FAQ

### Was macht das Plugin eigentlich?

Wähle eine Notiz, einen Ordner oder eine Auswahl: Das LLM zieht Entitäten und Konzepte heraus und schreibt ein vernetztes Wiki mit `[[bidirektionalen Links]]`. Stell eine Frage, und die Antwort kommt aus diesen Seiten, mit Zitaten. Deine ursprünglichen Notizen bleiben unverändert.

### Ist mein bestehendes Wiki sicher?

✅ Rückwärtskompatibel seit v1.0.0. Setze `reviewed: true` auf einer Seite, um sie vor dem Überschreiben zu schützen. Das Update von v1.24.x schreibt deinen Vault nicht um; der PDF-Ingest von v1.25.0 arbeitet standardmäßig nur im Cache, und v1.27.0 ergänzt nativen PDF-, Bild- und Office-Ingest, ohne das Wiki-Layout auf der Platte zu ändern.

### Kann ich PDFs, Bilder und Office-Dokumente aufnehmen?

✅ Ja. Anthropic, OpenAI, Bedrock und Gemini lesen PDFs nativ; das eingebaute MinerU-Backend (v1.27.0) deckt alles Übrige ab (PDF + Bilder + Office). Die vollständige Anleitung — Cloud-Anbieter, OCR auf Apple Silicon, PDF-Unterstützung erzwingen, Cache-Pflege — steht in [docs/PDF-OCR-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md).

### Gehen meine Daten irgendwohin?

🚫 Kein Backend, keine Analyse — das Plugin läuft vollständig in Obsidian. Nur Text, den du zum Aufnehmen oder Abfragen ausdrücklich sendest, verlässt dein Gerät, und nur in Richtung des Anbieters, den du eingestellt hast. Für vollständige Datenlokalität nimm Ollama oder LM Studio.

### Kann ich das Plugin in meiner Sprache nutzen?

🌍 11 Sprachen für die Oberfläche und für die Wiki-Ausgabe, getrennt voneinander einstellbar. Eine zwölfte Sprache kommt aus der Community (PR #159 ist das Muster).

### Worin unterscheidet sich das von einem RAG-Chatbot?

Kein Chunking, keine Embeddings, keine Vektor-Datenbank. Personalized PageRank läuft über den `[[wiki-link]]`-Graphen, den du ohnehin pflegst, und liefert Multi-Hop-Kontext ohne Embedding-Kosten.

### Welches LLM soll ich nehmen?

Ein Modell mit langem Kontext: ≥ 200K Tokens für Vaults über rund 500 Seiten. Die Tabelle nach Stufe steht in [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md).

### Gibt es einen veröffentlichten Benchmark?

PPR @5 = 27,1 % gegenüber einer reinen kNN-Baseline von 24,1 %, gemessen auf einem Vault des Projekts — [Wie die Suche funktioniert](#-wie-die-suche-funktioniert) sagt, was das belegt und was nicht.

### Wie halte ich die API-Kosten im Griff?

Nimm für die Stapelaufnahme die Granularität Grob oder Minimal. Smart Batch Skip erkennt bereits aufgenommene Dateien von selbst. Auto-Maintenance ist standardmäßig AUS. Lint zeigt die Zahlen, bevor es repariert — ohne deine Zustimmung wird nichts berechnet.

### Wie breche ich einen laufenden Vorgang ab?

Klicke auf die Statusleiste (sie zeigt „Aufnahme läuft... zum Abbrechen klicken“) oder `Cmd+P/Ctrl+P` → „Aktuelle Aufnahme abbrechen“. Der Lauf hält sauber an der nächsten Stapelgrenze an.

### Wo bekomme ich Hilfe?

[GitHub Issues](https://github.com/GD4AI/obsidian-llm-wiki/issues) für Fehlerberichte · [GitHub Discussions](https://github.com/GD4AI/obsidian-llm-wiki/discussions) für Fragen und Funktionswünsche · Entwicklerkonsole (`Ctrl+Shift+I` / `Cmd+Option+I`) für die Logs des Plugins.

---

## 🔒 Privatsphäre

Dieses Plugin steht im Obsidian Community Plugin Market und durchläuft eine automatische Prüfung auf Sicherheit und Berechtigungen.

- **🚫 Kein eigenes Backend, keine Telemetrie, keine Datensammlung.** Reine lokale Software, die in Obsidian läuft. Das Plugin betreibt keinen Server und meldet nirgendwohin etwas.
- **🔐 Netzwerkzugriff ist optional und ausdrücklich.** Er besteht nur, um Dienste zu erreichen, die *du* einstellst: deinen LLM-Anbieter und — wenn du das MinerU-Backend einschaltest — `mineru.net`. Der zweite Fall ist die Ausnahme, die man benennen muss: Er lädt das Dokument in eine Rechtsordnung hoch, die du nicht gewählt hast und die keine Aussage zur Aufbewahrung veröffentlicht. [Wo dein Dokument verarbeitet wird](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md#-where-your-document-is-processed) listet jeden Weg und nennt, wohin die Datei geht.
- **📁 Zugriff auf Vault-Dateien** dient der Wiki-Verwaltung: Notizen lesen, Seiten erzeugen, tote Links suchen, Duplikate erkennen. Das Plugin ändert deine Quelldateien nie.
- **📋 Zugriff auf die Zwischenablage** nutzt ausschließlich die Schaltfläche „Kopieren“ im Abfrage-Modal — und nur, wenn du sie anklickst.

Für vollständige Datenlokalität nimm Ollama oder LM Studio. Mit einem lokalen Anbieter verlassen deine Daten deinen Rechner nie.

---

## 💖 Unterstützung

Wenn Karpathy LLM Wiki ein wichtiger Teil deines Wissens-Workflows geworden ist:

- ☕ **[Kauf mir einen Ko-fi](https://ko-fi.com/greenerdalii)** — einmalig oder monatlich
- 💳 **[Trinkgeld über PayPal](https://paypal.me/greenerdalii)** — einmalig

Danke an die Folgenden für die Unterstützung des Projekts:

[@jameses-cyber](https://github.com/jameses-cyber), [@issaqua](https://github.com/issaqua), Dikson Choi

### Mitmachen

Fehlerberichte und Pull Requests sind beide nützlich. [CONTRIBUTING.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CONTRIBUTING.md) beschreibt den Build, die Testschleife und die Prüfungen, die eine Änderung bestehen muss; [CODE_OF_CONDUCT.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CODE_OF_CONDUCT.md) ist kurz. [ROADMAP.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/ROADMAP.md) zeigt, was geplant ist, und [CHANGELOG.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CHANGELOG.md) hält fest, was ausgeliefert wurde.

Bauen aus dem Quelltext: `pnpm install`, `pnpm build:dev`, `pnpm gate:1` — der letzte Befehl ist Lint, Architekturprüfung, Typprüfung, Build, Tests und CSS-Lint in einem Durchgang. `tools/dev-instrument/` ist das reine Messwerkzeug für die Entwicklung: Es führt das echte `WikiEngine.ingestSource` gegen einen Ordner auf der Festplatte aus, ohne Obsidian-Laufzeit, und gibt Token- und Laufzeitabrechnung pro Aufgabe aus — daher stammen die Performance-Zahlen im Changelog. Die CLI für Anwender liegt im Schwester-Repo: `npm i -g karpathywiki-cli`.

---

## 🔭 Weitere Projekte

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — dieselbe `WikiEngine` ohne Renderer: `npm i -g karpathywiki-cli`, dann `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`.
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — ein Router auf Aufgabenebene für [pi-coding-agent](https://github.com/earendil-works/pi): Ein kleiner Judge stuft jeden Zug als Routine oder als folgenreich ein, und die gewählte Stufe bestimmt Modell, Werkzeuge und Rückfallkette. MIT. → [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — dasselbe Routing-Design für die Laufzeit [dsh-coding-agent](https://github.com/earendil-works/dsh). MIT.
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — der Obsidian-Plugin-Workflow auf der DSH-Seite: einen Workspace aufsetzen, die Red→Green-Schleife fahren, dieselben Qualitätsgates wie dieses Repo laufen lassen und einen releasefähigen Branch `feat/*` oder `fix/*` hinterlassen.

---

## 📜 Lizenz & Danksagungen

Apache License, Version 2.0 — siehe [LICENSE](../LICENSE), [NOTICE](../NOTICE) und [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md).

**Aufgebaut auf:**
- 💡 [Andrej Karpathys LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — die ursprüngliche Idee
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v7](https://ai-sdk.dev/) (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) über Obsidians `requestUrl`
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) und [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — die Suchalgorithmen

**Betreuer:** [@green-dalii](https://github.com/green-dalii) (Autor) · [@DocTpoint](https://github.com/DocTpoint) (Mitbetreuer seit September 2026)

[![Star History Chart](https://api.star-history.com/chart?repos=GD4AI/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
