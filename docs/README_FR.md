<!--
Métadonnées SEO (invisibles pour l'utilisateur, lues par les crawlers et les LLM) :
- name: karpathy-llm-wiki-plugin-for-obsidian
- type: logiciel / plugin communautaire Obsidian / générateur de base de connaissances / alternative au RAG
- license: Apache-2.0
- language: TypeScript
- runtime: Obsidian >= 1.11.4 (ordinateur + mobile)
- dependencies: aucune dépendance à l'exécution (Vercel AI SDK v7 embarqué)
- obsidian-plugin-id: karpathywiki
- obsidian-marketplace: https://community.obsidian.md/plugins/karpathywiki
- repo: https://github.com/GD4AI/obsidian-llm-wiki
- sister-cli-repo: https://github.com/green-dalii/obsidian-llm-wiki-cli
- docs: README.md + docs/README_<locale>.md (11 langues) + docs/MODEL-GUIDE.md + docs/PDF-OCR-GUIDE.md
- first-published: 2025-09 (v0.1.0)
- latest: v1.31.0
- release-notes: https://github.com/GD4AI/obsidian-llm-wiki/releases
- previous: v1.30.0 (MINOR — un plafond de jetons pour le contexte de réponse, la Priorité d'extraction dans les paramètres et un rapport sur les hubs cristallisés)
- last-updated: 2026-11-12
- alternate-names: Karpathy LLM Wiki, LLM Wiki Obsidian, plugin wiki Obsidian, RAG basé sur un graphe, RAG sans embedding, recherche Personalized PageRank, deuxième cerveau Obsidian
- search-intents: "Obsidian RAG sans embeddings", "plugin wiki Obsidian", "Personalized PageRank Obsidian", "recherche par graphe de notes", "implémentation Karpathy LLM Wiki", "génération automatique de base de connaissances Obsidian", "Obsidian Graph View + IA", "plugin deuxième cerveau Obsidian", "Obsidian IA graphe de liens", "plugin Obsidian 11 langues", "plugin Obsidian 15 fournisseurs LLM", "RAG sans base vectorielle", "ingestion PDF Obsidian IA", "Obsidian Codex OAuth", "plugin Obsidian Bedrock", "Obsidian Bedrock SSO", "Obsidian MinerU", "ingestion Obsidian Word PPT Excel", "identifiants Obsidian IAM"
- features: recherche par graphe, Personalized PageRank (Haveliwala 2002), Monte Carlo PPR (Fogaras 2005), cascade de sélection de graines en 5 étapes, détection de doublons Tier 1/Tier 2, interface en 11 langues + sortie wiki en 11 langues (indépendantes), 15+ fournisseurs LLM (Anthropic, OpenAI, Bedrock [clé API + SSO/IAM], Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, Codex OAuth), ingestion MinerU multi-format (PDF + images + Office), ingestion PDF (cache seul, voies OCR), analyse de santé Lint, Smart Fix All, citations verbatim des pages sources, filtre des candidats à l'ingestion, interface taskPolicies par étape, intégration Obsidian Graph View, architecture sans embedding ni base vectorielle, mode local d'abord
- direct-competitors: nashsu/llm_wiki (application de bureau Tauri), SamurAIGPT/llm-wiki-agent (skill Claude Code / Codex / OpenCode / Gemini CLI), atomicstrata/llm-wiki-compiler (CLI TypeScript, recherche par morceaux)
- retrieval-benchmark: PPR @5 = 27,1 % vs kNN pur 24,1 % (corpus d'un coffre du projet, pas un jeu de référence public)
- author: green-dalii / Greener-Dalii (https://github.com/green-dalii)
- co-maintainer: DocTpoint (https://github.com/DocTpoint)
- canonical: https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md
-->

![Bannière du plugin Karpathy LLM Wiki — un réseau de pages wiki reliées entre elles, construites à partir de vos notes Obsidian](assets/llm_wiki_banner.webp)

# 🧠 Plugin Karpathy LLM Wiki pour Obsidian

> Un plugin Obsidian qui transforme vos notes en une base de connaissances connectée et interrogeable — l'idée du [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), installée dans l'éditeur où vous écrivez déjà.

**Score parfait à la revue Obsidian • Recherche par graphe sans embedding • 11 langues natives • Ingestion native PDF + images + Office • Compatible avec tous les fournisseurs • Local d'abord • Aucun backend • Conforme au RGPD**

![Version](https://img.shields.io/github/v/release/GD4AI/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-15%2B-cyan?style=flat-square) <br>
![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml)

[English](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_CN.md) | [繁體中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_KO.md) | [Deutsch](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_DE.md) | **Français** | [Español](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ES.md) | [Português](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_PT.md) | [Italiano](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_IT.md) | [Русский](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[Site officiel](https://llmwiki.greenerai.top/) | [Marketplace Obsidian](https://community.obsidian.md/plugins/karpathywiki) | [Blog](https://llmwiki.greenerai.top/blog/) | [Discussions](https://github.com/GD4AI/obsidian-llm-wiki/discussions)

🤔 [Pourquoi ce plugin ?](#-pourquoi-ce-plugin-) | 🚀 [Démarrage rapide](#-démarrage-rapide) | ✨ [Fonctionnalités](#-fonctionnalités) | 🌐 [Écosystème](#-écosystème) | 🔍 [Fonctionnement de la recherche](#-fonctionnement-de-la-recherche) | 🤖 [Modèles](#-modèles) | ❓ [FAQ](#-faq) | 🔒 [Confidentialité](#-confidentialité)

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD)

> Karpathy LLM Wiki est gratuit, s'auto-héberge et n'a aucun backend. Si le plugin vous fait gagner du temps, un café ponctuel le maintient en vie — et une ⭐ aide tout autant.

---

## 🤔 Pourquoi ce plugin ?

Vous prenez des notes. Elles restent dans des dossiers. Retrouver ce qui se relie à quoi suppose de vous souvenir de fils perdus de vue depuis des mois.

**D'autres réimplémentations open source de l'idée LLM Wiki de Karpathy existent — mais aucune ne se livre comme un plugin Obsidian en un clic.** La plupart sont des outils en ligne de commande, des skills Claude Code ou des applications de bureau séparées ; celui-ci tourne dans Obsidian — Graph View, ruban et palette de commandes compris.

### Comparaison

|  | **Karpathy LLM Wiki** (ce plugin) | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|
| **Mode de livraison** | ✅ Plugin Obsidian en un clic | 🟡 Application de bureau Tauri | 🟡 Skill Claude Code / Codex / OpenCode / Gemini CLI | 🟡 Pipeline en ligne de commande TypeScript |
| **Dépendances** | ✅ Aucune — le plugin seul | 🟡 Runtime Python + sqlite | 🟡 Runtime Claude Code / Codex / OpenCode | ❌ Modèle d'embedding + base vectorielle (selon leur documentation) |
| **i18n (interface + sortie wiki)** | ✅ 11 langues | 🟡 EN / 中文 | ❌ EN seulement | ❌ EN seulement |
| **Fournisseurs LLM** | ✅ 15+ (Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, …) | 🟡 Compatible OpenAI | 🟡 Abonnement via Claude Code / Codex | 🟡 Compatible OpenAI |
| **Recherche et pipeline de requête** | ✅ **PPR + Monte Carlo** sur le graphe `[[wiki-link]]` | 🟡 Décroissance à 2 sauts (heuristique à 4 signaux) | 🟡 Détection de communautés de Louvain | 🟡 BM25 + sémantique sur des morceaux |
| **Visualisation du graphe** | ✅ Graph View natif d'Obsidian (intégré, zéro octet en plus) | 🟡 sigma.js + graphology maison dans l'application | 🟡 `graph.html` avec vis.js (fichier séparé) | ❌ Visionneuse navigateur en lecture seule |
| **Formats ingérés** | ✅ **Markdown + PDF + images + Office (DOCX/PPTX/XLSX)** — un seul réglage bascule entre le PDF natif (Anthropic / OpenAI / Bedrock / Gemini) et le backend multi-format MinerU intégré | 🟡 Markdown + PDF | 🟡 Markdown et fichiers de code seulement | 🟡 Markdown seulement |

### Trois choix assumés, pas des accidents

- **🪟 Obsidian est l'environnement d'exécution.** Pas de terminal, pas d'application séparée, pas de Docker, pas de Python. Vous installez depuis les plugins communautaires, vous cliquez sur l'ingestion, et le wiki vit dans votre coffre dès la première seconde. Le Graph View natif d'Obsidian dessine votre graphe de `[[wiki-link]]` — intégré, zéro octet de bundle en plus.
- **🧭 Propre et autonome.** Aucune dépendance : pas de modèle d'embedding, pas de base vectorielle, pas de paquet pip. Un seul plugin lit vos notes, parle à un LLM et écrit des pages dans votre coffre.
- **🔌 Le modèle que vous payez déjà.** Anthropic, Bedrock, OpenAI, ChatGPT Plan (Codex OAuth), Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, endpoint compatible Anthropic, endpoint personnalisé — quinze fournisseurs et plus, et aucun n'a besoin d'un endpoint d'embedding.

### À qui il s'adresse

- **Vous voulez une installation en 5 minutes.** Plugins communautaires → choisissez un fournisseur → ingérez une note. Les pages wiki apparaissent dans `wiki/` en quelques secondes, sans ligne de commande, sans Python et sans base vectorielle à monter d'abord.
- **Vous voulez des réponses tirées de vos propres notes,** chaque réponse citant les pages d'où elle vient. Ollama ou LM Studio gardent tout l'appel sur votre machine.
- **Vous écrivez ou lisez dans l'une des 11 langues.** L'interface et la sortie du wiki sont indépendantes : un wiki en chinois derrière une interface en anglais est une configuration prise en charge.
- **Vous voulez une maintenance d'un clic.** L'analyse de santé et Smart Fix All contiennent doublons, liens morts et pages orphelines sans curation à la main.

**Ce plugin n'est pas pour vous** si vous cherchez un remplacement généraliste de ChatGPT, du RAG sur des corpus externes comme Confluence ou arXiv, ou un service hébergé avec collaboration d'équipe. Les réponses viennent de votre coffre, l'ingestion couvre votre coffre plus des fichiers autonomes, et il n'y a aucun backend à partager.

---

## 🚀 Démarrage rapide

**Prérequis :** Obsidian 1.11.4 ou plus récent, sur ordinateur ou mobile. Rien d'autre — ni Node, ni Python, ni conteneur. Votre propre clé API, ou un modèle local sans aucune clé ; les identifiants vivent dans Obsidian SecretStorage, d'où ce plancher de 1.11.4.

1. **Installez.** Obsidian → Paramètres → Plugins communautaires → Parcourir → recherchez « Karpathy LLM Wiki » → Installer → Activer. Vous pouvez aussi ouvrir la [page du plugin communautaire](https://community.obsidian.md/plugins/karpathywiki) et cliquer sur **Ajouter à Obsidian**.
   
   ![Le plugin Karpathy LLM Wiki installé et activé dans la liste des plugins communautaires d'Obsidian](assets/readme/readme-02-install.webp)
2. **Configurez un fournisseur.** Ouvrez Paramètres → Karpathy LLM Wiki → choisissez un fournisseur (OpenAI, Anthropic, Ollama, ChatGPT Plan (Codex OAuth), etc.) → saisissez la clé API (inutile en local) → cliquez sur **Tester la connexion** → Enregistrez.
3. **Ingérez une note.** Deux chemins :
   - **⌨️ Clavier :** `Cmd+P/Ctrl+P` → « Importer une source unique » → choisissez un fichier Markdown (ou PDF, v1.25.0+).
   - **🖱️ Icône du ruban :** cliquez sur l'**icône autocollant** du ruban gauche d'Obsidian pour ingérer la note ouverte sur-le-champ — sans chercher dans les menus.
   
   Vos premières pages wiki apparaissent dans `wiki/sources/`, `wiki/entities/` et `wiki/concepts/` en quelques secondes.
   
   ![À gauche la note d'origine, à droite la page que l'ingestion en a tirée — propriétés, description et concepts liés](assets/readme/readme-01-before-after.webp)
4. **Interrogez votre wiki.** Deux chemins :
   - **⌨️ Clavier :** `Cmd+P/Ctrl+P` → « Interroger le wiki ».
   - **🖱️ Icône du ruban :** cliquez sur l'**icône bulle de message** du ruban gauche d'Obsidian.
   
   Un panneau latéral ancré à droite s'ouvre (façon Copilot) : vous dialoguez avec votre wiki. Les réponses portent des `[[wiki-links]]` qui vous ramènent dans votre graphe de connaissances.

![Une réponse de Query wiki dans le panneau latéral droit, chaque affirmation renvoyant en note de bas de page à la page wiki qui la fonde](assets/readme/readme-07-query-citations.webp)

Voilà tout. Le plugin ne modifie rien dans vos notes d'origine — il crée seulement de nouvelles pages sous `wiki/`. L'ingestion et Query wiki sont toutes deux épinglées dans le ruban gauche, accessibles en un clic à tout moment. (`Cmd` sur macOS, `Ctrl` sous Windows et Linux.)

### Commandes principales

| Commande | Ce qu'elle fait |
|---------|--------------|
| **📥 Importer une source unique** | `Cmd+P/Ctrl+P` → « Importer une source unique » — choisissez un fichier Markdown ou **PDF (v1.25.0+)**, vous obtenez des pages entité, concept et wiki. *Aussi : 🖱️ icône autocollant du ruban sur la note active.* |
| **📂 Importer depuis un dossier** | `Cmd+P/Ctrl+P` → « Importer depuis un dossier » — ingestion par lots de toutes les notes d'un dossier, avec saut intelligent des lots déjà traités |
| **📑 Importer plusieurs fichiers** | `Cmd+P/Ctrl+P` → « Importer plusieurs fichiers » — sélectionnez un sous-ensemble dans une arborescence à deux volets (file d'attente en direct et annulation fichier par fichier) |
| **🔍 Interroger le wiki** | `Cmd+P/Ctrl+P` → « Interroger le wiki » — dialoguez avec votre wiki dans un panneau latéral ancré à droite ; les réponses portent des `[[wiki-links]]`. *Aussi : 🖱️ icône bulle de message du ruban.* |
| **🛠️ Vérifier le wiki** | `Cmd+P/Ctrl+P` → « Vérifier le wiki » — analyse de santé complète : doublons, liens morts, pages vides, pages orphelines, alias manquants, contradictions |
| **⚡ Smart Fix All** | dans la fenêtre de vérification — réparation en un clic dans l'ordre causal, avec un rapport par phase |
| **📋 Régénérer l'index** | `Cmd+P/Ctrl+P` → « Régénérer l'index » — reconstruit `wiki/index.md` avec les pages et les alias à jour |
| **⏹ Annuler** | `Cmd+P/Ctrl+P` → « Annuler l'ingestion en cours » ou cliquez sur la barre d'état — arrêt propre à la limite de lot suivante |
| **📊 Voir l'historique d'ingestion** | `Cmd+P/Ctrl+P` → « Voir l'historique d'ingestion » — interface de recherche pour les ingestions, les rapports de vérification et les maintenances passés |

![Toutes les commandes de Karpathy LLM Wiki, réunies sous un seul préfixe dans la palette de commandes d'Obsidian](assets/readme/readme-03-commands.webp)

| Avant | Après |
|--------|-------|
| `notes/machine-learning.md` (un fichier plat) | `wiki/concepts/supervised-learning.md` avec des `[[liens bidirectionnels]]`, des alias, l'attribution des sources et une entrée dans `wiki/index.md` |

> 📖 Tutoriels dans [GitHub Discussions → Guides](https://github.com/GD4AI/obsidian-llm-wiki/discussions/categories/guides). Utile ? [Mettez une étoile au dépôt](https://github.com/GD4AI/obsidian-llm-wiki) pour suivre les versions.

---

## ✨ Fonctionnalités

### 📚 Qualité des connaissances

- **🔍 Extraction d'entités et de concepts** — le LLM extrait les entités (personnes, organisations, produits, événements) et les concepts (théories, méthodes, termes) dans des pages autonomes. La granularité se règle (Minimale → Fine, plus Personnalisée) : vous arbitrez entre coût et profondeur.
- **🏷️ Alias obligatoires** — chaque page arrive avec au moins un alias (traduction, abréviation, variante), sans quoi la détection de doublons entre langues ne peut pas fonctionner.
- **🔄 Détection de doublons par niveaux** — le niveau 1 (correspondance directe du nom : entre langues, abréviations, titres très proches) est toujours vérifié ; le niveau 2 (liens partagés, similarité moyenne) consomme le budget de jetons restant.
- **🧩 Fusion intelligente et état des contradictions** — les doublons fusionnent en conservant les alias ; les contradictions sont signalées avec leur source ; une page marquée `reviewed: true` n'est jamais écrasée.
- **🎨 Un seul vocabulaire de tags, le vôtre** — les tags qu'une page peut porter viennent des tags imbriqués de vos notes, des tags déjà présents sur les pages wiki, et de la liste *Personnalisé* dans Paramètres → Configuration du Wiki → Configuration du vocabulaire des tags. Le prompt, la barrière d'écriture, la vérification et le retag lisent tous cette même liste : ce que le modèle reçoit est ce qui atterrit sur le disque ; une valeur hors liste est écartée, jamais écrite. Les petits modèles dérivent encore (environ une exécution sur dix renvoie la taxonomie propre au modèle) — la barrière l'intercepte et la vérification signale la page. Ancre de conception : [Issue #328](https://github.com/GD4AI/obsidian-llm-wiki/issues/328).

![Une page concept générée : le tag de vocabulaire qui l'a écrite, ses alias AF et AFib, sa définition et les pages qui s'y rattachent](assets/readme/readme-04-entity-page.webp)

### 📄 Ingestion de documents / PDF / images

Six points d'entrée, réglables ingestion par ingestion :

1. **🧾 Backend MinerU intégré** — Paramètres → Configuration du Wiki → Backend de conversion Markdown → *MinerU*. PDF, images (PNG/JPG/WebP/GIF/BMP et d'autres) et Office (DOC/DOCX/PPT/PPTX/XLS/XLSX) passent par le [parseur Precise de MinerU](https://mineru.net/apiManage/docs). Le jeton vit dans SecretStorage ; il expire au bout d'environ 90 jours, donc une erreur 401 dit que le jeton a probablement expiré et nomme la page où le renouveler. Les plafonds sont de 200 Mo / 200 pages par PDF et de 256 Mo / 10 000 fichiers par archive. C'est le chemin des articles scannés et des fichiers Office dont la mise en page compte.
2. **☁️ Fournisseurs cloud avec PDF natif** — Anthropic, OpenAI, Google Gemini et AWS Bedrock (variantes Anthropic et OpenAI) lisent les PDF comme des file parts, sans autre réglage que le choix du fournisseur.
3. **🖥️ OCR local sur Apple Silicon** — [oMLX](https://github.com/jundot/omlx) embarque Microsoft Markitdown comme backend PDF→Markdown. Activez Markitdown dans oMLX, chargez [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) (3B / 570M actifs, publié en 2026-06) comme modèle de vision, déclarez oMLX comme fournisseur OpenAI-compatible personnalisé, activez **Forcer le support PDF** et choisissez le modèle multimodal qu'oMLX sert. Le PDF ne quitte jamais votre machine.
4. **🛠️ Extracteur tiers (interface en ligne MinerU)** — le [service MinerU Extractor](https://mineru.net/OpenSourceTools/Extractor) reste là pour une conversion manuelle rapide, quand vous ne voulez pas configurer de jeton API. Téléchargez le `.md` obtenu, déposez-le dans votre coffre en dehors du dossier wiki, et ingérez-le comme une note Markdown ordinaire.
5. **🔌 Forcer le support PDF** — pour tout autre endpoint compatible OpenAI ou Anthropic qui accepte les file parts, le plugin tente l'appel (Paramètres → Configuration LLM → Paramètres LLM avancés). L'endpoint tranche ; un échec apparaît dans une notice localisée.
6. **🖼️ Images Markdown intégrées** — activez *Analyser les images intégrées lors de l'ingestion Markdown* dans les paramètres avancés pour analyser chaque intégration locale `![[image.png]]` et `![alt](image.png)`. Chaque image est analysée avec les paragraphes Markdown les plus proches, envoyée dans des paquets de preuves visuelles de 20 Mio et plafonnée à 10 Mio ; les URL distantes ne sont jamais téléchargées. Pour une sortie vérifiable image par image, activez *Enregistrer les preuves visuelles des images intégrées dans la page source* : une section d'audit repliable est ajoutée à la page source générée.

**Réserve sur les formats Office :** Obsidian ne rend pas nativement les `.docx` / `.xlsx` / `.pptx` ([file-formats](https://obsidian.md/help/file-formats)). Le flux pratique pour un fichier Office est donc : MinerU le convertit en `.md`, le plugin ingère ce `.md` en pages wiki, et le fichier Office d'origine reste pour référence. Pour prévisualiser un fichier Office dans Obsidian, utilisez un plugin communautaire comme Pandoc Plugin / Docxer / Md Importer / Office Reader.

**Plomberie commune à tous les chemins :**

- **🗄️ Cache borné** — `.obsidian/plugins/karpathywiki/pdf-cache/` garde le Markdown converti, indexé par hash de contenu + modèle + version du convertisseur ; plafonds de 100 Mo au total / 1 000 entrées / 10 Mo par entrée, avec éviction LRU par date de modification.
- **📝 Copie optionnelle dans le coffre** — Paramètres → Configuration du Wiki → Dossier wiki → *Écrire le Markdown converti dans le Vault* écrit `<basename>.pdf.md` à côté du PDF source (désactivé par défaut — le cache seul est le comportement par défaut).
- **🛡️ Prompt de transcription verbatim** — conversion de type OCR avec les marqueurs anti-hallucination `[illegible]` / `[figure: ...]` ; les fences ```markdown ajoutées par les petits modèles locaux sont nettoyées avant l'écriture dans le cache.
- **🔁 Citations verbatim dans les pages sources (v1.27.0, #496)** — chaque page `sources/<slug>.md` générée porte une section `Mentions in Source` construite à partir des mêmes citations verbatim que celles recueillies pour chaque entité et chaque concept (la prose dont le modèle a déjà montré qu'il la voyait) : le document d'origine est ainsi la seule page wiki qui garde une trace réelle et ancrée vers son texte source.

📖 **Guides d'installation complets** pour tous les chemins (fournisseurs cloud, paliers matériels oMLX, installation de MinerU, entretien du cache) → [docs/PDF-OCR-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 Requête et maintenance

**Recherche et réponses**

- **🧭 Cascade PPR en 5 étapes** — voir [Fonctionnement de la recherche](#-fonctionnement-de-la-recherche). Personalized PageRank sur le graphe `[[wiki-link]]` donne un contexte multi-sauts conscient du graphe.
- **🔤 Score lexical qui lit le corps du texte** — le chemin rapide note le titre, les alias, le résumé **et le corps** avec BM25F : le texte le plus long d'une page atteint enfin le scoreur. C'est le plus grand gain de rappel que ce projet ait obtenu.
- **🧩 Mise en forme des pages liées** — une page hub ne peut plus attirer toutes les autres vers elle. Les listes de pages liées sont recalculées à chaque écriture à partir des noms qui ont survécu, classées et plafonnées.
- **🔁 Bascule vers l'ancien scoreur** — Paramètres → Paramètres avancés → *Ancien scoreur de requête* exécute l'ancien classement linéaire réglé à la main au lieu du nouveau. Désactivé par défaut : le nouveau classement est le comportement par défaut, et cette bascule est le chemin de retour.
- **📏 Le budget de réponse est de 16 000 jetons, et le pipeline dit quand il est épuisé** — la réponse ne s'arrête plus en silence à la limite du budget. Le contexte est ajusté à un budget de pages avant l'assemblage : les 20 pages sont dans le prompt par construction, pas par chance.
- **🔖 Des citations de forme académique** — le composeur grandit avec le contenu, et *effacer l'historique* efface vraiment le contenu.
- **🪟 Panneau latéral ancré à droite** — Query wiki s'ouvre dans un panneau latéral façon Copilot (v1.22.1+), et non dans une fenêtre centrée.

**Maintenance et réparation**

- **🔍 Analyse de santé** — une seule commande relève les doublons, les liens morts, les pages vides, les pages orphelines, les alias manquants et les contradictions. Elle liste aussi les pages hub dont le voisinage s'est cristallisé — un hub qui tient lieu de liens que le contenu ne peut plus faire.
- **⚡ Smart Fix All** — réparation en un clic dans l'ordre causal : remplir les alias → fusionner les doublons → corriger les liens morts → relier les pages orphelines → développer les pages vides, avec un rapport par phase.
  
  ![Un rapport de vérification du wiki — la ligne d'état, les liens morts trouvés et le bouton Smart Fix All qui les répare en une passe](assets/readme/readme-08-lint-report.webp)
- **🚧 Réparation des liens morts : le choix de laisser tel quel** — Paramètres → Paramètres avancés → *Créer des pages talon pour les liens non résolus* (activé par défaut). Désactivez-le et un lien mort reste visible dans chaque rapport jusqu'à ce qu'une vraie source le définisse, au lieu de devenir une page de remplissage vide. La barrière « jamais d'extension sans source » de #197 ne change pas ; ce réglage décide seulement si le talon est écrit.
- **📊 Panneau d'historique des opérations** — interface de recherche et de filtrage pour les ingestions, les rapports de vérification et les maintenances passés.

**Barrières qui tombent avant qu'un appel soit payé**

- **🛡️ Filtre avant ingestion** — une note vide, blanche ou réduite à son frontmatter est refusée avant tout appel LLM ; la déduplication par hash de contenu repère les fichiers identiques d'un chemin à l'autre.
- **🚦 Filtre des candidats à l'ingestion** — optionnel (`skipMentionOnlyCandidates`, désactivé par défaut). Un candidat nommé seulement entre parenthèses, dans une énumération ou dans un court élément de liste est élagué avant de coûter une génération et un appel de dédoublonnage. Il ne s'applique qu'aux langues qui ont un profil mesuré ; une langue sans profil n'est jamais filtrée en silence, et les notes multilingues ne sont pas filtrées du tout.
- **🎛️ Politiques par étape** — champ Paramètres LLM avancés → *Mode de sortie et raisonnement par étape* ; surchargez le mode texte ou le niveau de raisonnement d'une étape sans toucher au code. La base intégrée reste intacte pour les étapes que vous ne listez pas.

### 🦙 Local d'abord

- **🖥️ Ollama, LM Studio, OpenRouter, endpoint personnalisé** — prêts à l'emploi. Un modèle local suffit pour interroger (fenêtre de contexte plus courte) ; ingérer un coffre de 2 000 pages demande en général un modèle cloud à long contexte.
- **📄 La voie OCR des PDF est entièrement locale sur Apple Silicon** — voir [Ingestion de documents / PDF / images](#-ingestion-de-documents--pdf--images) plus haut.
- **🔐 ChatGPT Plan (Codex OAuth)** — rappel loopback sur ordinateur, ou code d'appareil sur mobile ; les identifiants ne vivent que dans Obsidian SecretStorage. (Voir [Anthropic vs OpenAI vs Codex OAuth](#anthropic-vs-openai-vs-codex-oauth--ce-sont-des-fournisseurs-distincts) plus bas pour l'explication complète des frontières entre fournisseurs.)

### 🌐 Langue

- **🌍 11 langues d'interface** — English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano, Русский. L'interface et la langue de sortie du wiki sont indépendantes — votre wiki peut être en chinois pendant que l'interface est en anglais.
  
  ![Deux réglages séparés, langue de l'interface et langue de sortie du wiki, pour un wiki en chinois derrière une interface en anglais](assets/readme/readme-06-language-settings.webp)
- **📚 11 langues de sortie wiki** — le même ensemble ; à choisir dans Paramètres → Configuration du Wiki. L'option *Custom input* sert aux prompts ponctuels.
- **Toutes les chaînes traduites, langue par langue** — chaque libellé, chaque fenêtre, chaque notice. Une 12e langue vient des contributeurs (le modèle est la PR #159).
- **🔧 En-têtes personnalisés par fournisseur** — un champ libre juste sous l'API Base URL. Un `Nom: valeur` par ligne, envoyé à chaque requête. Livré avec un préréglage OpenCode et une variante `(Responses)` pour les endpoints qui parlent `/v1/responses`.
- **📡 Un flux qui survit à une origine bloquée** — quand une requête cross-origin est refusée, le flux repart sur un transport `node:https` de bureau au lieu de retomber sur une réponse mise en tampon, et un repli échoué est consigné au lieu d'être avalé.

### ⚙️ Paramètres qui orientent une exécution

Le plugin décide de presque tout à votre place. Ces huit réglages changent cela, et chacun répond à une panne que quelqu'un a rencontrée.

| Réglage | Où | Ce qu'il change |
|---|---|---|
| **Streaming des requêtes d'ingestion** | Paramètres avancés | `auto` diffuse sur mobile ; `always` et `never` forcent le choix. Le streaming est ce qui garde une longue ingestion sous le délai d'inactivité d'un fournisseur. |
| **Niveau de réflexion** | Paramètres LLM avancés | Default / Bas / Moyen / Élevé. L'AI SDK traduit le niveau pour chaque fournisseur : aucun champ fournisseur écrit à la main n'entre en jeu. |
| **Max. jetons de sortie par appel** | Paramètres LLM avancés | Fonctionne maintenant dans les deux sens : augmentez-le quand un modèle de raisonnement dépense le budget avant d'écrire, baissez-le pour plafonner le coût. Vide demande au modèle son propre plafond. |
| **Fenêtre de contexte du modèle** | Paramètres LLM avancés | Le plafond ne peut plus dépasser la fenêtre : un petit modèle local ne reçoit jamais un nombre qu'il ne peut pas accepter. |
| **Parallélisme LLM** | Configuration LLM | 1 à 20 appels en parallèle. Une valeur haute termine plus tôt une grosse ingestion ; une valeur basse garde un modèle local dans sa mémoire. |
| **Priorité d'extraction** et **`Additional Content Rules`** | Paramètres avancés | Texte libre écrit dans `schema/config.md`. Ils orientent ce que le modèle extrait sans que vous éditiez le schéma à la main. |
| **Mode de sortie et raisonnement par étape** | Paramètres LLM avancés | Surchargez le mode texte ou le niveau de raisonnement d'une seule étape — extraction, fusion, requête — sans changer les autres. |
| **Fichiers exclus** | la liste d'Obsidian | L'ingestion de dossier, la surveillance des fichiers et le chemin automatique respectent les exclusions que vous avez posées dans Obsidian : le plugin et Obsidian s'accordent sur ce qui est hors limites. |

---

## 🌐 Écosystème

Le plugin s'articule au reste de votre pile Obsidian — chaque outil ci-dessous se branche au graphe `[[wiki-link]]` sans modification de code.

- **📄 [Backend multi-format MinerU](https://mineru.net/apiManage/docs) (intégré depuis la v1.27.0)** — ce qui était une étape CLI ou une interface séparée est devenu un réglage du plugin ; voir [Ingestion de documents / PDF / images](#-ingestion-de-documents--pdf--images) pour le tableau complet des chemins. Le [service en ligne MinerU](https://mineru.net/OpenSourceTools/Extractor) reste disponible pour qui préfère une interface rapide à un jeton API ; [héberger MinerU soi-même](https://github.com/opendatalab/mineru) est aussi une option.
- **🕸️ Obsidian Graph View** — ouvrez le graphe natif sur n'importe quelle page wiki ; chaque `[[wiki-link]]` devient un nœud, chaque rétrolien une arête. Intégré, zéro octet de bundle en plus.
  
  ![Le Graph View natif d'Obsidian sur un wiki généré — pages sources, entités et concepts dans un seul graphe connecté](assets/readme/readme-05-graph-view.webp)
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** — l'extension officielle de navigateur. Enregistrez des pages web (articles, billets de blog, fils Reddit, Hacker News, recettes, articles de recherche, transcriptions YouTube via Interpreter) dans n'importe quel dossier de votre coffre, puis lancez la commande « Importer depuis un dossier » pour extraire entités et concepts par lots.
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** — interrogez le wiki comme une base de données avec DQL (`LIST FROM "wiki/entities" WHERE contains(tags, "person")`) ou l'API JS. Le plugin écrit un frontmatter standard (`tags:`, `type:`, `aliases:`) sur chaque page : les requêtes Dataview fonctionnent sans réglage.
- **🌿 Git** — versionnez votre coffre avec n'importe quel client Git. Le plugin ne réécrit jamais vos fichiers sources ; il crée seulement de nouvelles pages sous `wiki/`, si bien que `git diff` sépare nettement vos modifications du contenu produit par le LLM.
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** — transformez n'importe quelle note Obsidian en diaporama par le frontmatter Marp (`marp: true`). Les pages wiki sont du Markdown pur : elles se rendent en diapositives sans conversion supplémentaire.
- **🖼️ Canvas** — le canevas infini natif d'Obsidian. Déposez des fiches wiki sur un canvas pour assembler fiches de révision, cartes mentales ou synthèses de recherche à partir des `[[wiki-links]]`, sans quitter le coffre.

---

## 🔍 Fonctionnement de la recherche

La plupart des plugins de « recherche IA » découpent vos notes en morceaux et les enfouissent dans une base vectorielle. Nous ne le faisons pas. [L'argument de Karpathy contre le RAG](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) est que le découpage brise la capacité du LLM à raisonner sur l'ensemble de votre graphe de connaissances — et cet argument tient en pratique. Nous parcourons donc le graphe que vous entretenez déjà en écrivant des `[[wiki-links]]`.

### La cascade de sélection de graines en 5 étapes

Quand vous demandez « Qui a fondé Microsoft ? », Query wiki déroule cinq étapes avant toute génération de réponse :

1. **Chemin rapide lexical** — BM25F sur le titre, les alias, le résumé **et le corps** de chaque entité et de chaque concept, avec saturation par champ et IDF calculé sur une vraie table de fréquence documentaire. Gratuit, instantané, et l'étape qui commande toutes les suivantes.
2. **Génération de mots-clés par le LLM** — le LLM propose 8 à 12 mots-clés multilingues à partir de votre requête (il gère synonymes, abréviations et termes qui résistent au chevauchement de jetons, en un seul appel).
3. **Scan local de sous-chaînes** — chaque mot-clé généré est rematché localement contre les titres de pages, les alias et des extraits de corps. Aucun appel LLM supplémentaire ; cela complète le rappel tolérant au bruit.
4. **Repli LLM sur la base de connaissances** — quand lexical et mots-clés renvoient des signaux faibles, le LLM ré-ensemence les N meilleurs candidats contre tout le wiki, en une passe sémantique.
5. **Expansion de graphe PPR** — Personalized PageRank (Haveliwala 2002) sur le graphe `[[wiki-link]]`, en partant du jeu de graines candidates. C'est ce qui donne un contexte multi-sauts conscient du graphe : « Bill Gates » → « Microsoft » → « concurrents », et non un simple chevauchement de titres.

La cascade s'arrête à l'étape qui a renvoyé assez de signal — pas de coût fixe en 5 étapes ; aucun appel LLM quand le lexical suffit ; le repli sémantique seulement quand lexical et mots-clés ne suffisent pas.

### Expansion de la requête, et un chemin de retour

Quand la cascade atteint l'étape du graphe, la requête est étendue deux fois avant le choix des graines : une fois avec les termes du wiki, une fois avec les termes proposés par le LLM. Chaque passe est pondérée, et le gain est mesuré sur les coffres du projet plutôt que supposé — sur les deux coffres écrits par la version actuelle, l'expansion vaut **+0,086** et **+0,113** en r@10, l'intervalle excluant zéro dans les deux cas. L'affirmation reste volontairement étroite : la forme pondérée n'est **pas** mesurablement meilleure que la simple concaténation, et l'interrupteur qui relance l'ancien scoreur est là pour le lecteur dont les résultats se sont dégradés.

Paramètres → Paramètres avancés → *Ancien scoreur de requête* exécute l'ancien scoreur linéaire réglé à la main. Le nouveau classement est le comportement par défaut ; la bascule est le chemin de retour.

### Personalized PageRank à l'échelle

Nous utilisons Monte Carlo PPR (Fogaras 2005) — 3 000 marches aléatoires de 50 pas chacune — avec la règle de cul-de-sac de Haveliwala 2002. Le coût est **O(K × L)** (K = marches, L = pas par marche), indépendant du nombre de pages : un coffre de 2 000 pages connaît la même latence d'expansion qu'un coffre de 200 pages.

**PPR @5 = 27,1 % contre une base kNN pur à 24,1 %** sur un coffre du projet. Le corpus n'est pas public : lisez ce nombre comme la comparaison que le projet a mesurée pour lui-même, pas comme une promesse sur votre coffre ; `tools/dev-instrument/run-recall-harness.mjs` est l'instrument qui mesure le rappel sur un coffre.

### Pourquoi pas d'embeddings

Nous avons écarté la voie des embeddings en connaissance de cause dans [l'issue #175](https://github.com/GD4AI/obsidian-llm-wiki/issues/175). Le signal est déjà dans le graphe — chaque `[[wiki-link]]` est une arête « ces pages sont liées », établie à la main — et la plupart des fournisseurs que nous prenons en charge (Ollama, LM Studio, Anthropic, Bedrock, Kimi, GLM, MiniMax) n'exposent aucun endpoint `/v1/embeddings`. Ajouter un modèle d'embedding imposerait un téléchargement par page, un adaptateur par fournisseur et aucun gain de qualité de recherche.

---

## 🤖 Modèles

Quinze fournisseurs nommés, plus tout endpoint compatible OpenAI ou Anthropic. Le tableau de choix par palier — cloud, local, OCR, quantification, matériel — se trouve dans [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md), vérifié le 2026-11-06 face à [models.dev](https://models.dev/).

- **Cloud de pointe** — Anthropic, OpenAI, Google Gemini, xAI Grok, Moonshot Kimi, Zhipu GLM, MiniMax. PDF natif sur Anthropic, OpenAI et Gemini.
- **Budget et poids ouverts** — DeepSeek, Alibaba Qwen, Step, Tencent Hunyuan, Xiaomi MiMo, Google Gemma.
- **Entreprise** — AWS Bedrock (variantes Anthropic et OpenAI, avec clé API, SSO ou IAM) et ChatGPT Plan via Codex OAuth.
- **Local et passerelles** — Ollama, LM Studio, OpenRouter, passerelles compatibles Anthropic.

Le plugin envoie au LLM tout le contexte de votre wiki à chaque requête : **les modèles à long contexte gagnent**.

### Ce qui compte

- **🧠 Fenêtre de contexte ≥ 200K jetons** pour les coffres de plus de 500 pages environ. En dessous de 200K, la cascade peut abandonner des étapes pour tenir dans la fenêtre.
- **⚖️ La qualité de suivi des instructions** pèse plus que le QI brut sur la tâche d'extraction — choisissez un modèle qui suit le modèle de schéma, pas le plus gros chiffre du classement.
- **🔌 L'endpoint d'embedding n'a aucune importance** — nous n'utilisons pas d'embeddings. Un fournisseur sans `/v1/embeddings` convient parfaitement (la plupart de nos 15+ fournisseurs n'en proposent pas).
- **🦙 Le local pour interroger, le cloud pour ingérer** — ingérer un coffre de 2 000 pages demande en général un modèle cloud à long contexte ; un modèle local à 262K couvre la plupart des requêtes.

Pour l'ingestion PDF, images et Office, voir [Ingestion de documents / PDF / images](#-ingestion-de-documents--pdf--images) dans les fonctionnalités — Anthropic, OpenAI, Bedrock et Gemini lisent les PDF comme des file parts nativement ; le backend MinerU intégré (v1.27.0+) et **Forcer le support PDF** couvrent tout le reste.

### Anthropic vs OpenAI vs Codex OAuth — ce sont des fournisseurs distincts

- **Anthropic** (et sa variante Bedrock) — clé API Anthropic Platform facturée séparément.
- **OpenAI** — clé API OpenAI Platform facturée séparément.
- **ChatGPT Plan (Codex OAuth)** — fournisseur distinct et expérimental, qui consomme une allocation Codex admissible après connexion par navigateur ou par code d'appareil ; sa disponibilité suit les politiques d'authentification et d'allocation d'OpenAI Codex, pas le nom de votre offre. C'est une compatibilité Codex tierce, ni un partenariat OpenAI ni une API ChatGPT générale.

### AWS Bedrock — trois modes d'authentification (v1.27.0, #425)

Paramètres → Fournisseur → Bedrock (Anthropic / OpenAI) choisit maintenant l'un des trois modes d'authentification ; la ligne du fournisseur ne demande ensuite que les entrées dont ce mode a réellement besoin :

- **Clé API** — le chemin bearer d'origine, étape 1 ; comportement identique octet pour octet à la v1.26.4, et le choix recommandé pour qui paie déjà une clé API Bedrock.
- **SSO** — flux d'appareil IAM Identity Center. Cliquez sur *Se connecter avec AWS SSO*, collez le code d'URL de vérification dans le navigateur, le plugin reçoit un jeton SSO via `karpathywiki-bedrock-sso` dans SecretStorage, l'échange contre des identifiants de rôle temporaires et signe chaque requête avec un SigV4 écrit à la main (aucun SDK AWS ajouté). L'identifiant de compte et le nom de rôle sont détectés automatiquement quand l'identité SSO en expose exactement un de chaque ; sinon, saisissez-les dans les paramètres du fournisseur.
- **IAM** — clés d'accès statiques pour les environnements sans SSO (CI, tâches batch planifiées). Stockées dans `karpathywiki-bedrock-iam` dans SecretStorage ; le cache en mémoire mémoïse par clé d'accès pour garder la signature SigV4 dans la fenêtre d'expiration.

Les trois modes partagent la même discipline SecretStorage (aucun identifiant dans `data.json`, dans les journaux ou dans la documentation) et le même chemin OIDC + SigV4 écrit à la main, sans SDK AWS. La région Bedrock est indépendante du mode d'authentification et se règle dans la même ligne du fournisseur.

> 📖 **Tableau de sélection complet** (cloud + local + OCR PDF + Codex OAuth + quantification + paliers matériels) → [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

## ❓ FAQ

### Que fait exactement le plugin ?

Choisissez une note, un dossier ou une sélection : le LLM extrait les entités et les concepts et écrit un wiki relié par des `[[liens bidirectionnels]]`. Posez une question, la réponse vient de ces pages, avec ses citations. Vos notes d'origine ne sont jamais modifiées.

### Mon wiki existant est-il en sécurité ?

✅ Rétrocompatible depuis la v1.0.0. Posez `reviewed: true` sur une page pour la protéger de l'écrasement. Passer de la v1.24.x ne réécrit pas votre coffre ; l'ingestion PDF de la v1.25.0 est en cache seul par défaut, et la v1.27.0 ajoute l'ingestion native PDF + images + Office sans changer la disposition du wiki sur le disque.

### Puis-je ingérer des PDF, des images et des documents Office ?

✅ Oui. Anthropic, OpenAI, Bedrock et Gemini lisent les PDF nativement ; le backend MinerU intégré (v1.27.0) couvre tout le reste (PDF + images + Office). Le guide complet — fournisseurs cloud, OCR Apple Silicon, Forcer le support PDF, entretien du cache — est dans [docs/PDF-OCR-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md).

### Mes données partent-elles quelque part ?

🚫 Aucun backend, aucune analytique — le plugin tourne entièrement dans Obsidian. Seul le texte que vous envoyez explicitement pour l'ingestion ou une requête quitte votre appareil, et uniquement vers le fournisseur LLM que vous configurez. Pour une localité complète des données, utilisez Ollama ou LM Studio.

### Puis-je utiliser le plugin dans ma langue ?

🌍 11 langues pour l'interface comme pour la sortie du wiki, réglées indépendamment. Une 12e langue vient des contributeurs (la PR #159 en est le modèle).

### En quoi est-ce différent d'un chatbot RAG ?

Pas de découpage, pas d'embeddings, pas de base vectorielle. Personalized PageRank parcourt le graphe `[[wiki-link]]` que vous entretenez déjà, ce qui donne un contexte multi-sauts sans coût d'embedding.

### Quel LLM choisir ?

Un modèle à long contexte : ≥ 200K jetons pour les coffres de plus de 500 pages environ. Le tableau par palier est dans [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md).

### Existe-t-il une référence publiée ?

PPR @5 = 27,1 % contre une base kNN pur à 24,1 %, mesuré sur un coffre du projet — [Fonctionnement de la recherche](#-fonctionnement-de-la-recherche) dit ce que cela prouve et ce que cela ne prouve pas.

### Comment maîtriser les coûts d'API ?

Utilisez la granularité d'extraction Grossière ou Minimale pour l'ingestion par lots. Smart Batch Skip détecte les fichiers déjà ingérés. La maintenance automatique est DÉSACTIVÉE par défaut. La vérification affiche les compteurs avant de lancer une correction — rien n'est facturé sans votre accord.

### Comment annuler une opération en cours ?

Cliquez sur la barre d'état (elle affiche « Ingestion… cliquer pour annuler ») ou `Cmd+P/Ctrl+P` → « Annuler l'ingestion en cours ». L'arrêt est propre, à la limite de lot suivante.

### Où trouver de l'aide ?

[GitHub Issues](https://github.com/GD4AI/obsidian-llm-wiki/issues) pour les bogues · [GitHub Discussions](https://github.com/GD4AI/obsidian-llm-wiki/discussions) pour les questions et les demandes de fonctionnalités · la console développeur (`Ctrl+Shift+I` / `Cmd+Option+I`) pour les journaux du plugin.

---

## 🔒 Confidentialité

Ce plugin est référencé sur le marché des plugins communautaires d'Obsidian et passe une revue automatisée de sécurité et de permissions.

- **🚫 Aucun backend propre, aucune télémétrie, aucune collecte de données.** C'est un logiciel purement local qui tourne dans Obsidian. Le plugin n'exploite aucun serveur et ne rapporte rien nulle part.
- **🔐 L'accès réseau est optionnel et explicite.** Il ne sert qu'à joindre des services que *vous* configurez : votre fournisseur LLM et, si vous activez le backend documentaire MinerU, `mineru.net`. Cette seconde destination mérite d'être nommée : elle envoie le document dans une juridiction que vous n'avez pas choisie et qui ne publie aucune règle de conservation. [Où votre document est traité](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md#-where-your-document-is-processed) liste chaque chemin et la destination du fichier.
- **📁 L'accès aux fichiers du coffre** sert à la gestion du wiki (lire des notes, générer des pages, repérer les liens morts, détecter les doublons). Le plugin ne modifie jamais vos fichiers sources.
- **📋 L'accès au presse-papiers** est réservé au bouton « Copier » de la fenêtre de requête — et seulement quand vous cliquez dessus.

Pour une localité complète des données, utilisez Ollama ou LM Studio. Avec un fournisseur local, vos données ne quittent jamais votre machine.

---

## 💖 Soutien

Si Karpathy LLM Wiki est devenu une part utile de votre travail sur vos connaissances :

- ☕ **[Offrez-moi un Ko-fi](https://ko-fi.com/greenerdalii)** — ponctuel ou mensuel
- 💳 **[Un pourboire via PayPal](https://paypal.me/greenerdalii)** — ponctuel

Merci à celles et ceux qui soutiennent le projet :

[@jameses-cyber](https://github.com/jameses-cyber), [@issaqua](https://github.com/issaqua), Dikson Choi

### Contribuer

Les rapports de bogues et les pull requests sont les deux utiles. [CONTRIBUTING.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CONTRIBUTING.md) couvre la compilation, la boucle de test et les contrôles qu'un changement doit passer ; [CODE_OF_CONDUCT.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CODE_OF_CONDUCT.md) est court. [ROADMAP.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/ROADMAP.md) montre ce qui est prévu, et [CHANGELOG.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CHANGELOG.md) consigne ce qui est livré.

Compiler depuis les sources : `pnpm install`, `pnpm build:dev`, `pnpm gate:1` — cette dernière commande enchaîne lint, vérification de l'architecture, vérification des types, compilation, tests et lint CSS. `tools/dev-instrument/` est l'instrument de mesure réservé au développement : il exécute le vrai `WikiEngine.ingestSource` sur un dossier du disque sans runtime Obsidian et imprime la comptabilité par tâche en jetons et en temps réel, d'où viennent les chiffres de performance du changelog. La CLI destinée aux utilisateurs est un dépôt frère — `npm i -g karpathywiki-cli`.

---

## 🔭 Autres projets

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — le même `WikiEngine` sans moteur de rendu : `npm i -g karpathywiki-cli`, puis `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`.
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — un routeur au niveau de la tâche pour [pi-coding-agent](https://github.com/earendil-works/pi) : un petit juge classe chaque tour comme routinier ou lourd, et le palier retenu pilote le modèle, les outils et la chaîne de repli. MIT. → [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — la même conception de routage pour le runtime [dsh-coding-agent](https://github.com/earendil-works/dsh). MIT.
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — le workflow de plugin Obsidian côté DSH : il monte un espace de travail, pilote une boucle Rouge→Vert, exécute les mêmes barrières de qualité que ce dépôt et laisse une branche `feat/*` ou `fix/*` prête à livrer.

---

## 📜 Licence et crédits

Apache License, Version 2.0 — voir [LICENSE](../LICENSE), [NOTICE](../NOTICE) et [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md).

**Construit sur :**
- 💡 [Andrej Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — le concept d'origine
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v7](https://ai-sdk.dev/) (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) via `requestUrl` d'Obsidian
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) et [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — les algorithmes de recherche

**Mainteneurs :** [@green-dalii](https://github.com/green-dalii) (auteur) · [@DocTpoint](https://github.com/DocTpoint) (co-mainteneur depuis septembre 2026)

[![Star History Chart](https://api.star-history.com/chart?repos=GD4AI/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
