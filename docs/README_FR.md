<!--
SEO metadata (not user-visible, parsed by crawlers / LLMs) — version localisée en français :
- name: karpathy-llm-wiki-plugin-for-obsidian
- type: logiciel / plugin communautaire Obsidian / générateur de base de connaissances / alternative RAG
- license: Apache-2.0
- language: TypeScript
- runtime: Obsidian >= 1.11.4 (bureau + mobile)
- dependencies: zéro dépendance à l'exécution (Vercel AI SDK v6 inclus)
- obsidian-plugin-id: karpathywiki
- obsidian-marketplace: https://community.obsidian.md/plugins/karpathywiki
- repo: https://github.com/green-dalii/obsidian-llm-wiki
- sister-cli-repo: https://github.com/green-dalii/obsidian-llm-wiki-cli
- docs: README.md + docs/README_<locale>.md (11 locales) + docs/MODEL-GUIDE.md + docs/PDF-OCR-GUIDE.md
- first-published: 2025-09 (v0.1.0)
- latest: v1.27.1 (PATCH — listes liées déterministes, garde des paragraphes sourcés, re-pointage des liens sur tout le vault, politique de réflexion sur le flux, dates locales ; 46 commits, 3993 tests)
- last-updated: 2026-09-06
- alternate-names: Karpathy LLM Wiki, LLM Wiki Obsidian, plugin wiki Obsidian, RAG basé sur un graphe, RAG sans embedding, recherche Personalized PageRank, deuxième cerveau Obsidian
- search-intents: "Obsidian RAG sans embeddings", "plugin wiki Obsidian", "Personalized PageRank Obsidian", "recherche par graphe de notes", "implémentation Karpathy LLM Wiki", "génération automatique de base de connaissances Obsidian", "Obsidian Graph View + IA", "plugin deuxième cerveau Obsidian", "Obsidian IA graphe de liens", "plugin Obsidian 11 langues", "plugin Obsidian 16 fournisseurs LLM", "RAG sans base vectorielle", "ingestion PDF Obsidian IA", "Obsidian Codex OAuth", "plugin Obsidian Bedrock", "Obsidian Bedrock SSO", "Obsidian MinerU", "ingestion Obsidian Word PPT Excel", "identifiants Obsidian IAM"
- features: recherche par graphe, Personalized PageRank (Haveliwala 2002), Monte Carlo PPR (Fogaras 2005), cascade seed-selection 5 étapes, détection de doublons Tier 1/Tier 2, 11 langues UI + 11 langues sortie wiki (indépendantes), 16+ fournisseurs LLM (Anthropic, OpenAI, Bedrock [API key + SSO/IAM], Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, Codex OAuth), ingest MinerU multi-format (PDF + images + Office), ingestion PDF (cache uniquement, voies OCR), Lint health scan, Smart Fix All, citations verbatim des pages sources, porte candidats à l'ingest, UI taskPolicies par étape, intégration Obsidian Graph View, architecture zéro embedding zéro base vectorielle, mode local-first
- direct-competitors: nashsu/llm_wiki (app bureau Tauri), SamurAIGPT/llm-wiki-agent (skill Claude Code), sdyckjq/llm-wiki-skill (skill Codex), atomicstrata/llm-wiki-compiler (pipeline Python)
- retrieval-benchmark: PPR @5 = 27,1 % vs kNN pur 24,1 % (corpus du projet, seul chiffre publié dans cet espace open-source LLM-wiki)
- author: green-dalii / Greener-Dalii (https://github.com/green-dalii)
- canonical: https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md
-->

![Bannière du plugin Karpathy LLM Wiki — un réseau de pages wiki interconnectées construites à partir de vos notes Obsidian](assets/llm_wiki_banner.webp)

# 🧠 Karpathy LLM Wiki — Plugin Obsidian

> Plugin Obsidian qui transforme vos notes en une base de connaissances interconnectée et questionnable — l'idée de [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) d'Andrej Karpathy, intégrée dans l'éditeur où vous écrivez déjà.

**Score parfait revue Obsidian • Recherche par graphe sans embedding • 11 langues natives • Ingestion native PDF + images + Office • Fonctionne avec tous les fournisseurs • Local d'abord • Aucun backend • Conforme RGPD**

![Version](https://img.shields.io/github/v/release/green-dalii/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-16%2B-cyan?style=flat-square) <br>
![Maintenance](https://img.shields.io/badge/maintenance-actively%20maintained-brightgreen?style=flat-square) ![Build Status](https://img.shields.io/github/actions/workflow/status/green-dalii/obsidian-llm-wiki/release.yml?style=flat-square) ![Author](https://img.shields.io/badge/author-Greener--Dalii-blue?style=flat-square) <br>
![GitHub Stars](https://img.shields.io/github/stars/green-dalii/obsidian-llm-wiki?style=flat-square) ![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/green-dalii/obsidian-llm-wiki)

[English](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_CN.md) | [繁體中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_KO.md) | [Deutsch](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_DE.md) | **Français** | [Español](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ES.md) | [Português](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_PT.md) | [Italiano](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_IT.md) | [Русский](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[Site officiel](https://llmwiki.greenerai.top/) | [Marketplace Obsidian](https://community.obsidian.md/plugins/karpathywiki) | [Blog](https://llmwiki.greenerai.top/blog/) | [Discussions](https://github.com/green-dalii/obsidian-llm-wiki/discussions)

🤔 [Pourquoi ce plugin ?](#-pourquoi-ce-plugin-) | 🚀 [Démarrage rapide](#-démarrage-rapide) | ✨ [Fonctionnalités](#-fonctionnalités) | 🌐 [Écosystème](#-écosystème) | 🔍 [Fonctionnement de la recherche](#-fonctionnement-de-la-recherche) | 🤖 [Modèles](#-modèles) | ❓ [FAQ](#-faq)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD) ← Si ce plugin t'a aidé, offre-moi un café♥️ ou dépose une étoile🌟↗

---

---

## 🤔 Pourquoi ce plugin ?

Vous prenez des notes. Elles restent dans des dossiers. Retrouver ce qui se relie à quoi signifie se souvenir de fils que vous avez perdus de vue il y a des mois.

**D'autres réimplémentations open-source de l'idée LLM Wiki de Karpathy existent — mais aucune ne se livre comme un plugin Obsidian en un clic.** La plupart sont des outils CLI, des skills Claude Code ou des applications de bureau séparées ; ce plugin tourne à l'intérieur d'Obsidian — Graph View, rubans et palette de commandes inclus.

### Comparaison

| | **Karpathy LLM Wiki** (ce plugin) | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | sdyckjq / llm-wiki-skill | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|---|
| **Livraison & installation** | ✅ **5 min** — Plugin Obsidian en un clic : Plugins communautaires → Installer → choisir un fournisseur → Ingester | ❌ 30 min+ — Compiler/télécharger le binaire Tauri, configurer CLI | ❌ 15 min — nécessite abonnement Claude Code + installation skill | ❌ 10 min — nécessite abonnement Claude Code/Codex + configuration | ❌ 30 min+ — pip install + Python SDK + serveur local |
| **Architecture & dépendances** | ✅ **Zéro dépendance** — pas de BD vectorielle, pas de modèle d'embedding, pas de processus externe (PPR sur le graphe `[[wiki-link]]`, par conception) | 🟡 Embarque son propre runtime Python + sigma.js + sqlite ; embeddings optionnels, désactivés par défaut | 🟡 Utilise l'environnement Claude Code — pas autonome ; pas d'embedding | 🟡 Nécessite une plateforme d'exécution séparée ; pas d'embedding | ❌ Nécessite Python + modèle d'embedding + BD vectorielle (obligatoire) |
| **i18n (UI + sortie Wiki)** | ✅ 11 langues (UI / sortie indépendantes) | 🟡 2 (EN / 中文) | ❌ Anglais uniquement | ❌ Anglais uniquement | ❌ Anglais uniquement |
| **Fournisseurs LLM** | ✅ 16+ (dont Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, Anthropic-Compatible) | 🟡 Compatible OpenAI | 🟡 Abonnement via Claude Code | 🟡 Abonnement via Claude Code / Codex | 🟡 Compatible OpenAI |
| **Recherche & pipeline de requête** | ✅ **Cascade 5 étapes** — Lex → mots-clés LLM → scan sous-chaîne → fallback LLM KB → expansion PPR (troncature dès signal suffisant). Personalized PageRank (Haveliwala 2002) + Monte Carlo (Fogaras 2005) | 🟡 Décroissance 2-sauts uniquement (heuristique 4 signaux : Adamic-Adar + 2-sauts) | ❌ Détection de communautés Louvain uniquement | ❌ Aperçus k-hop uniquement (sans augmentation LLM) | ❌ BM25 + sémantique sur chunks (sans graphe) |
| **Visualisation du graphe** | ✅ Graph View natif d'Obsidian (intégré, zéro taille supplémentaire) | ❌ sigma.js + graphology personnalisés dans l'appli bureau | 🟡 graph.html vis.js (fichier séparé) | ❌ sigma.js HTML hors ligne personnalisé | ❌ Visualiseur navigateur lecture seule |
| **Honnêteté Wiki** | ✅ Bannière « Stage FALLBACK » quand aucune source wiki ne correspond à votre requête | ❌ Pas d'équivalent | ❌ Pas d'équivalent | ❌ Pas d'équivalent | ❌ Pas d'équivalent |
| **Benchmark de recherche publié** | ✅ PPR @5 = 27,1 % vs kNN pur 24,1 % (seul chiffre publié dans cet espace) | ❌ 58 % → 71 % *uniquement avec embeddings*, pas dans notre format comparable | ❌ Non publié | ❌ Non publié | ❌ Non publié |

### Trois choix délibérés, pas accidentels

- **🪟 Obsidian est l'environnement d'exécution.** Pas de terminal, pas d'application séparée, pas de Docker, pas de Python. Installez depuis les Plugins communautaires, cliquez sur Ingester, le wiki vit dans votre coffre dès la première seconde. Le Graph View natif d'Obsidian rend votre graphe de `[[wiki-links]]` — intégré, zéro taille de bundle supplémentaire.
- **🧭 Propre et autonome.** Zéro dépendance. Pas de modèle d'embedding, pas de base de données vectorielle, pas de package pip — un seul plugin qui lit vos notes, dialogue avec un LLM et écrit des pages wiki. Tout vit dans Obsidian.
- **🔌 N'importe quel modèle que vous payez déjà.** Anthropic, Bedrock, OpenAI, ChatGPT Plan (Codex OAuth), Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-compatible, endpoint personnalisé — seize fournisseurs et plus, aucun n'a besoin d'un endpoint d'embedding.

---

## 🎯 Est-ce pour moi ?

**✅ Oui, si vous :**

- **Voulez une installation en 5 minutes, pas un projet de 5 heures.** Installez depuis les Plugins communautaires → choisissez un fournisseur → Ingérez une note. Pas de CLI, pas de Python, pas d'environnement d'exécution séparé, pas de BD vectorielle. Vous voyez des pages wiki dans `wiki/` en quelques secondes.
- **Voulez quelque chose de propre et autonome.** Le plugin a exactement zéro dépendance externe : pas de modèle d'embedding, pas de base de données vectorielle, pas de package pip, pas de conteneur Docker. C'est un seul plugin Obsidian qui lit vos notes, dialogue avec un LLM et écrit des pages wiki dans votre coffre. Tout vit dans Obsidian.
- **Voulez un chat questionnable qui répond à partir de *vos* notes** — pas d'Internet — chaque réponse étant accompagnée de `[[wiki-links]]` vers votre graphe de connaissances.
- **Tenez à la souveraineté des données** — fonctionne entièrement en local avec Ollama ou LM Studio, sans jamais toucher à Internet.
- **Écrivez ou lisez dans l'une des 11 langues prises en charge** — la langue de l'UI et celle du wiki sont indépendantes (votre wiki peut être en chinois pendant que l'interface est en anglais).
- **Maintenez le graphe en écrivant des `[[wiki-links]]`** — chaque lien que vous écrivez enrichit déjà la recherche ; aucune étape séparée de tagging/embedding/indexation.
- **Voulez une maintenance en un clic** — Lint (analyse de santé) + Smart Fix All maintiennent doublons, liens morts et pages orphelines sous contrôle sans curation manuelle.

**❌ Non, si vous :**

- **Voulez un remplacement généraliste de ChatGPT** — les réponses viennent uniquement de votre coffre, pas d'Internet.
- **Avez besoin de RAG sur de grands corpus externes** (Confluence, Notion, arXiv, pages web scrapées) — le plugin ingère votre coffre ainsi que des fichiers PDF/Office autonomes ; le RAG en masse sur corpus externe est hors scope par conception.
- **Voulez un SaaS hébergé avec collaboration d'équipe** — il n'y a pas de backend, pas de serveur, pas d'état partagé ; tout tourne localement dans votre Obsidian.

---

## 🚀 Démarrage rapide

1. **Installez.** Obsidian → Paramètres → Plugins communautaires → Parcourir → recherchez « Karpathy LLM Wiki » → Installer → Activer. Ou visitez la [page du plugin communautaire](https://community.obsidian.md/plugins/karpathywiki) et cliquez sur **Ajouter à Obsidian**.
2. **Configurez un fournisseur.** Ouvrez Paramètres → Karpathy LLM Wiki → choisissez un fournisseur (OpenAI, Anthropic, Ollama, ChatGPT Plan (Codex OAuth), etc.) → entrez la clé API (pas nécessaire pour le local) → cliquez sur **Test Connection** → Enregistrez.
3. **Ingérez une note.** Deux méthodes :
   - **⌨️ Clavier :** `Cmd+P/Ctrl+P` → « Ingest single source » → choisissez n'importe quel fichier Markdown (ou PDF, v1.25.0+).
   - **🖱️ Icône de barre d'outils :** Cliquez sur l'**icône d'autocollant** dans le ruban gauche d'Obsidian pour ingérer instantanément la note actuellement ouverte — pas besoin de chercher dans les menus.
   
   Vos premières pages wiki apparaissent dans `wiki/sources/`, `wiki/entities/`, `wiki/concepts/` en quelques secondes.
4. **Discutez avec votre wiki.** Deux méthodes :
   - **⌨️ Clavier :** `Cmd+P/Ctrl+P` → « Query wiki ».
   - **🖱️ Icône de barre d'outils :** Cliquez sur l'**icône de bulle de message** dans le ruban gauche d'Obsidian.
   
   Un panneau latéral droit de style Copilot s'ouvre, dans lequel vous pouvez discuter avec votre wiki. Les réponses sont accompagnées de `[[wiki-links]]` qui renvoient vers votre graphe de connaissances.

![Panneau latéral Query Wiki ancré à droite dans Obsidian montrant une interface de chat avec des réponses wiki-link vers votre graphe de connaissances](/docs/assets/query-side-panel.png)

C'est tout. Le plugin ne modifie rien dans vos notes originales — il crée uniquement de nouvelles pages dans `wiki/`. **Ingest** et **Query wiki** sont tous deux épinglés dans le ruban gauche pour un accès en un clic à tout moment. (`Cmd` sur macOS, `Ctrl` sur Windows/Linux.)

### Commandes principales

| Commande | Action |
|----------|--------|
| **📥 Ingest single source** | `Cmd+P/Ctrl+P` → « Ingest single source » — choisissez un fichier Markdown ou **PDF (v1.25.0+)** pour obtenir des pages entité/concept/wiki. *Ou : 🖱️ cliquez sur l'icône d'autocollant du ruban gauche sur la note active.* |
| **📂 Ingest from folder** | `Cmd+P/Ctrl+P` → « Ingest from folder » — ingestion par lot de toutes les notes d'un dossier, avec saut intelligent de lot |
| **📑 Ingest multiple files** | `Cmd+P/Ctrl+P` → « Ingest multiple files » — sélectionnez un sous-ensemble via une arborescence à deux volets (file d'attente en direct + annulation par fichier) |
| **🔍 Query wiki** | `Cmd+P/Ctrl+P` → « Query wiki » — discutez avec votre wiki dans un panneau latéral droit ; les réponses sont accompagnées de `[[wiki-links]]`. *Ou : 🖱️ cliquez sur l'icône de bulle de message du ruban gauche.* |
| **🛠️ Lint wiki** | `Cmd+P/Ctrl+P` → « Lint wiki » — analyse complète de santé : doublons, liens morts, pages vides, orphelines, alias manquants, contradictions |
| **⚡ Smart Fix All** | dans le modal Lint — réparation en un clic par ordre causal avec rapport par phase |
| **📋 Regenerate index** | `Cmd+P/Ctrl+P` → « Regenerate index » — reconstruit `wiki/index.md` avec les pages et alias actuels |
| **⏹ Cancel** | `Cmd+P/Ctrl+P` → « Cancel current ingestion » ou cliquez sur la barre d'état — s'arrête proprement à la prochaine limite de lot |
| **📊 Ingestion history** | `Cmd+P/Ctrl+P` → « View Ingestion History » — UI consultable pour les ingestions passées, rapports Lint et maintenances |

![Command panel — all LLM Wiki commands live in Obsidian's command palette](/docs/assets/command-panel.png)
| Avant | Après |
|-------|-------|
| `notes/machine-learning.md` (un fichier plat) | `wiki/concepts/supervised-learning.md` avec `[[liens bidirectionnels]]`, alias, attribution de source et une entrée dans `wiki/index.md` |

> 📖 Guides détaillés dans [GitHub Discussions → Guides](https://github.com/green-dalii/obsidian-llm-wiki/discussions/categories/guides). Utile ? [Mettez une étoile sur le dépôt](https://github.com/green-dalii/obsidian-llm-wiki) pour suivre les releases.

---

## ✨ Fonctionnalités

### 📚 Qualité des connaissances

- **🔍 Extraction d'entités et de concepts** — Le LLM extrait les entités (personnes, organisations, produits, événements) et les concepts (théories, méthodes, termes) dans des pages autonomes. La granularité est configurable (Minimale → Fine, plus Personnalisée) pour équilibrer coût et profondeur.
- **🏷️ Alias obligatoires** — chaque page est livrée avec au moins un alias (traduction, abréviation, variante) pour que la détection de doublons inter-langues fonctionne.
- **🔄 Détection de doublons à plusieurs niveaux** — Niveau 1 (correspondance directe de nom : inter-langues, abréviations, titres de haute similarité) toujours vérifié ; Niveau 2 (liens partagés, similarité moyenne) remplit le budget de tokens restant.
- **🧩 Fusion intelligente et état des contradictions** — les doublons sont fusionnés en préservant les alias ; les contradictions sont signalées avec attribution de source ; les pages `reviewed: true` sont protégées contre l'écrasement.
- **🎨 Vocabulaire de tags personnalisable** — définissez vos propres tags de type entité et concept dans Paramètres → Wiki → Vocabulaire de tags → *Personnalisé*. Le vocabulaire est un hint d'injection de schéma, pas une porte d'écriture — les petits/modèles locaux peuvent toujours dériver (environ un sur dix renvoie la taxonomie intégrée du modèle). Lint signale le reste. Ancre de conception pour l'application du schéma : [Issue #328](https://github.com/green-dalii/obsidian-llm-wiki/issues/328).

### 📄 Ingestion Document / PDF / Image

Cinq points d'entrée, commutable par ingest :

1. **🆕 Backend MinerU intégré (v1.27.0, #404)** — Paramètres → Configuration Wiki → Backend de conversion Markdown → *MinerU*. PDF + images (PNG/JPG/JPEG/JP2/WebP/GIF/BMP) + Office (DOC/DOCX/PPT/PPTX/XLS/XLSX) via le [parseur Precise de MinerU](https://mineru.net/apiManage/docs). Token dans Obsidian SecretStorage. Meilleur chemin pour les articles scientifiques, documents scannés et fichiers Office où la préservation de la mise en page compte. Limites serveur : 200 Mo / 200 pages par PDF, 256 Mo / 10 000 fichiers par archive.
2. **☁️ Fournisseurs cloud avec PDF natif** — Anthropic, OpenAI, Google Gemini et AWS Bedrock (variantes Anthropic + OpenAI) lisent les PDF comme file parts sans configuration supplémentaire.
3. **🖥️ OCR local sur Apple Silicon** — [oMLX](https://github.com/jundot/omlx) intègre Microsoft Markitdown comme backend PDF→Markdown intégré. Activez Markitdown dans oMLX, chargez [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) (3B / 570M actifs, open-source 2026-06) comme modèle de vision, pointez le plugin vers oMLX comme fournisseur personnalisé compatible OpenAI, activez **Force PDF Support** et choisissez le modèle multimodal servi par oMLX. Le PDF ne quitte jamais votre machine.
4. **🛠️ Extracteur tiers (UI en ligne MinerU)** — utilisez le [service en ligne MinerU Extractor](https://mineru.net/OpenSourceTools/Extractor) pour une UI manuelle rapide quand vous ne voulez pas configurer un jeton API. Téléchargez le `.md` converti, déposez-le dans votre coffre en dehors du dossier wiki, et ingérez-le comme une note Markdown ordinaire.
5. **🔌 Force PDF Support** — pour tout autre endpoint compatible OpenAI/Anthropic qui accepte les file parts, le plugin tente l'appel (Paramètres → Configuration LLM → Avancé). L'endpoint décide ; les échecs apparaissent sous forme de Notice localisée.

**Avertissement pour les formats Office :** Obsidian ne rend pas nativement les `.docx` / `.xlsx` / `.pptx` ([file-formats](https://obsidian.md/help/file-formats)). Le flux pratique pour les fichiers Office est donc : MinerU convertit en `.md`, le plugin ingère ce `.md` dans les pages wiki, et le fichier Office d'origine est conservé uniquement pour référence. Pour une prévisualisation inline des fichiers Office, utilisez un plugin communautaire comme Pandoc Plugin / Docxer / Md Importer / Office Reader.

**Plomberie partagée entre tous les chemins :**

- **🗄️ Cache à croissance bornée** — `.obsidian/plugins/karpathywiki/pdf-cache/` stocke le Markdown converti, indexé par hash de contenu + modèle + version du convertisseur ; 100 Mo total / 1000 entrées / 10 Mo par entrée avec éviction LRU-by-mtime.
- **📝 Sidecar coffre optionnel** — Paramètres → Configuration Wiki → Dossier Wiki → *Write PDF Markdown to Vault* écrit `<basename>.pdf.md` à côté du PDF source (désactivé par défaut — cache uniquement).
- **🛡️ Invite de transcription textuelle** — Conversion style OCR avec marqueurs anti-hallucination `[illegible]` / `[figure: ...]` ; le wrapping dans des fences ```markdown par les petits modèles locaux est automatiquement nettoyé avant l'écriture en cache.
- **🔁 Citations verbatim des pages sources (v1.27.0, #496)** — chaque page `sources/<slug>.md` générée porte désormais une section `Mentions in Source` construite à partir des mêmes citations verbatim que celles capturées par extraction par entité/concept (la prose que le modèle a déjà prouvé qu'il pouvait voir), de sorte que le document sous-jacent est la seule page wiki avec une trace réelle et ancrée vers son texte source.

📖 **Guides d'installation complets** pour tous les chemins (fournisseurs cloud, niveaux matériels oMLX, installation MinerU, ménage du cache) → [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 Requête et maintenance

- **🧭 Cascade PPR en 5 étapes** — voir [Fonctionnement de la recherche](#-fonctionnement-de-la-recherche). Personalized PageRank sur le graphe `[[wiki-link]]` pour un contexte multi-hop conscient du graphe.
- **🪟 Panneau latéral ancré à droite** — Query Wiki s'ouvre dans un panneau latéral droit style Copilot (v1.22.1+) au lieu d'un modal centré.
- **🔍 Lint — analyse de santé** — une seule commande détecte : doublons, liens morts, pages vides, orphelines, alias manquants, contradictions.
- **⚡ Smart Fix All** — réparation en un clic par ordre causal : remplir les alias → fusionner les doublons → corriger les liens morts → relier les orphelines → développer les pages vides, avec rapport par phase.
- **🆕 Issue Fix Dead Links : option « laisser tel quel » (v1.27.0, #485)** — Paramètres → Avancé → *Create Stubs for Unresolvable Links* (activé par défaut) vous permet de refuser les pages placeholder vides : désactivé, le lien mort reste visible dans chaque rapport lint jusqu'à ce qu'une vraie source le définisse, et l'ingest crée les pages via les canaux normaux. La porte never-LLM-expand de #197 est inchangée — le nouveau contrôle ne régit que l'écriture (ou non) de la page stub.
- **📊 Panneau d'historique des opérations** — UI consultable et filtrable pour les ingestions passées, rapports Lint et maintenances.
- **🛡️ Portail de pré-ingestion** — les notes vides / blancs / uniquement du frontmatter sont rejetées avant tout appel LLM ; la déduplication par hash de contenu détecte les fichiers identiques à travers les chemins.
- **🆕 Porte candidats à l'ingest (v1.27.0, #514 / PR #521)** — toggle opt-in (`skipMentionOnlyCandidates`, désactivé par défaut, Paramètres → Avancé). Pour les sources dont la langue dispose d'un profil mesuré (de mesuré ; en/fr/es/pt/nl/ko estimés avec edge cases épinglés ; les seuils par jeu de caractères zh/ja non mesurés), les candidats nommés uniquement entre parenthèses / dans des énumérations / dans de courts items de liste sont élagués avant qu'ils ne coûtent une page plus des appels dedup et génération. Les notes cross-langue ne sont pas gated ; les langues wiki sans profil rapportent une fois par ingest et ne skip jamais silencieusement.
- **🆕 Politiques par étape (taskPolicies) (v1.27.0, #525 / #490)** — champ LLM Advanced → Task Policies ; surcharge le réglage text-mode/thinking par étape sans modification de code. La baseline intégrée reste intacte pour les étapes que vous ne listez pas.

### 🔒 Confidentialité

- **🚫 Pas de backend, pas de suivi, pas d'analyse.** Fonctionne entièrement dans Obsidian. Le réseau est utilisé uniquement pour communiquer avec le fournisseur LLM que vous configurez.
- **📁 Les fichiers sources sont en lecture seule.** Le plugin ne modifie jamais vos notes originales du coffre — il crée uniquement de nouvelles pages dans `wiki/`.
- **🦙 Mode entièrement local.** Ollama, LM Studio ou tout endpoint local compatible OpenAI → vos notes ne quittent jamais votre machine.
- **🔐 Permissions minimales.** Accès aux fichiers du coffre pour la gestion du wiki. Accès au presse-papiers uniquement lorsque vous cliquez sur le bouton « Copier » dans le modal de requête.

### 🦙 Priorité au local

- **🖥️ Ollama, LM Studio, OpenRouter, endpoint personnalisé** — prêts à l'emploi. Les modèles locaux fonctionnent pour les requêtes (fenêtres de contexte plus petites) ; l'ingestion d'un coffre de 2000 pages nécessite généralement un modèle cloud à long contexte.
- **📄 La voie OCR PDF est entièrement locale sur Apple Silicon** — voir [Ingestion Document / PDF / Image](#-ingestion-document--pdf--image) ci-dessus.
- **🔐 ChatGPT Plan (Codex OAuth)** — rappel localhost sur le bureau ou code d'appareil sur mobile ; les identifiants vivent uniquement dans Obsidian SecretStorage. (Voir [Anthropic vs OpenAI vs Codex OAuth — ce sont des fournisseurs distincts](#-anthropic-vs-openai-vs-codex-oauth--ce-sont-des-fournisseurs-distincts) ci-dessous pour l'explication complète des frontières entre fournisseurs.)

### 🌐 Langue

- **🌍 11 langues d'interface** — English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano, Русский. La langue de l'UI et celle du wiki sont indépendantes — votre wiki peut être en chinois pendant que l'interface est en anglais.
- **📚 11 langues de sortie wiki** — même ensemble ; choisissez dans Paramètres → Configuration Wiki. Option *Custom input* pour les invites ad-hoc.
- **Toutes les chaînes UI traduites par locale** — chaque label, modal et notice. L'ajout d'une 12e langue est piloté par les contributeurs (modèle PR #159).

---

## 🌐 Écosystème

Le plugin s'intègre au reste de votre stack Obsidian — chacun des outils ci-dessous se branche au graphe `[[wiki-link]]` sans modification de code.

- **📄 [Backend multi-format MinerU](https://mineru.net/apiManage/docs) (intégré depuis v1.27.0)** — ce qui était autrefois une étape CLI/UI séparée est désormais un commutateur du plugin ; voir [Ingestion Document / PDF / Image](#-ingestion-document--pdf--image) pour la table complète des chemins. Le [service en ligne MinerU](https://mineru.net/OpenSourceTools/Extractor) reste disponible pour ceux qui préfèrent une UI rapide à un jeton API ; [auto-héberger MinerU](https://github.com/opendatalab/mineru) est aussi une option.
- **🕸️ Obsidian Graph View** — ouvrez la vue de graphe natif sur n'importe quelle page wiki ; chaque `[[wiki-link]]` devient un nœud, chaque backlink une arête. Intégré, zéro taille de bundle supplémentaire.
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** — extension officielle de navigateur. Enregistrez des pages web (articles, billets de blog, fils Reddit, Hacker News, recettes, articles de recherche, transcriptions YouTube via Interpreter) dans n'importe quel dossier de votre vault, puis exécutez la commande « Ingérer depuis le dossier » du plugin pour extraire entités et concepts en lot.
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** — interrogez le wiki comme une base de données avec DQL (`LIST FROM "wiki/entities" WHERE contains(tags, "person")`) ou l'API JS. Le plugin écrit du frontmatter standard (`tags:`, `type:`, `aliases:`) sur chaque page, donc les requêtes Dataview fonctionnent sans configuration.
- **🌿 Git** — versionnez votre vault (avec n'importe quel client Git). Le plugin ne réécrit jamais vos fichiers sources ; il crée uniquement de nouvelles pages sous `wiki/`, de sorte que `git diff` sépare clairement vos modifications du contenu généré par le LLM.
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** — transformez n'importe quelle note Obsidian en diaporama via le frontmatter Marp (`marp: true`). Les pages wiki sont en Markdown pur, elles se rendent en diapositives sans conversion supplémentaire.
- **🖼️ Canvas** — canevas infini natif d'Obsidian. Déposez des fiches wiki sur un canvas pour assembler guides d'étude, cartes mentales ou synthèses de recherche à partir de `[[wiki-links]]`, sans quitter le vault.
- **🎤 [Obsidian Nous](https://github.com/AndyMDH/obsidian-nous)** — plugin compagnon pour la capture locale de mémos vocaux et réunions (whisper.cpp sur macOS ; l'audio ne quitte jamais la machine). Génère des transcriptions étiquetées par locuteur et ses propres pages wiki hub. Indépendant de ce plugin — les deux peuvent partager le même vault sans couplage.

## 🧰 CLI sans interface

**La plupart des utilisateurs peuvent ignorer cette section.** La CLI utilisateur du plugin vit dans le dépôt frère [green-dalii/obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli) — installez avec `npm i -g karpathywiki-cli` puis exécutez `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`.

Ce qui est livré dans ce repo sous `tools/dev-instrument/` est l'**instrument de mesure headless dev-only** pour les contributeurs du moteur — il exécute le vrai `WikiEngine.ingestSource` contre un coffre sur disque sans runtime Obsidian, imprime la comptabilité par tâche (tokens + temps réel) — les mêmes chiffres qui alimentent les preuves de performance dans CLAUDE.md et les notes de version. Voir [`tools/dev-instrument/README.md`](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/tools/dev-instrument/README.md) pour la commande d'entrée, les variables d'environnement, les modes de mesure et la spécification du code de sortie.

---

## 🔍 Fonctionnement de la recherche

La plupart des plugins de « recherche IA » fragmentent vos notes en morceaux et les intègrent dans une base de données vectorielle. Pas nous. [L'argument de Karpathy contre le RAG](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) est que le découpage brise la capacité du LLM à raisonner sur l'ensemble de votre graphe de connaissances — et cet argument se vérifie en pratique. Au lieu de cela, nous parcourons le graphe que vous maintenez déjà en écrivant des `[[wiki-links]]`.

### La cascade de sélection de graines en 5 étapes

Quand vous demandez « Qui a fondé Microsoft ? », Query Wiki exécute cinq étapes avant toute génération de réponse :

1. **Chemin rapide Lex** — chevauchement direct de tokens contre chaque titre d'entité/concept et alias. Gratuit, instantané, et l'étape de filtrage pour tout ce qui suit.
2. **Génération de mots-clés LLM** — le LLM propose 8 à 12 mots-clés inter-langues à partir de votre requête (gère les synonymes, abréviations et termes résistants au chevauchement de tokens en un seul appel LLM).
3. **Scan local de sous-chaînes** — chaque mot-clé généré est re-matché localement contre les titres de pages, alias et extraits de corps. Aucun appel LLM supplémentaire ; complète le rappel tolérant au bruit.
4. **Fallback LLM KB** — quand lex + scan de mots-clés renvoient des signaux faibles, le LLM ré-ensemence les N meilleurs candidats avec une passe sémantique sur l'ensemble du wiki.
5. **Expansion de graphe PPR** — Personalized PageRank (Haveliwala 2002) sur le graphe `[[wiki-link]]` à partir de l'ensemble de graines candidates. C'est ce qui donne le contexte multi-hop conscient du graphe : « Bill Gates » → « Microsoft » → « concurrents », pas seulement un chevauchement littéral de titres.

La cascade se tronque à l'étape qui a renvoyé suffisamment de signal — pas de coût fixe de 5 étapes ; pas d'appels LLM quand lex est suffisant ; le fallback sémantique n'est utilisé que lorsque lex + scan de mots-clés ne suffit pas.

### Personalized PageRank à l'échelle

Nous utilisons Monte Carlo PPR (Fogaras 2005) — 3000 marches aléatoires × 50 pas chacune — avec la règle de cul-de-sac de Haveliwala 2002. Le coût est **O(K × L)** (K = marches, L = pas par marche), indépendant du nombre de pages, donc un coffre de 2000 pages a la même latence d'expansion qu'un coffre de 200 pages.

**PPR @5 = 27,1 % vs baseline kNN pur 24,1 %** sur le corpus de benchmark du projet (le seul benchmark de recherche publié dans cet espace open-source LLM-Wiki).

### Pourquoi pas d'embeddings

Nous avons délibérément rejeté la voie des embeddings dans [Issue #175](https://github.com/green-dalii/obsidian-llm-wiki/issues/175). Le signal du graphe est déjà là — chaque `[[wiki-link]]` est une arête « ces pages sont liées » curated manuellement, et la plupart des fournisseurs que nous supportons (Ollama, LM Studio, Anthropic, Bedrock, Kimi, GLM, MiniMax) n'ont pas du tout d'endpoint `/v1/embeddings`. Ajouter un modèle d'embedding signifierait un téléchargement par page, un adaptateur par fournisseur et zéro bénéfice sur la qualité de recherche.

---

## 🤖 Modèles

**Fournisseurs pris en charge (16+, vérifiés cross-check models.dev 2026-07) :**

| Fournisseur | Séries | Notes |
|------------|--------|-------|
| **Anthropic** | Claude 5 series | PDF natif ; protocole `/v1/messages` |
| **OpenAI** | GPT-5.6 series (Sol / Terra / Luna) | PDF natif ; clé API Platform |
| **Google Gemini** | Gemini 3.6 series | PDF natif (file parts depuis 1.5) ; endpoint compatible OpenAI |
| **DeepSeek** | DeepSeek V4 series | Compatible OpenAI ; niveau de coût le plus bas |
| **Alibaba Qwen** | Qwen3.7/3.8 series | Compatible OpenAI (DashScope) |
| **xAI Grok** | Grok 4 series | Compatible OpenAI ; long contexte |
| **Moonshot Kimi** | Kimi K3 series | Compatible OpenAI ; 2,8T MoE frontière |
| **Zhipu GLM** | GLM-5 series | Compatible OpenAI ; fort bilingue |
| **MiniMax** | MiniMax M3 series | Compatible OpenAI ; 1M contexte |
| **Step (阶跃星辰)** | Step 3 series (Flash) | Compatible OpenAI ; inférence rapide |
| **Tencent Hunyuan** | Hy3 series | Compatible OpenAI ; MoE open-weight |
| **Xiaomi MiMo** | MiMo V2.5 series | Open-source MIT ; tarification plate |
| **Google Gemma** | Gemma 4 series | Open-weight ; contexte 262K |
| **AWS Bedrock** | Variantes Anthropic + OpenAI | VPC / conformité ; **API key + SSO + IAM** (v1.27.0, #425) |
| **ChatGPT Plan (Codex OAuth)** | API Codex Responses | Connexion navigateur/code d'appareil ; SecretStorage |
| **Local : Ollama, LM Studio, OpenRouter, Anthropic-Compatible** | Tout modèle protocole OpenAI/Anthropic | Custom OpenAI-Compatible + Anthropic-Compatible (Token Plan / Coding Plan) |

Ce plugin alimente le LLM avec le contexte complet de votre Wiki par requête — donc **les modèles à long contexte gagnent**. Le tableau complet des niveaux (cloud + local) se trouve dans [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md), vérifié par recoupement avec [models.dev](https://models.dev/) pour que les choix restent à jour.

### Ce qui compte

- **🧠 Fenêtre de contexte ≥ 200K tokens** pour les coffres de plus de ~500 pages. En dessous de 200K, la cascade peut abandonner des étapes précédentes pour tenir dans la fenêtre.
- **⚖️ La qualité de suivi des instructions** importe plus que le QI brut pour la tâche d'extraction — choisissez un modèle qui suit le modèle de schéma, pas le plus grand numéro du classement.
- **🔌 L'endpoint d'embedding n'a pas d'importance** — nous n'utilisons pas d'embeddings. Un fournisseur sans `/v1/embeddings` est parfait (la plupart de nos 16+ fournisseurs n'en proposent pas).
- **🦙 Local pour les requêtes, cloud pour l'ingestion** — l'ingestion sur un coffre de 2000 pages nécessite généralement un modèle cloud à long contexte ; un modèle local 262K couvre la plupart des requêtes.

### Anthropic vs OpenAI vs Codex OAuth — ce sont des fournisseurs distincts

- **Anthropic** (et sa variante Bedrock) — clé API Anthropic Platform facturée séparément.
- **OpenAI** — clé API OpenAI Platform facturée séparément.
- **ChatGPT Plan (Codex OAuth)** — fournisseur expérimental distinct qui utilise une allocation Codex éligible après connexion par navigateur ou code d'appareil ; la disponibilité suit les politiques d'authentification et d'allocation OpenAI Codex, pas le nom du forfait. Compatibilité tierce Codex, pas un partenariat OpenAI ou une API ChatGPT générale.

### AWS Bedrock — trois modes d'authentification (v1.27.0, #425)

Paramètres → Fournisseur → Bedrock (Anthropic / OpenAI) choisit désormais l'un des trois modes d'authentification ; la ligne du fournisseur demande ensuite uniquement les inputs dont ce mode a réellement besoin :

- **API key** — le chemin bearer Stage-1 d'origine ; comportement byte-pour-byte identique à v1.26.4, choix recommandé pour les utilisateurs qui paient déjà pour une clé API Bedrock.
- **SSO** — flux device IAM Identity Center. Cliquez sur *Sign in with AWS SSO*, collez le code URL de vérification dans le navigateur, le plugin reçoit un token SSO via `karpathywiki-bedrock-sso` dans SecretStorage, l'échange contre des identifiants de rôle temporaires, et signe chaque requête avec un SigV4 fait main (pas d'AWS SDK ajouté). L'ID de compte et le nom de rôle sont auto-détectés quand l'identité SSO n'en expose qu'un de chaque ; sinon saisissez-les dans les paramètres du fournisseur.
- **IAM** — clés d'accès statiques pour les environnements sans SSO (CI, jobs batch planifiés). Stockées dans `karpathywiki-bedrock-iam` dans SecretStorage ; le cache en mémoire mémoïse par clé d'accès pour garder la signature SigV4 dans la fenêtre d'expiration.

Les trois modes partagent la même discipline Obsidian SecretStorage (aucun credential dans `data.json`, les logs, ou la doc) et le même chemin OIDC + SigV4 fait main zéro-AWS-SDK. La région Bedrock est indépendante du mode d'auth et se configure dans la même ligne du fournisseur.

> 📖 **Tableau de sélection complet** (cloud + local + PDF OCR + Codex OAuth + quantification + niveaux matériels) → [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

## ❓ FAQ

### Que fait exactement le plugin ?

Choisissez n'importe quelle note, dossier ou sélection ; le LLM extrait les entités et concepts et génère un wiki interconnecté avec des `[[liens bidirectionnels]]`. Posez des questions et obtenez des réponses conversationnelles fondées sur *vos* notes, pas sur Internet. Vos notes originales du coffre ne sont jamais modifiées.

### Comment commencer ?

Installez depuis les Plugins communautaires Obsidian → choisissez un fournisseur → **Test Connection** → exécutez **Ingest single source** sur n'importe quelle note. Les premières pages wiki apparaissent en quelques secondes. Voir [Démarrage rapide](#-démarrage-rapide).

### Mon wiki existant est-il sûr ?

✅ Rétrocompatible depuis la v1.0.0. Définissez `reviewed: true` sur n'importe quelle page pour la protéger contre l'écrasement. La mise à niveau depuis v1.24.x ne réécrit pas votre coffre ; l'ingestion PDF v1.25.0 est en cache uniquement par défaut, et v1.27.0 ajoute l'ingestion native PDF + images + Office sans modifier la disposition du wiki sur disque.

### Puis-je ingérer des PDF, des images et des documents Office ?

✅ Oui. Anthropic, OpenAI, Bedrock et Gemini lisent les PDF nativement ; le backend MinerU intégré (v1.27.0) couvre tout le reste (PDF + images + Office). Guide complet — fournisseurs cloud, OCR Apple Silicon, Force PDF Support, ménage du cache — dans [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md).

### Mes données sont-elles envoyées quelque part ?

🚫 Pas de backend, pas d'analyse — le plugin fonctionne entièrement dans Obsidian. Seul le texte que vous envoyez explicitement pour ingestion/requête quitte votre appareil, et uniquement vers le fournisseur LLM que vous configurez. Pour une localité complète des données, utilisez Ollama ou LM Studio.

### Puis-je utiliser le plugin dans ma langue ?

🌍 11 langues pour l'interface et la sortie wiki. La langue de l'UI et celle du wiki sont indépendantes. L'ajout d'une 12e langue est piloté par les contributeurs (modèle PR #159).

### En quoi est-ce différent d'un chatbot RAG ?

🚫 Pas de découpage. 🚫 Pas d'embeddings. 🚫 Pas de BD vectorielle. ✅ Personalized PageRank sur votre graphe `[[wiki-link]]` existant — contexte multi-hop conscient du graphe, zéro coût d'embedding, support complet des modèles locaux.

### Quel LLM dois-je utiliser ?

Les modèles à long contexte (≥200K tokens) fonctionnent le mieux. La [section Modèles](#-modèles) couvre les principes ; le tableau complet des niveaux se trouve dans [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md).

### Existe-t-il un benchmark publié ?

Oui — PPR @5 = 27,1 % vs baseline kNN pur 24,1 % sur le corpus du projet. Le pipeline complet et le script de benchmark sont décrits dans [Fonctionnement de la recherche](#-fonctionnement-de-la-recherche).

### Comment contrôler les coûts d'API ?

Utilisez la granularité d'extraction Grossière ou Minimale pour l'ingestion par lots. Smart Batch Skip détecte automatiquement les fichiers déjà ingérés. La maintenance automatique est DÉSACTIVÉE par défaut. Lint montre les compteurs avant d'exécuter les corrections — rien n'est facturé sans votre approbation.

### Comment annuler une opération en cours ?

Cliquez sur la barre d'état (affiche « Ingestion… cliquer pour annuler ») ou `Cmd+P/Ctrl+P` → « Cancel current ingestion ». S'arrête proprement à la prochaine limite de lot.

### Où obtenir de l'aide ?

[GitHub Issues](https://github.com/green-dalii/obsidian-llm-wiki/issues) pour les signalements de bugs · [GitHub Discussions](https://github.com/green-dalii/obsidian-llm-wiki/discussions) pour les questions et demandes de fonctionnalités · Console développeur (`Ctrl+Shift+I` / `Cmd+Option+I`) pour les logs du plugin.

---

## 🔒 Confidentialité

Ce plugin est répertorié sur le marché des plugins communautaires Obsidian et fait l'objet d'une vérification automatisée de la sécurité et des autorisations.

- **🚫 Pas de backend, pas de serveur, pas de collecte de données.** Logiciel purement local fonctionnant dans Obsidian. Le plugin ne peut pas et ne collecte, stocke ou transmet vos données à aucun serveur — parce qu'un tel serveur n'existe pas.
- **🔐 L'accès réseau est sur option.** Utilisé uniquement pour communiquer avec le fournisseur LLM que vous configurez. Vous choisissez le fournisseur, vous entrez la clé API, vous décidez où vont vos données.
- **📁 L'accès aux fichiers du coffre** est utilisé pour la gestion du wiki (lecture des notes, génération de pages, analyse des liens morts, détection des doublons). Le plugin ne modifie jamais vos fichiers sources.
- **📋 L'accès au presse-papiers** est utilisé exclusivement par le bouton « Copier » dans le modal de requête — et uniquement lorsque vous cliquez dessus.

Pour une localité complète des données, utilisez Ollama ou LM Studio. Avec un fournisseur local, vos données ne quittent jamais votre machine.

---

## 💖 Soutien

Si LLM-Wiki est devenu une partie importante de votre flux de travail de connaissances :

- ☕ **[Offrez-moi un café sur Ko-fi](https://ko-fi.com/greenerdalii)** — ponctuel ou mensuel
- 💳 **[Pourboire via PayPal](https://paypal.me/greenerdalii)** — pourboire ponctuel

Merci aux suivants pour leur soutien au projet:

[@jameses-cyber](https://github.com/jameses-cyber), [@issaqua](https://github.com/issaqua), Dikson Choi

---

## 🔭 Autres projets

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — la CLI d'ingestion headless, publiée en dépôt frère sous forme de paquet npm `karpathywiki-cli`. Elle exécute le même `WikiEngine` contre un coffre présent sur le disque, sans moteur de rendu. Installation avec `npm i -g karpathywiki-cli`. Le répertoire in-tree `tools/dev-instrument/` est l'instrument de mesure dev-only qui alimente les chiffres de coût par tâche dans les notes de version de ce plugin.
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — un routeur au niveau de la tâche pour [pi-coding-agent](https://github.com/earendil-works/pi). Avant chaque tour, un petit juge LLM classe votre message comme routinier ou conséquent, et le palier retenu assure tout le tour. Pour les tâches complexes, il va plus loin : le palier Smart joue le rôle d'un CTO qui planifie le travail, délègue l'implémentation à des sous-agents Fast, relit chaque résultat et itère. La montée en palier est immédiate, la descente attend une tendance durable, et les chaînes de repli par palier encaissent les 429 et les 5xx. Zéro dépendance à l'exécution, MIT. → [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — fork DSH du pi-shift-router, qui partage la même conception de routage par tâche, mais ciblé sur le runtime [dsh-coding-agent](https://github.com/earendil-works/dsh). Mêmes paliers pilotés par juge, mêmes chaînes de repli par palier, MIT.
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — équivalent DSH du workflow `obsidian-plugin-dev` côté Claude : scaffolde un workspace de plugin Obsidian, pilote la boucle TDD Red→Green, exécute la clôture qualité Six-Gate (lint/tsc/test/build/css-lint) et prépare une branche prête à releaser sur `feat/*` ou `fix/*`. Conçu pour que les contributeurs qui tournent sur DSH bénéficient du même scaffolding + expérience de gates sans avoir à copier-coller depuis CLAUDE.md.

---

## 📜 Licence et crédits

Apache License, Version 2.0 — voir [LICENSE](../LICENSE) et [NOTICE](../NOTICE).

**Construit avec :**
- 💡 [LLM Wiki d'Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — le concept original
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v6](https://ai-sdk.dev/) (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) via Obsidian `requestUrl`
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) et [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — algorithmes de recherche

**Mainteneur :** [@green-dalii](https://github.com/green-dalii)

[![Star History Chart](https://api.star-history.com/chart?repos=green-dalii/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
