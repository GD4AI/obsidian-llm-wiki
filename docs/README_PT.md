<!--
SEO metadata (not user-visible, parsed by crawlers / LLMs):
- name: karpathy-llm-wiki-plugin-for-obsidian
- type: software / Obsidian community plugin / knowledge-base generator / RAG alternative
- license: Apache-2.0
- language: TypeScript
- runtime: Obsidian >= 1.11.4 (desktop + mobile)
- dependencies: sem dependências em tempo de execução (Vercel AI SDK v7 incluído)
- obsidian-plugin-id: karpathywiki
- obsidian-marketplace: https://community.obsidian.md/plugins/karpathywiki
- repo: https://github.com/GD4AI/obsidian-llm-wiki
- sister-cli-repo: https://github.com/green-dalii/obsidian-llm-wiki-cli
- docs: README.md + docs/README_<locale>.md (11 locales) + docs/MODEL-GUIDE.md + docs/PDF-OCR-GUIDE.md
- first-published: 2025-09 (v0.1.0)
- latest: v1.31.0
- release-notes: https://github.com/GD4AI/obsidian-llm-wiki/releases
- previous: v1.30.0 (MINOR — um teto de tokens para o contexto da resposta, Extraction Focus nas configurações e um relatório de hubs cristalizados)
- last-updated: 2026-11-12
- alternate-names: Karpathy LLM Wiki, LLM Wiki Obsidian, Obsidian wiki plugin, graph-based RAG, no-embedding RAG, Personalized PageRank retrieval, Obsidian second brain
- search-intents: "Obsidian RAG without embeddings", "Obsidian wiki plugin", "Personalized PageRank Obsidian", "graph-based note retrieval", "Karpathy LLM Wiki implementation", "Obsidian knowledge base auto-generation", "Obsidian graph view + AI", "Obsidian second brain plugin", "Obsidian note link graph AI", "Obsidian plugin 11 languages", "Obsidian plugin 15 LLM providers", "no-vector-DB RAG", "Obsidian PDF ingest AI", "Obsidian Codex OAuth", "Obsidian Bedrock plugin", "Obsidian Bedrock SSO", "Obsidian MinerU", "Obsidian Word PPT Excel ingest", "Obsidian IAM credentials"
- features: graph-based retrieval, Personalized PageRank (Haveliwala 2002), Monte Carlo PPR (Fogaras 2005), 5-stage seed-selection cascade, Tier 1/Tier 2 duplicate detection, 11-language UI + 11-language wiki output (independent), 15+ LLM providers (Anthropic, OpenAI, Bedrock [API key + SSO/IAM], Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, Codex OAuth), MinerU multi-format ingest (PDF + images + Office), PDF ingest (cache-only, OCR paths), lint health scan, Smart Fix All, source-page verbatim quotes, ingest candidate gate, per-step taskPolicies UI, Obsidian Graph View integration, zero-embedding zero-vector-DB architecture, local-first mode
- direct-competitors: nashsu/llm_wiki (Tauri desktop app), SamurAIGPT/llm-wiki-agent (Claude Code / Codex / OpenCode / Gemini CLI skill), atomicstrata/llm-wiki-compiler (TypeScript CLI, chunk-based retrieval)
- retrieval-benchmark: PPR @5 = 27.1% vs pure-kNN 24.1% (um corpus de um vault do projeto, não um conjunto de benchmark público)
- author: green-dalii / Greener-Dalii (https://github.com/green-dalii)
- co-maintainer: DocTpoint (https://github.com/DocTpoint)
- canonical: https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md
-->

![Banner do plugin Karpathy LLM Wiki — uma rede de páginas wiki interligadas, construída a partir das suas notas do Obsidian](assets/llm_wiki_banner.webp)

# 🧠 Plugin Karpathy LLM Wiki para Obsidian

> Um plugin do Obsidian que transforma as suas notas numa base de conhecimento ligada e consultável — a ideia do [LLM Wiki do Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), construída dentro do editor onde você já escreve.

**Nota máxima na revisão da Obsidian • Recuperação por grafo sem embeddings • 11 idiomas nativos • Ingestão nativa de PDF + imagens + Office • Funciona com qualquer provedor • Local primeiro • Sem backend • Compatível com o RGPD**

![Version](https://img.shields.io/github/v/release/GD4AI/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-15%2B-cyan?style=flat-square) <br>
![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml)

[English](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_CN.md) | [繁體中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_KO.md) | [Deutsch](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_DE.md) | [Français](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_FR.md) | [Español](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ES.md) | **Português** | [Italiano](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_IT.md) | [Русский](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[Site oficial](https://llmwiki.greenerai.top/) | [Mercado Obsidian](https://community.obsidian.md/plugins/karpathywiki) | [Blog](https://llmwiki.greenerai.top/blog/) | [Discussões](https://github.com/GD4AI/obsidian-llm-wiki/discussions)

🤔 [Por que este plugin?](#-por-que-este-plugin) | 🚀 [Início rápido](#-início-rápido) | ✨ [Funcionalidades](#-funcionalidades) | 🌐 [Ecossistema](#-ecossistema) | 🔍 [Como funciona a recuperação](#-como-funciona-a-recuperação) | 🤖 [Modelos](#-modelos) | ❓ [FAQ](#-faq) | 🔒 [Privacidade](#-privacidade)

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD)

> O Karpathy LLM Wiki é gratuito, auto-hospedado e não tem backend próprio. Se ele poupa o seu tempo, um café mantém o projeto vivo — e uma ⭐ ajuda na mesma medida.

---

## 🤔 Por que este plugin?

Você escreve notas. Elas ficam em pastas. Para descobrir o que se relaciona com o quê, precisa de se lembrar de fios que perdeu há meses.

**Existem outras reimplementações de código aberto da ideia do LLM Wiki do Karpathy — mas nenhuma delas é um plugin do Obsidian de um clique.** A maioria são ferramentas de linha de comando, skills do Claude Code ou aplicações de desktop à parte; esta corre dentro do Obsidian — Graph View, faixa lateral e paleta de comandos incluídas.

### Como nos comparamos

|  | **Karpathy LLM Wiki** (este plugin) | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|
| **Entrega** | ✅ Plugin do Obsidian de um clique | 🟡 Aplicação de desktop em Tauri | 🟡 Skill para Claude Code / Codex / OpenCode / Gemini CLI | 🟡 Pipeline em TypeScript na linha de comando |
| **Dependências** | ✅ Nenhuma — só o plugin | 🟡 Runtime Python + sqlite | 🟡 Runtime Claude Code / Codex / OpenCode | ❌ Modelo de embedding + base de dados vetorial (segundo a documentação deles) |
| **i18n (interface + saída da wiki)** | ✅ 11 idiomas | 🟡 EN / 中文 | ❌ Só EN | ❌ Só EN |
| **Provedores LLM** | ✅ 15+ (Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, …) | 🟡 Compatível com OpenAI | 🟡 Assinatura via Claude Code / Codex | 🟡 Compatível com OpenAI |
| **Recuperação e pipeline de consulta** | ✅ **PPR + Monte Carlo** sobre o grafo `[[wiki-link]]` | 🟡 Decaimento de 2 saltos (heurística de 4 sinais) | 🟡 Deteção de comunidades Louvain | 🟡 BM25 + semântica sobre chunks |
| **Visualização do grafo** | ✅ Graph View nativa do Obsidian (integrada, zero de tamanho extra) | 🟡 sigma.js + graphology à medida na aplicação de desktop | 🟡 vis.js em `graph.html` (ficheiro separado) | ❌ Visualizador de navegador só de leitura |
| **Formatos de ingestão** | ✅ **Markdown + PDF + imagens + Office (DOCX/PPTX/XLSX)** — um interruptor alterna entre PDF nativo (Anthropic / OpenAI / Bedrock / Gemini) e o backend multiformato MinerU integrado | 🟡 Markdown + PDF | 🟡 Só Markdown / ficheiros de código | 🟡 Só Markdown |

### Três coisas que escolhemos de propósito, não por acidente

- **🪟 O Obsidian é o runtime.** Sem terminal, sem aplicação à parte, sem Docker, sem Python. Instale a partir dos Plugins da comunidade, clique em Ingerir, e a wiki vive no seu vault desde o primeiro segundo. A Graph View nativa do Obsidian desenha o seu grafo `[[wiki-link]]` — integrada, zero de tamanho extra no bundle.
- **🧭 Limpo e autocontido.** Zero dependências: sem modelo de embedding, sem base de dados vetorial, sem pacote pip. Um único plugin lê as suas notas, fala com um LLM e escreve páginas no seu vault.
- **🔌 Qualquer modelo pelo qual já paga.** Anthropic, Bedrock, OpenAI, ChatGPT Plan (Codex OAuth), Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-compatible, endpoint à medida — mais de quinze provedores, e nenhum deles precisa de ter um endpoint de embeddings.

### Para quem é

- **Você quer uma configuração de 5 minutos.** Instale a partir dos Plugins da comunidade → escolha um provedor → ingira uma nota. As páginas wiki aparecem em `wiki/` em segundos, sem CLI, sem Python e sem base de dados vetorial para levantar primeiro.
- **Você quer respostas a partir das suas próprias notas,** e cada resposta cita as páginas de onde veio. Ollama ou LM Studio mantêm a chamada inteira na sua máquina.
- **Você escreve ou lê em qualquer um dos 11 idiomas.** Interface e saída da wiki são independentes: uma wiki em chinês por trás de uma interface em inglês é uma configuração suportada.
- **Você quer manutenção de um clique.** A verificação de saúde do Lint e o Smart Fix All mantêm duplicados, links quebrados e órfãos sob controlo, sem curadoria à mão.

**Não é para você se** quer um substituto genérico do ChatGPT, RAG sobre corpora externos como Confluence ou arXiv, ou um serviço alojado com colaboração em equipa. As respostas vêm do seu vault, a ingestão cobre o seu vault mais ficheiros isolados, e não há backend para partilhar.

---

## 🚀 Início rápido

**Requisitos:** Obsidian 1.11.4 ou mais recente, no desktop ou no telemóvel. Nada mais — sem Node, sem Python, sem contentor. A sua própria chave de API, ou um modelo local sem chave nenhuma; as credenciais ficam no SecretStorage do Obsidian, e é por isso que a 1.11.4 é o mínimo.

1. **Instalar.** Obsidian → Configurações → Plugins da comunidade → Procurar → pesquise "Karpathy LLM Wiki" → Instalar → Ativar. Ou visite a [página do plugin na comunidade](https://community.obsidian.md/plugins/karpathywiki) e clique em **Add to Obsidian**.
   
   ![O Karpathy LLM Wiki instalado e ativado na lista de plugins da comunidade do Obsidian](assets/readme/readme-02-install.webp)
2. **Configurar um provedor.** Abra Configurações → Karpathy LLM Wiki → escolha um provedor (OpenAI, Anthropic, Ollama, ChatGPT Plan (Codex OAuth), etc.) → introduza a chave de API (não é necessária para modelos locais) → clique em **Testar conexão** → Guardar.
3. **Ingerir uma nota.** Duas formas:
   - **⌨️ Teclado:** `Cmd+P/Ctrl+P` → "Ingerir fonte individual" → escolha qualquer ficheiro Markdown (ou PDF, v1.25.0+).
   - **🖱️ Ícone na faixa lateral:** Clique no **ícone de autocolante** na faixa lateral esquerda do Obsidian para ingerir de imediato a nota que está aberta — sem procurar em menus.
   
   As suas primeiras páginas wiki aparecem em `wiki/sources/`, `wiki/entities/` e `wiki/concepts/` em segundos.
   
   ![A nota à esquerda e, à direita, a página que a ingestão gerou a partir dela — propriedades, descrição e conceitos relacionados](assets/readme/readme-01-before-after.webp)
4. **Consultar a sua wiki.** Duas formas:
   - **⌨️ Teclado:** `Cmd+P/Ctrl+P` → "Consultar Wiki".
   - **🖱️ Ícone na faixa lateral:** Clique no **ícone de balão de mensagem** na faixa lateral esquerda do Obsidian.
   
   Abre-se um painel lateral direito (ao estilo Copilot) onde pode conversar com a sua wiki. As respostas trazem `[[wiki-links]]` de volta para o seu grafo de conhecimento.

![Uma resposta do Consultar Wiki no painel lateral direito, com cada afirmação remetida por nota de rodapé para a página wiki de onde veio](assets/readme/readme-07-query-citations.webp)

É isto. O plugin não altera nada nas suas notas originais — apenas cria páginas novas em `wiki/`. Tanto **Ingerir** como **Consultar Wiki** estão fixados na faixa lateral esquerda, para acesso com um clique a qualquer momento. (`Cmd` no macOS, `Ctrl` no Windows e no Linux.)

### Comandos principais

| Comando | O que faz |
|---------|-----------|
| **📥 Ingerir fonte individual** | `Cmd+P/Ctrl+P` → "Ingerir fonte individual" — escolha um ficheiro Markdown ou **PDF (v1.25.0+)**, e obtém páginas de entidade, conceito e wiki. *Também: 🖱️ ícone de autocolante na faixa lateral, sobre a nota ativa.* |
| **📂 Ingerir de pasta** | `Cmd+P/Ctrl+P` → "Ingerir de pasta" — ingere em lote todas as notas de uma pasta, com salto inteligente de lotes |
| **📑 Ingerir vários ficheiros** | `Cmd+P/Ctrl+P` → "Ingerir vários ficheiros" — escolha um subconjunto numa árvore de dois painéis (com fila em direto e cancelamento por ficheiro) |
| **🔍 Consultar Wiki** | `Cmd+P/Ctrl+P` → "Consultar Wiki" — converse com a sua wiki num painel lateral direito; as respostas trazem `[[wiki-links]]`. *Também: 🖱️ ícone de balão de mensagem na faixa lateral.* |
| **🛠️ Verificar Wiki** | `Cmd+P/Ctrl+P` → "Verificar Wiki" — verificação completa de saúde: duplicados, links quebrados, páginas vazias, órfãs, aliases ausentes, contradições |
| **⚡ Smart Fix All** | dentro do modal do Lint — reparação em ordem causal com um clique, com relatório por fase |
| **📋 Regenerar índice** | `Cmd+P/Ctrl+P` → "Regenerar índice" — reconstrói `wiki/index.md` com as páginas e os aliases atuais |
| **⏹ Cancelar** | `Cmd+P/Ctrl+P` → "Cancelar ingestão atual" ou clique na barra de estado — para de forma limpa no limite do lote seguinte |
| **📊 Histórico de ingestão** | `Cmd+P/Ctrl+P` → "Ver histórico de ingestão" — interface pesquisável das ingestões passadas, relatórios de Lint e execuções de manutenção |

![Todos os comandos do Karpathy LLM Wiki reunidos sob um único prefixo na paleta de comandos do Obsidian](assets/readme/readme-03-commands.webp)

| Antes | Depois |
|--------|-------|
| `notes/machine-learning.md` (um ficheiro plano) | `wiki/concepts/supervised-learning.md` com `[[links bidirecionais]]`, aliases, atribuição de fonte e uma entrada em `wiki/index.md` |

> 📖 Passo a passo em [GitHub Discussions → Guides](https://github.com/GD4AI/obsidian-llm-wiki/discussions/categories/guides). Achou útil? [Dê uma estrela ao repositório](https://github.com/GD4AI/obsidian-llm-wiki) para acompanhar as versões.

---

## ✨ Funcionalidades

### 📚 Qualidade do conhecimento

- **🔍 Extração de entidades e conceitos** — o LLM extrai entidades (pessoas, organizações, produtos, eventos) e conceitos (teorias, métodos, termos) para páginas autónomas. A granularidade é configurável (Mínima → Fina, mais Personalizada), por isso troca custo por profundidade.
- **🏷️ Aliases obrigatórios** — cada página chega com pelo menos um alias (tradução, abreviatura, variante), para que a deteção de duplicados entre idiomas funcione.
- **🔄 Deteção de duplicados por níveis** — o Nível 1 (correspondência direta de nome: entre idiomas, abreviatura, títulos muito semelhantes) é sempre verificado; o Nível 2 (links partilhados, semelhança média) preenche o orçamento de tokens que resta.
- **🧩 Fusão inteligente e estado de contradição** — os duplicados fundem-se preservando os aliases; as contradições ficam assinaladas com atribuição de fonte; as páginas com `reviewed: true` ficam protegidas contra sobrescrita.
- **🎨 Um vocabulário de tags, o seu** — as tags que uma página pode carregar vêm das tags aninhadas das suas notas, das tags que já existem nas páginas wiki e da lista *Personalizado* em Configurações → Wiki → Vocabulário de Tags. O prompt, a barreira de escrita, o Lint e o retag leem todos essa mesma lista, por isso o que é oferecido ao modelo é exatamente o que chega ao disco; um valor fora dela é descartado, nunca escrito. Modelos pequenos ainda derivam (cerca de uma execução em dez devolve a taxonomia do próprio modelo) — a barreira apanha, e o Lint sinaliza a página. Âncora de design: [Issue #328](https://github.com/GD4AI/obsidian-llm-wiki/issues/328).

![Uma página de conceito gerada: a tag de vocabulário com que foi escrita, os seus aliases AF e AFib, a definição e as páginas com que se relaciona](assets/readme/readme-04-entity-page.webp)

### 📄 Ingestão de documentos / PDF / imagens

Seis caminhos, alternáveis em cada ingestão:

1. **🧾 Backend MinerU integrado** — Configurações → Configuração Wiki → Backend de conversão Markdown → *MinerU*. PDF, imagens (PNG/JPG/WebP/GIF/BMP e mais) e Office (DOC/DOCX/PPT/PPTX/XLS/XLSX) através do [parser Precise do MinerU](https://mineru.net/apiManage/docs). Token no SecretStorage; expira ao fim de cerca de 90 dias, por isso um 401 quer dizer que o token provavelmente expirou — e a mensagem indica a página onde o renovar. Os limites são 200 MB / 200 páginas por PDF e 256 MB / 10 000 ficheiros por arquivo. O caminho para artigos digitalizados e ficheiros Office onde o layout importa.
2. **☁️ Provedores cloud com PDF nativo** — Anthropic, OpenAI, Google Gemini e AWS Bedrock (variantes Anthropic + OpenAI) leem PDFs como partes de ficheiro sem qualquer configuração além de escolher o provedor.
3. **🖥️ OCR local em Apple Silicon** — o [oMLX](https://github.com/jundot/omlx) traz o Microsoft Markitdown como backend PDF→Markdown integrado. Ative o Markitdown no oMLX, carregue o [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) (3B / 570M ativos, código aberto desde 2026-06) como modelo de visão, aponte o plugin ao oMLX como provedor OpenAI-Compatible personalizado, ative **Forçar suporte a PDF** e escolha o modelo multimodal que o oMLX está a servir. O PDF nunca sai da sua máquina.
4. **🛠️ Extrator de terceiros (interface online do MinerU)** — use o [serviço online MinerU Extractor](https://mineru.net/OpenSourceTools/Extractor) para uma interface manual rápida, quando não quer configurar um token de API. Descarregue o `.md` convertido, coloque-o no vault fora da pasta da wiki e ingira-o como uma nota Markdown normal.
5. **🔌 Forçar suporte a PDF** — para qualquer outro endpoint compatível com OpenAI ou Anthropic que aceite partes de ficheiro, o plugin tenta a chamada (Configurações → Configuração LLM → Avançado). O endpoint decide; as falhas aparecem como um Notice localizado.
6. **🖼️ Imagens Markdown incorporadas** — ative *Analisar imagens incorporadas durante a ingestão Markdown* nas Configurações avançadas para analisar cada incorporação local elegível `![[imagem.png]]` e `![alt](imagem.png)`. Cada imagem é analisada com os parágrafos Markdown mais próximos, enviada em pacotes de evidência visual de 20 MiB e limitada a 10 MiB; os URLs remotos nunca são descarregados. Para ter saída testável por imagem, ative opcionalmente *Salvar evidências visuais de imagens incorporadas na página de origem*, que acrescenta uma secção de auditoria recolhível à página de origem gerada.

**Atenção aos formatos Office:** o Obsidian não desenha `.docx` / `.xlsx` / `.pptx` nativamente ([file-formats](https://obsidian.md/help/file-formats)), por isso o fluxo prático para ficheiros Office é: o MinerU converte para `.md`, o plugin ingere esse `.md` em páginas wiki, e o ficheiro Office original fica guardado para referência. Use um plugin da comunidade como Pandoc Plugin / Docxer / Md Importer / Office Reader se precisar de pré-visualizar ficheiros Office no editor.

**Infraestrutura partilhada por todos os caminhos:**

- **🗄️ Cache limitada** — `.obsidian/plugins/karpathywiki/pdf-cache/` guarda o Markdown convertido, indexado por hash de conteúdo + modelo + versão do conversor; tetos de 100 MB no total / 1000 entradas / 10 MB por entrada, com remoção LRU pela data de modificação.
- **📝 Sidecar opcional no vault** — Configurações → Configuração Wiki → Pasta Wiki → *Gravar o Markdown convertido no Vault* escreve `<basename>.pdf.md` ao lado do PDF de origem (desligado por padrão — só a cache é o padrão).
- **🛡️ Prompt de transcrição literal** — conversão ao estilo OCR com os marcadores anti-alucinação `[illegible]` / `[figure: ...]`; as cercas de código markdown que os modelos locais pequenos acrescentam são removidas antes da escrita na cache.
- **🔁 Citações literais na página de origem (v1.27.0, #496)** — cada página `sources/<slug>.md` gerada traz agora uma secção `Menções na fonte`, construída a partir das mesmas citações literais que a extração capturou por entidade e por conceito (a prosa que o modelo já provou ver), para que o documento subjacente seja a única página wiki com um rasto real e fundamentado até ao seu texto de origem.

📖 **Guias completos de configuração** para todos os caminhos (provedores cloud, níveis de hardware do oMLX, instalação do MinerU, manutenção da cache) → [docs/PDF-OCR-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 Consulta e manutenção

**Recuperação e respostas**

- **🧭 Cascata PPR de 5 estágios** — veja [Como funciona a recuperação](#-como-funciona-a-recuperação). O Personalized PageRank sobre `[[wiki-link]]` dá contexto multi-hop consciente do grafo.
- **🔤 Pontuação lexical que lê o corpo do texto** — o caminho rápido pontua título, aliases, resumo **e o corpo do texto** com BM25F, por isso o texto mais longo de uma página chega ao pontuador. É a maior mudança de cobertura que este projeto já fez.
- **🧩 Formatação das páginas relacionadas** — uma página hub já não consegue arrastar todas as outras para si. As listas de relacionados são recalculadas a cada escrita a partir dos nomes que sobreviveram, ordenadas e limitadas.
- **🔁 Interruptor do pontuador antigo** — Configurações → Avançado → *Antigo avaliador de consultas* executa a ordenação linear anterior, ajustada à mão, em vez da nova. Desligado por padrão; a nova ordenação é o padrão e o interruptor é o caminho de volta.
- **📏 O orçamento da resposta é de 16 000 tokens, e o pipeline diz quando ele acaba** — a resposta já não para em silêncio no orçamento. O contexto é ajustado a um orçamento de páginas antes da montagem, por isso 20 páginas entram no prompt por plano e não por sorte.
- **🔖 As citações leem-se em forma académica** — o compositor cresce com o conteúdo, e *limpar histórico* limpa de facto o registo.
- **🪟 Painel lateral à direita** — o Consultar Wiki abre num painel lateral direito ao estilo Copilot (v1.22.1+) em vez de um modal centrado.

**Manutenção e reparação**

- **🔍 Verificação de saúde do Lint** — um único comando apanha: duplicados, links quebrados, páginas vazias, órfãos, aliases ausentes, contradições. Também lista as páginas hub cuja vizinhança cristalizou — um hub que ocupa o lugar de ligações que o conteúdo já não consegue fazer.
- **⚡ Smart Fix All** — reparação em ordem causal com um clique: preencher aliases → fundir duplicados → corrigir links quebrados → ligar órfãos → expandir páginas vazias, com relatório por fase.
  
  ![Relatório do Lint — a linha de estado, os links quebrados encontrados e o botão Smart fix all que os repara numa só passagem](assets/readme/readme-08-lint-report.webp)
- **🚧 Resultado «deixar como está» em links quebrados** — Configurações → Avançado → *Criar páginas de stub para links não resolvidos* (ligado por padrão). Desligue-o e um link quebrado fica visível em todos os relatórios do Lint até uma fonte real o definir, em vez de se tornar uma página de marcador vazia. A barreira «nunca expandir sem uma fonte» da #197 não muda; este controlo decide apenas se a página de stub chega a ser escrita.
- **📊 Painel de histórico de operações** — interface pesquisável e filtrável das ingestões passadas, relatórios de Lint e execuções de manutenção.

**Barreiras que correm antes de uma chamada ser paga**

- **🛡️ Barreira de pré-ingestão** — notas vazias / só com espaços / só com frontmatter são rejeitadas antes de qualquer chamada ao LLM; a deduplicação por hash de conteúdo apanha ficheiros idênticos em caminhos diferentes.
- **🚦 Barreira de candidatos de ingestão** — opcional (`skipMentionOnlyCandidates`, desligado por padrão). Um candidato nomeado apenas entre parênteses, numa enumeração ou num item de lista curto é podado antes de custar uma geração e uma chamada de deduplicação. Aplica-se só aos idiomas com perfil medido; um idioma sem perfil nunca é filtrado em silêncio, e as notas multilingues não são filtradas de todo.
- **🎛️ Modo de saída e raciocínio por etapa** — campo Task Policies em Parâmetros LLM avançados; substitui a definição de modo-texto/raciocínio por etapa sem mexer no código. A base integrada fica intacta para as etapas que você não listar.

### 🦙 Local primeiro

- **🖥️ Ollama, LM Studio, OpenRouter, endpoint à medida** — funcionam de imediato. Os modelos locais servem para consulta (janelas de contexto mais pequenas); a ingestão de um vault de 2 000 páginas normalmente pede um modelo cloud de contexto longo.
- **📄 O caminho de OCR de PDF é totalmente local em Apple Silicon** — veja [Ingestão de documentos / PDF / imagens](#-ingestão-de-documentos--pdf--imagens) acima.
- **🔐 ChatGPT Plan (Codex OAuth)** — loopback no desktop ou código de dispositivo no telemóvel; as credenciais vivem apenas no SecretStorage do Obsidian. (Veja [Anthropic vs OpenAI vs Codex OAuth](#anthropic-vs-openai-vs-codex-oauth--são-provedores-distintos) abaixo para a explicação completa dos limites entre provedores.)

### 🌐 Idioma

- **🌍 11 idiomas de interface** — Inglês, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano, Русский. O idioma da interface e o da saída da wiki são independentes — a sua wiki pode estar em chinês com a interface em inglês.
  
  ![O idioma da interface e o idioma de saída da wiki são duas definições separadas, por isso uma wiki em chinês pode correr atrás de uma interface em inglês](assets/readme/readme-06-language-settings.webp)
- **📚 11 idiomas de saída da wiki** — o mesmo conjunto; escolha em Configurações → Configuração Wiki. Opção *Custom input* para prompts pontuais.
- **Todas as strings de interface traduzidas por locale** — cada rótulo, modal e aviso. Acrescentar um 12.º idioma depende de contribuidores (o padrão da PR #159).
- **🔧 Cabeçalhos personalizados por provedor** — um campo de texto livre logo abaixo do API Base URL. Uma linha `Name: value` por linha, enviada em todos os pedidos. Traz um preset OpenCode e uma variante `(Responses)` para endpoints que falam `/v1/responses`.
- **📡 Um stream que sobrevive a uma origem bloqueada** — quando um pedido cross-origin é recusado, o stream é repetido por um transporte `node:https` do desktop em vez de degradar para uma resposta em buffer, e uma repetição que falha fica registada em vez de ser engolida.

### ⚙️ Configurações que moldam uma execução

A maior parte do que o plugin faz está decidido por si. Estas oito definições mudam isso, e cada uma delas é a resposta a uma falha que alguém encontrou.

| Definição | Onde | O que muda |
|---|---|---|
| **Streaming da ingestão** | Configurações avançadas | `Automático` usa streaming no telemóvel; `Sempre` e `Nunca` forçam a escolha. É o streaming que mantém uma ingestão longa abaixo do tempo de inatividade de um provedor. |
| **Nível de raciocínio** | Parâmetros LLM avançados | Default / Baixo / Médio / Alto. O AI SDK traduz o nível por provedor, por isso não há nenhum campo de provedor escrito à mão. |
| **Máx. tokens de saída por chamada** | Parâmetros LLM avançados | Agora funciona nos dois sentidos: suba quando um modelo de raciocínio gasta o orçamento antes de escrever, desça para limitar o custo. Vazio pede ao modelo o seu próprio teto. |
| **Janela de contexto do modelo** | Parâmetros LLM avançados | O teto já não pode exceder a janela, por isso um modelo local pequeno nunca recebe um número que não consegue aceitar. |
| **Paralelismo LLM** | Configuração LLM | 1–20 chamadas em paralelo. Mais alto termina uma ingestão grande mais cedo; mais baixo mantém um modelo local dentro da sua memória. |
| **Prioridade de extração** e **Requisitos de conteúdo** | Configurações avançadas | Texto livre escrito em `schema/config.md`. Moldam o que o modelo extrai, sem que você edite o schema à mão. |
| **Modo de saída e raciocínio por etapa** | Parâmetros LLM avançados | Substitui o modo de texto ou o nível de raciocínio de uma etapa — extração, fusão, consulta — sem mudar as restantes. |
| **Ficheiros excluídos** | A própria lista do Obsidian | A ingestão de pastas, o monitor de ficheiros e o caminho automático respeitam as exclusões que você define no Obsidian, por isso o plugin e o Obsidian concordam sobre o que está fora de alcance. |

---

## 🌐 Ecossistema

O plugin compõe-se com o resto do seu stack do Obsidian — cada ferramenta abaixo liga-se ao grafo `[[wiki-link]]` sem alterações de código.

- **📄 [Backend multiformato MinerU](https://mineru.net/apiManage/docs) (integrado desde a v1.27.0)** — o que antes era um passo separado de CLI/interface é agora um interruptor do plugin; veja [Ingestão de documentos / PDF / imagens](#-ingestão-de-documentos--pdf--imagens) para a tabela completa de caminhos. O [serviço online MinerU](https://mineru.net/OpenSourceTools/Extractor) continua disponível para quem prefere uma interface rápida a um token de API; [auto-hospedar o MinerU](https://github.com/opendatalab/mineru) também é uma opção.
- **🕸️ Obsidian Graph View** — abra o grafo nativo em qualquer página wiki; cada `[[wiki-link]]` torna-se um nó e cada backlink uma aresta. Integrado, zero de tamanho extra no bundle.
  
  ![A Graph View nativa do Obsidian sobre uma wiki gerada — páginas de origem, entidade e conceito como um único grafo ligado](assets/readme/readme-05-graph-view.webp)
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** — extensão oficial do navegador. Guarde páginas web (artigos, posts de blog, tópicos do Reddit, Hacker News, receitas, artigos científicos, transcrições do YouTube via Interpreter) em qualquer pasta do seu vault e depois use o comando `Ingerir de pasta` do plugin para extrair entidades e conceitos em lote.
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** — consulte a wiki como uma base de dados com DQL (`LIST FROM "wiki/entities" WHERE contains(tags, "person")`) ou a API JS. O plugin escreve frontmatter padrão (`tags:`, `type:`, `aliases:`) em todas as páginas, por isso as consultas Dataview funcionam de imediato.
- **🌿 Git** — versione o seu vault (com qualquer cliente Git). O plugin nunca reescreve os seus ficheiros de origem; só cria páginas novas em `wiki/`, por isso o `git diff` separa com clareza as suas edições do conteúdo gerado pelo LLM.
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** — transforme qualquer nota do Obsidian em apresentações através do frontmatter do Marp (`marp: true`). As páginas wiki são Markdown puro, por isso são desenhadas como slides sem conversão adicional.
- **🖼️ Canvas** — a tela infinita nativa do Obsidian. Arraste cartões da wiki para um Canvas e monte guias de estudo, mapas mentais ou sínteses de investigação a partir dos `[[wiki-links]]`, sem sair do vault.

---

## 🔍 Como funciona a recuperação

A maioria dos plugins de "busca com IA" fragmenta as suas notas em chunks e embebe-os numa base de dados vetorial. Nós não. O [argumento do Karpathy contra o RAG](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) é que a fragmentação quebra a capacidade de o LLM raciocinar sobre o seu grafo de conhecimento inteiro — e o argumento aguenta na prática. Em vez disso, percorremos o grafo que você já mantém ao escrever `[[wiki-links]]`.

### A cascata de seleção de sementes de 5 estágios

Quando você pergunta "Quem fundou a Microsoft?", o Consultar Wiki corre cinco estágios antes de gerar qualquer resposta:

1. **Caminho rápido lexical** — BM25F sobre o título, os aliases, o resumo **e o corpo do texto** de cada entidade e conceito, com saturação por campo e IDF a partir de uma tabela real de frequência documental. Grátis, instantâneo, e a etapa que condiciona tudo o resto.
2. **Geração de palavras-chave pelo LLM** — o LLM propõe 8–12 palavras-chave entre idiomas a partir da sua pergunta (resolve sinónimos, abreviaturas e termos resistentes à sobreposição de tokens numa única chamada).
3. **Varredura local de substrings** — cada palavra-chave gerada é novamente comparada localmente com títulos de páginas, aliases e trechos do corpo. Sem chamada extra ao LLM; completa a cobertura tolerante a ruído.
4. **Fallback pela base de conhecimento do LLM** — quando o caminho lexical mais a varredura devolvem sinais fracos, o LLM volta a semear os top-N candidatos contra a wiki inteira, numa passagem semântica.
5. **Expansão do grafo por PPR** — Personalized PageRank (Haveliwala 2002) sobre o grafo `[[wiki-link]]`, a partir do conjunto de sementes candidatas. É isto que dá contexto multi-hop consciente do grafo: "Bill Gates" → "Microsoft" → "concorrentes", e não apenas sobreposição literal de títulos.

A cascata trunca no estágio que devolveu sinal suficiente — sem custo fixo de 5 estágios; sem chamadas ao LLM quando o caminho lexical basta; fallback semântico só quando o caminho lexical mais a varredura não chegam.

### Expansão da consulta, e um caminho de volta

Quando a cascata chega ao estágio do grafo, a consulta é expandida duas vezes antes de as sementes serem escolhidas: uma com os termos da própria wiki, outra com termos propostos pelo LLM. Cada passagem tem peso, e o ganho é **medido** nos vaults do próprio projeto em vez de suposto — nos dois vaults escritos pela versão atual, a expansão vale **+0.086** e **+0.113** em r@10, e em ambos os casos o intervalo exclui o zero. A afirmação é deliberadamente estreita: a forma ponderada **não** é mensuravelmente melhor do que a simples concatenação, e o interruptor que corre o avaliador anterior existe para quem teve piores resultados.

Configurações → Avançado → *Antigo avaliador de consultas* corre o avaliador linear anterior, ajustado à mão. A nova ordenação é o padrão; o interruptor é o caminho de volta.

### Personalized PageRank em escala

Usamos Monte Carlo PPR (Fogaras 2005) — 3 000 caminhadas aleatórias × 50 passos cada — com a regra de becos sem saída de Haveliwala 2002. O custo é **O(K × L)** (K = caminhadas, L = passos por caminhada), independente do número de páginas, por isso um vault de 2 000 páginas vê a mesma latência de expansão que um de 200 páginas.

**PPR @5 = 27,1% contra uma linha de base pure-kNN de 24,1%** num vault do projeto. O corpus não é público, por isso leia o número como a comparação que o projeto fez para si mesmo, e não como uma afirmação sobre o seu vault; `tools/dev-instrument/run-recall-harness.mjs` é o instrumento que mede a cobertura contra um vault.

### Por que nenhum embedding

Rejeitámos o caminho do embedding de propósito na [Issue #175](https://github.com/GD4AI/obsidian-llm-wiki/issues/175). O sinal do grafo já lá está — cada `[[wiki-link]]` é uma aresta «estes estão relacionados» curada à mão — e a maioria dos provedores que suportamos (Ollama, LM Studio, Anthropic, Bedrock, Kimi, GLM, MiniMax) não tem sequer um endpoint `/v1/embeddings`. Acrescentar um modelo de embedding significaria um download por página, um adaptador por provedor e zero benefício na qualidade da recuperação.

---

## 🤖 Modelos

Quinze provedores com nome, mais qualquer endpoint compatível com OpenAI ou Anthropic. A tabela de escolha por nível — cloud, local, OCR, quantização, hardware — está em [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md), verificada pela última vez em 2026-11-06 contra o [models.dev](https://models.dev/).

- **Cloud de fronteira** — Anthropic, OpenAI, Google Gemini, xAI Grok, Moonshot Kimi, Zhipu GLM, MiniMax. PDF nativo em Anthropic, OpenAI e Gemini.
- **Custo contido e pesos abertos** — DeepSeek, Alibaba Qwen, Step, Tencent Hunyuan, Xiaomi MiMo, Google Gemma.
- **Empresas** — AWS Bedrock (variantes Anthropic e OpenAI, com chave de API, SSO ou IAM) e ChatGPT Plan através de Codex OAuth.
- **Local e gateways** — Ollama, LM Studio, OpenRouter, gateways compatíveis com Anthropic.

Este plugin entrega ao LLM o contexto completo da sua wiki em cada consulta, por isso **os modelos de contexto longo ganham**.

### O que importa

- **🧠 Janela de contexto ≥ 200K tokens** para vaults com mais de ~500 páginas. Abaixo de 200K a cascata pode largar estágios anteriores para caber.
- **⚖️ A qualidade no seguimento de instruções** importa mais do que a inteligência bruta na tarefa de extração — escolha um modelo que siga o template do schema, não o maior número do leaderboard.
- **🔌 O endpoint de embeddings é irrelevante** — não usamos embeddings. Um provedor sem `/v1/embeddings` serve perfeitamente (a maioria dos nossos 15+ provedores não tem um).
- **🦙 Local para consultar, cloud para ingerir** — a ingestão de um vault de 2 000 páginas normalmente pede um modelo cloud de contexto longo; um modelo local de 262K cobre a maioria das consultas.

Para ingestão de PDF / imagens / Office, veja [Ingestão de documentos / PDF / imagens](#-ingestão-de-documentos--pdf--imagens) em Funcionalidades — Anthropic, OpenAI, Bedrock e Gemini leem PDFs como partes de ficheiro nativamente; o backend MinerU integrado (v1.27.0+) e o **Forçar suporte a PDF** cobrem tudo o resto.

### Anthropic vs OpenAI vs Codex OAuth — são provedores distintos

- **Anthropic** (e a sua variante Bedrock) — chave da API Anthropic Platform, faturada à parte.
- **OpenAI** — chave da API OpenAI Platform, faturada à parte.
- **ChatGPT Plan (Codex OAuth)** — experimental, um provedor distinto que usa a franquia Codex elegível depois de entrar pelo navegador ou por código de dispositivo; a disponibilidade segue as políticas de autenticação e de franquia do OpenAI Codex, não o nome do plano. É compatibilidade de terceiros com o Codex, não uma parceria com a OpenAI nem uma API genérica do ChatGPT.

### AWS Bedrock — três modos de autenticação (v1.27.0, #425)

Configurações → Provedor → Bedrock (Anthropic / OpenAI) passa a escolher um de três modos de autenticação; a linha do provedor pede depois apenas os dados que esse modo realmente precisa:

- **Chave de API** — o caminho bearer original do Estágio 1; o comportamento é byte a byte idêntico ao da v1.26.4 e é a escolha recomendada para quem já paga por uma chave de API do Bedrock.
- **SSO** — fluxo de dispositivo do IAM Identity Center. Clique em *Sign in with AWS SSO*, cole no navegador o código do URL de verificação, e o plugin recebe um token SSO em `karpathywiki-bedrock-sso` no SecretStorage, troca-o por credenciais temporárias da role e assina cada pedido com SigV4 escrito à mão (sem acrescentar o AWS SDK). O ID da conta e o nome da role são detetados automaticamente quando a identidade SSO expõe exatamente um de cada; caso contrário, introduza-os nas configurações do provedor.
- **IAM** — chaves de acesso estáticas para ambientes sem SSO (CI, tarefas em lote agendadas). Guardadas em `karpathywiki-bedrock-iam` no SecretStorage; a cache em memória memoriza por chave de acesso para manter a assinatura SigV4 dentro da validade.

Os três modos partilham a mesma disciplina do SecretStorage do Obsidian (nenhuma credencial em `data.json`, logs ou documentação) e o mesmo caminho OIDC + SigV4 escrito à mão, sem AWS SDK. A região do Bedrock é independente do modo de autenticação e configura-se na mesma linha do provedor.

> 📖 **Tabela de escolha completa** (cloud + local + OCR de PDF + Codex OAuth + quantização + níveis de hardware) → [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

## ❓ FAQ

### O que o plugin faz na prática?

Escolha uma nota, uma pasta ou uma seleção: o LLM extrai entidades e conceitos e escreve uma wiki interligada com `[[links bidirecionais]]`. Faça uma pergunta e a resposta vem dessas páginas, com citações. As suas notas originais nunca são modificadas.

### A minha wiki atual está segura?

✅ Retrocompatível desde a v1.0.0. Defina `reviewed: true` em qualquer página para a proteger contra sobrescrita. Atualizar a partir da v1.24.x não reescreve o seu vault; a ingestão de PDF da v1.25.0 é só de cache por padrão, e a v1.27.0 acrescenta ingestão nativa de PDF + imagens + Office sem mudar o layout da wiki em disco.

### Posso ingerir PDFs, imagens e documentos Office?

✅ Sim. Anthropic, OpenAI, Bedrock e Gemini leem PDFs nativamente; o backend MinerU integrado (v1.27.0) cobre tudo o resto (PDF + imagens + Office). Guia completo — provedores cloud, OCR em Apple Silicon, Forçar suporte a PDF, manutenção da cache — em [docs/PDF-OCR-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md).

### Os meus dados são enviados para algum lado?

🚫 Sem backend, sem analítica — o plugin corre inteiramente dentro do Obsidian. Só o texto que você envia explicitamente para ingestão ou consulta sai do seu dispositivo, e só para o provedor LLM que você configurar. Para localidade total dos dados, use Ollama ou LM Studio.

### Posso usar o plugin no meu idioma?

🌍 11 idiomas tanto para a interface como para a saída da wiki, definidos de forma independente. Um 12.º depende de contribuidores (a PR #159 é o padrão).

### Em que difere de um chatbot RAG?

Sem fragmentação, sem embeddings, sem base de dados vetorial. O Personalized PageRank corre sobre o grafo `[[wiki-link]]` que você já mantém, o que dá contexto multi-hop a custo zero de embedding.

### Que LLM devo usar?

Um modelo de contexto longo: ≥200K tokens para vaults com mais de ~500 páginas. A tabela por níveis está em [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md).

### Existe um benchmark publicado?

PPR @5 = 27,1% contra uma linha de base pure-kNN de 24,1%, medido num vault do projeto — [Como funciona a recuperação](#-como-funciona-a-recuperação) diz o que isso prova e o que não prova.

### Como controlo os custos de API?

Use a granularidade de extração Grossa ou Mínima na ingestão em lote. O Smart Batch Skip deteta automaticamente ficheiros já ingeridos. A manutenção automática está DESLIGADA por padrão. O Lint mostra contagens antes de executar correções — nada é cobrado sem a sua aprovação.

### Como cancelo uma operação em curso?

Clique na barra de estado (mostra "Ingerindo... clique para cancelar") ou use `Cmd+P/Ctrl+P` → "Cancelar ingestão atual". Para de forma limpa no limite do lote seguinte.

### Onde obtenho ajuda?

[GitHub Issues](https://github.com/GD4AI/obsidian-llm-wiki/issues) para relatar erros · [GitHub Discussions](https://github.com/GD4AI/obsidian-llm-wiki/discussions) para perguntas e pedidos de funcionalidades · Consola de programador (`Ctrl+Shift+I` / `Cmd+Option+I`) para os logs do plugin.

---

## 🔒 Privacidade

Este plugin está listado no Mercado de Plugins da Comunidade do Obsidian e passa por revisão automática de segurança e permissões.

- **🚫 Sem backend próprio, sem telemetria, sem recolha de dados.** Software puramente local a correr dentro do Obsidian. O plugin não opera nenhum servidor e não reporta nada a ninguém.
- **🔐 O acesso à rede é opcional e explícito.** Existe apenas para chegar aos serviços que *você* configura: o seu provedor LLM e — se ativar o backend de documentos MinerU — `mineru.net`. Esse segundo é a exceção que vale a pena nomear: carrega o documento para uma jurisdição que você não escolheu e que não publica qualquer declaração de retenção. [Onde o seu documento é processado](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md#-where-your-document-is-processed) lista todos os caminhos e para onde vai o ficheiro.
- **📁 O acesso aos ficheiros do vault** serve a gestão da wiki (ler notas, gerar páginas, procurar links quebrados, detetar duplicados). O plugin nunca modifica os seus ficheiros de origem.
- **📋 O acesso à área de transferência** é usado exclusivamente pelo botão "Copiar" do modal de consulta — e só quando você clica nele.

Para localidade total dos dados, use Ollama ou LM Studio. Com um provedor local, os seus dados nunca saem da sua máquina.

---

## 💖 Apoiar

Se o Karpathy LLM Wiki passou a ser uma parte importante do seu fluxo de conhecimento:

- ☕ **[Pague-me um Ko-fi](https://ko-fi.com/greenerdalii)** — uma vez ou por mês
- 💳 **[Gorjeta via PayPal](https://paypal.me/greenerdalii)** — gorjeta única

Obrigado a quem apoia o projeto:

[@jameses-cyber](https://github.com/jameses-cyber), [@issaqua](https://github.com/issaqua), Dikson Choi

### Contribuir

Relatos de erros e pull requests são ambos úteis. O [CONTRIBUTING.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CONTRIBUTING.md) cobre o build, o ciclo de testes e as verificações que uma alteração tem de passar; o [CODE_OF_CONDUCT.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CODE_OF_CONDUCT.md) é curto. O [ROADMAP.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/ROADMAP.md) mostra o que está planeado, e o [CHANGELOG.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CHANGELOG.md) registra o que foi lançado.

Construir a partir do código-fonte: `pnpm install`, `pnpm build:dev`, `pnpm gate:1` — o último é lint, verificação de arquitetura, verificação de tipos, build, testes e CSS lint num único comando. `tools/dev-instrument/` é o instrumento de medição exclusivo do desenvolvimento: corre o verdadeiro `WikiEngine.ingestSource` contra uma pasta no disco sem runtime do Obsidian e imprime a contabilidade de tokens e de tempo de relógio por tarefa, que é de onde vêm os números de desempenho do changelog. A CLI para o utilizador final está num repositório irmão — `npm i -g karpathywiki-cli`.

---

## 🔭 Outros projetos

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — o mesmo `WikiEngine` sem renderizador: `npm i -g karpathywiki-cli`, depois `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`.
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — um router ao nível da tarefa para o [pi-coding-agent](https://github.com/earendil-works/pi): um juiz pequeno marca cada turno como rotineiro ou consequente, e o nível escolhido conduz o modelo, as ferramentas e a cadeia de fallback. MIT. → [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — o mesmo desenho de routing para o runtime do [dsh-coding-agent](https://github.com/earendil-works/dsh). MIT.
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — o fluxo de trabalho de plugins do Obsidian do lado do DSH: monta um espaço de trabalho, conduz o ciclo Red→Green, corre as mesmas verificações de qualidade que este repositório usa e deixa um ramo `feat/*` ou `fix/*` pronto para lançamento.

---

## 📜 Licença e créditos

Licença Apache, Versão 2.0 — veja [LICENSE](../LICENSE), [NOTICE](../NOTICE) e [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md).

**Construído sobre:**
- 💡 [LLM Wiki do Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — o conceito original
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v7](https://ai-sdk.dev/) (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) através do `requestUrl` do Obsidian
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) e [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — os algoritmos de recuperação

**Mantenedores:** [@green-dalii](https://github.com/green-dalii) (autor) · [@DocTpoint](https://github.com/DocTpoint) (co-mantenedor desde setembro de 2026)

[![Star History Chart](https://api.star-history.com/chart?repos=GD4AI/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
