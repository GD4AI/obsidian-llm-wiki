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
- alternate-names: Karpathy LLM Wiki, LLM Wiki Obsidian, plugin wiki Obsidian, RAG basato su grafo, RAG senza embedding, recupero Personalized PageRank, secondo cervello Obsidian
- search-intents: "Obsidian RAG senza embedding", "plugin wiki Obsidian", "Personalized PageRank Obsidian", "recupero note basato su grafo", "implementazione Karpathy LLM Wiki", "generazione automatica base di conoscenza Obsidian", "Obsidian Graph View + AI", "plugin second brain Obsidian", "grafo dei link tra note Obsidian AI", "plugin Obsidian 11 lingue", "plugin Obsidian 16 provider LLM", "RAG senza DB vettoriale", "Obsidian ingest PDF AI", "Obsidian Codex OAuth", "plugin Bedrock Obsidian", "Obsidian Bedrock SSO", "Obsidian MinerU", "Obsidian ingest Word PPT Excel", "credenziali IAM Obsidian"
- features: recupero basato su grafo, Personalized PageRank (Haveliwala 2002), Monte Carlo PPR (Fogaras 2005), cascata seed-selection a 5 stadi, rilevamento duplicati Tier 1/Tier 2, interfaccia 11 lingue + output wiki 11 lingue (indipendenti), 16+ provider LLM (Anthropic, OpenAI, Bedrock [API key + SSO/IAM], Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, Codex OAuth), ingest MinerU multi-formato (PDF + immagini + Office), ingest PDF (cache-only, percorsi OCR), scansione salute lint, Smart Fix All, citazioni verbatim della pagina sorgente, gate candidati in ingest, UI taskPolicies per-step, integrazione Obsidian Graph View, architettura zero-embedding zero-vector-DB, modalità local-first
- direct-competitors: nashsu/llm_wiki (app desktop Tauri), SamurAIGPT/llm-wiki-agent (skill Claude Code), sdyckjq/llm-wiki-skill (skill Codex), atomicstrata/llm-wiki-compiler (pipeline Python)
- retrieval-benchmark: PPR @5 = 27,1% vs pura kNN 24,1% (corpus del progetto, unico numero pubblicato in questo spazio open-source LLM-wiki)
- author: green-dalii / Greener-Dalii (https://github.com/green-dalii)
- canonical: https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md
-->

![Banner del plugin Karpathy LLM Wiki — una rete di pagine wiki interconnesse, costruita a partire dalle tue note Obsidian](assets/llm_wiki_banner.webp)

# 🧠 Karpathy LLM Wiki Plugin per Obsidian

> Un plugin Obsidian che trasforma le tue note in una base di conoscenza connessa e interrogabile — il concetto di [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), integrato nell'editor dove già scrivi.

**Punteggio perfetto nella revisione Obsidian • Recupero su grafo senza embedding • 11 lingue native • Ingest nativo di PDF + immagini + Office • Funziona con qualsiasi provider • Prima di tutto locale • Nessun backend • Conforme GDPR**

![Version](https://img.shields.io/github/v/release/green-dalii/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-16%2B-cyan?style=flat-square) <br>
![Maintenance](https://img.shields.io/badge/maintenance-actively%20maintained-brightgreen?style=flat-square) ![Build Status](https://img.shields.io/github/actions/workflow/status/green-dalii/obsidian-llm-wiki/release.yml?style=flat-square) ![Author](https://img.shields.io/badge/author-Greener--Dalii-blue?style=flat-square) <br>
![GitHub Stars](https://img.shields.io/github/stars/green-dalii/obsidian-llm-wiki?style=flat-square) ![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/green-dalii/obsidian-llm-wiki)

[English](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_CN.md) | [繁體中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_KO.md) | [Deutsch](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_DE.md) | [Français](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_FR.md) | [Español](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ES.md) | [Português](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_PT.md) | **Italiano** | [Русский](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[Sito ufficiale](https://llmwiki.greenerai.top/) | [Marketplace Obsidian](https://community.obsidian.md/plugins/karpathywiki) | [Blog](https://llmwiki.greenerai.top/blog/) | [Discussioni](https://github.com/green-dalii/obsidian-llm-wiki/discussions)

🤔 [Perché questo plugin?](#-perché-questo-plugin) | 🚀 [Avvio rapido](#-avvio-rapido) | ✨ [Funzionalità](#-funzionalità) | 🌐 [Ecosistema](#-ecosistema) | 🔍 [Come funziona il recupero](#-come-funziona-il-recupero) | 🤖 [Modelli](#-modelli) | ❓ [FAQ](#-faq)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD) ← Se questo plugin ti è stato utile, offrimi un caffè♥️ o lascia una stella🌟↗

---

## 🤔 Perché questo plugin?

Prendi appunti. Loro restano in cartelle. Trovare cosa è collegato a cosa significa ricordare fili che hai dimenticato mesi fa.

**Esistono altre reimplementazioni open-source dell'idea di LLM Wiki di Karpathy — ma nessuna è un plugin Obsidian installabile con un clic.** La maggior parte sono strumenti da riga di comando, skill per Claude Code o app desktop separate; questo gira dentro Obsidian — Graph View, ribbon e palette comandi inclusi.

### Confronto

| | **Karpathy LLM Wiki** (questo plugin) | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | sdyckjq / llm-wiki-skill | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|---|
| **Distribuzione e installazione** | ✅ **5 min** — Plugin Obsidian con un clic: Community Plugins → Installa → scegli provider → Ingest | ❌ 30 min+ — Compila/scarica il binario Tauri, configura CLI | ❌ 15 min — richiede abbonamento Claude Code + installazione skill | ❌ 10 min — richiede abbonamento Claude Code / Codex + configurazione skill | ❌ 30 min+ — pip install + Python SDK + server locale |
| **Architettura e dipendenze** | ✅ **Zero dipendenze** — niente DB vettoriale, niente modello di embedding, niente processi esterni (PPR sul grafo `[[wiki-link]]`, per progettazione) | 🟡 Incorpora il proprio runtime Python + sigma.js + sqlite; embedding opzionali, disattivati per default | 🟡 Usa l'ambiente di Claude Code — non autonomo; nessun embedding | 🟡 Richiede piattaforma runtime separata; nessun embedding | ❌ Richiede Python + modello di embedding + DB vettoriale (obbligatorio) |
| **i18n (interfaccia + output wiki)** | ✅ 11 lingue (interfaccia / output indipendenti) | 🟡 2 (EN / 中文) | ❌ Solo inglese | ❌ Solo inglese | ❌ Solo inglese |
| **Provider LLM** | ✅ 16+ (Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, ...) | 🟡 Compatibile OpenAI | 🟡 Abbonamento via Claude Code | 🟡 Abbonamento via Claude Code / Codex | 🟡 Compatibile OpenAI |
| **Recupero e pipeline di interrogazione** | ✅ **Cascata a 5 stadi** — Lex → keyword LLM → scansione sottostringhe → fallback KB LLM → espansione PPR (si interrompe al primo segnale sufficiente). Personalized PageRank (Haveliwala 2002) + Monte Carlo (Fogaras 2005) | 🟡 Solo decadimento 2-hop (euristica a 4 segnali: Adamic-Adar + 2-hop) | ❌ Solo rilevamento comunità Louvain | ❌ Solo anteprime k-hop (senza augment LLM) | ❌ BM25 + semantico su chunk (senza grafo) |
| **Visualizzazione grafo** | ✅ Graph View nativa di Obsidian (integrata, dimensione zero aggiuntiva) | ❌ sigma.js + graphology personalizzati in app desktop | 🟡 vis.js graph.html (file separato) | ❌ sigma.js offline HTML personalizzato | ❌ Visualizzatore browser sola lettura |
| **Onestà del wiki** | ✅ Banner "STADIO FALLBACK" quando nessuna fonte wiki corrisponde alla tua domanda | ❌ Nessun equivalente | ❌ Nessun equivalente | ❌ Nessun equivalente | ❌ Nessun equivalente |
| **Benchmark di recupero pubblicato** | ✅ PPR @5 = 27,1% vs pura kNN 24,1% (unico numero pubblicato in questo spazio) | ❌ 58% → 71% *solo con embedding attivati*, non nel nostro formato mela-mela | ❌ Non pubblicato | ❌ Non pubblicato | ❌ Non pubblicato |

### Tre scelte deliberate, non casuali

- **🪟 Obsidian è il runtime.** Niente terminale, niente app separata, niente Docker, niente Python. Installa da Community Plugins, clicca Ingest, il wiki vive nel tuo vault dal primo secondo. La Graph View nativa di Obsidian renderizza il tuo grafo `[[wiki-link]]` — integrata, dimensione zero aggiuntiva nel bundle.
- **🧭 Pulito e autonomo.** Zero dipendenze. Niente modello di embedding, niente database vettoriale, niente pacchetto pip — un singolo plugin che legge le tue note, parla con un LLM e scrive pagine wiki. Tutto vive dentro Obsidian.
- **🔌 Qualsiasi modello per cui già paghi.** Anthropic, Bedrock, OpenAI, ChatGPT Plan (Codex OAuth), Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-compatibile, endpoint personalizzato — oltre sedici provider, nessuno dei quali deve avere un endpoint per embedding.

---

## 🎯 Fa per me?

**✅ Sì, se:**

- **Vuoi una configurazione da 5 minuti, non un progetto da 5 ore.** Installa da Community Plugins → scegli un provider → Ingest una nota. Niente CLI, niente Python, niente runtime separato, niente DB vettoriale. Vedi le pagine wiki in `wiki/` in pochi secondi.
- **Vuoi qualcosa di pulito e autonomo.** Il plugin ha esattamente zero dipendenze esterne: niente modello di embedding, niente database vettoriale, niente pacchetto pip, niente container Docker. È un singolo plugin Obsidian che legge le tue note, parla con un LLM e scrive pagine wiki nel tuo vault. Tutto vive dentro Obsidian.
- **Vuoi una chat interrogabile che risponda dalle *tue* note** — non da internet — con ogni risposta che porta `[[wiki-link]]` di ritorno nel tuo grafo della conoscenza.
- **Ti importa della sovranità dei dati** — funziona completamente in locale con Ollama o LM Studio, senza mai toccare internet.
- **Scrivi o leggi in una qualsiasi delle 11 lingue supportate** — l'interfaccia e la lingua di output del wiki sono indipendenti (il tuo wiki può essere in cinese mentre l'interfaccia è in inglese).
- **Mantieni il grafo scrivendo `[[wiki-link]]`** — ogni link che scrivi arricchisce già il recupero; nessun passaggio separato di tagging/embedding/indicizzazione.
- **Vuoi manutenzione con un clic** — scansione salute Lint + Smart Fix All tengono sotto controllo duplicati, link morti e pagine orfane senza che tu debba curare a mano.

**❌ No, se:**

- **Vuoi un sostituto generico di ChatGPT** — le risposte arrivano solo dal tuo vault, non da internet.
- **Hai bisogno di RAG su grandi corpora esterni** (Confluence, Notion, arXiv, pagine web scaricate) — il plugin ingerisce il tuo vault più i file PDF/Office indipendenti; il RAG massivo su corpora esterni è fuori ambito per design.
- **Vuoi un SaaS ospitato con collaborazione in team** — non c'è backend, non c'è server, non c'è stato condiviso; tutto gira localmente dentro il tuo Obsidian.

---

## 🚀 Avvio rapido

1. **Installa.** Obsidian → Impostazioni → Plugin della community → Sfoglia → cerca "Karpathy LLM Wiki" → Installa → Abilita. Oppure visita la [pagina del plugin della community](https://community.obsidian.md/plugins/karpathywiki) e clicca su **Add to Obsidian**.
2. **Configura un provider.** Apri Impostazioni → Karpathy LLM Wiki → scegli un provider (OpenAI, Anthropic, Ollama, ChatGPT Plan (Codex OAuth), ecc.) → inserisci la chiave API (non necessaria per provider locali) → clicca su **Test Connection** → Salva.
3. **Ingerisci una nota.** Due modalità:
   - **⌨️ Tastiera:** `Cmd+P/Ctrl+P` → "Ingest single source" → scegli un file Markdown (o PDF, v1.25.0+).
   - **🖱️ Icona della barra degli strumenti:** Clicca sull'**icona sticker** nella barra sinistra di Obsidian per ingerire istantaneamente la nota attualmente aperta — niente menu da cercare.
   
   Le tue prime pagine wiki appaiono in `wiki/sources/`, `wiki/entities/`, `wiki/concepts/` in pochi secondi.
4. **Interroga il tuo wiki.** Due modalità:
   - **⌨️ Tastiera:** `Cmd+P/Ctrl+P` → "Query wiki".
   - **🖱️ Icona della barra degli strumenti:** Clicca sull'**icona fumetto** nella barra sinistra di Obsidian.
   
   Si apre un pannello laterale destro in stile Copilot in cui puoi chattare con il tuo wiki. Le risposte portano `[[wiki-link]]` che tornano al tuo grafo di conoscenza.

![Pannello Query ancorato a destra in Obsidian, con interfaccia chat le cui risposte portano wiki-link di ritorno al tuo grafo della conoscenza](/docs/assets/query-side-panel.png)

Questo è tutto. Il plugin non modifica nulla nelle tue note originali — crea solo nuove pagine in `wiki/`. Sia **Ingest** che **Query wiki** sono fissati alla barra sinistra per un accesso con un clic in qualsiasi momento. (`Cmd` su macOS, `Ctrl` su Windows/Linux.)

### Comandi principali

| Comando | Cosa fa |
|---------|---------|
| **📥 Ingest singola fonte** | `Cmd+P/Ctrl+P` → "Ingest single source" — scegli un file Markdown o **PDF (v1.25.0+)** , ottieni pagine entità/concetto/wiki. *Oppure: 🖱️ clicca sull'icona sticker nella barra sinistra sulla nota attiva.* |
| **📂 Ingest da cartella** | `Cmd+P/Ctrl+P` → "Ingest from folder" — ingest in batch di ogni nota in una cartella, con salto intelligente dei già elaborati |
| **📑 Ingest file multipli** | `Cmd+P/Ctrl+P` → "Ingest multiple files" — seleziona un sottoinsieme tramite albero cartelle a due pannelli (con coda live + annullamento per file) |
| **🔍 Query wiki** | `Cmd+P/Ctrl+P` → "Query wiki" — chatta con il tuo wiki in un pannello laterale ancorato a destra; le risposte portano `[[wiki-link]]`. *Oppure: 🖱️ clicca sull'icona fumetto nella barra sinistra.* |
| **🛠️ Lint wiki** | `Cmd+P/Ctrl+P` → "Lint wiki" — scansione salute completa: duplicati, link morti, pagine vuote, orfani, alias mancanti, contraddizioni |
| **⚡ Smart Fix All** | dentro il modale Lint — riparazione in ordine causale con un clic e report per fase |
| **📋 Rigenera indice** | `Cmd+P/Ctrl+P` → "Regenerate index" — ricostruisce `wiki/index.md` con pagine e alias correnti |
| **⏹ Annulla** | `Cmd+P/Ctrl+P` → "Cancel current ingestion" o clicca sulla barra di stato — si ferma pulitamente al prossimo limite di lotto |
| **📊 Cronologia ingestioni** | `Cmd+P/Ctrl+P` → "View Ingestion History" — interfaccia ricercabile per ingestioni passate, report lint ed esecuzioni di manutenzione |

![Command panel — all LLM Wiki commands live in Obsidian's command palette](/docs/assets/command-panel.png)
| Prima | Dopo |
|-------|------|
| `notes/machine-learning.md` (un file piatto) | `wiki/concepts/supervised-learning.md` con `[[collegamenti bidirezionali]]`, alias, attribuzione della fonte e una voce in `wiki/index.md` |

> 📖 Guide passo passo in [GitHub Discussions → Guides](https://github.com/green-dalii/obsidian-llm-wiki/discussions/categories/guides). Ti è stato utile? [Metti una stella al repo](https://github.com/green-dalii/obsidian-llm-wiki) per seguire le release.

---

## ✨ Funzionalità

### 📚 Qualità della conoscenza

- **🔍 Estrazione di entità e concetti** — l'LLM estrae entità (persone, organizzazioni, prodotti, eventi) e concetti (teorie, metodi, termini) in pagine autonome. La granularità è configurabile (Minima → Fine, più Personalizzata) così da bilanciare costo e profondità.
- **🏷️ Alias obbligatori** — ogni pagina viene creata con almeno un alias (traduzione, abbreviazione, variante) così il rilevamento dei duplicati tra lingue funziona.
- **🔄 Rilevamento duplicati a livelli** — Livello 1 (corrispondenza nome diretta: cross-lingua, abbreviazione, titoli ad alta similarità) sempre verificato; Livello 2 (link condivisi, similarità media) riempie il budget di token rimanente.
- **🧩 Fusione intelligente e stato contraddizioni** — i duplicati vengono uniti preservando gli alias; le contraddizioni vengono segnalate con attribuzione della fonte; le pagine `reviewed: true` sono protette dalla sovrascrittura.
- **🎨 Vocabolario tag personalizzabile** — definisci le tue liste di tag per tipo di entità e concetto in Impostazioni → Wiki → Vocabolario tag → *Personalizzato*. Il vocabolario è un hint di iniezione di schema per l'LLM, non un gate di scrittura — i modelli piccoli/locali possono comunque derivare (circa uno su dieci restituisce la tassonomia integrata del modello). Lint segnala il resto. Ancora di progetto per il enforcement dello schema: [Issue #328](https://github.com/green-dalii/obsidian-llm-wiki/issues/328).

### 📄 Ingest di Documenti / PDF / Immagini

Cinque percorsi, commutabili per ingest:

1. **🆕 Backend MinerU integrato (v1.27.0, #404)** — Impostazioni → Configurazione Wiki → Backend di conversione Markdown → *MinerU*. PDF + immagini (PNG/JPG/JPEG/JP2/WebP/GIF/BMP) + Office (DOC/DOCX/PPT/PPTX/XLS/XLSX) tramite il [parser Precise di MinerU](https://mineru.net/apiManage/docs). Token in Obsidian SecretStorage. Percorso migliore per articoli scientifici, documenti scansionati e file Office in cui la conservazione del layout è importante. Limiti del server: 200 MB / 200 pagine per PDF, 256 MB / 10.000 file per archivio.
2. **☁️ Provider cloud con PDF nativo** — Anthropic, OpenAI, Google Gemini e AWS Bedrock (varianti Anthropic + OpenAI) leggono i PDF come file parts out of the box. Nessuna configurazione oltre la selezione del provider.
3. **🖥️ OCR locale su Apple Silicon** — [oMLX](https://github.com/jundot/omlx) integra Microsoft Markitdown come backend PDF→Markdown integrato. Abilita Markitdown in oMLX, carica [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) (3B / 570M-attivi, open-source 2026-06) come modello visivo, punta il plugin a oMLX come provider personalizzato compatibile OpenAI, attiva **Force PDF Support** e scegli il modello multimodale che oMLX sta servendo. Il PDF non lascia mai la tua macchina.
4. **🛠️ Estrattore di terze parti (UI online MinerU)** — usa il [servizio online MinerU Extractor](https://mineru.net/OpenSourceTools/Extractor) per una rapida UI manuale quando non vuoi configurare un token API. Scarica il `.md` convertito, mettilo nel tuo vault fuori dalla cartella wiki e ingeriscilo come una normale nota Markdown.
5. **🔌 Force PDF Support** — per qualsiasi altro endpoint OpenAI/Anthropic-compatibile che accetti file parts, il plugin tenta la chiamata (Impostazioni → Configurazione LLM → Avanzate). L'endpoint decide; gli errori si presentano come Notice localizzata.

**Avvertenza per i formati Office:** Obsidian non renderizza nativamente `.docx` / `.xlsx` / `.pptx` ([file-formats](https://obsidian.md/help/file-formats)), quindi il flusso pratico per i file Office è: MinerU converte in `.md`, il plugin ingerisce quel `.md` nelle pagine wiki, e il file Office originale viene conservato come riferimento. Se ti serve l'anteprima inline dei file Office, usa un plugin della community come Pandoc Plugin / Docxer / Md Importer / Office Reader.

**Infrastruttura comune a tutti i percorsi:**

- **🗄️ Cache limitata** — `.obsidian/plugins/karpathywiki/pdf-cache/` memorizza il Markdown convertito indicizzato per hash del contenuto + modello + versione del convertitore; limiti 100 MB totali / 1000 voci / 10 MB per singola voce con eviction LRU-by-mtime.
- **📝 Sidecar vault opzionale** — Impostazioni → Configurazione Wiki → Cartella Wiki → *Write PDF Markdown to Vault* scrive `<basename>.pdf.md` accanto al PDF sorgente (disattivato per default — solo cache è il default).
- **🛡️ Prompt trascrittore verbatim** — conversione in stile OCR con marcatori anti-allucinazione `[illegible]` / `[figure: ...]`; l'incapsulamento in fence markdown da parte di modelli locali piccoli viene automaticamente pulito prima della scrittura in cache.
- **🔁 Citazioni verbatim della pagina sorgente (v1.27.0, #496)** — ogni pagina generata `sources/<slug>.md` ora contiene una sezione `Menzioni nella sorgente` costruita a partire dalle stesse citazioni verbatim che l'estrazione ha catturato per entità/concetto (la prosa di cui il modello ha già dimostrato di poter vedere), così il documento sottostante è l'unica pagina wiki con una traccia reale e ancorata al testo sorgente.

📖 **Guide complete** per tutti i percorsi (provider cloud, livelli hardware oMLX, installazione MinerU, manutenzione cache) → [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 Query e manutenzione

- **🧭 Cascata PPR a 5 stadi** — vedi [Come funziona il recupero](#-come-funziona-il-recupero). Personalized PageRank sul grafo `[[wiki-link]]` fornisce contesto multi-hop consapevole del grafo.
- **🪟 Pannello laterale ancorato a destra** — Query Wiki si apre in un leaf laterale destro in stile Copilot (v1.22.1+) invece di un modale centrato.
- **🔍 Scansione salute Lint** — un singolo comando rileva: duplicati, link morti, pagine vuote, orfani, alias mancanti, contraddizioni.
- **⚡ Smart Fix All** — riparazione in ordine causale con un clic: completa alias → unisci duplicati → correggi link morti → collega orfani → espandi pagine vuote, con report per fase.
- **🆕 Esito «lascia stare» per Fix Dead Links (v1.27.0, #485)** — Impostazioni → Avanzate → *Crea stub per link non risolvibili* (default ATTIVO) permette di rinunciare alle pagine segnaposto vuote: quando è disattivato, il link morto resta visibile in ogni report lint finché una vera sorgente non lo definisce, e l'ingest crea le pagine attraverso i canali normali. Il gate «non espandere mai via LLM» di #197 resta invariato — il nuovo controllo regola solo se la pagina stub viene *scritta o meno*.
- **📊 Pannello cronologia operazioni** — interfaccia ricercabile e filtrabile per ingestioni passate, report lint ed esecuzioni di manutenzione.
- **🛡️ Portale di pre-ingest** — le note vuote / solo spazi / solo frontmatter vengono rifiutate prima di qualsiasi chiamata LLM; la deduplicazione per hash del contenuto rileva file identici attraverso i percorsi.
- **🆕 Gate candidati in ingest (v1.27.0, #514 / PR #521)** — toggle opt-in (`skipMentionOnlyCandidates`, default disattivato, Impostazioni → Avanzate). Per le sorgenti la cui lingua ha un profilo misurato (de misurato; en/fr/es/pt/nl/ko stimato con casi limite fissati; soglie di script a caratteri per zh/ja non misurate), i candidati nominati solo dentro parentesi / enumerazioni / voci di elenchi brevi vengono potati prima che costino una pagina più chiamate di dedup e generazione. Le note cross-lingua non vengono filtrate; le lingue del wiki senza un profilo vengono segnalate una volta per ingest e non vengono mai saltate silenziosamente.
- **🆕 Policy per-task (v1.27.0, #525 / #490)** — LLM Avanzate → campo Policy per-task; sovrascrivi l'impostazione per-step di modalità testo / thinking senza modifiche al codice. La baseline integrata resta intatta per gli step che non elenchi.

### 🔒 Privacy

- **🚫 Nessun backend, nessun tracciamento, nessuna analisi.** Funziona interamente dentro Obsidian. La rete è usata solo per comunicare con il provider LLM che configuri.
- **📁 I file sorgente sono sola lettura.** Il plugin non modifica mai le tue note originali del vault — crea solo nuove pagine in `wiki/`.
- **🦙 Modalità completamente locale.** Ollama, LM Studio o qualsiasi endpoint locale compatibile OpenAI → le tue note non lasciano mai la tua macchina.
- **🔐 Permessi minimi.** Accesso ai file del vault per la gestione del wiki. Accesso agli appunti solo quando clicchi il pulsante "Copia" nel modale Query.

### 🦙 Locale prima di tutto

- **🖥️ Ollama, LM Studio, OpenRouter, endpoint personalizzato** — pronti all'uso. I modelli locali funzionano per le query (finestre di contesto più piccole); l'ingest su un vault di 2000 pagine di solito richiede un modello cloud a contesto lungo.
- **📄 Il percorso OCR PDF è completamente locale su Apple Silicon** — vedi [Ingest di Documenti / PDF / Immagini](#-ingest-di-documenti--pdf--immagini) sopra.
- **🔐 ChatGPT Plan (Codex OAuth)** — loopback desktop o codice dispositivo mobile; le credenziali vivono solo in Obsidian SecretStorage. (Vedi [Anthropic vs OpenAI vs Codex OAuth](#-anthropic-vs-openai-vs-codex-oauth--sono-provider-distinti) sotto per la spiegazione completa dei confini tra provider.)

### 🌐 Lingua

- **🌍 11 lingue per l'interfaccia** — Inglese, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano, Русский. L'interfaccia e la lingua di output del wiki sono indipendenti — il tuo wiki può essere in cinese mentre l'interfaccia è in inglese.
- **📚 11 lingue per l'output del wiki** — stesso set; scegli in Impostazioni → Configurazione Wiki. Opzione *Input personalizzato* per prompt ad-hoc.
- **Tutte le stringhe UI tradotte per locale** — ogni etichetta, modale e notifica. Aggiungere una dodicesima lingua è guidato dai contributori (pattern PR #159).

---

## 🌐 Ecosistema

Il plugin si compone con il resto del tuo stack Obsidian — ciascuno degli strumenti seguenti si integra nel grafo `[[wiki-link]]` senza modifiche al codice.

- **📄 [Backend multi-formato MinerU](https://mineru.net/apiManage/docs) (integrato dalla v1.27.0)** — quello che prima era un passo CLI/UI separato ora è un interruttore del plugin; vedi [Ingest di Documenti / PDF / Immagini](#-ingest-di-documenti--pdf--immagini) per la tabella completa dei percorsi. Il [servizio online MinerU](https://mineru.net/OpenSourceTools/Extractor) resta disponibile per gli utenti che preferiscono una rapida UI all'uso del token API; [auto-ospitare MinerU](https://github.com/opendatalab/mineru) è anch'esso un'opzione.
- **🕸️ Obsidian Graph View** — apri la vista grafo nativa su qualsiasi pagina wiki; ogni `[[wiki-link]]` diventa un nodo, ogni backlink un arco. Integrato, dimensione del bundle aggiuntiva pari a zero.
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** — estensione ufficiale del browser. Salva pagine web (articoli, post di blog, thread di Reddit, Hacker News, ricette, articoli di ricerca, trascrizioni YouTube tramite Interpreter) in una qualsiasi cartella del tuo vault, poi esegui il comando «Ingerisci dalla cartella» del plugin per estrarre in batch entità e concetti.
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** — interroga il wiki come un database con DQL (`LIST FROM "wiki/entities" WHERE contains(tags, "person")`) o l'API JS. Il plugin scrive frontmatter standard (`tags:`, `type:`, `aliases:`) su ogni pagina, quindi le query Dataview funzionano senza configurazione.
- **🌿 Git** — versiona il tuo vault (con qualsiasi client Git). Il plugin non riscrive mai i tuoi file sorgente; crea solo nuove pagine sotto `wiki/`, quindi `git diff` separa chiaramente le tue modifiche dal contenuto generato dal LLM.
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** — trasforma qualsiasi nota di Obsidian in presentazioni di diapositive tramite il frontmatter Marp (`marp: true`). Le pagine wiki sono Markdown puro, vengono rese come diapositive senza conversione aggiuntiva.
- **🖼️ Canvas** — tela nativa infinita di Obsidian. Disponi schede wiki su un canvas per assemblare guide di studio, mappe mentali o sintesi di ricerca a partire da `[[wiki-links]]` senza lasciare il vault.
- **🎤 [Obsidian Nous](https://github.com/AndyMDH/obsidian-nous)** — plugin complementare per la cattura locale di memo vocali e riunioni (whisper.cpp su macOS; l'audio non lascia mai la macchina). Genera trascrizioni etichettate per parlante e le proprie pagine wiki hub. Indipendente da questo plugin — entrambi possono condividere lo stesso vault senza accoppiamento.

---

## 🧰 CLI headless

**La maggior parte degli utenti può ignorare questa sezione.** La CLI rivolta all'utente del plugin vive nel repo fratello [green-dalii/obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli) — installa con `npm i -g karpathywiki-cli` ed esegui `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`.

Quello che spedisce questo repo in `tools/dev-instrument/` è lo **strumento di misurazione headless solo-dev** per i contributori del motore — esegue il vero `WikiEngine.ingestSource` contro un vault su disco senza runtime Obsidian, stampa la contabilità di token + wall-clock per-task — gli stessi numeri che alimentano le prove di prestazioni in `CLAUDE.md` e nelle release notes. Vedi [`tools/dev-instrument/README.md`](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/tools/dev-instrument/README.md) per il comando di ingresso, le variabili d'ambiente, le modalità di misurazione e la specifica del codice di uscita.

## 🔍 Come funziona il recupero

La maggior parte dei plugin di "ricerca AI" frammenta le tue note in chunk e le incorpora in un DB vettoriale. Noi no. L'[argomento di Karpathy contro il RAG](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) è che il chunking rompe la capacità dell'LLM di ragionare sull'intero grafo della conoscenza — e quell'argomento regge in pratica. Invece, percorriamo il grafo che già mantieni scrivendo `[[wiki-link]]`.

### La cascata di selezione seed a 5 stadi

Quando chiedi "Chi ha fondato Microsoft?", Query Wiki esegue cinque stadi prima di qualsiasi generazione di risposta:

1. **Percorso rapido Lex** — controllo diretto di sovrapposizione di token contro ogni titolo di entità/concetto e alias. Gratuito, istantaneo e fa da gate per tutto ciò che segue.
2. **Generazione di keyword via LLM** — l'LLM propone 8–12 keyword cross-lingua dalla tua domanda (gestisce sinonimi, abbreviazioni e termini resistenti alla sovrapposizione di token in una singola chiamata LLM).
3. **Scansione locale di sottostringhe** — ogni keyword generata viene ri-matchata localmente contro titoli di pagina, alias e snippet del corpo. Nessuna chiamata LLM extra; completa il recall tollerante al rumore.
4. **Fallback KB LLM** — quando lex + scansione keyword restituiscono segnali deboli, l'LLM ri-semina i top-N candidati con un passaggio semantico sull'intero wiki.
5. **Espansione del grafo PPR** — Personalized PageRank (Haveliwala 2002) sul grafo `[[wiki-link]]` a partire dall'insieme di seed candidati. Questo è ciò che fornisce contesto multi-hop consapevole del grafo: "Bill Gates" → "Microsoft" → "concorrenti", non solo sovrapposizione letterale dei titoli.

La cascata si interrompe allo stadio che ha restituito segnale sufficiente — nessun costo fisso di 5 stadi; nessuna chiamata LLM quando lex basta; fallback semantico solo quando lex + scansione keyword da soli non bastano.

### Personalized PageRank su larga scala

Usiamo Monte Carlo PPR (Fogaras 2005) — 3.000 cammini casuali × 50 passi ciascuno — con la regola dead-end di Haveliwala 2002. Il costo è **O(K × L)** (K = cammini, L = passi per cammino), indipendente dal numero di pagine, quindi un vault di 2000 pagine vede la stessa latenza di espansione di uno di 200 pagine.

**PPR @5 = 27,1% vs baseline pura kNN 24,1%** sul corpus di benchmark del progetto (l'unico benchmark di recupero pubblicato in questo spazio open-source LLM-Wiki).

### Perché niente embedding

Abbiamo deliberatamente rifiutato il percorso degli embedding in [Issue #175](https://github.com/green-dalii/obsidian-llm-wiki/issues/175). Il segnale del grafo è già lì — ogni `[[wiki-link]]` è un arco "questi sono correlati" curato a mano, e la maggior parte dei provider che supportiamo (Ollama, LM Studio, Anthropic, Bedrock, Kimi, GLM, MiniMax) non hanno affatto un endpoint `/v1/embeddings`. Aggiungere un modello di embedding significherebbe un download per pagina, un adattatore per provider e zero benefici sulla qualità del recupero.

---

## 🤖 Modelli

**Provider supportati (16+, tutti verificati su models.dev a luglio 2026):**

| Provider | Serie | Note |
|----------|-------|------|
| **Anthropic** | Serie Claude 5 | PDF nativo; protocollo `/v1/messages` |
| **OpenAI** | Serie GPT-5.6 (Sol / Terra / Luna) | PDF nativo; chiave API Platform |
| **Google Gemini** | Serie Gemini 3.6 | PDF nativo (file part dalla 1.5); endpoint compatibile OpenAI |
| **DeepSeek** | Serie DeepSeek V4 | Compatibile OpenAI; livello di costo più basso |
| **Alibaba Qwen** | Serie Qwen3.7/3.8 | Compatibile OpenAI (DashScope) |
| **xAI Grok** | Serie Grok 4 | Compatibile OpenAI; contesto lungo |
| **Moonshot Kimi** | Serie Kimi K3 | Compatibile OpenAI; frontiera 2.8T MoE |
| **Zhipu GLM** | Serie GLM-5 | Compatibile OpenAI; forte bilingue |
| **MiniMax** | Serie MiniMax M3 | Compatibile OpenAI; 1M di contesto |
| **Step (阶跃星辰)** | Serie Step 3 (Flash) | Compatibile OpenAI; inferenza veloce |
| **Tencent Hunyuan** | Serie Hy3 | Compatibile OpenAI; MoE open-weight |
| **Xiaomi MiMo** | Serie MiMo V2.5 | Open-source MIT; prezzi piatti |
| **Google Gemma** | Serie Gemma 4 | Open-weight; contesto 262K |
| **AWS Bedrock** | Varianti Anthropic + OpenAI | Percorso VPC / conformità; **API key + SSO + IAM** (v1.27.0, #425) |
| **ChatGPT Plan (Codex OAuth)** | Codex Responses API | Accesso via browser/codice dispositivo; SecretStorage |
| **Locali: Ollama, LM Studio, OpenRouter, Anthropic-Compatibile** | Qualsiasi modello protocollo OpenAI/Anthropic | OpenAI-Compatibile Personalizzato + Anthropic-Compatibile (Token Plan / Coding Plan) |

Questo plugin alimenta l'LLM con il contesto completo del tuo Wiki per ogni query — quindi **vincono i modelli a contesto lungo**. La tabella completa a livelli (cloud + locale) vive in [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md), verificata su [models.dev](https://models.dev/) per mantenere le scelte aggiornate.

### Cosa conta

- **🧠 Finestra di contesto ≥ 200K token** per vault oltre ~500 pagine. Sotto 200K la cascata può scartare stadi precedenti per rientrare.
- **⚖️ La qualità nel seguire le istruzioni** conta più del QI grezzo per il compito di estrazione — scegli un modello che segua il template dello schema, non il numero più alto in classifica.
- **🔌 L'endpoint di embedding è irrilevante** — non usiamo embedding. Un provider che non ha `/v1/embeddings` va bene (la maggior parte dei nostri 16+ provider non lo fornisce).
- **🦙 Locale per le query, cloud per l'ingest** — l'ingest su un vault di 2000 pagine di solito richiede un modello cloud a contesto lungo; un modello locale da 262K copre la maggior parte delle query.

Per ingest di PDF / immagini / Office, vedi [Ingest di Documenti / PDF / Immagini](#-ingest-di-documenti--pdf--immagini) in Funzionalità — Anthropic, OpenAI, Bedrock e Gemini leggono i PDF come file parts nativamente; il backend MinerU integrato (v1.27.0+) e **Force PDF Support** coprono tutto il resto.

### Anthropic vs OpenAI vs Codex OAuth — sono provider distinti

- **Anthropic** (e la sua variante Bedrock) — chiave API Anthropic Platform fatturata separatamente.
- **OpenAI** — chiave API OpenAI Platform fatturata separatamente.
- **ChatGPT Plan (Codex OAuth)** — provider sperimentale e distinto che usa un'idoneità Codex idonea dopo l'accesso via browser o codice dispositivo; la disponibilità segue le politiche di autenticazione e idoneità di OpenAI Codex, non il nome del piano. Compatibilità Codex di terze parti, non una partnership OpenAI o un'API ChatGPT generale.

### AWS Bedrock — tre modalità di autenticazione (v1.27.0, #425)

Impostazioni → Provider → Bedrock (Anthropic / OpenAI) ora sceglie una delle tre modalità di autenticazione; la riga del provider chiede poi solo gli input di cui quella modalità ha effettivamente bisogno:

- **API key** — il percorso bearer Stage-1 originale; il comportamento è identico byte-per-byte alla v1.26.4 ed è la scelta raccomandata per chi ha già una chiave API Bedrock a pagamento.
- **SSO** — flusso device di IAM Identity Center. Clicca *Accedi con AWS SSO*, incolla il codice dell'URL di verifica nel browser, il plugin riceve un token SSO tramite `karpathywiki-bedrock-sso` in SecretStorage, lo scambia con credenziali di ruolo temporanee e firma ogni richiesta con SigV4 scritto a mano (nessun AWS SDK aggiunto). Account ID e nome del ruolo sono auto-rilevati quando l'identità SSO ne espone esattamente uno per tipo; altrimenti inseriscili nelle impostazioni del provider.
- **IAM** — chiavi di accesso statiche per ambienti senza SSO (CI, job batch pianificati). Memorizzate in `karpathywiki-bedrock-iam` in SecretStorage; la cache in memoria memoizza per access-key per mantenere la firma SigV4 entro la scadenza.

Tutte e tre le modalità condividono la stessa disciplina Obsidian SecretStorage (nessuna credenziale in `data.json`, log o documentazione) e lo stesso percorso OIDC + SigV4 scritto a mano zero-AWS-SDK. La regione Bedrock è indipendente dalla modalità di autenticazione e si configura nella stessa riga del provider.

> 📖 **Tabella di scelta completa** (cloud + locale + OCR PDF + Codex OAuth + quantizzazione + livelli hardware) → [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

---

## ❓ FAQ

### Cosa fa esattamente il plugin?

Scegli una nota, cartella o selezione; l'LLM estrae entità e concetti e genera un wiki interconnesso con `[[collegamenti bidirezionali]]`. Fai domande e ottieni risposte conversazionali basate sulle *tue* note, non su internet. Le tue note originali del vault non vengono mai modificate.

### Come si inizia?

Installa da Obsidian Community Plugins → scegli un provider → **Test Connection** → esegui **Ingest single source** su una qualsiasi nota. Le prime pagine wiki appaiono in pochi secondi. Vedi [Avvio rapido](#-avvio-rapido).

### Posso ingerire PDF, immagini e documenti Office?

✅ Sì. Anthropic, OpenAI, Bedrock e Gemini leggono i PDF nativamente; il backend MinerU integrato (v1.27.0) copre tutto il resto (PDF + immagini + Office). Tutorial completo — provider cloud, OCR su Apple Silicon, Force PDF Support, manutenzione cache — in [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md).

### Il mio wiki esistente è al sicuro?

✅ Retrocompatibile dalla v1.0.0. Imposta `reviewed: true` su qualsiasi pagina per proteggerla dalla sovrascrittura. L'aggiornamento dalla v1.24.x non riscrive il tuo vault; l'ingest PDF della v1.25.0 è solo cache per default, e v1.27.0 aggiunge l'ingest nativo di PDF + immagini + Office senza modificare il layout del wiki su disco.

### I miei dati vengono inviati da qualche parte?

🚫 Nessun backend, nessuna analisi — il plugin funziona interamente dentro Obsidian. Solo il testo che invii esplicitamente per ingest/query lascia il tuo dispositivo, e solo verso il provider LLM che configuri. Per la completa località dei dati, usa Ollama o LM Studio.

### Posso usare il plugin nella mia lingua?

🌍 11 lingue sia per l'interfaccia che per l'output del wiki. Interfaccia e lingua del wiki sono indipendenti. Aggiungere una dodicesima lingua è guidato dai contributori (pattern PR #159).

### In cosa si differenzia da un chatbot RAG?

🚫 Nessun chunking. 🚫 Nessun embedding. 🚫 Nessun DB vettoriale. ✅ Personalized PageRank sul tuo grafo `[[wiki-link]]` esistente — contesto multi-hop consapevole del grafo, costo embedding zero, supporto completo per modelli locali.

### Quale LLM dovrei usare?

I modelli a contesto lungo (≥200K token) funzionano meglio. La [sezione Modelli](#-modelli) copre i principi; la tabella completa a livelli è in [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md).

### Esiste un benchmark pubblicato?

Sì — PPR @5 = 27,1% vs baseline pura kNN 24,1% sul corpus del progetto. La pipeline completa e lo script di benchmark sono descritti in [Come funziona il recupero](#-come-funziona-il-recupero).

### Come controllo i costi API?

Usa la granularità di estrazione Grossolana o Minima per l'ingest in batch. Smart Batch Skip rileva automaticamente i file già elaborati. La manutenzione automatica è DISATTIVATA per default. Lint mostra i conteggi prima di eseguire le correzioni — nulla viene addebitato senza la tua approvazione.

### Come annullo un'operazione in corso?

Clicca sulla barra di stato (mostra "Ingesting… click to cancel") o `Cmd+P/Ctrl+P` → "Cancel current ingestion". Si ferma pulitamente al prossimo limite di lotto.

### Dove trovo aiuto?

[GitHub Issues](https://github.com/green-dalii/obsidian-llm-wiki/issues) per segnalazioni di bug · [GitHub Discussions](https://github.com/green-dalii/obsidian-llm-wiki/discussions) per domande e richieste di funzionalità · Console sviluppatore (`Ctrl+Shift+I` / `Cmd+Option+I`) per i log del plugin.

---

## 🔒 Privacy

Questo plugin è elencato sul Marketplace dei plugin della community di Obsidian ed è sottoposto a una verifica automatizzata di sicurezza e permessi.

- **🚫 Nessun backend, nessun server, nessuna raccolta dati.** Software puramente locale eseguito all'interno di Obsidian. Il plugin non può e non raccoglie, archivia o trasmette i tuoi dati ad alcun server — perché tale server non esiste.
- **🔐 L'accesso alla rete è opt-in.** Usato solo per comunicare con il provider LLM che configuri. Scegli tu il provider, inserisci tu la chiave API, decidi tu dove vanno i tuoi dati.
- **📁 L'accesso ai file del vault** è usato per la gestione del wiki (leggere note, generare pagine, scansionare link morti, rilevare duplicati). Il plugin non modifica mai i tuoi file sorgente.
- **📋 L'accesso agli appunti** è usato esclusivamente dal pulsante "Copia" nel modale Query — e solo quando ci clicchi sopra.

Per la completa località dei dati, usa Ollama o LM Studio. Con un provider locale, i tuoi dati non lasciano mai la tua macchina.

---

## 💖 Supporto

Se LLM-Wiki è diventato una parte significativa del tuo flusso di lavoro della conoscenza:

- ☕ **[Offrimi un caffè su Ko-fi](https://ko-fi.com/greenerdalii)** — supporto una tantum o mensile
- 💳 **[Mancia tramite PayPal](https://paypal.me/greenerdalii)** — mancia una tantum

Grazie ai seguenti per aver sostenuto il progetto:

[@jameses-cyber](https://github.com/jameses-cyber), [@issaqua](https://github.com/issaqua), Dikson Choi

---

## 🔭 Altri progetti

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — la CLI di ingest headless, repo fratello pubblicato come pacchetto npm `karpathywiki-cli`. Esegue lo stesso `WikiEngine` contro un vault su disco, senza renderer. Installa con `npm i -g karpathywiki-cli`. La `tools/dev-instrument/` nell'albero è lo strumento di misurazione solo-dev che genera i numeri di costo per-task nelle note di rilascio di questo plugin.
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — un router a livello di task per [pi-coding-agent](https://github.com/earendil-works/pi). Prima di ogni turno un piccolo giudice LLM classifica il tuo messaggio come ordinario o importante, e il livello scelto porta avanti l'intero turno. Sui task complessi va oltre: il livello Smart fa da CTO, pianifica il lavoro, delega l'implementazione ai subagent Fast, rivede ogni risultato e itera. Salire di livello è immediato, scendere richiede una tendenza che si consolidi, e le catene di fallback per livello assorbono 429 e 5xx. Zero dipendenze a runtime, MIT. → [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — fork DSH di pi-shift-router, che condivide lo stesso design di routing a livello di task ma è rivolto al runtime [dsh-coding-agent](https://github.com/earendil-works/dsh). Stesse scelte di livello guidate dal giudice, stesse catene di fallback per livello, MIT.
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — equivalente DSH del flusso di lavoro `obsidian-plugin-dev` (lato Claude): predispone uno spazio di lavoro per plugin Obsidian, guida il loop TDD Red→Green, esegue la chiusura di qualità Six-Gate (lint/tsc/test/build/css-lint) e prepara un ramo pronto per il rilascio su `feat/*` o `fix/*`. Pensato affinché i contributori che usano DSH ottengano la stessa esperienza di scaffolding + gate senza copiare e incollare da CLAUDE.md.

---

## 📜 Licenza e crediti

Licenza Apache, Versione 2.0 — vedi [LICENSE](../LICENSE) e [NOTICE](../NOTICE).

**Costruito su:**
- 💡 [LLM Wiki di Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — il concetto originale
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v6](https://ai-sdk.dev/) (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) via Obsidian `requestUrl`
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) e [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — algoritmi di recupero

**Manutentore:** [@green-dalii](https://github.com/green-dalii)

[![Star History Chart](https://api.star-history.com/chart?repos=green-dalii/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
