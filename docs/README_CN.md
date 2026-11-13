<!--
SEO metadata (not user-visible, parsed by crawlers / LLMs) — 简体中文本地化版本：
- name: karpathy-llm-wiki-plugin-for-obsidian
- type: 软件 / Obsidian 社区插件 / 知识库生成器 / RAG 替代方案
- license: Apache-2.0
- language: TypeScript
- runtime: Obsidian >= 1.11.4 (桌面端 + 移动端)
- dependencies: 零运行时依赖（Vercel AI SDK v7 已打包）
- obsidian-plugin-id: karpathywiki
- obsidian-marketplace: https://community.obsidian.md/plugins/karpathywiki
- repo: https://github.com/GD4AI/obsidian-llm-wiki
- sister-cli-repo: https://github.com/green-dalii/obsidian-llm-wiki-cli
- docs: README.md + docs/README_<locale>.md（11 种语言）+ docs/MODEL-GUIDE.md + docs/PDF-OCR-GUIDE.md
- first-published: 2025-09 (v0.1.0)
- latest: v1.31.0
- release-notes: https://github.com/GD4AI/obsidian-llm-wiki/releases
- previous: v1.30.0（MINOR — 回答上下文的 token 上限、设置里的 Extraction Focus、结晶化 hub 报告）
- last-updated: 2026-11-12
- alternate-names: Karpathy LLM Wiki、LLM Wiki Obsidian、Obsidian wiki 插件、基于图谱的 RAG、无嵌入 RAG、Personalized PageRank 检索、Obsidian 第二大脑
- search-intents: "Obsidian 无嵌入 RAG", "Obsidian wiki 插件", "Personalized PageRank Obsidian", "基于图谱的笔记检索", "Karpathy LLM Wiki 实现", "Obsidian 知识库自动生成", "Obsidian 图谱视图 + AI", "Obsidian 第二大脑插件", "Obsidian 笔记链接图 AI", "Obsidian 11 语言插件", "Obsidian 15+ LLM 提供商插件", "无向量数据库 RAG", "Obsidian PDF 摄入 AI", "Obsidian Codex OAuth", "Obsidian Bedrock 插件", "Obsidian Bedrock SSO", "Obsidian MinerU", "Obsidian Word PPT Excel 导入", "Obsidian IAM 凭据"
- features: 基于图谱的检索, Personalized PageRank (Haveliwala 2002), Monte Carlo PPR (Fogaras 2005), 5 级种子选择级联, Tier 1/Tier 2 重复检测, 11 语言界面 + 11 语言 Wiki 输出（独立设置）, 15+ LLM 提供商（Anthropic, OpenAI, Bedrock [API key + SSO/IAM], Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-兼容, Codex OAuth）,MinerU 多格式导入（PDF + 图像 + Office）, PDF 摄入（仅缓存、OCR 路径）, Lint 健康扫描, 一键智能修复, 源页原句引用, 摄入候选门, 按步骤任务策略 UI, Obsidian 图谱视图集成, 零嵌入零向量数据库架构, 本地优先模式
- direct-competitors: nashsu/llm_wiki（Tauri 桌面应用）, SamurAIGPT/llm-wiki-agent（Claude Code / Codex / OpenCode / Gemini CLI 技能）, atomicstrata/llm-wiki-compiler（TypeScript CLI，分块检索）
- retrieval-benchmark: PPR @5 = 27.1% vs 纯 kNN 24.1%（项目自有 vault 语料，不是公开基准集）
- author: green-dalii / Greener-Dalii (https://github.com/green-dalii)
- co-maintainer: DocTpoint (https://github.com/DocTpoint)
- canonical: https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md
-->

![Karpathy LLM Wiki 插件横幅——一张由你的 Obsidian 笔记编织而成的互联 Wiki 页面网络](assets/llm_wiki_banner.webp)

# 🧠 Karpathy LLM Wiki — Obsidian 插件

> 一个 Obsidian 插件，把你的笔记变成互联、可查的知识库——[Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 的构想，直接长在你已经在用的编辑器里。

**Obsidian 官方市场满分评分 • 零嵌入图谱检索 • 原生 11 种语言 • 原生 PDF + 图片 + Office 摄入 • 兼容所有 LLM 提供商 • 本地优先 • 无后端 • GDPR 友好**

![Version](https://img.shields.io/github/v/release/GD4AI/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-15%2B-cyan?style=flat-square) <br>
![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml)

[English](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md) | **简体中文** | [繁體中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_KO.md) | [Deutsch](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_DE.md) | [Français](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_FR.md) | [Español](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ES.md) | [Português](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_PT.md) | [Italiano](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_IT.md) | [Русский](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[官网](https://llmwiki.greenerai.top/) | [Obsidian 插件市场](https://community.obsidian.md/plugins/karpathywiki) | [博客](https://llmwiki.greenerai.top/zh/blog/) | [反馈讨论](https://github.com/GD4AI/obsidian-llm-wiki/discussions)

🤔 [为什么使用此插件？](#-为什么使用此插件) | 🚀 [快速开始](#-快速开始) | ✨ [核心特性](#-核心特性) | 🌐 [生态](#-生态) | 🔍 [检索工作原理](#-检索工作原理) | 🤖 [模型推荐](#-模型推荐) | ❓ [常见问题](#-常见问题) | 🔒 [隐私](#-隐私)

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD)

> Karpathy LLM Wiki 免费、自托管、没有自己的后端。如果它替你省下了时间，一杯咖啡能让它继续被维护 —— 点个 ⭐ 同样有帮助。

---

## 🤔 为什么使用此插件？

你写笔记，它们躺在文件夹里。想找出哪些内容互相关联，只能靠回忆几个月前就忘掉的线索。

**Karpathy 的 LLM Wiki 构想已有别的开源实现——但没有一个是以一键 Obsidian 插件的形式交付的。** 它们多是 CLI 工具、Claude Code 技能，或者独立的桌面应用；本插件就长在 Obsidian 内部——图谱视图、ribbon、命令面板一应俱全。

### 竞品对比

|  | **Karpathy LLM Wiki**（本插件） | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|
| **交付方式** | ✅ 一键安装的 Obsidian 插件 | 🟡 Tauri 桌面应用 | 🟡 Claude Code / Codex / OpenCode / Gemini CLI 技能 | 🟡 TypeScript CLI 管线 |
| **依赖** | ✅ 无——只有一个插件 | 🟡 Python 运行时 + sqlite | 🟡 Claude Code / Codex / OpenCode 运行时 | ❌ 嵌入模型 + 向量数据库（按其文档） |
| **国际化（界面 + Wiki 输出）** | ✅ 11 种语言 | 🟡 英文 / 中文 | ❌ 仅英文 | ❌ 仅英文 |
| **LLM 提供商** | ✅ 15+（Anthropic、OpenAI、Bedrock、Gemini、DeepSeek、Qwen、Grok、Kimi、GLM、MiniMax、Step、Hunyuan、MiMo、Gemma、Codex OAuth、Ollama、LM Studio、OpenRouter、Anthropic 兼容……） | 🟡 OpenAI 兼容 | 🟡 通过 Claude Code / Codex 订阅 | 🟡 OpenAI 兼容 |
| **检索与查询管线** | ✅ `[[wiki-link]]` 图上的 **PPR + Monte Carlo** | 🟡 2 跳衰减（4 信号启发式） | 🟡 Louvain 社区发现 | 🟡 分块上的 BM25 + 语义 |
| **图谱可视化** | ✅ Obsidian 原生图谱视图（内建，零额外体积） | 🟡 桌面应用内自绘 sigma.js + graphology | 🟡 vis.js `graph.html`（独立文件） | ❌ 只读的浏览器查看器 |
| **可摄入格式** | ✅ **Markdown + PDF + 图片 + Office（DOCX/PPTX/XLSX）** —— 一个开关在原生 PDF（Anthropic / OpenAI / Bedrock / Gemini）与内置 MinerU 多格式后端之间切换 | 🟡 Markdown + PDF | 🟡 仅 Markdown / 代码文件 | 🟡 仅 Markdown |

### 三个有意的设计选择

- **🪟 Obsidian 就是运行环境。** 不要终端，不要独立应用，不要 Docker，不要 Python。从社区插件市场装好，点一下摄入，Wiki 从第一秒起就长在你的 vault 里。Obsidian 原生图谱视图渲染你的 `[[wiki-link]]` 图——内建，零额外体积。
- **🧭 干净、自包含。** 零依赖：没有嵌入模型，没有向量数据库，没有 pip 包。一个插件读你的笔记，与 LLM 对话，把页面写进你的 vault。
- **🔌 任何你已付费的模型。** Anthropic、Bedrock、OpenAI、ChatGPT Plan (Codex OAuth)、Gemini、DeepSeek、Qwen、Grok、Kimi、GLM、MiniMax、Step、Hunyuan、MiMo、Gemma、Ollama、LM Studio、OpenRouter、Anthropic 兼容、自定义端点——十五个以上提供商，没有一个必须提供嵌入端点。

### 适合谁

- **你想 5 分钟装完。** 从社区插件市场安装 → 选一个提供商 → 摄入一篇笔记。几秒内 `wiki/` 里就出现页面，事先不用装 CLI、不用装 Python、不用搭向量数据库。
- **你想从自己的笔记里得到答案，** 每个答案都注明它出自哪些页面。用 Ollama 或 LM Studio，整次调用都留在你的机器上。
- **你写的、读的是 11 种语言中的任何一种。** 界面和 Wiki 输出相互独立：英文界面后面挂一个中文 Wiki，是受支持的用法。
- **你想一键维护。** Lint 健康扫描与一键智能修复盯住重复页、断链和孤立页，不必手动整理。

**以下情况不适合你：** 想要一个通用 ChatGPT 替代品，想对 Confluence、arXiv 这类外部语料做 RAG，或者需要带团队协作的托管服务。答案来自你的 vault，摄入覆盖你的 vault 加独立文件，也没有可以共享的后端。

---

## 🚀 快速开始

**运行要求：** Obsidian 1.11.4 或更高，桌面端或移动端。没有别的——不需要 Node，不需要 Python，不需要容器。用你自己的 API key，或者用完全不需要 key 的本地模型；凭据存放在 Obsidian SecretStorage 里，1.11.4 这个下限就来自这里。

1. **安装。** Obsidian → 设置 → 第三方插件 → 浏览 → 搜索 “Karpathy LLM Wiki” → 安装 → 启用。也可以打开 [社区插件页面](https://community.obsidian.md/plugins/karpathywiki)，点击 **Add to Obsidian**。
   
   ![在 Obsidian 第三方插件列表里已安装并启用的 Karpathy LLM Wiki](assets/readme/readme-02-install.webp)
2. **配置一个提供商。** 打开 设置 → Karpathy LLM Wiki → 选提供商（OpenAI、Anthropic、Ollama、ChatGPT Plan (Codex OAuth) 等）→ 填入 API Key（本地模型不需要）→ 点击 **测试连接** → 保存。
3. **摄入一篇笔记。** 两种方式：
   - **⌨️ 键盘：** `Cmd+P/Ctrl+P` → “摄入单个源文件” → 挑一个 Markdown 文件（或 PDF，v1.25.0+）。
   - **🖱️ 工具栏图标：** 点击 Obsidian 左侧 ribbon 的 **贴纸图标**，立即摄入当前打开的笔记——不用翻菜单。
   
   首批 Wiki 页面几秒内出现在 `wiki/sources/`、`wiki/entities/`、`wiki/concepts/` 中。
   
   ![左边是那篇笔记，右边是它生成的摄入页面——属性、描述，以及相关概念](assets/readme/readme-01-before-after.webp)
4. **查询你的 Wiki。** 两种方式：
   - **⌨️ 键盘：** `Cmd+P/Ctrl+P` → “查询 Wiki”。
   - **🖱️ 工具栏图标：** 点击 Obsidian 左侧 ribbon 的 **消息圆形图标**。
   
   右侧会打开一个停靠面板（Copilot 风格），你可以在里面与 Wiki 对话。答案带 `[[wiki-links]]`，指回你的知识图谱。

![右侧停靠面板中的一条查询 Wiki 答案，每条结论都脚注到它来源的那个 Wiki 页面](assets/readme/readme-07-query-citations.webp)

就这样。插件不改动你的原始笔记——只在 `wiki/` 下新建页面。**摄入** 和 **查询 Wiki** 都固定在左侧 ribbon 上，随时一键可用。（macOS 上是 `Cmd`，Windows/Linux 上是 `Ctrl`。）

### 核心命令

| 命令 | 作用 |
|---------|------|
| **📥 摄入单个源文件** | `Cmd+P/Ctrl+P` → “摄入单个源文件” —— 选一个 Markdown 或 **PDF（v1.25.0+）** 文件，换来实体/概念/Wiki 页面。*另一条路：🖱️ 点左侧 ribbon 的贴纸图标，作用于当前笔记。* |
| **📂 从文件夹摄入** | `Cmd+P/Ctrl+P` → “从文件夹摄入” —— 批量摄入一个文件夹里的全部笔记，含智能批量跳过 |
| **📑 多选文件摄入** | `Cmd+P/Ctrl+P` → “多选文件摄入” —— 用双栏文件树挑一个子集（带实时队列与逐文件取消） |
| **🔍 查询 Wiki** | `Cmd+P/Ctrl+P` → “查询 Wiki” —— 在右侧停靠面板里与 Wiki 对话；答案带 `[[wiki-links]]`。*另一条路：🖱️ 点左侧 ribbon 的消息圆形图标。* |
| **🛠️ 维护 Wiki** | `Cmd+P/Ctrl+P` → “维护 Wiki” —— 完整体检扫描：重复页、断链、空洞页、孤立页、缺失别名、矛盾 |
| **⚡ 一键智能修复** | 在 Lint 弹窗内 —— 按因果关系顺序一键修复，附各阶段报告 |
| **📋 重新生成索引** | `Cmd+P/Ctrl+P` → “重新生成索引” —— 用当前页面与别名重建 `wiki/index.md` |
| **⏹ 取消** | `Cmd+P/Ctrl+P` → “取消当前提取”，或点状态栏 —— 在下一个批次边界干净停下 |
| **📊 摄入历史** | `Cmd+P/Ctrl+P` → “查看摄入历史” —— 可搜索的界面，回看摄入、Lint 报告与维护运行 |

![Obsidian 命令面板里，Karpathy LLM Wiki 的每条命令都归在同一个前缀下](assets/readme/readme-03-commands.webp)

| 之前 | 之后 |
|--------|-------|
| `notes/machine-learning.md`（一个平铺的文件） | `wiki/concepts/supervised-learning.md`，带 `[[双向链接]]`、别名、来源归属，以及 `wiki/index.md` 里的一条索引 |

> 📖 逐步教程在 [GitHub Discussions → 指南](https://github.com/GD4AI/obsidian-llm-wiki/discussions/categories/guides)。觉得有用？[给仓库点个 Star](https://github.com/GD4AI/obsidian-llm-wiki)，跟进后续发布。

---

## ✨ 核心特性

### 📚 知识质量

- **🔍 实体与概念提取** —— LLM 把人物、组织、产品、事件这类实体，以及理论、方法、术语这类概念，提取成独立页面。提取粒度可配置（极简 → 精细，另有自定义），由你在成本与深度之间取舍。
- **🏷️ 强制别名** —— 每个页面至少带一个别名（译名、缩写、变体），跨语言重复检测才成立。
- **🔄 分级重复检测** —— 第 1 级（直接名称匹配：跨语言、缩写、高相似度标题）一律验证；第 2 级（共享链接、中等相似度）填满剩余的 token 预算。
- **🧩 智能合并与矛盾状态** —— 重复页合并时保留别名；矛盾被标记并注明来源；`reviewed: true` 的页面受保护，不会被覆盖。
- **🎨 一套标签词汇表，由你掌握** —— 一个页面能带的标签，来自你笔记里的嵌套标签、wiki 页面已有的标签，以及 设置 → Wiki → 标签词汇表 里的 *自定义* 列表。提示词、写入闸门、Lint 与 retag 读的都是这一份列表，所以模型拿到的就是最终会落盘的内容；列表之外的值被丢弃，绝不写入。小模型仍会漂移（大约十次运行有一次返回模型自己的分类法）——闸门会拦下，Lint 会报告该页面。设计锚点见 [Issue #328](https://github.com/GD4AI/obsidian-llm-wiki/issues/328)。

![一个生成的概念页：写作时用的词汇表标签、它的别名 AF 与 AFib、它的定义，以及与之相关的页面](assets/readme/readme-04-entity-page.webp)

### 📄 文档 / PDF / 图片 摄入

六条接入路径，每次摄入可任选一条：

1. **🧾 内置 MinerU 后端** —— 设置 → Wiki 配置 → Markdown 转换后端 → *MinerU*。PDF、图片（PNG/JPG/WebP/GIF/BMP 等）和 Office 文档（DOC/DOCX/PPT/PPTX/XLS/XLSX）都走 [MinerU 的 Precise 解析器](https://mineru.net/apiManage/docs)。token 存在 SecretStorage 里，约 90 天后过期，所以遇到 401 基本就是 token 过期了，报错会写明去哪个页面续期。上限是每个 PDF 200 MB / 200 页，每个压缩包 256 MB / 10,000 个文件。扫描版论文和版式重要的 Office 文件走这条。
2. **☁️ 原生支持 PDF 的云端提供商** —— Anthropic、OpenAI、Google Gemini 与 AWS Bedrock（Anthropic + OpenAI 变体）开箱就把 PDF 当文件部分读取。除了选提供商，不用额外设置。
3. **🖥️ Apple Silicon 上的本地 OCR** —— [oMLX](https://github.com/jundot/omlx) 内置 Microsoft Markitdown 作为 PDF→Markdown 后端。在 oMLX 中启用 Markitdown，加载 [百度 Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR)（3B / 570M 活跃参数，2026-06 开源）作为视觉模型，把插件指向 oMLX 并当作自定义 OpenAI 兼容提供商，打开 **Force PDF Support**，选 oMLX 正在服务的那个多模态模型。PDF 全程不离开你的机器。
4. **🛠️ 第三方提取器（MinerU 在线界面）** —— 不想接 API token 时，用 [MinerU Extractor 在线服务](https://mineru.net/OpenSourceTools/Extractor) 手动转一次。下载转好的 `.md`，丢进 vault 里 wiki 文件夹之外的任何位置，再当普通 Markdown 笔记摄入。
5. **🔌 Force PDF Support** —— 其他任何接受文件部分的 OpenAI/Anthropic 兼容端点，插件都会试着调用（设置 → LLM 配置 → 高级）。成不成由端点决定，失败会弹本地化的 Notice。
6. **🖼️ Markdown 内嵌图片** —— 在高级设置里打开 *Markdown 摄入时分析内嵌图片*，每一个符合条件的本地 `![[image.png]]` 与 `![alt](image.png)` 嵌入都会被分析。每张图与它最近的 Markdown 段落一起处理，按 20 MiB 的视觉证据包发送，单张上限 10 MiB；远程 URL 一律不下载。想让单图输出可测，可以再启用 *将内嵌图片视觉证据保存到源页*，在生成的源页里加一个可折叠的审计段。

**Office 格式的注意事项：** Obsidian 不原生渲染 `.docx` / `.xlsx` / `.pptx`（[file-formats](https://obsidian.md/help/file-formats)），所以 Office 文件的实用做法是：MinerU 转成 `.md`，插件把这个 `.md` 摄入成 Wiki 页面，原始 Office 文件留着备查。需要内联预览 Office 文件，可以用 Pandoc Plugin / Docxer / Md Importer / Office Reader 这类社区插件。

**所有路径共用的底层机制：**

- **🗄️ 有界缓存** —— `.obsidian/plugins/karpathywiki/pdf-cache/` 按内容哈希 + 模型 + 转换器版本存放转换后的 Markdown；总量 100 MB / 1000 条 / 单条 10 MB 三个上限，按 mtime 做 LRU 淘汰。
- **📝 可选的 vault sidecar** —— 设置 → Wiki 配置 → Wiki 文件夹 → *将 PDF Markdown 写入 Vault* 会在源 PDF 旁写出 `<basename>.pdf.md`（默认关闭——默认只走缓存）。
- **🛡️ 逐字转录提示** —— OCR 风格的转换，带 `[illegible]` / `[figure: ...]` 反幻觉标记；小型本地模型爱套的 markdown 围栏，在写缓存前自动清掉。
- **🔁 源页原句引用（v1.27.0，#496）** —— 每个生成的 `sources/<slug>.md` 页面都带一个 `Mentions in Source` 段，内容取自提取时按实体/概念抓下的原句（也就是模型已经证明自己看见了的原文），于是源文档成为唯一一个能真实回溯到原始文本的 Wiki 页面。

📖 **所有路径的完整配置教程**（云端提供商、oMLX 硬件分级、MinerU 安装、缓存清理）→ [docs/PDF-OCR-GUIDE_CN.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE_CN.md)

### 💬 查询与维护

**检索与回答**

- **🧭 5 级 PPR 级联** —— 见 [检索工作原理](#-检索工作原理)。`[[wiki-link]]` 图上的 Personalized PageRank 给出图感知的多跳上下文。
- **🔤 正文感知的词法打分** —— 快速路径用 BM25F 对标题、别名、摘要**以及正文**打分，页面上最长的那段文字也能进入打分器。这是本项目做过的最大的单次召回改动。
- **🧩 相关页塑形** —— 一个 hub 页不再能把其他所有页面都拽向自己。相关列表每次写入时按存活的名称重算、排序、封顶。
- **🔁 旧版查询打分开关** —— 设置 → 高级设置 → *旧版查询评分器* 改用此前手工调出来的线性排序，而不是新的。默认关闭；新排序是默认值，这个开关是退路。
- **📏 答案预算是 16,000 token，用尽时管线会明说** —— 答案不再在预算处静默停下。上下文在拼装前先按页面预算装填，于是 20 个页面是按计划进提示词的，不是靠运气。
- **🔖 引用按学术格式排** —— 输入框随内容长高，*清空历史* 真的会清掉记录。
- **🪟 右侧停靠面板** —— 查询 Wiki 开在 Copilot 风格的右侧叶面板（v1.22.1+），不再用居中弹窗。

**维护与修复**

- **🔍 Lint 健康扫描** —— 一条命令查出：重复页、断链、空洞页、孤立页、缺失别名、矛盾。它还会列出周边关系已经结晶化的 hub 页——一个枢纽顶替了内容再也连不出的那些连接。
- **⚡ 一键智能修复** —— 按因果关系顺序的一次性修复：补别名 → 合并重复 → 修断链 → 连孤立页 → 扩空洞页，附各阶段报告。
  
  ![Wiki 维护报告——状态行、它查出的断链，以及一遍修完它们的一键智能修复按钮](assets/readme/readme-08-lint-report.webp)
- **🚧 修断链的“放着不管”出口** —— 设置 → 高级设置 → *为无法解析的链接创建占位页*（默认开启）。关掉它，断链会在每份 Lint 报告里一直可见，直到真的有源把它定义出来，而不是变成一个空占位页。#197 定下的“没有源就不扩写”闸门没有变；这个开关只决定占位页到底写不写。
- **📊 操作历史面板** —— 可搜索、可筛选的界面，回看过去的摄入、Lint 报告与维护运行。

**花钱调用之前先过的闸门**

- **🛡️ 摄入前置闸门** —— 空笔记、只有空白、只有 frontmatter 的笔记，在任何 LLM 调用之前就被拒；内容哈希去重会抓住不同路径下的同一个文件。
- **🚦 摄入候选闸门** —— 可选开关（`skipMentionOnlyCandidates`，默认关闭）。只出现在括号里、枚举里或短列表项里的候选，在花掉一次生成和一次去重调用之前被剪掉。它只对有实测画像的语言生效；没有画像的语言不会被静默拦下，跨语言笔记根本不走这道门。
- **🎛️ 按步骤任务策略** —— LLM 高级参数 → 任务策略字段；不改代码就能覆盖单步的文本模式/思考设置。你没列出的步骤保持内置基线。

### 🦙 本地优先

- **🖥️ Ollama、LM Studio、OpenRouter、自定义端点** —— 开箱可用。本地模型够用来查询（上下文窗口小一些）；2000 页 vault 的摄入通常需要长上下文的云端模型。
- **📄 Apple Silicon 上的 PDF OCR 路径完全本地** —— 见上文 [文档 / PDF / 图片 摄入](#-文档--pdf--图片-摄入)。
- **🔐 ChatGPT Plan (Codex OAuth)** —— 桌面端走回环回调，移动端走设备代码；凭据只存在 Obsidian SecretStorage 里。（完整的提供商边界说明见下文 [Anthropic vs OpenAI vs Codex OAuth](#anthropic-vs-openai-vs-codex-oauth--它们是不同的提供商)。）

### 🌐 语言

- **🌍 11 种界面语言** —— English、简体中文、繁體中文、日本語、한국어、Deutsch、Français、Español、Português、Italiano、Русский。界面语言与 Wiki 输出语言相互独立——你的 Wiki 可以是中文，界面是英文。
  
  ![界面语言与 Wiki 输出语言是两个各自独立的设置，所以中文 Wiki 能跑在英文界面后面](assets/readme/readme-06-language-settings.webp)
- **📚 11 种 Wiki 输出语言** —— 同样是这一组；在 设置 → Wiki 配置 里选。另有 *自定义输入* 选项，用于临时提示。
- **所有界面文案按语种翻译** —— 每个标签、弹窗、通知都翻了。加第 12 种语言由贡献者推动（PR #159 的模式）。
- **🔧 按提供商自定义请求头** —— API Base URL 正下方的一个自由文本字段。每行一条 `Name: value`，随每个请求发出。自带 OpenCode 预设，以及给说 `/v1/responses` 的端点的 `(Responses)` 变体。
- **📡 源被挡了，流还能走** —— 跨域请求被拒时，流会改走桌面端的 `node:https` 传输重试，而不是降级成缓冲式回答；回退失败会被记录，不会被吞掉。

### ⚙️ 改变一次运行的设置

插件的大部分行为已经替你定好了。下面这八项会改变它，每一项都是对某个真实失败的回应。

| 设置 | 位置 | 它改变什么 |
|---|---|---|
| **流式摄取请求** | 高级设置 | `auto` 在移动端走流式，`always` 与 `never` 强制选择。流式正是让长摄入不撞上提供商空闲超时的东西。 |
| **思考档位** | LLM 高级参数 | 默认 / 低 / 中 / 高。AI SDK 按提供商翻译档位，不涉及任何手写的提供商字段。 |
| **每次调用的最大输出 Token 数** | LLM 高级参数 | 现在两个方向都能调：推理模型在写答案前就把预算花光时调高，想压成本时调低。留空即向模型要它自己的上限。 |
| **模型上下文窗口** | LLM 高级参数 | 上限不可能再超过窗口，所以小型本地模型不会收到它接受不了的数字。 |
| **LLM 并发度** | LLM Provider | 1–20 个并行调用。调高让大摄入更早跑完；调低让本地模型不超内存。 |
| **提取重点** 与 **Additional Content Rules** | 高级设置 | 写进 `schema/config.md` 的自由文本。它们改变模型提取什么，你不用手改 schema。 |
| **按步骤设置输出模式与思考** | LLM 高级参数 | 只为某一步覆盖文本模式或思考档位——提取、合并、查询——不动其他步骤。 |
| **排除文件** | Obsidian 自带的列表 | 文件夹摄入、文件监视与自动路径都遵守你在 Obsidian 里设的排除项，插件与 Obsidian 对“什么在范围外”口径一致。 |

---

## 🌐 生态

插件与你 Obsidian 里其他工具搭得上——下面每个工具都能接进 `[[wiki-link]]` 图，不用改代码。

- **📄 [MinerU 多格式后端](https://mineru.net/apiManage/docs)（v1.27.0 起内置）** —— 过去要单独跑 CLI/UI 的一步，现在是一个插件开关；完整路径表见 [文档 / PDF / 图片 摄入](#-文档--pdf--图片-摄入)。[MinerU 在线服务](https://mineru.net/OpenSourceTools/Extractor) 仍然留给更想要界面而非 API token 的用户；[自建 MinerU](https://github.com/opendatalab/mineru) 也是一条路。
- **🕸️ Obsidian 图谱视图** —— 在任意 Wiki 页上打开原生图谱；每个 `[[wiki-link]]` 是一个节点，每条反向链接是一条边。内建，零额外体积。
  
  ![生成出来的 Wiki 在 Obsidian 原生图谱视图里的样子——源页、实体页与概念页连成一张图](assets/readme/readme-05-graph-view.webp)
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** —— 官方浏览器扩展。把网页（文章、博客、Reddit 帖、Hacker News、食谱、论文、经 Interpreter 取得的 YouTube 字幕）存进 vault 任意文件夹，再跑插件的「从文件夹摄入」命令，批量抽出实体与概念。
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** —— 用 DQL（`LIST FROM "wiki/entities" WHERE contains(tags, "person")`）或 JS API 把 Wiki 当数据库查。插件在每个页面都写标准 frontmatter（`tags:`、`type:`、`aliases:`），Dataview 查询开箱即用。
- **🌿 Git** —— 用任意 Git 客户端给 vault 做版本管理。插件从不重写你的源文件，只在 `wiki/` 下新建页面，所以 `git diff` 能把你的编辑和 LLM 生成的内容干净分开。
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** —— 靠 Marp frontmatter（`marp: true`）把任意 Obsidian 笔记变成幻灯片。Wiki 页面是纯 Markdown，不用额外转换就能当幻灯片渲染。
- **🖼️ Canvas** —— Obsidian 原生无限画布。把 Wiki 卡片拖到 Canvas 上，不用离开 vault 就能用 `[[wiki-links]]` 拼出学习指南、思维导图或研究综述。

---

## 🔍 检索工作原理

多数“AI 搜索”插件把笔记切块、嵌入到向量数据库里。我们不这么做。[Karpathy 反对 RAG 的论证](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)是：切块破坏了 LLM 在整张知识图谱上推理的能力——这个论证在实践中站得住。我们改为走你写 `[[wiki-links]]` 时就已经在维护的那张图。

### 5 级种子选择级联

当你问“微软是谁创立的？”，查询 Wiki 在生成任何答案之前先跑五个阶段：

1. **Lex 快速路径** —— 对每个实体/概念的标题、别名、摘要**与正文**做 BM25F，带字段饱和与本项目真实文档频率表上的 IDF。免费、即时，也是后面所有阶段的把关者。
2. **LLM 关键词生成** —— LLM 从你的问题里提出 8–12 个跨语言关键词（同义词、缩写、难以靠 token 重叠命中的术语，一次调用全处理）。
3. **本地子串扫描** —— 每个生成的关键词在本地对页面标题、别名与正文片段重新匹配。不再调 LLM；把抗噪声的召回补齐。
4. **LLM 知识库回退** —— lex 加关键词扫描信号太弱时，LLM 拿 top-N 候选对着整个 Wiki 再做一次语义过筛。
5. **PPR 图扩展** —— 从候选种子集出发，在 `[[wiki-link]]` 图上跑 Personalized PageRank（Haveliwala 2002）。图感知的多跳上下文就是这一步给的：“比尔·盖茨” → “微软” → “竞争对手”，而不只是标题字面重合。

级联在第一个信号足够的阶段截断——没有固定的五段成本；lex 够用时一次 LLM 调用都不发；只有 lex 加关键词扫描还不够，才走语义回退。

### 查询扩展，以及一条退路

级联走到图扩展阶段时，查询会先扩展两次再选种子：一次用 Wiki 自己的词，一次用 LLM 提出的词。每一轮都带权重，收益是在本项目自己的 vault 上量出来的，不是假设——在本版本写出的两个 vault 上，扩展在 r@10 上分别值 **+0.086** 与 **+0.113**，两个区间都不含零。这个结论刻意说得很窄：加权形式**并不**比简单拼接可测量地更好，而那个跑旧打分器的开关就在那里，留给结果变差的读者。

设置 → 高级设置 → *旧版查询评分器* 改用此前手工调出来的线性打分器。新排序是默认值；这个开关是退路。

### 规模化运行的 Personalized PageRank

我们用 Monte Carlo PPR（Fogaras 2005）——3,000 次随机游走 × 每次 50 步——加上 Haveliwala 2002 的死端规则。开销是 **O(K × L)**（K = 游走次数，L = 每次游走的步数），与页面数量无关，所以 2000 页的 vault 与 200 页的 vault 扩展延迟相同。

**PPR @5 = 27.1%，纯 kNN 基线 24.1%**，测在一个项目自有 vault 上。语料不公开，所以请把这个数字读成项目给自己量的一次对比，而不是关于你的 vault 的结论；`tools/dev-instrument/run-recall-harness.mjs` 就是对着一个 vault 测召回的测量工具。

### 为什么不用嵌入

我们在 [Issue #175](https://github.com/GD4AI/obsidian-llm-wiki/issues/175) 中有意否掉了嵌入这条路。图信号本来就在——每条 `[[wiki-link]]` 都是一条手工标好的“这两个相关”的边，而我们支持的大多数提供商（Ollama、LM Studio、Anthropic、Bedrock、Kimi、GLM、MiniMax）根本不提供 `/v1/embeddings` 端点。加一个嵌入模型，意味着每页一次下载、每个提供商一个适配器，检索质量却一点不涨。

---

## 🤖 模型推荐

十五个具名提供商，外加任何 OpenAI 或 Anthropic 兼容端点。分级选型表——云端、本地、OCR、量化、硬件——在 [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)，最后核对于 2026-11-06，对照 [models.dev](https://models.dev/)。

- **前沿云端** —— Anthropic、OpenAI、Google Gemini、xAI Grok、Moonshot Kimi、Zhipu GLM、MiniMax。Anthropic、OpenAI 与 Gemini 原生支持 PDF。
- **低价与开放权重** —— DeepSeek、Alibaba Qwen、Step、Tencent Hunyuan、Xiaomi MiMo、Google Gemma。
- **企业** —— AWS Bedrock（Anthropic 与 OpenAI 变体，凭 API key、SSO 或 IAM 认证）与经 Codex OAuth 的 ChatGPT Plan。
- **本地与网关** —— Ollama、LM Studio、OpenRouter、Anthropic 兼容网关。

本插件每次查询都把完整的 Wiki 上下文喂给 LLM，所以 **长上下文模型更占优**。

### 什么更重要

- **🧠 上下文窗口 ≥ 200K token**，适用于超过 ~500 页的 vault。低于 200K，级联可能不得不砍掉靠前的阶段才装得下。
- **⚖️ 指令遵循质量** 对提取任务比原始 IQ 更重要——挑一个能照 schema 模板走的模型，而不是排行榜上最靠前的那一个。
- **🔌 嵌入端点无关** —— 我们不用嵌入。没有 `/v1/embeddings` 的提供商完全没问题（我们 15+ 个提供商里大多数都没有）。
- **🦙 本地适合查询，云端适合摄入** —— 2000 页 vault 的摄入通常需要长上下文的云端模型；262K 的本地模型够覆盖大多数查询。

PDF / 图片 / Office 摄入，见特性章节的 [文档 / PDF / 图片 摄入](#-文档--pdf--图片-摄入)——Anthropic、OpenAI、Bedrock、Gemini 原生把 PDF 当文件部分读；内置 MinerU 后端（v1.27.0+）与 **Force PDF Support** 覆盖其余场景。

### Anthropic vs OpenAI vs Codex OAuth —— 它们是不同的提供商

- **Anthropic**（及其 Bedrock 变体）—— 单独计费的 Anthropic Platform API key。
- **OpenAI** —— 单独计费的 OpenAI Platform API key。
- **ChatGPT Plan (Codex OAuth)** —— 实验性的独立提供商，浏览器或设备代码登录后用符合条件的 Codex 额度；可用性跟随 OpenAI 的 Codex 身份认证与额度政策，不看套餐名字。这是第三方的 Codex 兼容能力，不是 OpenAI 合作，也不是通用的 ChatGPT API。

### AWS Bedrock —— 三种认证模式 (v1.27.0, #425)

设置 → Provider → Bedrock（Anthropic / OpenAI）现在选三种认证模式之一；那一行提供商随后只要该模式真正需要的输入：

- **API key** —— 最初的 Stage-1 bearer 路径；行为与 v1.26.4 逐字节一致，已经买了 Bedrock API key 的用户推荐这一条。
- **SSO** —— IAM Identity Center 设备流。点 *Sign in with AWS SSO*，在浏览器里粘贴验证码，插件通过 SecretStorage 里的 `karpathywiki-bedrock-sso` 收到 SSO token，换成临时角色凭据，再用自写的 SigV4 给每个请求签名（没有引入 AWS SDK）。SSO 身份恰好只暴露一个账户 ID 与一个角色名时自动识别；否则在提供商设置里填。
- **IAM** —— 静态 access key，给没有 SSO 的环境（CI、定时批处理）。存在 SecretStorage 的 `karpathywiki-bedrock-iam` 里；内存缓存按 access-key 记忆，让 SigV4 签名留在有效期内。

三种模式共用同一套 Obsidian SecretStorage 纪律（凭据不进 `data.json`、日志或文档），也共用同一条零 AWS SDK 的自写 OIDC + SigV4 路径。Bedrock region 与认证模式无关，在同一行提供商里配置。

> 📖 **完整选型表**（云端 + 本地 + PDF OCR + Codex OAuth + 量化 + 硬件分级）→ [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

## ❓ 常见问题

### 这个插件到底做什么？

选一篇笔记、一个文件夹或一组文件：LLM 抽出实体与概念，写出一套用 `[[双向链接]]` 互联的 Wiki。提一个问题，答案来自那些页面，并带引用。你的原始笔记永不被修改。

### 我现有的 Wiki 安全吗？

✅ 自 v1.0.0 起向后兼容。在任意页面上设 `reviewed: true` 即可保护它不被覆盖。从 v1.24.x 升级不会重写你的 vault；v1.25.0 的 PDF 摄入默认只走缓存，v1.27.0 加的 PDF + 图片 + Office 摄入也不改变磁盘上的 Wiki 布局。

### 能摄入 PDF、图片和 Office 文档吗？

✅ 可以。Anthropic、OpenAI、Bedrock、Gemini 原生读 PDF；内置 MinerU 后端（v1.27.0）覆盖其余全部场景（PDF + 图片 + Office）。完整教程——云端提供商、Apple Silicon OCR、Force PDF Support、缓存清理——见 [docs/PDF-OCR-GUIDE_CN.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE_CN.md)。

### 我的数据会被发到别处吗？

🚫 没有后端，没有分析——插件完全在 Obsidian 内运行。只有你显式发送用于摄入/查询的文本离开你的设备，且只发给你配置的那个 LLM 提供商。要完全数据本地化，用 Ollama 或 LM Studio。

### 能用我的语言使用吗？

🌍 界面与 Wiki 输出都是 11 种语言，各自独立设置。第 12 种由贡献者推动（PR #159 就是范例）。

### 这和 RAG 聊天机器人有什么不同？

没有切块，没有嵌入，没有向量数据库。Personalized PageRank 跑在你已经维护的 `[[wiki-link]]` 图上，用零嵌入成本换来多跳上下文。

### 该用哪个 LLM？

长上下文模型：超过 ~500 页的 vault 用 ≥200K token。分级表在 [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)。

### 有公开的基准测试吗？

PPR @5 = 27.1%，纯 kNN 基线 24.1%，测在一个项目自有 vault 上——[检索工作原理](#-检索工作原理) 说明了这个数字能证明什么、不能证明什么。

### 怎么控制 API 成本？

批量摄入用粗略或极简提取粒度。智能批量跳过会自动识别已摄入的文件。自动维护默认关闭。Lint 先给计数再跑修复——未经你确认不产生费用。

### 怎么取消正在运行的操作？

点状态栏（显示“提取中... 点击取消”），或 `Cmd+P/Ctrl+P` → “取消当前提取”。会在下一个批次边界干净停下。

### 哪里可以求助？

Bug 报告去 [GitHub Issues](https://github.com/GD4AI/obsidian-llm-wiki/issues) · 提问与功能请求去 [GitHub Discussions](https://github.com/GD4AI/obsidian-llm-wiki/discussions) · 插件日志到开发者控制台（`Ctrl+Shift+I` / `Cmd+Option+I`）查看。

---

## 🔒 隐私

本插件已上架 Obsidian 社区插件市场，并接受针对安全与权限的自动化审核。

- **🚫 没有自己的后端，没有遥测，不收集数据。** 纯本地软件，在 Obsidian 内运行。插件不运营任何服务器，也不向任何地方上报。
- **🔐 网络访问是显式开启的。** 它只用来联系*你*配置的服务：你的 LLM 提供商，以及——如果你打开了 MinerU 文档后端——`mineru.net`。第二个值得单独点名：它把文档上传到一个你没选过的司法辖区，而那里没有公布任何保留声明。[你的文档在哪里被处理](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE_CN.md#-你的文档在哪里被处理) 列出了每条路径以及文件最终去了哪里。
- **📁 Vault 文件访问** 用于 Wiki 管理（读笔记、生成页面、扫描断链、检测重复）。插件永不修改你的源文件。
- **📋 剪贴板访问** 只由查询弹窗里的 “Copy” 按钮使用——且只在你点它时。

要完全数据本地化，用 Ollama 或 LM Studio。用本地提供商时，你的数据从不离开你的机器。

---

## 💖 支持

如果 Karpathy LLM Wiki 已经成为你知识工作流里的一部分：

- ☕ **[在 Ko-fi 上请我喝咖啡](https://ko-fi.com/greenerdalii)** —— 一次性或按月
- 💳 **[通过 PayPal 打赏](https://paypal.me/greenerdalii)** —— 一次性打赏

感谢以下各位对本项目的支持：

[@jameses-cyber](https://github.com/jameses-cyber)、[@issaqua](https://github.com/issaqua)、Dikson Choi

### 参与贡献

Bug 报告和 PR 都有用。[CONTRIBUTING.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CONTRIBUTING.md) 讲了构建、测试循环与一次改动必须过的检查；[CODE_OF_CONDUCT.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CODE_OF_CONDUCT.md) 很短。[ROADMAP.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/ROADMAP.md) 写着计划，[CHANGELOG.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CHANGELOG.md) 记着已发布的内容。

从源码构建：`pnpm install`、`pnpm build:dev`、`pnpm gate:1`——最后一条一次跑完 lint、架构检查、类型检查、构建、测试与 CSS lint。`tools/dev-instrument/` 是 dev-only 的测量工具：它不用 Obsidian 运行时，对着磁盘上的一个文件夹跑真正的 `WikiEngine.ingestSource`，打印每个任务的 token 与实际耗时，变更日志里的性能数字就是从这里来的。面向用户的 CLI 在另一个仓库——`npm i -g karpathywiki-cli`。

---

## 🔭 其他项目

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** —— 同一个 `WikiEngine`，没有渲染层：`npm i -g karpathywiki-cli`，然后 `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`。
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** —— 给 [pi-coding-agent](https://github.com/earendil-works/pi) 用的任务级路由器：一个小判定器把每一轮标成例行还是要紧，选中的档位决定模型、工具与回退链。MIT。→ [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** —— 同一套路由设计，用在 [dsh-coding-agent](https://github.com/earendil-works/dsh) 运行时上。MIT。
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** —— DSH 侧的 Obsidian 插件工作流：搭好工作区，驱动 Red→Green 循环，跑本仓库用的同一套质量闸门，最后留下一个可发布的 `feat/*` 或 `fix/*` 分支。

---

## 📜 许可证与致谢

Apache License, Version 2.0 —— 详见 [LICENSE](../LICENSE)、[NOTICE](../NOTICE) 和 [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md)。

**构建于：**
- 💡 [Andrej Karpathy 的 LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) —— 原始构想
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v7](https://ai-sdk.dev/)（`@ai-sdk/openai`、`@ai-sdk/anthropic`、`@ai-sdk/openai-compatible`）经由 Obsidian `requestUrl`
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) 与 [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) —— 检索算法

**维护者：** [@green-dalii](https://github.com/green-dalii)（作者）· [@DocTpoint](https://github.com/DocTpoint)（2026 年 9 月起共同维护）

[![Star History Chart](https://api.star-history.com/chart?repos=GD4AI/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
