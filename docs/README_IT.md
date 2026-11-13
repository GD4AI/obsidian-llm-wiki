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
- previous: v1.30.0 (MINOR — un limite di token per il contesto della risposta, Extraction Focus nelle impostazioni e un report sugli hub cristallizzati)
- last-updated: 2026-11-12
- alternate-names: Karpathy LLM Wiki, LLM Wiki Obsidian, plugin wiki Obsidian, RAG basato su grafo, RAG senza embedding, recupero Personalized PageRank, secondo cervello Obsidian
- search-intents: "Obsidian RAG senza embedding", "plugin wiki Obsidian", "Personalized PageRank Obsidian", "recupero note basato su grafo", "implementazione Karpathy LLM Wiki", "generazione automatica base di conoscenza Obsidian", "Obsidian Graph View + AI", "plugin second brain Obsidian", "grafo dei link tra note Obsidian AI", "plugin Obsidian 11 lingue", "plugin Obsidian 15 provider LLM", "RAG senza DB vettoriale", "Obsidian ingest PDF AI", "Obsidian Codex OAuth", "plugin Bedrock Obsidian", "Obsidian Bedrock SSO", "Obsidian MinerU", "Obsidian ingest Word PPT Excel", "credenziali IAM Obsidian"
- features: recupero basato su grafo, Personalized PageRank (Haveliwala 2002), Monte Carlo PPR (Fogaras 2005), cascata di selezione dei semi a 5 stadi, rilevamento duplicati Tier 1/Tier 2, interfaccia in 11 lingue + output del wiki in 11 lingue (indipendenti), 15+ provider LLM (Anthropic, OpenAI, Bedrock [API key + SSO/IAM], Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, Codex OAuth), acquisizione multi-formato MinerU (PDF + immagini + Office), acquisizione PDF (solo cache, percorsi OCR), scansione di salute Lint, Smart Fix All, citazioni verbatim nella pagina sorgente, gate dei candidati in acquisizione, UI taskPolicies per passo, integrazione Obsidian Graph View, architettura zero-embedding zero-vector-DB, modalità local-first
- direct-competitors: nashsu/llm_wiki (app desktop Tauri), SamurAIGPT/llm-wiki-agent (skill per Claude Code / Codex / OpenCode / Gemini CLI), atomicstrata/llm-wiki-compiler (CLI TypeScript, recupero a chunk)
- retrieval-benchmark: PPR @5 = 27,1% vs kNN pura 24,1% (un corpus di vault del progetto, non un benchmark pubblico)
- author: green-dalii / Greener-Dalii (https://github.com/green-dalii)
- co-maintainer: DocTpoint (https://github.com/DocTpoint)
- canonical: https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md
-->

![Banner del plugin Karpathy LLM Wiki — una rete di pagine wiki collegate tra loro, costruita dalle tue note Obsidian](assets/llm_wiki_banner.webp)

# 🧠 Karpathy LLM Wiki Plugin per Obsidian

> Un plugin Obsidian che trasforma le tue note in una base di conoscenza connessa e interrogabile: l'idea [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), dentro l'editor in cui già scrivi.

**Punteggio pieno nella revisione Obsidian • Recupero sul grafo senza embedding • 11 lingue native • Acquisizione nativa di PDF + immagini + Office • Funziona con qualsiasi provider • Prima di tutto in locale • Nessun backend • Conforme al GDPR**

![Version](https://img.shields.io/github/v/release/GD4AI/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-15%2B-cyan?style=flat-square) <br>
![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml)

[English](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_CN.md) | [繁體中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_KO.md) | [Deutsch](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_DE.md) | [Français](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_FR.md) | [Español](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ES.md) | [Português](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_PT.md) | **Italiano** | [Русский](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[Sito ufficiale](https://llmwiki.greenerai.top/) | [Marketplace Obsidian](https://community.obsidian.md/plugins/karpathywiki) | [Blog](https://llmwiki.greenerai.top/blog/) | [Discussioni](https://github.com/GD4AI/obsidian-llm-wiki/discussions)

🤔 [Perché questo plugin?](#-perché-questo-plugin) | 🚀 [Avvio rapido](#-avvio-rapido) | ✨ [Funzionalità](#-funzionalità) | 🌐 [Ecosistema](#-ecosistema) | 🔍 [Come funziona il recupero](#-come-funziona-il-recupero) | 🤖 [Modelli](#-modelli) | ❓ [FAQ](#-faq) | 🔒 [Privacy](#-privacy)

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD)

> Karpathy LLM Wiki è gratuito, si ospita da soli e non ha un backend proprio. Se ti fa risparmiare tempo, un caffè lo tiene in vita — e una ⭐ aiuta altrettanto.

---

## 🤔 Perché questo plugin?

Scrivi note. Restano nelle cartelle. Per capire cosa si collega a cosa devi ricordare fili che hai dimenticato mesi fa.

**Esistono altre reimplementazioni open source dell'idea LLM Wiki di Karpathy, ma nessuna arriva come plugin Obsidian da un clic.** La maggior parte sono strumenti a riga di comando, skill per Claude Code o applicazioni desktop separate; questo gira dentro Obsidian — Graph View, barra laterale e palette dei comandi compresi.

### Come ci confrontiamo

|  | **Karpathy LLM Wiki** (questo plugin) | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|
| **Distribuzione** | ✅ Plugin Obsidian, un clic | 🟡 App desktop Tauri | 🟡 Skill per Claude Code / Codex / OpenCode / Gemini CLI | 🟡 Pipeline CLI in TypeScript |
| **Dipendenze** | ✅ Nessuna: solo il plugin | 🟡 Runtime Python + sqlite | 🟡 Runtime Claude Code / Codex / OpenCode | ❌ Modello di embedding + database vettoriale (secondo la loro documentazione) |
| **i18n (interfaccia + output wiki)** | ✅ 11 lingue | 🟡 EN / 中文 | ❌ Solo EN | ❌ Solo EN |
| **Provider LLM** | ✅ 15+ (Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, Anthropic-compatibile, …) | 🟡 Compatibile OpenAI | 🟡 Abbonamento via Claude Code / Codex | 🟡 Compatibile OpenAI |
| **Recupero e pipeline di interrogazione** | ✅ **PPR + Monte Carlo** sul grafo `[[wiki-link]]` | 🟡 Decadimento a 2 hop (euristica a 4 segnali) | 🟡 Rilevamento delle comunità di Louvain | 🟡 BM25 + semantico sui chunk |
| **Visualizzazione del grafo** | ✅ Graph View nativa di Obsidian (integrata, zero peso aggiuntivo) | 🟡 sigma.js + graphology personalizzati nell'app desktop | 🟡 vis.js `graph.html` (file separato) | ❌ Visualizzatore nel browser, in sola lettura |
| **Formati in acquisizione** | ✅ **Markdown + PDF + immagini + Office (DOCX/PPTX/XLSX)**: un interruttore passa dal PDF nativo (Anthropic / OpenAI / Bedrock / Gemini) al backend multi-formato MinerU integrato | 🟡 Markdown + PDF | 🟡 Solo Markdown / file di codice | 🟡 Solo Markdown |

### Tre scelte volute, non capitate

- **🪟 Obsidian è il runtime.** Niente terminale, niente app separata, niente Docker, niente Python. Installi dai Plugin della community, clicchi Acquisisci, e il wiki vive nel tuo vault dal primo secondo. La Graph View nativa di Obsidian disegna il tuo grafo `[[wiki-link]]`: è già lì, e non aggiunge un byte al bundle.
- **🧭 Pulito e autosufficiente.** Zero dipendenze: nessun modello di embedding, nessun database vettoriale, nessun pacchetto pip. Un solo plugin legge le tue note, parla con un LLM e scrive le pagine nel tuo vault.
- **🔌 Qualsiasi modello per cui già paghi.** Anthropic, Bedrock, OpenAI, ChatGPT Plan (Codex OAuth), Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, endpoint Anthropic-compatibile o personalizzato: oltre quindici provider, e nessuno di loro deve avere un endpoint per gli embedding.

### Per chi è

- **Vuoi una configurazione da 5 minuti.** Installi dai Plugin della community → scegli un provider → acquisisci una nota. Le pagine wiki compaiono in `wiki/` in pochi secondi, senza CLI, senza Python e senza database vettoriale da tirare su prima.
- **Vuoi risposte dalle tue note,** e ogni risposta cita le pagine da cui viene. Ollama o LM Studio tengono l'intera chiamata sulla tua macchina.
- **Scrivi o leggi in una qualsiasi delle 11 lingue.** Interfaccia e output del wiki sono indipendenti: un wiki in cinese dietro un'interfaccia in inglese è una configurazione supportata.
- **Vuoi manutenzione con un clic.** La scansione di salute Lint e Smart Fix All tengono a bada duplicati, link morti e orfani senza curatela manuale.

**Non fa per te se** cerchi un sostituto generico di ChatGPT, un RAG su corpora esterni come Confluence o arXiv, oppure un servizio ospitato con collaborazione di squadra. Le risposte arrivano dal tuo vault, l'acquisizione copre il tuo vault più i file singoli, e non c'è nessun backend da condividere.

---

## 🚀 Avvio rapido

**Requisiti:** Obsidian 1.11.4 o successivo, desktop o mobile. Nient'altro: né Node, né Python, né container. La tua chiave API, oppure un modello locale che non ne ha bisogno; le credenziali vivono in Obsidian SecretStorage, ed è per questo che 1.11.4 è il minimo.

1. **Installa.** Obsidian → Impostazioni → Plugin della community → Sfoglia → cerca "Karpathy LLM Wiki" → Installa → Abilita. Oppure apri la [pagina del plugin nella community](https://community.obsidian.md/plugins/karpathywiki) e clicca **Add to Obsidian**.
   
   ![Karpathy LLM Wiki installato e attivo nell'elenco dei plugin della community di Obsidian](assets/readme/readme-02-install.webp)
2. **Configura un provider.** Apri Impostazioni → Karpathy LLM Wiki → scegli un provider (OpenAI, Anthropic, Ollama, ChatGPT Plan (Codex OAuth), ecc.) → inserisci la chiave API (non serve per i modelli locali) → clicca **Testa connessione** → Salva.
3. **Acquisisci una nota.** Due strade:
   - **⌨️ Da tastiera:** `Cmd+P/Ctrl+P` → "Acquisisci singola sorgente" → scegli un file Markdown (o PDF, dalla v1.25.0).
   - **🖱️ Icona nella barra:** clicca l'**icona adesivo** nella barra laterale sinistra di Obsidian e acquisisci all'istante la nota aperta, senza cercare nei menu.
   
   Le prime pagine wiki compaiono in `wiki/sources/`, `wiki/entities/` e `wiki/concepts/` in pochi secondi.
   
   ![A sinistra la nota sorgente, a destra la pagina che l'acquisizione ha generato: proprietà, descrizione e concetti correlati](assets/readme/readme-01-before-after.webp)
4. **Interroga il wiki.** Due strade:
   - **⌨️ Da tastiera:** `Cmd+P/Ctrl+P` → "Interroga wiki".
   - **🖱️ Icona nella barra:** clicca l'**icona fumetto** nella barra laterale sinistra di Obsidian.
   
   Si apre un pannello laterale ancorato a destra (in stile Copilot) in cui conversi con il tuo wiki. Le risposte portano `[[wiki-link]]` che rientrano nel tuo grafo della conoscenza.

![Una risposta di Interroga wiki nel pannello laterale a destra, con ogni affermazione annotata verso la pagina wiki da cui proviene](assets/readme/readme-07-query-citations.webp)

Fine. Il plugin non modifica niente nelle tue note originali: crea solo pagine nuove sotto `wiki/`. Sia **Acquisisci singola sorgente** sia **Interroga wiki** sono fissati alla barra laterale sinistra, quindi restano a portata di clic in qualsiasi momento. (`Cmd` su macOS, `Ctrl` su Windows e Linux.)

### Comandi principali

| Comando | Cosa fa |
|---------|---------|
| **📥 Acquisisci singola sorgente** | `Cmd+P/Ctrl+P` → "Acquisisci singola sorgente": scegli un file Markdown o **PDF (v1.25.0+)** e ottieni pagine entità, concetti e wiki. *In alternativa: 🖱️ l'icona adesivo della barra laterale, sulla nota attiva.* |
| **📂 Acquisisci da cartella** | `Cmd+P/Ctrl+P` → "Acquisisci da cartella": acquisisce in blocco tutte le note di una cartella, con salto intelligente dei file già trattati |
| **📑 Acquisisci più file** | `Cmd+P/Ctrl+P` → "Acquisisci più file": scegli un sottoinsieme con un albero dei file a due pannelli (coda in tempo reale e annullamento per singolo file) |
| **🔍 Interroga wiki** | `Cmd+P/Ctrl+P` → "Interroga wiki": conversa con il wiki in un pannello laterale ancorato a destra; le risposte portano `[[wiki-link]]`. *In alternativa: 🖱️ l'icona fumetto della barra laterale.* |
| **🛠️ Lint wiki** | `Cmd+P/Ctrl+P` → "Lint wiki": scansione di salute completa — duplicati, link morti, pagine vuote, orfani, alias mancanti, contraddizioni |
| **⚡ Smart Fix All** | dentro il modale Lint: riparazione in un clic, in ordine causale, con report per ogni fase |
| **📋 Rigenera indice** | `Cmd+P/Ctrl+P` → "Rigenera indice": ricostruisce `wiki/index.md` con le pagine e gli alias attuali |
| **⏹ Annulla** | `Cmd+P/Ctrl+P` → "Annulla acquisizione corrente", oppure clicca la barra di stato: si ferma in modo pulito al confine del lotto successivo |
| **📊 Cronologia acquisizioni** | `Cmd+P/Ctrl+P` → "Visualizza cronologia acquisizioni": interfaccia ricercabile sulle acquisizioni, sui report Lint e sui cicli di manutenzione passati |

![Tutti i comandi di Karpathy LLM Wiki, raggruppati sotto un unico prefisso nella palette dei comandi di Obsidian](assets/readme/readme-03-commands.webp)

| Prima | Dopo |
|--------|-------|
| `notes/machine-learning.md` (un file piatto) | `wiki/concepts/supervised-learning.md` con `[[collegamenti bidirezionali]]`, alias, attribuzione della fonte e una voce in `wiki/index.md` |

> 📖 Guide passo passo in [GitHub Discussions → Guides](https://github.com/GD4AI/obsidian-llm-wiki/discussions/categories/guides). Ti è servito? [Metti una stella al repository](https://github.com/GD4AI/obsidian-llm-wiki) per seguire le release.

---

## ✨ Funzionalità

### 📚 Qualità della conoscenza

- **🔍 Estrazione di entità e concetti** — l'LLM estrae entità (persone, organizzazioni, prodotti, eventi) e concetti (teorie, metodi, termini) in pagine autonome. La granularità è configurabile (Minima → Fine, più Personalizzata), così scegli tu il compromesso tra costo e profondità.
- **🏷️ Alias obbligatori** — ogni pagina nasce con almeno un alias (traduzione, abbreviazione, variante), così il rilevamento dei duplicati tra lingue funziona.
- **🔄 Rilevamento duplicati a livelli** — il Livello 1 (corrispondenza diretta del nome: cross-lingua, abbreviazione, titoli molto simili) viene sempre verificato; il Livello 2 (link condivisi, similarità media) riempie il budget di token rimasto.
- **🧩 Fusione intelligente e stato delle contraddizioni** — i duplicati vengono fusi conservando gli alias; le contraddizioni vengono segnalate con l'attribuzione della fonte; le pagine con `reviewed: true` sono protette dalla sovrascrittura.
- **🎨 Un vocabolario di tag solo, il tuo** — i tag che una pagina può portare vengono dai tag annidati delle tue note, dai tag già presenti nelle pagine wiki e dalla lista *Personalizzato* in Impostazioni → Wiki → Vocabolario dei tag. Prompt, gate di scrittura, Lint e retag leggono tutti quell'unica lista, quindi quello che viene offerto al modello è esattamente quello che finisce su disco; un valore fuori lista viene scartato, mai scritto. I modelli piccoli derivano comunque (circa una volta su dieci restituiscono la tassonomia interna del modello) — il gate la intercetta e Lint segnala la pagina. Ancora di progetto: [Issue #328](https://github.com/GD4AI/obsidian-llm-wiki/issues/328).

![Una pagina di concetto generata: il tag del vocabolario con cui è stata scritta, i suoi alias AF e AFib, la definizione e le pagine collegate](assets/readme/readme-04-entity-page.webp)

### 📄 Ingest di Documenti / PDF / Immagini

Sei percorsi, scegliibili a ogni acquisizione:

1. **🧾 Backend MinerU integrato** — Impostazioni → Configurazione Wiki → Backend di conversione Markdown → *MinerU*. PDF, immagini (PNG/JPG/WebP/GIF/BMP e altre) e Office (DOC/DOCX/PPT/PPTX/XLS/XLSX) passano dal [parser Precise di MinerU](https://mineru.net/apiManage/docs). Il token sta in SecretStorage e scade dopo circa 90 giorni, quindi un 401 dice che il token è probabilmente scaduto e indica la pagina dove rinnovarlo. I limiti sono 200 MB / 200 pagine per PDF e 256 MB / 10.000 file per archivio. È la strada per gli articoli scansionati e per i file Office in cui conta l'impaginazione.
2. **☁️ Provider cloud con PDF nativo** — Anthropic, OpenAI, Google Gemini e AWS Bedrock (varianti Anthropic e OpenAI) leggono i PDF come file parts senza configurazione. Oltre a scegliere il provider non serve altro.
3. **🖥️ OCR locale su Apple Silicon** — [oMLX](https://github.com/jundot/omlx) include Microsoft Markitdown come backend PDF→Markdown. Attiva Markitdown in oMLX, carica [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) (3B / 570M parametri attivi, open source da 2026-06) come modello visivo, punta il plugin su oMLX come provider OpenAI-compatibile personalizzato, accendi **Forza supporto PDF** e scegli il modello multimodale che oMLX sta servendo. Il PDF non lascia mai la tua macchina.
4. **🛠️ Estrattore di terze parti (interfaccia online MinerU)** — usa il [servizio online MinerU Extractor](https://mineru.net/OpenSourceTools/Extractor) per una conversione manuale e rapida, quando non vuoi configurare un token API. Scarica il `.md` convertito, mettilo nel vault fuori dalla cartella del wiki e acquisiscilo come una normale nota Markdown.
5. **🔌 Forza supporto PDF** — per qualsiasi altro endpoint OpenAI/Anthropic-compatibile che accetta file parts, il plugin tenta la chiamata (Impostazioni → Configurazione LLM → Avanzate). Decide l'endpoint; i fallimenti compaiono come Notice localizzata.
6. **🖼️ Immagini incorporate nel Markdown** — attiva *Analizza immagini incorporate durante l'acquisizione Markdown* nelle impostazioni avanzate per analizzare ogni incorporazione locale idonea `![[image.png]]` e `![alt](image.png)`. Ogni immagine viene analizzata insieme ai paragrafi Markdown più vicini, inviata in pacchetti di evidenza visiva da 20 MiB e limitata a 10 MiB; gli URL remoti non vengono mai scaricati. Per un output per immagine verificabile, attiva anche *Salva l'evidenza visiva delle immagini incorporate nella pagina sorgente*: aggiunge una sezione di audit richiudibile alla pagina sorgente generata.

**Avvertenza sui formati Office:** Obsidian non mostra nativamente `.docx` / `.xlsx` / `.pptx` ([file-formats](https://obsidian.md/help/file-formats)), quindi il flusso pratico per i file Office è: MinerU converte in `.md`, il plugin acquisisce quel `.md` in pagine wiki, e il file Office originale resta come riferimento. Se ti serve l'anteprima inline dei file Office, usa un plugin della community come Pandoc Plugin / Docxer / Md Importer / Office Reader.

**Meccanismi comuni a tutti i percorsi:**

- **🗄️ Cache con limiti** — `.obsidian/plugins/karpathywiki/pdf-cache/` conserva il Markdown convertito, indicizzato per hash del contenuto + modello + versione del convertitore; tetti di 100 MB totali / 1000 voci / 10 MB per singola voce, con sfratto LRU per mtime.
- **📝 Sidecar opzionale nel vault** — Impostazioni → Configurazione Wiki → Cartella Wiki → *Scrivi il Markdown convertito nel Vault* scrive `<basename>.pdf.md` accanto al PDF sorgente (disattivato per default: il default è la sola cache).
- **🛡️ Prompt di trascrizione verbatim** — conversione in stile OCR con marcatori antiallucinazione `[illegible]` / `[figure: ...]`; se un modello locale piccolo avvolge l'output in un fence Markdown, il fence viene ripulito prima di scrivere in cache.
- **🔁 Citazioni verbatim nella pagina sorgente (v1.27.0, #496)** — ogni pagina generata `sources/<slug>.md` porta una sezione `Mentions in Source` costruita dalle stesse citazioni verbatim raccolte in estrazione per ogni entità e concetto (la prosa di cui il modello ha già dimostrato di vedere il testo), così il documento sottostante è l'unica pagina wiki con una traccia reale e ancorata al suo testo sorgente.

📖 **Guide complete** per tutti i percorsi (provider cloud, livelli hardware oMLX, installazione di MinerU, manutenzione della cache) → [docs/PDF-OCR-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 Interrogazione e manutenzione

**Recupero e risposte**

- **🧭 Cascata PPR a 5 stadi** — vedi [Come funziona il recupero](#-come-funziona-il-recupero). Personalized PageRank sul grafo `[[wiki-link]]` dà un contesto multi-hop consapevole del grafo.
- **🔤 Punteggio lessicale che legge il corpo** — il percorso rapido valuta titolo, alias, sintesi **e testo del corpo** con BM25F, quindi il testo più lungo di una pagina arriva al punteggio. È il singolo cambiamento di richiamo più grande che il progetto abbia fatto.
- **🧩 Forma delle pagine correlate** — una pagina hub non riesce più a trascinare tutte le altre verso di sé. Gli elenchi `## Related` vengono ricalcolati a ogni scrittura a partire dai nomi sopravvissuti, ordinati e limitati.
- **🔁 Interruttore per il vecchio scorer di query** — Impostazioni → Avanzate → *Vecchio punteggio di ricerca* esegue il precedente ordinamento lineare scritto a mano invece di quello nuovo. Disattivato per default; il nuovo ordinamento è il default e l'interruttore è la via di ritorno.
- **📏 Il budget della risposta è di 16.000 token, e la pipeline dice quando finisce** — la risposta non si interrompe più in silenzio al limite. Il contesto viene adattato a un budget di pagine prima dell'assemblaggio, quindi 20 pagine entrano nel prompt per progetto e non per fortuna.
- **🔖 Citazioni in forma accademica** — il composer cresce con il contenuto, e *cancella cronologia* cancella davvero il registro.
- **🪟 Pannello laterale ancorato a destra** — Query Wiki si apre in un leaf laterale destro in stile Copilot (v1.22.1+) invece che in un modale centrato.

**Manutenzione e riparazione**

- **🔍 Scansione di salute Lint** — un solo comando intercetta duplicati, link morti, pagine vuote, orfani, alias mancanti e contraddizioni. Elenca anche le pagine hub il cui vicinato si è cristallizzato: un hub che sostituisce connessioni che il contenuto non riesce più a fare.
- **⚡ Smart Fix All** — riparazione in ordine causale con un clic: riempi gli alias → fondi i duplicati → correggi i link morti → collega gli orfani → espandi le pagine vuote, con report per ogni fase.
  
  ![Il report Lint del wiki: la riga di stato, i link morti trovati e il pulsante Smart Fix All che li ripara in un solo passaggio](assets/readme/readme-08-lint-report.webp)
- **🚧 L'esito «lascia stare» di Fix Dead Links** — Impostazioni → Avanzate → *Crea pagine segnaposto per i collegamenti irrisolti* (attivo per default). Se lo disattivi, un link morto resta visibile in ogni report Lint finché una fonte reale non lo definisce, invece di diventare una pagina segnaposto vuota. Il gate «non espandere mai senza una fonte» del #197 resta com'è; questo controllo decide solo se il segnaposto viene scritto o no.
- **📊 Pannello cronologia operazioni** — interfaccia ricercabile e filtrabile sulle acquisizioni, sui report Lint e sui cicli di manutenzione passati.

**Gate che scattano prima che una chiamata venga pagata**

- **🛡️ Gate di pre-acquisizione** — le note vuote, fatte di soli spazi o di solo frontmatter, vengono rifiutate prima di qualsiasi chiamata LLM; la deduplicazione per hash del contenuto intercetta file identici su percorsi diversi.
- **🚦 Gate dei candidati in acquisizione** — opzionale (`skipMentionOnlyCandidates`, disattivato per default). Un candidato nominato solo dentro parentesi, dentro un'enumerazione o in una voce di elenco breve viene potato prima di costare una generazione e una chiamata di deduplicazione. Vale solo per le lingue che hanno un profilo misurato; una lingua senza profilo non viene mai filtrata in silenzio, e le note cross-lingua non passano affatto da questo gate.
- **🎛️ Politiche per passo** — Parametri LLM avanzati → campo *Modalità di output e ragionamento per passo*; sovrascrive l'impostazione di modalità testo e ragionamento di un singolo passo senza toccare il codice. La base integrata resta intatta per i passi che non elenchi.

### 🦙 Prima di tutto in locale

- **🖥️ Ollama, LM Studio, OpenRouter, endpoint personalizzato** — pronti all'uso. I modelli locali bastano per l'interrogazione (con finestre di contesto più piccole); su un vault di 2.000 pagine l'acquisizione richiede di solito un modello cloud a contesto lungo.
- **📄 Il percorso OCR dei PDF è del tutto locale su Apple Silicon** — vedi [Ingest di Documenti / PDF / Immagini](#-ingest-di-documenti--pdf--immagini) più sopra.
- **🔐 ChatGPT Plan (Codex OAuth)** — loopback su desktop o codice dispositivo su mobile; le credenziali vivono solo in Obsidian SecretStorage. (La spiegazione completa dei confini tra provider è in [Anthropic vs OpenAI vs Codex OAuth](#anthropic-vs-openai-vs-codex-oauth--sono-provider-distinti) qui sotto.)

### 🌐 Lingua

- **🌍 11 lingue per l'interfaccia** — inglese, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano, Русский. L'interfaccia e la lingua di output del wiki sono indipendenti: il tuo wiki può essere in cinese mentre l'interfaccia è in inglese.
  
  ![Lingua dell'interfaccia e lingua di output del wiki sono due impostazioni separate, quindi un wiki in cinese può girare dietro un'interfaccia in inglese](assets/readme/readme-06-language-settings.webp)
- **📚 11 lingue per l'output del wiki** — lo stesso insieme; si sceglie in Impostazioni → Configurazione Wiki. L'opzione *Input personalizzato* serve per i prompt ad-hoc.
- **Tutte le stringhe dell'interfaccia tradotte per lingua** — ogni etichetta, modale e notifica. Aggiungere una dodicesima lingua dipende dai contributori (il modello è la PR #159).
- **🔧 Intestazioni personalizzate per provider** — un campo di testo libero subito sotto l'URL di base API. Una riga `Name: value` per riga, inviata con ogni richiesta. Include un preset OpenCode e una variante `(Responses)` per gli endpoint che parlano `/v1/responses`.
- **📡 Uno stream che sopravvive a un'origine bloccata** — quando una richiesta cross-origin viene rifiutata, lo stream viene ritentato su un trasporto desktop `node:https` invece di degradare a una risposta bufferizzata, e un fallback fallito viene registrato anziché inghiottito.

### ⚙️ Le impostazioni che decidono un'esecuzione

Quasi tutto quello che il plugin fa è già deciso per te. Queste otto impostazioni cambiano quella decisione, e ognuna risponde a un guasto che qualcuno ha incontrato.

| Impostazione | Dove | Cosa cambia |
|---|---|---|
| **Streaming delle richieste di ingestione** | Avanzate | `auto` usa lo streaming su mobile, `always` e `never` forzano la scelta. Lo streaming è ciò che tiene un'acquisizione lunga sotto il timeout di inattività del provider. |
| **Livello di ragionamento** | Parametri LLM avanzati | default / low / medium / high. L'AI SDK traduce il livello provider per provider, quindi nessun campo scritto a mano entra nella richiesta. |
| **Max token di output per chiamata** | Parametri LLM avanzati | Ora funziona in entrambe le direzioni: alzalo quando un modello di ragionamento spende il budget prima di scrivere, abbassalo per limitare il costo. Vuoto chiede al modello il proprio tetto. |
| **Finestra di contesto del modello** | Parametri LLM avanzati | Il tetto non può più superare la finestra, quindi a un modello locale piccolo non viene mai inviato un numero che non può accettare. |
| **Concorrenza LLM** | Provider | Da 1 a 20 chiamate in parallelo. Più alta finisce prima un'acquisizione grande; più bassa tiene un modello locale dentro la sua memoria. |
| **Priorità di estrazione** e **Requisiti di contenuto** | Impostazioni avanzate | Testo libero scritto in `schema/config.md`. Cambiano cosa estrae il modello senza che tu debba modificare lo schema a mano. |
| **Modalità di output e ragionamento per passo** | Parametri LLM avanzati | Sovrascrive la modalità testo o il livello di ragionamento di un passo — estrazione, fusione, interrogazione — senza toccare gli altri. |
| **File esclusi** | L'elenco di Obsidian | L'acquisizione da cartella, il monitoraggio dei file e il percorso automatico rispettano le esclusioni che hai impostato in Obsidian, quindi plugin e Obsidian sono d'accordo su cosa resta fuori. |

---

## 🌐 Ecosistema

Il plugin si compone con il resto del tuo stack Obsidian: ogni strumento qui sotto entra nel grafo `[[wiki-link]]` senza modifiche al codice.

- **📄 [Backend multi-formato MinerU](https://mineru.net/apiManage/docs) (integrato dalla v1.27.0)** — quello che prima era un passaggio separato da CLI o interfaccia ora è un interruttore del plugin; la tabella completa dei percorsi è in [Ingest di Documenti / PDF / Immagini](#-ingest-di-documenti--pdf--immagini). Il [servizio online MinerU](https://mineru.net/OpenSourceTools/Extractor) resta disponibile per chi preferisce un'interfaccia rapida al token API; anche [ospitare MinerU da sé](https://github.com/opendatalab/mineru) è un'opzione.
- **🕸️ Obsidian Graph View** — apri il grafo nativo su qualsiasi pagina wiki; ogni `[[wiki-link]]` diventa un nodo, ogni backlink un arco. Integrato, zero peso aggiuntivo nel bundle.
  
  ![La Graph View nativa di Obsidian su un wiki generato: pagine sorgente, entità e concetti formano un unico grafo connesso](assets/readme/readme-05-graph-view.webp)
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** — l'estensione ufficiale per il browser. Salva pagine web (articoli, post di blog, thread su Reddit, Hacker News, ricette, paper, trascrizioni YouTube via Interpreter) in qualsiasi cartella del vault, poi esegui il comando "Acquisisci da cartella" del plugin per estrarre entità e concetti in blocco.
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** — interroga il wiki come un database con DQL (`LIST FROM "wiki/entities" WHERE contains(tags, "person")`) o con l'API JS. Il plugin scrive frontmatter standard (`tags:`, `type:`, `aliases:`) su ogni pagina, quindi le query Dataview funzionano subito.
- **🌿 Git** — versiona il vault con qualsiasi client Git. Il plugin non riscrive mai i tuoi file sorgente: crea solo pagine nuove sotto `wiki/`, così `git diff` separa nettamente le tue modifiche dal contenuto generato dall'LLM.
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** — trasforma qualsiasi nota Obsidian in una presentazione tramite il frontmatter Marp (`marp: true`). Le pagine wiki sono Markdown puro, quindi diventano diapositive senza conversione aggiuntiva.
- **🖼️ Canvas** — la tela infinita nativa di Obsidian. Trascina le schede del wiki su un Canvas per comporre guide di studio, mappe mentali o panoramiche di ricerca a partire dai `[[wiki-link]]`, senza uscire dal vault.

---

## 🔍 Come funziona il recupero

La maggior parte dei plugin di "ricerca AI" spezzetta le tue note in chunk e le incorpora in un database vettoriale. Noi no. L'[argomento di Karpathy contro il RAG](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) è che il chunking rompe la capacità dell'LLM di ragionare su tutto il tuo grafo della conoscenza, e quell'argomento regge nella pratica. Noi percorriamo invece il grafo che già mantieni scrivendo `[[wiki-link]]`.

### La cascata di selezione dei semi a 5 stadi

Quando chiedi "Chi ha fondato Microsoft?", Interroga wiki esegue cinque stadi prima di generare qualsiasi risposta:

1. **Percorso rapido lessicale** — BM25F su titolo, alias, sintesi **e testo del corpo** di ogni entità e concetto, con saturazione per campo e IDF su una vera tabella di frequenza documentale. Gratis, istantaneo, e fa da gate per tutto ciò che segue.
2. **Generazione di keyword via LLM** — l'LLM propone da 8 a 12 keyword cross-lingua dalla tua domanda: gestisce sinonimi, abbreviazioni e termini che resistono alla sovrapposizione di token in una sola chiamata LLM.
3. **Scansione locale di sottostringhe** — ogni keyword generata viene ricercata localmente nei titoli delle pagine, negli alias e negli estratti del corpo. Nessuna chiamata LLM in più; completa il richiamo tollerante al rumore.
4. **Fallback sulla KB via LLM** — quando il percorso lessicale e la scansione delle keyword danno segnali deboli, l'LLM risemina i primi N candidati contro l'intero wiki, in un unico passaggio semantico.
5. **Espansione del grafo con PPR** — Personalized PageRank (Haveliwala 2002) sul grafo `[[wiki-link]]`, a partire dall'insieme dei semi candidati. È questo che dà un contesto multi-hop consapevole del grafo: "Bill Gates" → "Microsoft" → "concorrenti", non la sola sovrapposizione letterale dei titoli.

La cascata si ferma allo stadio che ha restituito segnale sufficiente: nessun costo fisso di cinque stadi, nessuna chiamata LLM quando il percorso lessicale basta, fallback semantico solo quando lessicale e scansione delle keyword da soli non bastano.

### Espansione della query, e una via di ritorno

Quando la cascata arriva allo stadio del grafo, la query viene espansa due volte prima di scegliere i semi: una con i termini del wiki, poi di nuovo con i termini proposti dall'LLM. Ogni passaggio ha un peso, e il guadagno è misurato sui vault del progetto invece che dato per scontato: sui due vault scritti dalla release attuale l'espansione vale **+0,086** e **+0,113** a r@10, e in entrambi i casi l'intervallo esclude lo zero. L'affermazione è volutamente stretta: la forma pesata **non** è misurabilmente migliore della semplice concatenazione, e l'interruttore che esegue lo scorer precedente esiste per chi ha ottenuto risultati peggiori.

Impostazioni → Avanzate → *Vecchio punteggio di ricerca* esegue il precedente scorer lineare scritto a mano. Il nuovo ordinamento è il default; l'interruttore è la via di ritorno.

### Personalized PageRank su larga scala

Usiamo Monte Carlo PPR (Fogaras 2005) — 3.000 cammini casuali × 50 passi ciascuno — con la regola dead-end di Haveliwala 2002. Il costo è **O(K × L)** (K = cammini, L = passi per cammino), indipendente dal numero di pagine, quindi un vault di 2.000 pagine ha la stessa latenza di espansione di uno da 200.

**PPR @5 = 27,1% contro una baseline kNN pura di 24,1%** su un vault del progetto. Il corpus non è pubblico, quindi leggi quel numero come il confronto che il progetto ha misurato per sé e non come un'affermazione sul tuo vault; `tools/dev-instrument/run-recall-harness.mjs` è l'harness che misura il richiamo su un vault.

### Perché nessun embedding

Abbiamo rifiutato di proposito la strada degli embedding nella [Issue #175](https://github.com/GD4AI/obsidian-llm-wiki/issues/175). Il segnale del grafo c'è già: ogni `[[wiki-link]]` è un arco "questi sono correlati" curato a mano, e la maggior parte dei provider che supportiamo (Ollama, LM Studio, Anthropic, Bedrock, Kimi, GLM, MiniMax) non espone affatto un endpoint `/v1/embeddings`. Aggiungere un modello di embedding vorrebbe dire un download per pagina, un adattatore per provider e nessun vantaggio sulla qualità del recupero.

---

## 🤖 Modelli

Quindici provider con un nome, più qualsiasi endpoint compatibile OpenAI o Anthropic. La tabella di scelta per livello — cloud, locale, OCR, quantizzazione, hardware — è in [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md), verificata da ultimo il 2026-11-06 su [models.dev](https://models.dev/).

- **Frontiera cloud** — Anthropic, OpenAI, Google Gemini, xAI Grok, Moonshot Kimi, Zhipu GLM, MiniMax. PDF nativo su Anthropic, OpenAI e Gemini.
- **Economici e open-weight** — DeepSeek, Alibaba Qwen, Step, Tencent Hunyuan, Xiaomi MiMo, Google Gemma.
- **Enterprise** — AWS Bedrock (varianti Anthropic e OpenAI, con autenticazione a chiave API, SSO o IAM) e ChatGPT Plan tramite Codex OAuth.
- **Locali e gateway** — Ollama, LM Studio, OpenRouter, gateway Anthropic-compatibili.

Questo plugin passa all'LLM l'intero contesto del wiki a ogni interrogazione, quindi **vincono i modelli a contesto lungo**.

### Cosa conta davvero

- **🧠 Finestra di contesto ≥ 200K token** per vault oltre le ~500 pagine. Sotto i 200K la cascata può scartare gli stadi iniziali per rientrare.
- **⚖️ La qualità nel seguire le istruzioni** conta più del QI grezzo nel compito di estrazione: scegli un modello che segua il template dello schema, non il numero più alto in classifica.
- **🔌 L'endpoint di embedding è irrilevante** — non usiamo embedding. Un provider senza `/v1/embeddings` va benissimo (alla maggior parte dei nostri 15+ provider manca).
- **🦙 Il locale serve per interrogare, il cloud per acquisire** — su un vault di 2.000 pagine l'acquisizione richiede di solito un modello cloud a contesto lungo; un modello locale da 262K copre la maggior parte delle interrogazioni.

Per l'acquisizione di PDF / immagini / Office vedi [Ingest di Documenti / PDF / Immagini](#-ingest-di-documenti--pdf--immagini) in Funzionalità: Anthropic, OpenAI, Bedrock e Gemini leggono i PDF come file parts in modo nativo; il backend MinerU integrato (v1.27.0+) e **Forza supporto PDF** coprono tutto il resto.

### Anthropic vs OpenAI vs Codex OAuth — sono provider distinti

- **Anthropic** (e la sua variante Bedrock) — chiave API di Anthropic Platform, fatturata a parte.
- **OpenAI** — chiave API di OpenAI Platform, fatturata a parte.
- **ChatGPT Plan (Codex OAuth)** — provider sperimentale e distinto, che usa il credito Codex disponibile dopo l'accesso da browser o con codice dispositivo; la disponibilità segue le politiche di autenticazione e di credito di OpenAI Codex, non il nome del piano. È compatibilità Codex di terze parti, non una partnership con OpenAI né un'API ChatGPT generica.

### AWS Bedrock — tre modalità di autenticazione (v1.27.0, #425)

Impostazioni → Provider → Bedrock (Anthropic / OpenAI) ora fa scegliere una fra tre modalità di autenticazione; la riga del provider chiede poi solo gli input che quella modalità richiede davvero:

- **Chiave API** — il percorso bearer originale dello Stage 1; il comportamento è identico byte per byte alla v1.26.4 ed è la scelta consigliata a chi paga già una chiave API Bedrock.
- **SSO** — flusso device di IAM Identity Center. Clicca *Accedi con AWS SSO*, incolla nel browser il codice dell'URL di verifica, e il plugin riceve un token SSO tramite `karpathywiki-bedrock-sso` in SecretStorage, lo scambia con credenziali di ruolo temporanee e firma ogni richiesta con SigV4 scritto a mano (nessun AWS SDK aggiunto). L'ID account e il nome del ruolo vengono rilevati da soli quando l'identità SSO ne espone esattamente uno per tipo; altrimenti inseriscili nelle impostazioni del provider.
- **IAM** — chiavi di accesso statiche per gli ambienti senza SSO (CI, job batch pianificati). Stanno in `karpathywiki-bedrock-iam` in SecretStorage; la cache in memoria memorizza per chiave di accesso, così la firma SigV4 resta entro la scadenza.

Tutte e tre le modalità condividono la stessa disciplina di Obsidian SecretStorage (nessuna credenziale in `data.json`, nei log o nella documentazione) e lo stesso percorso OIDC + SigV4 scritto a mano, senza AWS SDK. La regione Bedrock è indipendente dalla modalità di autenticazione e si configura nella stessa riga del provider.

> 📖 **Tabella di scelta completa** (cloud + locale + OCR PDF + Codex OAuth + quantizzazione + livelli hardware) → [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

## ❓ FAQ

### Cosa fa esattamente il plugin?

Scegli una nota, una cartella o una selezione: l'LLM estrae entità e concetti e scrive un wiki interconnesso con `[[collegamenti bidirezionali]]`. Fai una domanda e la risposta arriva da quelle pagine, con le citazioni. Le tue note originali non vengono mai modificate.

### Il mio wiki esistente è al sicuro?

✅ Retrocompatibile dalla v1.0.0. Imposta `reviewed: true` su una pagina per proteggerla dalla sovrascrittura. L'aggiornamento dalla v1.24.x non riscrive il vault; l'acquisizione PDF della v1.25.0 è solo cache per default, e la v1.27.0 aggiunge l'acquisizione nativa di PDF + immagini + Office senza cambiare la struttura del wiki su disco.

### Posso acquisire PDF, immagini e documenti Office?

✅ Sì. Anthropic, OpenAI, Bedrock e Gemini leggono i PDF in modo nativo; il backend MinerU integrato (v1.27.0) copre tutto il resto (PDF + immagini + Office). Il percorso completo — provider cloud, OCR su Apple Silicon, Forza supporto PDF, manutenzione della cache — è in [docs/PDF-OCR-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md).

### I miei dati vengono inviati da qualche parte?

🚫 Nessun backend, nessuna analitica: il plugin gira interamente dentro Obsidian. Solo il testo che invii esplicitamente per l'acquisizione o l'interrogazione lascia il tuo dispositivo, e solo verso il provider LLM che configuri. Per la località completa dei dati, usa Ollama o LM Studio.

### Posso usare il plugin nella mia lingua?

🌍 11 lingue, sia per l'interfaccia sia per l'output del wiki, impostate in modo indipendente. La dodicesima dipende dai contributori (la PR #159 è il modello).

### In cosa è diverso da un chatbot RAG?

Nessun chunking, nessun embedding, nessun database vettoriale. Personalized PageRank gira sul grafo `[[wiki-link]]` che già mantieni, e questo dà un contesto multi-hop a costo di embedding zero.

### Quale LLM dovrei usare?

Un modello a contesto lungo: ≥ 200K token per vault oltre le ~500 pagine. La tabella per livelli è in [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md).

### Esiste un benchmark pubblicato?

PPR @5 = 27,1% contro una baseline kNN pura di 24,1%, misurato su un vault del progetto: [Come funziona il recupero](#-come-funziona-il-recupero) dice cosa quel numero dimostra e cosa non dimostra.

### Come tengo sotto controllo i costi API?

Usa la granularità di estrazione Grossolana o Minima per l'acquisizione in blocco. Smart Batch Skip riconosce da solo i file già acquisiti. La manutenzione automatica è disattivata per default. Lint mostra i conteggi prima di eseguire le correzioni: niente viene addebitato senza la tua approvazione.

### Come annullo un'operazione in corso?

Clicca la barra di stato (mostra "Ingesting… click to cancel") oppure `Cmd+P/Ctrl+P` → "Annulla acquisizione corrente". Si ferma in modo pulito al confine del lotto successivo.

### Dove trovo aiuto?

[GitHub Issues](https://github.com/GD4AI/obsidian-llm-wiki/issues) per segnalare un bug · [GitHub Discussions](https://github.com/GD4AI/obsidian-llm-wiki/discussions) per domande e richieste di funzionalità · la Console per sviluppatori (`Ctrl+Shift+I` / `Cmd+Option+I`) per i log del plugin.

---

## 🔒 Privacy

Questo plugin è elencato nel Marketplace dei plugin della community di Obsidian ed è sottoposto a una revisione automatica di sicurezza e permessi.

- **🚫 Nessun backend proprio, nessuna telemetria, nessuna raccolta dati.** È software puramente locale che gira dentro Obsidian. Il plugin non gestisce alcun server e non riporta niente da nessuna parte.
- **🔐 L'accesso alla rete è opt-in ed esplicito.** Serve solo a raggiungere i servizi che configuri *tu*: il tuo provider LLM e, se attivi il backend documenti MinerU, `mineru.net`. Il secondo è l'eccezione che vale la pena nominare: carica il documento in una giurisdizione che non hai scelto e che non pubblica alcuna dichiarazione sulla conservazione. [Dove viene elaborato il tuo documento](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md#-where-your-document-is-processed) elenca ogni percorso e dove finisce il file.
- **📁 L'accesso ai file del vault** serve alla gestione del wiki (leggere note, generare pagine, scansionare link morti, rilevare duplicati). Il plugin non modifica mai i tuoi file sorgente.
- **📋 L'accesso agli appunti** è usato esclusivamente dal pulsante "Copia" nel modale di interrogazione, e solo quando ci clicchi.

Per la località completa dei dati, usa Ollama o LM Studio. Con un provider locale i tuoi dati non lasciano mai la tua macchina.

---

## 💖 Supporto

Se Karpathy LLM Wiki è diventato una parte significativa del tuo modo di lavorare con la conoscenza:

- ☕ **[Offrimi un Ko-fi](https://ko-fi.com/greenerdalii)** — una volta o ogni mese
- 💳 **[Mancia con PayPal](https://paypal.me/greenerdalii)** — una tantum

Grazie a chi sostiene il progetto:

[@jameses-cyber](https://github.com/jameses-cyber), [@issaqua](https://github.com/issaqua), Dikson Choi

### Contribuire

Le segnalazioni di bug e le pull request servono entrambe. [CONTRIBUTING.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CONTRIBUTING.md) descrive la build, il ciclo di test e i controlli che una modifica deve passare; [CODE_OF_CONDUCT.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CODE_OF_CONDUCT.md) è breve. [ROADMAP.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/ROADMAP.md) mostra cosa è in programma e [CHANGELOG.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CHANGELOG.md) registra cosa è stato rilasciato.

Per compilare dai sorgenti: `pnpm install`, `pnpm build:dev`, `pnpm gate:1`. L'ultimo comando fa lint, controllo dell'architettura, controllo dei tipi, build, test e lint CSS in un colpo solo. `tools/dev-instrument/` è lo strumento di misurazione riservato agli sviluppatori: esegue il vero `WikiEngine.ingestSource` su una cartella su disco senza runtime Obsidian e stampa la contabilità di token e di tempo reale per ogni task, ed è da lì che vengono i numeri di prestazione nel changelog. La CLI per gli utenti vive in un repository fratello: `npm i -g karpathywiki-cli`.

---

## 🔭 Altri progetti

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — lo stesso `WikiEngine` senza renderer: `npm i -g karpathywiki-cli`, poi `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`.
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — un router a livello di task per [pi-coding-agent](https://github.com/earendil-works/pi): un piccolo giudice marca ogni turno come ordinario o impegnativo, e il livello scelto guida il modello, gli strumenti e la catena di fallback. MIT. → [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — lo stesso design di routing per il runtime [dsh-coding-agent](https://github.com/earendil-works/dsh). MIT.
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — il flusso di lavoro per plugin Obsidian lato DSH: prepara lo spazio di lavoro, guida il ciclo Rosso→Verde, esegue gli stessi gate di qualità di questo repository e lascia un ramo `feat/*` o `fix/*` pronto per il rilascio.

---

## 📜 Licenza e crediti

Apache License, Version 2.0 — vedi [LICENSE](../LICENSE), [NOTICE](../NOTICE) e [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md).

**Costruito su:**
- 💡 [LLM Wiki di Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — il concetto originale
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v7](https://ai-sdk.dev/) (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) tramite `requestUrl` di Obsidian
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) e [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — gli algoritmi di recupero

**Manutentori:** [@green-dalii](https://github.com/green-dalii) (autore) · [@DocTpoint](https://github.com/DocTpoint) (co-manutentore da settembre 2026)

[![Star History Chart](https://api.star-history.com/chart?repos=GD4AI/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
