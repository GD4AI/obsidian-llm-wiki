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

![Banner do plugin Karpathy LLM Wiki — uma rede de páginas wiki interconectadas, construída a partir das suas notas Obsidian](assets/llm_wiki_banner.webp)

# 🧠 Plugin Karpathy LLM Wiki para Obsidian

> Um plugin Obsidian que transforma as suas notas numa base de conhecimento conectada e pesquisável — a ideia do [LLM Wiki do Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), construída no editor onde você já escreve.

**Pontuação perfeita na revisão da Obsidian • Recuperação por grafo sem embeddings • 11 idiomas nativos • Ingestão nativa de PDF + imagens + Office • Funciona com qualquer provedor • Local primeiro • Sem backend • Compatível com RGPD**

![Version](https://img.shields.io/github/v/release/green-dalii/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-16%2B-cyan?style=flat-square) <br>
![Maintenance](https://img.shields.io/badge/maintenance-actively%20maintained-brightgreen?style=flat-square) ![Build Status](https://img.shields.io/github/actions/workflow/status/green-dalii/obsidian-llm-wiki/release.yml?style=flat-square) ![Author](https://img.shields.io/badge/author-Greener--Dalii-blue?style=flat-square) <br>
![GitHub Stars](https://img.shields.io/github/stars/green-dalii/obsidian-llm-wiki?style=flat-square) ![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/green-dalii/obsidian-llm-wiki)

[English](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_CN.md) | [繁體中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_KO.md) | [Deutsch](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_DE.md) | [Français](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_FR.md) | [Español](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ES.md) | **Português** | [Italiano](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_IT.md) | [Русский](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[Site oficial](https://llmwiki.greenerai.top/) | [Mercado Obsidian](https://community.obsidian.md/plugins/karpathywiki) | [Blog](https://llmwiki.greenerai.top/blog/) | [Discussões](https://github.com/green-dalii/obsidian-llm-wiki/discussions)

🤔 [Por que este plugin?](#-por-que-este-plugin) | 🚀 [Início rápido](#-início-rápido) | ✨ [Funcionalidades](#-funcionalidades) | 🌐 [Ecossistema](#-ecossistema) | 🔍 [Como funciona a recuperação](#-como-funciona-a-recuperação) | 🤖 [Modelos](#-modelos) | ❓ [FAQ](#-faq)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD) ← Se este plugin te ajudou, sinta-se à vontade para me pagar um café♥️ ou deixar uma estrela🌟↗

---

## 🤔 Por que este plugin?

Você escreve notas. Elas ficam em pastas. Encontrar o que se relaciona com o quê significa lembrar de fios que você esqueceu há meses.

**Existem outras reimplementações open-source da ideia do LLM Wiki do Karpathy — mas nenhuma delas é um plugin Obsidian de um clique.** A maioria são ferramentas de CLI, skills do Claude Code ou aplicativos desktop separados; este roda dentro do Obsidian — Graph View, ribbons e paleta de comandos incluídos.

### Como nos comparamos

|  | **Karpathy LLM Wiki** (este plugin) | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | sdyckjq / llm-wiki-skill | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|---|
| **Entrega e instalação** | ✅ **5 min** — Plugin Obsidian de um clique: Community Plugins → Instalar → escolher provedor → Ingerir | ❌ 30 min+ — Compilar/baixar binário Tauri, configurar CLI | ❌ 15 min — requer assinatura Claude Code + instalação da skill | ❌ 10 min — requer assinatura Claude Code/Codex + configuração | ❌ 30 min+ — pip install + Python SDK + servidor local |
| **Arquitetura e dependências** | ✅ **Zero dependências** — sem BD vetorial, sem modelo de embedding, sem processos externos (PPR sobre o grafo `[[wiki-link]]`, por design) | 🟡 Embutido seu próprio runtime Python + sigma.js + sqlite; embeddings opcionais, desligados por padrão | 🟡 Usa o ambiente do Claude Code — não é autocontido; sem embeddings | 🟡 Requer runtime de plataforma separada; sem embeddings | ❌ Requer Python + modelo de embedding + BD vetorial (obrigatório) |
| **i18n (UI + saída wiki)** | ✅ 11 idiomas (UI / saída independentes) | 🟡 2 (EN / 中文) | ❌ Apenas inglês | ❌ Apenas inglês | ❌ Apenas inglês |
| **Provedores LLM** | ✅ 16+ (Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, ...) | 🟡 Compatível com OpenAI | 🟡 Assinatura via Claude Code | 🟡 Assinatura via Claude Code / Codex | 🟡 Compatível com OpenAI |
| **Recuperação e pipeline de consulta** | ✅ **Cascata de 5 estágios** — Lex → keyword LLM → varredura de substring → fallback KB LLM → expansão PPR (trunca no primeiro sinal suficiente). Personalized PageRank (Haveliwala 2002) + Monte Carlo (Fogaras 2005) | 🟡 Apenas decaimento de 2 saltos (heurística de 4 sinais: Adamic-Adar + 2 saltos) | ❌ Apenas deteção de comunidades Louvain | ❌ Apenas pré-visualizações k-hop (sem aumento LLM) | ❌ BM25 + semântico sobre chunks (sem grafo) |
| **Visualização do grafo** | ✅ Graph View nativo do Obsidian (integrado, tamanho extra zero) | ❌ sigma.js + graphology personalizados em app desktop | 🟡 graph.html vis.js (arquivo separado) | ❌ sigma.js offline HTML personalizado | ❌ Visualizador de navegador só de leitura |
| **Honestidade da Wiki** | ✅ Banner "ESTÁGIO FALLBACK" quando nenhuma fonte wiki corresponde à sua consulta | ❌ Sem equivalente | ❌ Sem equivalente | ❌ Sem equivalente | ❌ Sem equivalente |
| **Benchmark de recuperação publicado** | ✅ PPR @5 = 27,1% vs pure-kNN 24,1% (único número publicado neste espaço) | ❌ 58% → 71% *apenas com embeddings ativados*, não no nosso formato comparável | ❌ Não publicado | ❌ Não publicado | ❌ Não publicado |

### Três coisas que escolhemos de propósito, não por acidente

- **🪟 Obsidian é o runtime.** Sem terminal, sem app separado, sem Docker, sem Python. Instale dos Community Plugins, clique em Ingerir, a wiki vive no seu vault desde o primeiro segundo. O Graph View nativo do Obsidian renderiza o seu grafo `[[wiki-link]]` — integrado, tamanho extra zero no bundle.
- **🧭 Limpo e autocontido.** Zero dependências. Sem modelo de embedding, sem banco de dados vetorial, sem pacote pip — um único plugin que lê suas notas, conversa com um LLM e escreve páginas wiki. Tudo vive dentro do Obsidian.
- **🔌 Qualquer modelo pelo qual você já paga.** Anthropic, Bedrock, OpenAI, ChatGPT Plan (Codex OAuth), Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-compatible, endpoint customizado — mais de dezesseis provedores, nenhum deles precisa ter um endpoint de embeddings.

---

## 🎯 É para mim?

**✅ Sim, se você:**

- **Quer uma configuração de 5 minutos, não um projeto de 5 horas.** Instale dos Community Plugins → escolha um provedor → Ingerir uma nota. Sem CLI, sem Python, sem runtime separado, sem BD vetorial. Você vê páginas wiki em `wiki/` em segundos.
- **Quer algo limpo e autocontido.** O plugin tem exatamente zero dependências externas: sem modelo de embedding, sem banco de dados vetorial, sem pacote pip, sem contêiner Docker. É um único plugin Obsidian que lê suas notas, conversa com um LLM e escreve páginas wiki no seu vault. Tudo vive dentro do Obsidian.
- **Quer um chat pesquisável que responde a partir das *suas* notas** — não da internet — com cada resposta carregando `[[wiki-links]]` de volta para o seu grafo de conhecimento.
- **Se importa com a soberania dos dados** — funciona totalmente local com Ollama ou LM Studio, sem nunca tocar a internet.
- **Escreve ou lê em qualquer um dos 11 idiomas suportados** — o idioma da UI e da saída wiki são independentes (sua wiki pode estar em chinês enquanto a interface está em inglês).
- **Mantém o grafo escrevendo `[[wiki-links]]`** — cada link que você escreve já enriquece a recuperação; sem etapa separada de marcação/embedding/indexação.
- **Quer manutenção com um clique** — Lint health scan + Smart Fix All mantêm duplicados, links mortos e páginas órfãs sob controle sem que você precise cuidar manualmente.

**❌ Não, se você:**

- **Quer um substituto genérico do ChatGPT** — as respostas vêm apenas do seu vault, não da internet.
- **Precisa de RAG sobre grandes corpora externos** (Confluence, Notion, arXiv, páginas web extraídas) — o plugin ingere o seu vault mais ficheiros PDF/Office independentes; RAG em massa sobre corpora externos está fora do escopo por design.
- **Quer um SaaS hospedado com colaboração em equipa** — não há backend, nem servidor, nem estado partilhado; tudo corre localmente dentro do seu Obsidian.

---

## 🚀 Início rápido

1. **Instalar.** Obsidian → Configurações → Plugins da comunidade → Procurar → pesquise "Karpathy LLM Wiki" → Instalar → Ativar. Ou visite a [página do plugin comunitário](https://community.obsidian.md/plugins/karpathywiki) e clique em **Add to Obsidian**.
2. **Configurar um provedor.** Abra Configurações → Karpathy LLM Wiki → escolha um provedor (OpenAI, Anthropic, Ollama, ChatGPT Plan (Codex OAuth), etc.) → insira a chave API (não necessária para locais) → clique em **Test Connection** → Salvar.
3. **Ingerir uma nota.** Duas formas:
   - **⌨️ Teclado:** `Cmd+P/Ctrl+P` → "Ingest single source" → escolha qualquer arquivo Markdown (ou **PDF, v1.25.0+**).
   - **🖱️ Ícone da barra de ferramentas:** Clique no **ícone de adesivo** na faixa esquerda do Obsidian para ingerir instantaneamente a nota aberta no momento — sem procurar nos menus.
   
   Suas primeiras páginas wiki aparecem em `wiki/sources/`, `wiki/entities/`, `wiki/concepts/` em segundos.
4. **Consultar sua wiki.** Duas formas:
   - **⌨️ Teclado:** `Cmd+P/Ctrl+P` → "Query wiki".
   - **🖱️ Ícone da barra de ferramentas:** Clique no **ícone de balão de mensagem** na faixa esquerda do Obsidian.
   
   Abre-se um painel lateral direito estilo Copilot onde você pode conversar com sua wiki. As respostas carregam `[[wiki-links]]` de volta para o seu grafo de conhecimento.

![Painel de Consulta ancorado à direita no Obsidian, com interface de chat cujas respostas trazem wiki-links de volta ao seu grafo de conhecimento](/docs/assets/query-side-panel.png)

É isso. O plugin não modifica nada nas suas notas originais — apenas cria novas páginas em `wiki/`. Tanto **Ingest** quanto **Query wiki** estão fixados à faixa esquerda para acesso com um clique a qualquer momento. (`Cmd` no macOS, `Ctrl` no Windows/Linux.)

### Comandos principais

| Comando | O que faz |
|---------|-----------|
| **📥 Ingerir fonte individual** | `Cmd+P/Ctrl+P` → "Ingest single source" — escolha um arquivo Markdown ou **PDF (v1.25.0+)**, obtenha páginas de entidade/conceito/wiki. *Ou: 🖱️ clique no ícone de adesivo da faixa esquerda sobre a nota ativa.* |
| **📂 Ingerir de pasta** | `Cmd+P/Ctrl+P` → "Ingest from folder" — ingerir em lote todas as notas de uma pasta, com smart batch skip |
| **📑 Ingerir múltiplos arquivos** | `Cmd+P/Ctrl+P` → "Ingest multiple files" — escolha um subconjunto via árvore de dois painéis (com fila ao vivo + cancelamento por arquivo) |
| **🔍 Consultar Wiki** | `Cmd+P/Ctrl+P` → "Query wiki" — converse com sua wiki num painel lateral direito; respostas carregam `[[wiki-links]]`. *Ou: 🖱️ clique no ícone de balão de mensagem da faixa esquerda.* |
| **🛠️ Verificar Wiki** | `Cmd+P/Ctrl+P` → "Lint wiki" — verificação completa de saúde: duplicados, links mortos, páginas vazias, órfãos, aliases ausentes, contradições |
| **⚡ Smart Fix All** | dentro do Modal Lint — reparo em ordem causal com relatório por fase, num clique |
| **📋 Regenerar índice** | `Cmd+P/Ctrl+P` → "Regenerate index" — reconstrói `wiki/index.md` com páginas e aliases atuais |
| **⏹ Cancelar** | `Cmd+P/Ctrl+P` → "Cancel current ingestion" ou clique na barra de status — para com segurança no próximo limite de lote |
| **📊 Histórico de ingestão** | `Cmd+P/Ctrl+P` → "View Ingestion History" — UI pesquisável para ingestões passadas, relatórios Lint e execuções de manutenção |

![Command panel — all LLM Wiki commands live in Obsidian's command palette](/docs/assets/command-panel.png)
| Antes | Depois |
|-------|--------|
| `notes/machine-learning.md` (um arquivo simples) | `wiki/concepts/supervised-learning.md` com `[[bidirectional links]]`, aliases, atribuição de fonte e uma entrada em `wiki/index.md` |

> 📖 Tutoriais em [GitHub Discussions → Guides](https://github.com/green-dalii/obsidian-llm-wiki/discussions/categories/guides). Achou útil? [Dê uma estrela no repo](https://github.com/green-dalii/obsidian-llm-wiki) para acompanhar as releases.

---

## ✨ Funcionalidades

### 📚 Qualidade do Conhecimento

- **🔍 Extração de Entidade e Conceito** — O LLM extrai entidades (pessoas, organizações, produtos, eventos) e conceitos (teorias, métodos, termos) em páginas independentes. A granularidade é configurável (Mínima → Fina, além de Personalizada) para que você equilibre custo versus profundidade.
- **🏷️ Aliases Obrigatórios** — Cada página gerada inclui pelo menos um alias (tradução, abreviatura, variante) para que a deteção de duplicados entre idiomas funcione.
- **🔄 Deteção de Duplicados por Camadas** — Camada 1 (correspondência direta de nome: entre idiomas, abreviatura, títulos de alta similaridade) sempre verificada; Camada 2 (links compartilhados, similaridade média) preenche o orçamento de tokens restante.
- **🧩 Fusão Inteligente e Estado de Contradição** — Duplicados são mesclados preservando aliases; contradições são sinalizadas com atribuição de fonte; páginas `reviewed: true` são protegidas contra sobrescrita.
- **🎨 Vocabulário de Tags Personalizável** — Defina suas próprias listas de tags de tipo de entidade e conceito em Configurações → Wiki → Vocabulário de Tags → *Personalizado*. O vocabulário é uma dica de injeção de esquema para a LLM, não uma barreira de escrita — modelos pequenos/locais ainda podem derivar (cerca de um em dez devolve a taxonomia interna do modelo). Lint sinaliza o restante. Âncora de design para aplicação do esquema: [Issue #328](https://github.com/green-dalii/obsidian-llm-wiki/issues/328).

### 📄 Ingestão de Documentos / PDF / Imagens

Cinco caminhos, alternáveis por ingestão:

1. **🆕 Backend MinerU integrado (v1.27.0, #404)** — Configurações → Configuração Wiki → Backend de Conversão Markdown → *MinerU*. PDF + imagens (PNG/JPG/JPEG/JP2/WebP/GIF/BMP) + Office (DOC/DOCX/PPT/PPTX/XLS/XLSX) via [parser Precise do MinerU](https://mineru.net/apiManage/docs). Token em Obsidian SecretStorage. Melhor caminho para artigos científicos, documentos digitalizados e arquivos Office onde a preservação do layout importa. Limites do servidor: 200 MB / 200 páginas por PDF, 256 MB / 10 000 arquivos por arquivo.
2. **☁️ Provedores cloud com PDF nativo** — Anthropic, OpenAI, Google Gemini e AWS Bedrock (variantes Anthropic + OpenAI) leem PDFs como file parts imediatamente. Sem configuração além de selecionar o provedor.
3. **🖥️ OCR local no Apple Silicon** — [oMLX](https://github.com/jundot/omlx) integra o Microsoft Markitdown como backend PDF→Markdown integrado. Ative o Markitdown no oMLX, carregue o [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) (3B / 570M ativos, código aberto em 2026-06) como modelo de visão, aponte o plugin para o oMLX como provedor Custom OpenAI-Compatible, ative **Force PDF Support** e escolha o modelo multimodal que o oMLX está servindo. O PDF nunca sai da sua máquina.
4. **🛠️ Extrator de terceiros (UI online MinerU)** — use o [serviço online MinerU Extractor](https://mineru.net/OpenSourceTools/Extractor) para uma UI manual rápida quando não quiser configurar um token de API. Transfira o `.md` convertido, coloque-o no seu vault fora da pasta wiki e ingira como uma nota Markdown regular.
5. **🔌 Force PDF Support** — para qualquer outro endpoint OpenAI/Anthropic-compatible que aceite file parts, o plugin tenta a chamada (Configurações → Configuração LLM → Avançado). O endpoint decide; falhas surgem como Notice localizada.

**Observação sobre formatos Office:** o Obsidian não renderiza `.docx` / `.xlsx` / `.pptx` nativamente ([file-formats](https://obsidian.md/help/file-formats)), então o fluxo prático para arquivos Office é: o MinerU converte para `.md`, o plugin ingere esse `.md` em páginas wiki e o arquivo Office original fica para referência. Para pré-visualizar Office inline, use um plugin da comunidade como Pandoc Plugin / Docxer / Md Importer / Office Reader.

**Infraestrutura comum a todos os caminhos:**

- **🗄️ Cache com Limites** — `.obsidian/plugins/karpathywiki/pdf-cache/` armazena Markdown convertido, indexado por hash de conteúdo + modelo + versão do conversor; limites de 100 MB total / 1000 entradas / 10 MB por entrada individual com evicção LRU por mtime.
- **📝 Sidecar Opcional no Vault** — Configurações → Configuração Wiki → Pasta Wiki → *Write PDF Markdown to Vault* escreve `<basename>.pdf.md` ao lado do PDF fonte (desligado por padrão — apenas cache é o padrão).
- **🛡️ Prompt de Transcrição Literal** — conversão estilo OCR com marcadores `[illegible]` / `[figure: ...]` anti-alucinação; o encapsulamento em fences markdown de modelos locais pequenos é limpo automaticamente antes da escrita no cache.
- **🔁 Citações verbatim na página de origem (v1.27.0, #496)** — cada página gerada `sources/<slug>.md` agora traz uma seção `Menções na Fonte` construída a partir das mesmas citações verbatim que a extração capturou por entidade/conceito (a prosa que o modelo provou que consegue ver); assim, o documento de origem é a única página wiki com um rastro real e fundamentado até o texto fonte.

📖 **Tutoriais de configuração completos** para todos os caminhos (provedores cloud, tiers de hardware oMLX, instalação do MinerU, manutenção do cache) → [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 Consulta e Manutenção

- **🧭 Cascata PPR de 5 Estágios** — veja [Como funciona a recuperação](#-como-funciona-a-recuperação). Personalized PageRank sobre o grafo `[[wiki-link]]` fornece contexto multi-hop consciente do grafo.
- **🪟 Painel Lateral Acoplado à Direita** — Query Wiki abre numa leaf lateral direita estilo Copilot (v1.22.1+) em vez de um modal centralizado.
- **🔍 Lint Health Scan** — Um comando captura: duplicados, links mortos, páginas vazias, órfãos, aliases ausentes, contradições.
- **⚡ Smart Fix All** — Reparo em ordem causal com um clique: preencher aliases → mesclar duplicados → corrigir links mortos → vincular órfãos → expandir páginas vazias, com relatório por fase.
- **🆕 Resultado «deixar como está» em Fix Dead Links (v1.27.0, #485)** — Configurações → Avançado → *Criar Stubs para Links Não-Resolvíveis* (ATIVADO por padrão) permite dispensar páginas-placeholder vazias: quando desligado, o link morto permanece visível em todo relatório de Lint até que uma fonte real o defina, e a ingestão cria páginas pelos canais normais. A barreira «nunca expandir via LLM» de #197 permanece intacta — o novo controle rege apenas se a página stub é *escrita de fato*.
- **📊 Painel de Histórico de Operações** — UI pesquisável e filtrável para ingestões passadas, relatórios Lint e execuções de manutenção.
- **🛡️ Porta de Pré-Ingestão** — Notas vazias / somente espaços em branco / somente frontmatter são rejeitadas antes de qualquer chamada LLM; a deduplicação por hash de conteúdo captura arquivos idênticos entre caminhos.
- **🆕 Porta de candidatos de ingestão (v1.27.0, #514 / PR #521)** — toggle opcional (`skipMentionOnlyCandidates`, desligado por padrão, Configurações → Avançado). Para fontes cujo idioma tem perfil medido (de medido; en/fr/es/pt/nl/ko estimado com casos de fronteira fixados; zh/ja com limiares de script de caracteres não medidos), candidatos nomeados apenas entre parênteses / enumerações / itens curtos de lista são podados antes de custarem uma página mais dedup e chamadas de geração. Notas multilíngues não passam pela porta; idiomas de wiki sem perfil reportam uma vez por ingestão e nunca pulam silenciosamente.
- **🆕 Políticas de tarefa por etapa (v1.27.0, #525 / #490)** — LLM Avançado → campo Task Policies; substitua a definição por etapa de modo-texto/thinking sem mudanças de código. O baseline embutido fica intocado para etapas que você não lista.

### 🔒 Privacidade

- **🚫 Sem backend, sem rastreio, sem análise.** Executa inteiramente dentro do Obsidian. A rede é usada apenas para comunicar com o provedor LLM que você configurar.
- **📁 Arquivos de origem são somente leitura.** O plugin nunca modifica suas notas originais do vault — apenas cria novas páginas em `wiki/`.
- **🦙 Modo local completo.** Ollama, LM Studio ou qualquer endpoint compatível com OpenAI local → suas notas nunca saem da sua máquina.
- **🔐 Permissões mínimas.** Acesso aos arquivos do vault para gestão da wiki. Acesso à área de transferência apenas quando você clica no botão "Copiar" no modal de Consulta.

### 🦙 Local-Primeiro

- **🖥️ Ollama, LM Studio, OpenRouter, endpoint customizado** — funcionam imediatamente. Modelos locais funcionam para consulta (janelas de contexto menores); a ingestão de um vault de 2000 páginas geralmente precisa de um modelo cloud de contexto longo.
- **📄 O caminho OCR PDF é totalmente local no Apple Silicon** — veja [Ingestão de Documentos / PDF / Imagens](#-ingestão-de-documentos--pdf--imagens) acima.
- **🔐 ChatGPT Plan (Codex OAuth)** — loopback desktop ou código de dispositivo mobile; as credenciais vivem apenas no Obsidian SecretStorage. (Veja [Anthropic vs OpenAI vs Codex OAuth](#-anthropic-vs-openai-vs-codex-oauth--são-provedores-distintos) abaixo para a explicação completa dos limites entre provedores.)

### 🌐 Idioma

- **🌍 11 idiomas de interface** — Inglês, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano, Русский. O idioma da UI e da saída wiki são independentes — sua wiki pode estar em chinês enquanto a interface está em inglês.
- **📚 11 idiomas de saída wiki** — o mesmo conjunto; escolha em Configurações → Configuração Wiki. Opção *Custom input* para prompts ad-hoc.
- **Todas as strings de UI traduzidas por locale** — cada rótulo, modal e aviso. Adicionar um 12º idioma é orientado por contribuidores (padrão PR #159).

---

## 🌐 Ecossistema

O plugin compõe-se com o restante do seu stack Obsidian — cada ferramenta abaixo conecta-se ao grafo `[[wiki-link]]` sem alterações de código.

- **📄 [Backend multi-formato MinerU](https://mineru.net/apiManage/docs) (integrado desde v1.27.0)** — o que antes era um passo CLI/UI separado agora é uma opção do plugin; veja [Ingestão de Documentos / PDF / Imagens](#-ingestão-de-documentos--pdf--imagens) para a tabela completa de caminhos. O [serviço online MinerU](https://mineru.net/OpenSourceTools/Extractor) continua disponível para utilizadores que preferem uma UI rápida em vez de um token API; [auto-hospedar MinerU](https://github.com/opendatalab/mineru) também é uma opção.
- **🕸️ Obsidian Graph View** — abra a vista de grafo nativa em qualquer página wiki; cada `[[wiki-link]]` torna-se um nó, cada backlink uma aresta. Integrado, zero tamanho extra no bundle.
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** — extensão oficial do navegador. Guarde páginas web (artigos, publicações de blog, tópicos do Reddit, Hacker News, receitas, artigos de pesquisa, transcrições do YouTube via Interpreter) em qualquer pasta do seu vault e, em seguida, execute o comando «Ingerir da pasta» do plugin para extrair entidades e conceitos em lote.
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** — consulte o wiki como uma base de dados com DQL (`LIST FROM "wiki/entities" WHERE contains(tags, "person")`) ou a API JS. O plugin escreve frontmatter padrão (`tags:`, `type:`, `aliases:`) em cada página, por isso as consultas Dataview funcionam sem configuração adicional.
- **🌿 Git** — versione o seu vault (com qualquer cliente Git). O plugin nunca reescreve os seus ficheiros fonte; apenas cria novas páginas sob `wiki/`, por isso `git diff` separa claramente as suas edições do conteúdo gerado pelo LLM.
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** — converta qualquer nota do Obsidian em conjuntos de slides através do frontmatter Marp (`marp: true`). As páginas wiki são Markdown puro, são renderizadas como slides sem conversão adicional.
- **🖼️ Canvas** — tela infinita nativa do Obsidian. Coloque cartões wiki num canvas para montar guias de estudo, mapas mentais ou sínteses de investigação a partir de `[[wiki-links]]` sem sair do vault.
- **🎤 [Obsidian Nous](https://github.com/AndyMDH/obsidian-nous)** — plugin companheiro para captura local de notas de voz e reuniões (whisper.cpp no macOS; o áudio nunca sai da máquina). Gera transcrições com etiqueta de orador e as suas próprias páginas wiki hub. Independente deste plugin — ambos podem partilhar o mesmo vault sem acoplamento.

## 🧰 CLI headless

**A maioria dos utilizadores deve ignorar esta secção.** A CLI voltada para o utilizador do plugin vive no repositório irmão [green-dalii/obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli) — instale com `npm i -g karpathywiki-cli` e execute `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`.

O que vem neste repositório em `tools/dev-instrument/` é o **instrumento de medição headless só-dev** para contribuidores do motor — executa o verdadeiro `WikiEngine.ingestSource` contra um cofre em disco sem runtime Obsidian, imprime a contabilidade de tokens e wall-clock por tarefa — os mesmos números que conduzem a evidência de desempenho em `CLAUDE.md` e nas notas de versão. Veja [`tools/dev-instrument/README.md`](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/tools/dev-instrument/README.md) para o comando de entrada, variáveis de ambiente, modos de medição e especificação do código de saída.

## 🔍 Como funciona a recuperação

A maioria dos plugins de "busca IA" fragmenta suas notas em chunks e os incorpora num BD vetorial. Nós não fazemos isso. O [argumento de Karpathy contra RAG](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) é que a fragmentação quebra a capacidade do LLM de raciocinar através de todo o seu grafo de conhecimento — e esse argumento se sustenta na prática. Em vez disso, percorremos o grafo que você já mantém escrevendo `[[wiki-links]]`.

### A cascata de seleção de sementes de 5 estágios

Quando você pergunta "Quem fundou a Microsoft?", o Query Wiki executa cinco estágios antes de qualquer geração de resposta:

1. **Caminho rápido Lex** — sobreposição direta de tokens contra cada título de entidade/conceito e aliases. Grátis, instantâneo e a etapa de bloqueio para tudo que se segue.
2. **Geração de keywords pelo LLM** — o LLM propõe 8–12 keywords inter-idiomas a partir da sua consulta (lida com sinônimos, abreviações e termos resistentes à sobreposição de tokens numa única chamada LLM).
3. **Varredura local de substring** — cada keyword gerada é re-correspondida localmente contra títulos de página, aliases e trechos de corpo. Sem chamada LLM extra; completa o recall tolerante a ruído.
4. **Fallback KB do LLM** — quando lex + varredura de keywords retornam sinais fracos, o LLM re-semeia os top-N candidatos contra a wiki inteira para uma passagem semântica.
5. **Expansão de grafo PPR** — Personalized PageRank (Haveliwala 2002) sobre o grafo `[[wiki-link]]` a partir do conjunto de sementes candidatas. É isso que dá contexto multi-hop consciente do grafo: "Bill Gates" → "Microsoft" → "concorrentes", não apenas sobreposição literal de títulos.

A cascata trunca na etapa que retornou sinal suficiente — sem custo fixo de 5 etapas; sem chamadas LLM quando lex é suficiente; fallback semântico apenas quando lex + varredura de keywords por si só não bastam.

### Personalized PageRank em escala

Usamos Monte Carlo PPR (Fogaras 2005) — 3.000 caminhadas aleatórias × 50 passos cada — com a regra de beco sem saída de Haveliwala 2002. O custo é **O(K × L)** (K = caminhadas, L = passos por caminhada), independente do número de páginas, então um vault de 2.000 páginas vê a mesma latência de expansão que um de 200 páginas.

**PPR @5 = 27,1% vs baseline pure-kNN 24,1%** no corpus de benchmark interno do projeto (o único benchmark de recuperação publicado neste espaço de LLM-Wiki open-source).

### Por que nenhum embedding

Rejeitamos deliberadamente o caminho de embedding na [Issue #175](https://github.com/green-dalii/obsidian-llm-wiki/issues/175). O sinal do grafo já está lá — cada `[[wiki-link]]` é uma aresta "estes estão relacionados" curada manualmente, e a maioria dos provedores que suportamos (Ollama, LM Studio, Anthropic, Bedrock, Kimi, GLM, MiniMax) não têm endpoint `/v1/embeddings`. Adicionar um modelo de embedding significaria download por página, um adaptador por provedor e zero benefício na qualidade da recuperação.

---

## 🤖 Modelos

**Provedores suportados (16+, verificados no models.dev em 2026-07):**

| Provedor | Série | Notas |
|----------|-------|-------|
| **Anthropic** | Claude 5 series | PDF nativo; protocolo `/v1/messages` |
| **OpenAI** | GPT-5.6 series (Sol / Terra / Luna) | PDF nativo; chave API Platform |
| **Google Gemini** | Gemini 3.6 series | PDF nativo (file parts desde 1.5); endpoint compatível com OpenAI |
| **DeepSeek** | DeepSeek V4 series | Compatível com OpenAI; tier de menor custo |
| **Alibaba Qwen** | Qwen3.7/3.8 series | Compatível com OpenAI (DashScope) |
| **xAI Grok** | Grok 4 series | Compatível com OpenAI; contexto longo |
| **Moonshot Kimi** | Kimi K3 series | Compatível com OpenAI; MoE 2.8T de fronteira |
| **Zhipu GLM** | GLM-5 series | Compatível com OpenAI; forte bilíngue |
| **MiniMax** | MiniMax M3 series | Compatível com OpenAI; 1M de contexto |
| **Step (阶跃星辰)** | Step 3 series (Flash) | Compatível com OpenAI; inferência rápida |
| **Tencent Hunyuan** | Hy3 series | Compatível com OpenAI; MoE de pesos abertos |
| **Xiaomi MiMo** | MiMo V2.5 series | Open-source MIT; preço fixo |
| **Google Gemma** | Gemma 4 series | Pesos abertos; 262K de contexto |
| **AWS Bedrock** | Variantes Anthropic + OpenAI | Caminho VPC / conformidade; **API key + SSO + IAM** (v1.27.0, #425) |
| **ChatGPT Plan (Codex OAuth)** | Codex Responses API | Login por navegador/código de dispositivo; SecretStorage |
| **Local: Ollama, LM Studio, OpenRouter, Anthropic-Compatible** | Qualquer modelo de protocolo OpenAI-/Anthropic | Custom OpenAI-Compatible + Anthropic-Compatible (Token Plan / Coding Plan) |

Este plugin alimenta o LLM com o contexto completo da sua Wiki por consulta — então **modelos de contexto longo vencem**. A tabela completa por níveis (cloud + local) está em [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md), verificada no [models.dev](https://models.dev/) para que as escolhas se mantenham atuais.

### O que importa

- **🧠 Janela de contexto ≥ 200K tokens** para vaults com mais de ~500 páginas. Abaixo de 200K, a cascata pode descartar etapas anteriores para caber.
- **⚖️ Qualidade de seguimento de instruções** importa mais que QI bruto para a tarefa de extração — escolha um modelo que siga o template de esquema, não o maior número no leaderboard.
- **🔌 Endpoint de embedding é irrelevante** — não usamos embeddings. Um provedor sem `/v1/embeddings` é perfeitamente aceitável (a maioria dos nossos 16+ provedores não fornece um).
- **🦙 Local funciona para consulta, cloud para ingestão** — a ingestão num vault de 2000 páginas geralmente precisa de um modelo cloud de contexto longo; um modelo local de 262K cobre a maioria das consultas.

Para ingestão de PDF / imagens / Office, veja [Ingestão de Documentos / PDF / Imagens](#-ingestão-de-documentos--pdf--imagens) em Funcionalidades — Anthropic, OpenAI, Bedrock e Gemini leem PDFs como file parts nativamente; o backend MinerU integrado (v1.27.0+) e **Force PDF Support** cobrem tudo o mais.

### Anthropic vs OpenAI vs Codex OAuth — são provedores distintos

- **Anthropic** (e sua variante Bedrock) — chave API Anthropic Platform com faturamento separado.
- **OpenAI** — chave API OpenAI Platform com faturamento separado.
- **ChatGPT Plan (Codex OAuth)** — experimental, provedor distinto que usa franquia Codex elegível após login por navegador ou código de dispositivo; a disponibilidade segue as políticas de autenticação e franquia da OpenAI Codex, não o nome do plano. Compatibilidade de terceiros com Codex, não uma parceria com a OpenAI ou uma API geral do ChatGPT.

### AWS Bedrock — três modos de autenticação (v1.27.0, #425)

Configurações → Provedor → Bedrock (Anthropic / OpenAI) agora escolhe um dos três modos de autenticação; a linha do provedor então pede apenas as entradas que aquele modo de fato precisa:

- **API key** — o caminho bearer original do Estágio 1; o comportamento é byte a byte idêntico ao da v1.26.4 e é a escolha recomendada para quem já paga por uma chave API do Bedrock.
- **SSO** — fluxo de dispositivo do IAM Identity Center. Clique em *Sign in with AWS SSO*, cole o código da URL de verificação no navegador; o plugin recebe um token SSO via `karpathywiki-bedrock-sso` no SecretStorage, troca-o por credenciais temporárias de role e assina cada requisição com SigV4 feito à mão (nenhum AWS SDK adicionado). O ID da conta e o nome da role são autodetectados quando a identidade SSO expõe exatamente um de cada; caso contrário, informe-os nas configurações do provedor.
- **IAM** — chaves de acesso estáticas para ambientes sem SSO (CI, jobs agendados em lote). Armazenadas em `karpathywiki-bedrock-iam` no SecretStorage; o cache em memória memoiza por access-key para manter a assinatura SigV4 dentro da validade.

Os três modos compartilham a mesma disciplina do Obsidian SecretStorage (nenhuma credencial em `data.json`, logs ou docs) e o mesmo caminho SigV4 + OIDC feito à mão, sem AWS SDK. A região do Bedrock é independente do modo de autenticação e é configurada na mesma linha do provedor.

> 📖 **Tabela de escolha completa** (cloud + local + PDF OCR + Codex OAuth + quantização + tiers de hardware) → [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

## ❓ FAQ

### O que o plugin realmente faz?

Escolha qualquer nota, pasta ou seleção; o LLM extrai entidades e conceitos e gera uma wiki interligada com `[[bidirectional links]]`. Faça perguntas e obtenha respostas conversacionais baseadas nas *suas* notas, não na internet. Suas notas originais do vault nunca são modificadas.

### Como começo?

Instale dos Community Plugins do Obsidian → escolha um provedor → **Test Connection** → execute **Ingest single source** em qualquer nota. Primeiras páginas wiki aparecem em segundos. Veja [Início rápido](#-início-rápido).

### Posso ingerir PDFs, imagens e documentos Office?

✅ Sim. Anthropic, OpenAI, Bedrock e Gemini leem PDFs imediatamente; o backend multi-formato MinerU integrado (v1.27.0) cobre tudo o mais (PDF + imagens + Office). Tutorial completo — provedores cloud, OCR no Apple Silicon, Force PDF Support, manutenção de cache — em [docs/PDF-OCR-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md).

### Minha wiki existente está segura?

✅ Retrocompatível desde a v1.0.0. Defina `reviewed: true` em qualquer página para protegê-la contra sobrescrita. Atualizar da v1.24.x não reescreve seu vault; a ingestão de PDF da v1.25.0 é apenas cache por padrão, e a v1.27.0 adiciona ingestão nativa de PDF + imagens + Office sem alterar o layout da wiki em disco.

### Meus dados são enviados para algum lugar?

🚫 Sem backend, sem análise — o plugin executa inteiramente dentro do Obsidian. Apenas o texto que você envia explicitamente para ingestão/consulta sai do seu dispositivo, e apenas para o provedor LLM que você configurar. Para localidade completa dos dados, use Ollama ou LM Studio.

### Posso usar o plugin no meu idioma?

🌍 11 idiomas tanto para a interface quanto para a saída wiki. O idioma da UI e da wiki são independentes. Adicionar um 12º idioma é orientado por contribuidores (padrão PR #159).

### Como isso é diferente de um chatbot RAG?

🚫 Sem fragmentação. 🚫 Sem embeddings. 🚫 Sem BD vetorial. ✅ Personalized PageRank sobre o seu grafo `[[wiki-link]]` existente — contexto multi-hop consciente do grafo, custo zero de embedding, suporte total a modelos locais.

### Qual LLM devo usar?

Modelos de contexto longo (≥200K tokens) funcionam melhor. A [seção Modelos](#-modelos) cobre os princípios; a tabela completa por níveis está em [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md).

### Existe um benchmark publicado?

Sim — PPR @5 = 27,1% vs baseline pure-kNN 24,1% no corpus do próprio projeto. O pipeline completo e o script de benchmark estão descritos em [Como funciona a recuperação](#-como-funciona-a-recuperação).

### Como controlo os custos de API?

Use granularidade Grossa ou Mínima para ingestão em lote. Smart Batch Skip deteta automaticamente arquivos já ingeridos. A Manutenção Automática está DESLIGADA por padrão. O Lint mostra contagens antes de executar correções — nada é cobrado sem sua aprovação.

### Como cancelo uma operação em execução?

Clique na barra de status (mostra "Ingerindo… clique para cancelar") ou `Cmd+P/Ctrl+P` → "Cancel current ingestion". Para com segurança no próximo limite de lote.

### Onde obtenho ajuda?

[GitHub Issues](https://github.com/green-dalii/obsidian-llm-wiki/issues) para relatar bugs · [GitHub Discussions](https://github.com/green-dalii/obsidian-llm-wiki/discussions) para perguntas e pedidos de funcionalidades · Console do Desenvolvedor (`Ctrl+Shift+I` / `Cmd+Option+I`) para logs do plugin.

---

## 🔒 Privacidade

Este plugin está listado no Mercado de Plugins Comunitários do Obsidian e passa por revisão automatizada de segurança e permissões.

- **🚫 Sem backend, sem servidor, sem coleta de dados.** Software puramente local executado dentro do Obsidian. O plugin não pode e não coleta, armazena ou transmite seus dados para nenhum servidor — porque tal servidor não existe.
- **🔐 Acesso à rede é opcional.** Usado apenas para comunicar com o provedor LLM que você configurar. Você escolhe o provedor, você insere a chave API, você decide para onde seus dados vão.
- **📁 Acesso aos arquivos do vault** é usado para gestão da wiki (ler notas, gerar páginas, verificar links mortos, detetar duplicados). O plugin nunca modifica seus arquivos de origem.
- **📋 Acesso à área de transferência** é usado exclusivamente pelo botão "Copiar" no modal de Consulta — e apenas quando você clica nele.

Para localidade completa dos dados, use Ollama ou LM Studio. Com um provedor local, seus dados nunca saem da sua máquina.

---

## 💖 Apoiar o projeto

Se o LLM-Wiki se tornou uma parte significativa do seu fluxo de trabalho de conhecimento:

- ☕ **[Pague-me um café no Ko-fi](https://ko-fi.com/greenerdalii)** — apoio pontual ou mensal
- 💳 **[Gorjeta via PayPal](https://paypal.me/greenerdalii)** — gorjeta pontual

Obrigado aos seguintes por apoiarem o projeto:

[@jameses-cyber](https://github.com/jameses-cyber), [@issaqua](https://github.com/issaqua), Dikson Choi

---

## 🔭 Outros projetos

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — a CLI de ingestão headless, repositório irmão publicado como o pacote npm `karpathywiki-cli`. Executa o mesmo `WikiEngine` contra um cofre em disco, sem renderizador. Instale com `npm i -g karpathywiki-cli`. O `tools/dev-instrument/` na árvore é o instrumento de medição só-dev que gera os números de custo por tarefa nas notas de versão deste plugin.
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — um roteador em nível de tarefa para o [pi-coding-agent](https://github.com/earendil-works/pi). Antes de cada turno, um juiz LLM pequeno classifica a sua mensagem como rotineira ou importante, e o nível escolhido conduz o turno inteiro. Em tarefas complexas ele vai além: o nível Smart atua como um CTO que planeja o trabalho, delega a implementação a subagentes Fast, revisa cada resultado e itera. Subir de nível é imediato; descer espera uma tendência consistente, e as cadeias de fallback por nível absorvem 429 e 5xx. Zero dependências em tempo de execução, MIT. → [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — fork DSH do pi-shift-router, partilhando o mesmo design de roteamento em nível de tarefa mas direcionado para o runtime [dsh-coding-agent](https://github.com/earendil-works/dsh). Mesmas escolhas de nível dirigidas por juiz, mesmas cadeias de fallback por nível, MIT.
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — equivalente DSH do fluxo de trabalho `obsidian-plugin-dev` (lado Claude): arma um espaço de trabalho de plugin Obsidian, conduz o loop TDD Red→Green, executa o fecho de qualidade Six-Gate (lint/tsc/test/build/css-lint) e prepara um ramo pronto para release em `feat/*` ou `fix/*`. Construído para que contribuidores que usam DSH obtenham a mesma experiência de scaffolding + gate sem copiar e colar de CLAUDE.md.

---

## 📜 Licença & Créditos

Licença Apache, Versão 2.0 — veja [LICENSE](../LICENSE) e [NOTICE](../NOTICE).

**Construído sobre:**
- 💡 [LLM Wiki de Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — o conceito original
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v6](https://ai-sdk.dev/) (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) via Obsidian `requestUrl`
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) e [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — algoritmos de recuperação

**Mantenedor:** [@green-dalii](https://github.com/green-dalii)


[![Star History Chart](https://api.star-history.com/chart?repos=green-dalii/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
