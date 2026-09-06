<!--
SEO metadata (not user-visible, parsed by crawlers / LLMs) — 简体中文本地化版本：
- name: karpathy-llm-wiki-plugin-for-obsidian
- type: 软件 / Obsidian 社区插件 / 知识库生成器 / RAG 替代方案
- license: Apache-2.0
- language: TypeScript
- runtime: Obsidian >= 1.11.4 (桌面端 + 移动端)
- dependencies: 零运行时依赖（Vercel AI SDK v6 已打包）
- obsidian-plugin-id: karpathywiki
- obsidian-marketplace: https://community.obsidian.md/plugins/karpathywiki
- repo: https://github.com/green-dalii/obsidian-llm-wiki
- sister-cli-repo: https://github.com/green-dalii/obsidian-llm-wiki-cli
- docs: README.md + docs/README_<locale>.md（11 种语言）+ docs/MODEL-GUIDE.md + docs/PDF-OCR-GUIDE.md
- first-published: 2025-09 (v0.1.0)
- latest: v1.27.1（PATCH — 确定性相关列表、脚注段落保留守卫、全库链接重定向、流式思维策略、本地日期；46 commits, 3993 tests）
- last-updated: 2026-09-06
- alternate-names: Karpathy LLM Wiki、LLM Wiki Obsidian、Obsidian wiki 插件、基于图谱的 RAG、无嵌入 RAG、Personalized PageRank 检索、Obsidian 第二大脑
- search-intents: "Obsidian 无嵌入 RAG", "Obsidian wiki 插件", "Personalized PageRank Obsidian", "基于图谱的笔记检索", "Karpathy LLM Wiki 实现", "Obsidian 知识库自动生成", "Obsidian 图谱视图 + AI", "Obsidian 第二大脑插件", "Obsidian 笔记链接图 AI", "Obsidian 11 语言插件", "Obsidian 16+ LLM 提供商插件", "无向量数据库 RAG", "Obsidian PDF 摄入 AI", "Obsidian Codex OAuth", "Obsidian Bedrock 插件", "Obsidian Bedrock SSO", "Obsidian MinerU", "Obsidian Word PPT Excel 导入", "Obsidian IAM 凭据"
- features: 基于图谱的检索, Personalized PageRank (Haveliwala 2002), Monte Carlo PPR (Fogaras 2005), 5 级种子选择级联, Tier 1/Tier 2 重复检测, 11 语言界面 + 11 语言 Wiki 输出（独立设置）, 16+ LLM 提供商（Anthropic, OpenAI, Bedrock [API key + SSO/IAM], Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-兼容, Codex OAuth）,MinerU 多格式导入（PDF + 图像 + Office）, PDF 摄入（仅缓存、OCR 路径）, Lint 健康扫描, 一键智能修复, 源页原句引用, 摄入候选门, 按步骤任务策略 UI, Obsidian 图谱视图集成, 零嵌入零向量数据库架构, 本地优先模式
- direct-competitors: nashsu/llm_wiki（Tauri 桌面应用）, SamurAIGPT/llm-wiki-agent（Claude Code 技能）, sdyckjq/llm-wiki-skill（Codex 技能）, atomicstrata/llm-wiki-compiler（Python 管线）
- retrieval-benchmark: PPR @5 = 27.1% vs 纯 kNN 24.1%（项目自有语料，开源 LLM-wiki 领域唯一已发布数字）
- author: green-dalii / Greener-Dalii (https://github.com/green-dalii)
- canonical: https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md
-->

![Karpathy LLM Wiki 插件横幅——由你的 Obsidian 笔记生成的互联 Wiki 页面网络](assets/llm_wiki_banner.webp)

# 🧠 Karpathy LLM Wiki — Obsidian 插件

> 一个 Obsidian 插件，把你的笔记变成互联可查的知识库——[Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 概念，直接集成在你已有的编辑器中。

**Obsidian 官方市场满分评分 • 零嵌入图谱检索 • 原生 11 种语言 • 原生 PDF + 图片 + Office 摄入 • 兼容所有 LLM 提供商 • 本地优先 • 无后端 • GDPR 友好**

![Version](https://img.shields.io/github/v/release/green-dalii/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-16%2B-cyan?style=flat-square) <br>
![Maintenance](https://img.shields.io/badge/maintenance-actively%20maintained-brightgreen?style=flat-square) ![Build Status](https://img.shields.io/github/actions/workflow/status/green-dalii/obsidian-llm-wiki/release.yml?style=flat-square) ![Author](https://img.shields.io/badge/author-Greener--Dalii-blue?style=flat-square) <br>
![GitHub Stars](https://img.shields.io/github/stars/green-dalii/obsidian-llm-wiki?style=flat-square) ![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/green-dalii/obsidian-llm-wiki/actions/workflows/release.yml) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/green-dalii/obsidian-llm-wiki)

[English](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/README.md) | **简体中文** | [繁體中文](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_KO.md) | [Deutsch](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_DE.md) | [Français](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_FR.md) | [Español](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_ES.md) | [Português](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_PT.md) | [Italiano](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_IT.md) | [Русский](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[官网](https://llmwiki.greenerai.top/) | [Obsidian 插件市场](https://community.obsidian.md/plugins/karpathywiki) | [博客](https://llmwiki.greenerai.top/zh/blog/) | [反馈讨论](https://github.com/green-dalii/obsidian-llm-wiki/discussions)

🤔 [为什么使用此插件？](#-为什么使用此插件) | 🚀 [快速开始](#-快速开始) | ✨ [核心特性](#-核心特性) | 🌐 [生态](#-生态) | 🔍 [检索工作原理](#-检索工作原理) | 🤖 [模型推荐](#-模型推荐) | ❓ [常见问题](#-常见问题)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD) ← 如果你觉得项目帮到了你，欢迎请我杯咖啡♥️或为项目点亮🌟↗


---

> **⚡ 更新提醒：** 本项目迭代速度快，会经常进行 Bug 修复、性能提升或新功能、体验优化等。建议经常在 Obsidian 中更新到最新版本（**设置 → 社区插件 → 检查更新**），或开启插件的自动更新功能以确保获得最佳体验。

---

## 🤔 为什么使用此插件？

你写笔记，它们躺在文件夹里。想找出哪些内容互相关联，只能靠回忆早已忘记的线索。

**Karpathy LLM Wiki 的其他开源实现确实存在——但没有一款以一键 Obsidian 插件的形式交付。** 大多数是 CLI 工具、Claude Code 技能或独立桌面应用；本插件直接在 Obsidian 内部运行——图谱视图、ribbon、命令面板一应俱全。

### 竞品对比

| | **Karpathy LLM Wiki**（本插件） | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | sdyckjq / llm-wiki-skill | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|---|
| **交付与安装** | ✅ **5 分钟** — 一键 Obsidian 插件：社区插件市场 → 安装 → 选择 Provider → 摄入 | ❌ 30 分钟以上 — 编译/下载 Tauri 二进制、配置 CLI | ❌ 15 分钟 — 需要 Claude Code 订阅 + 安装技能 | ❌ 10 分钟 — 需要 Claude Code/Codex 订阅 + 配置 | ❌ 30 分钟以上 — pip install + Python SDK + 本地服务 |
| **架构与依赖** | ✅ **零依赖** — 无需向量数据库、无需嵌入模型、无需外部进程（按设计采用 PPR 检索 `[[wiki-link]]` 图谱） | 🟡 自带 Python 运行时 + sigma.js + sqlite；嵌入模型可选，默认关闭 | 🟡 依赖 Claude Code 环境 — 非自包含；无嵌入 | 🟡 需要独立平台运行时；无嵌入 | ❌ 需要 Python + 嵌入模型 + 向量数据库（强制） |
| **国际化（界面 + Wiki 输出）** | ✅ 11 种语言（界面/Wiki 独立设置） | 🟡 2 种（英文/中文） | ❌ 仅英文 | ❌ 仅英文 | ❌ 仅英文 |
| **LLM 提供商** | ✅ 16+（Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, Anthropic-兼容, …） | 🟡 OpenAI 兼容 | 🟡 通过 Claude Code 订阅 | 🟡 通过 Claude Code / Codex 订阅 | 🟡 OpenAI 兼容 |
| **检索与查询管线** | ✅ **5 级级联** — Lex → LLM 关键词 → 子串扫描 → LLM KB 回退 → PPR 扩展（首个充分信号即截断）。Personalized PageRank (Haveliwala 2002) + Monte Carlo (Fogaras 2005) | 🟡 仅 2 跳衰减（4 信号启发式：Adamic-Adar + 2 跳） | ❌ 仅 Louvain 社区检测 | ❌ 仅 k 跳预览（无 LLM 增强） | ❌ BM25 + 语义分块（无图谱） |
| **图谱可视化** | ✅ Obsidian 原生图谱视图（内建，零额外体积） | ❌ 桌面应用中自定义 sigma.js + graphology | 🟡 vis.js graph.html（独立文件） | ❌ 自定义 sigma.js 离线 HTML | ❌ 只读浏览器查看器 |
| **Wiki 诚实度** | ✅ 当没有 Wiki 源匹配查询时显示"阶段回退"提示 | ❌ 无等效功能 | ❌ 无等效功能 | ❌ 无等效功能 | ❌ 无等效功能 |
| **已发布检索基准** | ✅ PPR @5 = 27.1% vs 纯 knn 基线 24.1%（该领域唯一公开基准） | ❌ 58% → 71% *仅在启用嵌入时*，非同类对比 | ❌ 未公开 | ❌ 未公开 | ❌ 未公开 |

### 三个有意的设计选择

- **🪟 Obsidian 就是运行环境。** 不需要终端、不需要独立应用、不需要 Docker、不需要 Python。从社区插件市场安装，点击摄入，Wiki 从第一秒就存在于你的 vault 中。Obsidian 原生图谱视图渲染你的 `[[wiki-link]]` 图——内建，零额外体积。
- **🧭 干净、自包含。** 零依赖。没有嵌入模型、没有向量数据库、没有 pip 包——一个插件读取你的笔记，与 LLM 对话，写出 Wiki 页面。一切都在 Obsidian 内部运行。
- **🔌 任何你已付费的模型。** Anthropic、Bedrock、OpenAI、ChatGPT Plan (Codex OAuth)、Gemini、DeepSeek、Qwen、Grok、Kimi、GLM、MiniMax、Step、Hunyuan、MiMo、Gemma、LM Studio、Ollama、OpenRouter、Anthropic 兼容、自定义端点——十六个以上提供商，没有一个需要嵌入端点。

---

## 🎯 适合我吗？

**✅ 适合，如果你：**

- **想要 5 分钟的上手时间，而非 5 小时的项目。** 从社区插件市场安装 → 选择 Provider → 摄入一篇笔记。没有 CLI、没有 Python、没有独立运行时、没有向量数据库。几秒内就能在 `wiki/` 中看到 Wiki 页面。
- **想要干净、自包含的解决方案。** 插件有零个外部依赖：没有嵌入模型、没有向量数据库、没有 pip 包、没有 Docker 容器。它是一个单一的 Obsidian 插件，读取你的笔记、与 LLM 对话、将 Wiki 页面写入你的 vault。一切都在 Obsidian 内部运行。
- **想要一个基于*你的笔记*回答的可查询聊天**——而非互联网——每个答案都带有 `[[wiki-links]]` 回到你的知识图谱。
- **关心数据主权**——使用 Ollama 或 LM Studio 完全本地运行，永不触网。
- **使用或阅读 11 种支持语言中的任何一种**——界面和 Wiki 输出语言相互独立（你的 Wiki 可以是中文而界面是英文）。
- **通过写 `[[wiki-links]]` 来维护图谱**——你写的每个链接已经在丰富检索；无需单独的标签/嵌入/索引步骤。
- **想要一键维护**——Lint 健康扫描 + 一键智能修复自动处理重复、断链和孤立页，无需手动整理。

**❌ 不适合，如果你：**

- **想要一个通用 ChatGPT 替代品**——本插件只从 vault 中回答，不连互联网。
- **需要对大型外部语料库（Confluence、Notion、arXiv、抓取的网页）做 RAG**——插件摄入你的 vault 加独立的 PDF / Office 文件；批量外部语料库 RAG 超出设计范围。
- **在寻找带团队协作的托管 SaaS**——没有后端、没有服务器、没有共享状态；一切都在你的 Obsidian 本地运行。

---

## 🚀 快速开始

1. **安装。** Obsidian → 设置 → 第三方插件 → 社区插件 → 浏览 → 搜索 "Karpathy LLM Wiki" → 安装 → 启用。或访问 [社区插件页面](https://community.obsidian.md/plugins/karpathywiki) 点击 **Add to Obsidian**。
2. **配置 Provider。** 打开 设置 → Karpathy LLM Wiki → 选择 Provider（OpenAI、Anthropic、Ollama、ChatGPT Plan (Codex OAuth) 等）→ 输入 API Key（本地模型不需要）→ 点击 **测试连接** → 保存。
3. **摄入一篇笔记。** 两种方式：
   - **⌨️ 键盘：** `Cmd+P/Ctrl+P` → 「摄入单个源文件」 → 选择任意 Markdown（或 PDF，v1.25.0+）文件。
   - **🖱️ 工具栏图标：** 点击 Obsidian 左侧 ribbon 中的 **贴纸图标**，即可一键摄入当前打开的笔记——无需翻菜单。
   
   几秒内你的首批 Wiki 页面就出现在 `wiki/sources/`、`wiki/entities/`、`wiki/concepts/` 中。
4. **查询你的 Wiki。** 两种方式：
   - **⌨️ 键盘：** `Cmd+P/Ctrl+P` → 「查询 Wiki」。
   - **🖱️ 工具栏图标：** 点击 Obsidian 左侧 ribbon 中的 **消息圆形图标**。
   
   一个右侧停靠的侧边面板（类 Copilot 风格）会打开，你可以在其中与 Wiki 对话。答案带 `[[wiki-links]]` 回链到你的知识图谱。

![Obsidian 中右侧停靠的查询 Wiki 面板，聊天式界面，答案带 wiki-link 回链到你的知识图谱](/docs/assets/query-side-panel.png)

仅此而已。插件不会修改你的原始笔记——只在 `wiki/` 下创建新页面。**摄入** 和 **查询 Wiki** 都已固定在左侧 ribbon 上，可随时一键访问。（macOS 上使用 `Cmd`，Windows/Linux 上使用 `Ctrl`。）

### 核心命令

| 命令 | 功能 |
|------|------|
| **📥 摄入单个源文件** | `Cmd+P/Ctrl+P` → "摄入单个源文件" — 选择 Markdown 或 **PDF (v1.25.0+)** 文件，生成实体/概念/Wiki 页面。*也可：🖱️ 在当前笔记上点击左侧 ribbon 贴纸图标。* |
| **📂 从文件夹摄入** | `Cmd+P/Ctrl+P` → "从文件夹摄入" — 批量处理文件夹中所有笔记，含智能批量跳过 |
| **📑 多选文件摄入** | `Cmd+P/Ctrl+P` → "多选文件摄入" — 通过双栏文件树选择子集（带实时队列 + 按文件取消）|
| **🔍 查询 Wiki** | `Cmd+P/Ctrl+P` → "查询 Wiki" — 在右侧停靠面板中与 Wiki 对话；答案带有 `[[wiki-links]]`。*也可：🖱️ 点击左侧 ribbon 消息圆形图标。* |
| **🛠️ Lint Wiki** | `Cmd+P/Ctrl+P` → "Lint Wiki" — 全面健康扫描：重复页、断链、空洞页、孤立页、缺失别名、矛盾 |
| **⚡ 一键智能修复** | 在 Lint 弹窗内 — 按因果关系顺序修复，含各阶段执行报告 |
| **📋 重新生成索引** | `Cmd+P/Ctrl+P` → "重新生成索引" — 用当前页面和别名重建 `wiki/index.md` |
| **⏹ 取消** | `Cmd+P/Ctrl+P` → "取消当前摄入" 或点击状态栏 — 在下一个批次边界干净停止 |
| **📊 摄入历史** | `Cmd+P/Ctrl+P` → "查看摄入历史" — 可搜索的 UI，浏览历史摄入、Lint 报告和维护运行 |

![命令面板 — 所有 LLM Wiki 命令都在 Obsidian 的命令面板中](/docs/assets/command-panel.png)

**从一篇笔记到互联 Wiki：**

| 之前 | 之后 |
|------|------|
| `notes/machine-learning.md`（一个扁平文件） | `wiki/concepts/supervised-learning.md` 带 `[[双向链接]]`、别名、来源归属，以及 `wiki/index.md` 中的索引条目 |

> 📖 详细教程（安装、PDF 配置、多 Provider 说明、升级指南）见 [GitHub Discussions → 指南](https://github.com/green-dalii/obsidian-llm-wiki/discussions/categories/guides)。觉得好用？欢迎 [点亮 Star](https://github.com/green-dalii/obsidian-llm-wiki) 以便跟进后续发布。

---

## ✨ 核心特性

### 📚 知识质量

- **🔍 实体与概念提取** — LLM 从笔记中提取实体（人物、组织、产品、事件）和概念（理论、方法、术语），生成独立页面。提取粒度可配置（极简 → 精细，外加自定义），让你在成本与深度之间取舍。
- **🏷️ 强制别名** — 每个页面至少包含一个别名（翻译、缩写、变体名），使跨语言重复检测得以工作。
- **🔄 分级重复检测** — 第 1 级（直接名称匹配：跨语言、缩写、高相似度标题）全部验证；第 2 级（共享链接、中等相似度）填充剩余 token 预算。
- **🧩 智能合并与矛盾状态** — 重复页面合并时保留别名；矛盾被标记并注明来源归属；`reviewed: true` 的页面受保护不被覆盖。
- **🎨 自定义标签词汇表** — 在设置 → Wiki → 标签词汇表 → *自定义* 中定义自己的实体类型与概念类型标签列表。词表是注入 LLM 的提示（schema injection hint），而非写入时的强制闸门——小型/本地模型仍可能漂移（约十次中有一次返回模型内置分类）。Lint 会把其余问题暴露出来。Schema 强校验的设计锚点见 [Issue #328](https://github.com/green-dalii/obsidian-llm-wiki/issues/328)。

### 📄 文档 / PDF / 图片 摄入

五种导入入口，每次摄入可选其一：

1. **🆕 内置 MinerU 后端 (v1.27.0, #404)** — 设置 → Wiki 配置 → Markdown 转换后端 → *MinerU*。经 [MinerU 的 Precise 解析器](https://mineru.net/apiManage/docs) 处理 PDF、图片（PNG/JPG/JPEG/JP2/WebP/GIF/BMP）与 Office 文档（DOC/DOCX/PPT/PPTX/XLS/XLSX）。API token 存于 Obsidian SecretStorage。是科学论文、扫描文档、需要保留版式的 Office 文件的最佳路径。服务器限制：每个 PDF 200 MB / 200 页，每个压缩包 256 MB / 10,000 文件。
2. **☁️ 云端 Provider 原生 PDF** — Anthropic、OpenAI、Google Gemini 与 AWS Bedrock（Anthropic + OpenAI 变体）开箱即用地将 PDF 作为文件部分读取。选定 Provider 即可，无需额外设置。
3. **🖥️ Apple Silicon 本地 OCR** — [oMLX](https://github.com/jundot/omlx) 内置 Microsoft Markitdown 作为 PDF→Markdown 后端。在 oMLX 中启用 Markitdown，加载 [百度 Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR)（3B / 570M 活跃参数，2026-06 开源）作为视觉模型，将插件指向 oMLX 作为自定义 OpenAI 兼容 Provider，开启 **Force PDF Support**，选择 oMLX 服务的多模态模型。PDF 全程不离开你的机器。
4. **🛠️ 第三方提取器（MinerU 在线 UI）** — 不想接入 API token 时，用 [MinerU Extractor 在线服务](https://mineru.net/OpenSourceTools/Extractor) 做快速手动转换。下载转换好的 `.md`，放到 wiki 文件夹之外的 vault 任意位置，再作为普通 Markdown 笔记摄入。
5. **🔌 Force PDF Support** — 对任何其他接受文件部分的 OpenAI/Anthropic 兼容端点，插件都会尝试调用（设置 → LLM 配置 → 高级）。端点决定成败，失败会显示本地化的 Notice。

**Office 格式的注意事项：** Obsidian 不原生渲染 `.docx` / `.xlsx` / `.pptx`（[file-formats](https://obsidian.md/help/file-formats)），因此 Office 文件的实用工作流是：MinerU 转成 `.md` → 插件把 `.md` 摄取为 wiki 页面，原始 Office 文件留作参考。如需内联预览 Office 文件，使用社区插件 **Pandoc Plugin**、**Docxer**、**Md Importer** 或 **Office Reader**。

**所有路径共享的底层机制：**

- **🗄️ 有界缓存** — `.obsidian/plugins/karpathywiki/pdf-cache/` 按内容哈希 + 模型 + 转换器版本存储转换后的 Markdown。三层防御：总计 100 MB / 1000 条 / 单条 10 MB 上限，LRU-by-mtime 淘汰。
- **📝 可选 vault sidecar** — 设置 → Wiki 配置 → Wiki 文件夹 → *将 PDF Markdown 写入 Vault* 在源 PDF 旁写入 `<basename>.pdf.md`（默认关闭——仅缓存模式）。
- **🛡️ 逐字转录提示** — 带 `[illegible]` / `[figure: ...]` 反幻觉标记的 OCR 风格转换；小型本地模型的 markdown 围栏包裹在写入缓存前自动清洗。
- **🔁 源页原句引用 (v1.27.0, #496)** — 每个生成的 `sources/<slug>.md` 页面现在携带一个 `Mentions in Source` 段，由提取阶段在每个实体/概念上抓取的原句引用直接拼接（模型已证明自己能看到的原文），因此源文档成了唯一一个能真实回溯到原始文本的 Wiki 页面。

📖 **所有路径的完整设置教程**（云端 Provider、oMLX 硬件等级、MinerU 安装、缓存管理）→ [docs/PDF-OCR-GUIDE_CN.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE_CN.md)

### 💬 查询与维护

- **🧭 5 级 PPR 级联** — 见 [检索工作原理](#-检索工作原理)。`[[wiki-link]]` 图上的 Personalized PageRank 提供图感知的多跳上下文。
- **🪟 右侧停靠侧边栏** — 查询 Wiki 在 Copilot 风格的右侧侧边栏（v1.22.1+）中打开，而非居中弹窗。
- **🔍 Lint 健康扫描** — 一条命令检测：重复页、断链、空洞页、孤立页、缺失别名、矛盾。
- **⚡ 一键智能修复** — 按因果关系顺序修复：补全别名 → 合并重复 → 修复断链 → 链接孤立页 → 扩充空洞页，附带各阶段报告。
- **🆕 Fix Dead Links leave-it 结果 (v1.27.0, #485)** — 设置 → 高级 → *Create Stubs for Unresolvable Links*（默认开启）允许你选择退出空占位页：关闭后，断链会在每次 Lint 报告中保持可见，直到真正有源定义它，摄入则通过正常通道创建页面。#197 中的 never-LLM-expand 门未变 —— 新控件只决定占位页是否会被*写出*。
- **📊 操作历史面板** — 可搜索、可筛选的 UI，查看历史摄入、Lint 报告和维护运行。
- **🛡️ 摄入前置检查** — 空/空白/仅 frontmatter 的笔记在任何 LLM 调用前被拒绝；内容哈希去重捕获跨路径的相同文件。
- **🆕 摄入候选门 (v1.27.0, #514 / PR #521)** — 可选开关（`skipMentionOnlyCandidates`，默认关闭，设置 → 高级）。对于语言已建立测量画像的源（de 已测量；en/fr/es/pt/nl/ko 用固定边界条件估计；zh/ja 字符脚本阈值未测量），那些只出现在括号/枚举/短列表项中的候选在消耗页面+去重+生成调用之前被剪除。跨语言笔记不进入此门；没有画像的 Wiki 语言每次摄入只报告一次且从不静默跳过。
- **🆕 按步骤任务策略 (v1.27.0, #525 / #490)** — LLM 高级 → 任务策略字段；无需改代码即可覆盖各步骤的文本模式与思考设置。未列出的步骤保持内置基线不变。

### 🔒 隐私

- **🚫 无后端、无追踪、无分析。** 完全在 Obsidian 内部运行。网络仅用于与你配置的 LLM 提供商通信。
- **📁 源文件只读。** 插件永不修改你的原始 vault 笔记——仅在 `wiki/` 下创建新页面。
- **🦙 完全本地模式。** Ollama、LM Studio 或任何本地 OpenAI 兼容端点——你的笔记永不离开你的机器。
- **🔐 最小化权限。** Vault 文件访问用于 Wiki 管理。剪贴板访问仅在你在查询弹窗中点击"复制"按钮时。

### 🦙 本地优先

- **🖥️ Ollama、LM Studio、OpenRouter、自定义端点** — 开箱即用。本地模型可用于查询（上下文窗口较小）；2000 页 vault 的摄入通常需要长上下文云端模型。
- **📄 Apple Silicon 上 PDF OCR 路径完全本地** — 见上方的 [文档 / PDF / 图片 摄入](#-文档--pdf--图片-摄入)。
- **🔐 ChatGPT Plan (Codex OAuth)** — 桌面端回环回调或移动端设备代码；凭据仅存在于 Obsidian SecretStorage 中。（完整 Provider 边界说明见下方的 [Anthropic vs OpenAI vs Codex OAuth](#-anthropic-vs-openai-vs-codex-oauth--它们是不同的-provider)。）

### 🌐 语言

- **🌍 11 种界面语言** — English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano, Русский。界面和 Wiki 输出语言相互独立——你的 Wiki 可以是中文而界面是英文。
- **📚 11 种 Wiki 输出语言** — 同一集合；在设置 → Wiki 配置中选择。*自定义输入* 选项用于临时提示。
- **📝 UI 字符串全部按语种本地化** — 每个标签、弹窗与通知。添加第 12 种语言由贡献者驱动（PR #159 模式）。

---

## 🌐 生态

本插件与你的其他 Obsidian 工具无缝协作——以下工具皆可直接对接 `[[wiki-link]]` 图谱，无需任何代码改动。

- **📄 [MinerU 多格式后端](https://mineru.net/apiManage/docs)（v1.27.0 起内置）** —— 原本独立的 CLI/UI 步骤现在只需一个插件开关即可完成；完整路径表见 [文档 / PDF / 图片 摄入](#-文档--pdf--图片-摄入)。[MinerU 在线服务](https://mineru.net/OpenSourceTools/Extractor) 仍为偏好图形界面而非 API token 的用户提供备选；[自部署 MinerU](https://github.com/opendatalab/mineru) 也是可选方案。
- **🕸️ Obsidian 原生关系图谱** —— 在任意 Wiki 页面上打开原生图谱视图；每个 `[[wiki-link]]` 成为节点，每条反向链接成为边。内置功能，零额外体积。
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** —— 官方浏览器扩展。将网页（文章、博客、Reddit 帖子、Hacker News、食谱、研究论文、YouTube 字幕（通过 Interpreter 提取））保存到 vault 内任意文件夹，然后运行插件的「从文件夹摄入」命令批量提取实体与概念。
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** —— 用 DQL（`LIST FROM "wiki/entities" WHERE contains(tags, "person")`）或 JS API 像查询数据库一样检索 Wiki。插件在每个页面写入标准 frontmatter（`tags:`、`type:`、`aliases:`），Dataview 查询开箱即用。
- **🌿 Git** —— 用任意 Git 客户端对 vault 进行版本控制。插件永不重写源文件，仅在 `wiki/` 下创建新页面，因此 `git diff` 能清晰区分你的手动编辑与 LLM 生成内容。
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** —— 通过 Marp frontmatter（`marp: true`）将任意 Obsidian 笔记转为幻灯片。Wiki 页面是纯 Markdown，可直接渲染为幻灯片，无需额外转换。
- **🖼️ Canvas** —— Obsidian 原生无限画布。把 Wiki 卡片拖到 Canvas 上，无需离开 vault 即可拼装学习指南、思维导图或研究概览，所有内容均通过 `[[wiki-links]]` 互联。
- **🎤 [Obsidian Nous](https://github.com/AndyMDH/obsidian-nous)** —— 本地语音备忘录与会议录制（macOS 上使用 whisper.cpp，音频数据不出本机）的配套插件。生成带说话人标记的转录文件与自有 wiki 中心页面。与本插件相互独立——可在同一 vault 共存而无需耦合。

---

## 🧰 无头 CLI

**大多数用户可以跳过本节。** 插件的面向用户的 CLI 位于独立仓库 [green-dalii/obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli) ——以 npm 包 `karpathywiki-cli` 形式发布。安装：`npm i -g karpathywiki-cli`，运行 `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`。

本仓库内 [`tools/dev-instrument/`](https://github.com/green-dalii/obsidian-llm-wiki/tree/main/tools/dev-instrument) 装的是 **dev-only 无头测量工具** —— 面向引擎贡献者，跑真正的 `WikiEngine.ingestSource`，无 Obsidian 运行时，输出每任务的 token + wall-clock 统计——正是 `CLAUDE.md` 和发布说明中性能证据的同源数据。入口命令、env 变量、测量模式、退出码规范详见 [`tools/dev-instrument/README.md`](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/tools/dev-instrument/README.md)。

---

## 🔍 检索工作原理

大多数"AI 搜索"插件将你的笔记分块并嵌入到向量数据库中。我们不这样做。[Karpathy 反对 RAG 的理由](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)是分块破坏了 LLM 在完整知识图谱上的推理能力——这个论点在实践中成立。相反，我们遍历你通过写 `[[wiki-links]]` 已经维护的图谱。

### 5 级种子选择级联

当你在问"谁创立了微软？"时，查询 Wiki 在任何答案生成之前运行五个阶段：

1. **Lex 快速路径** — 直接对每个实体/概念的标题和别名做 token 重叠匹配。免费、即时，也是后续所有阶段的把关者。
2. **LLM 关键词生成** — LLM 从你的查询中提出 8–12 个跨语言关键词（在一次 LLM 调用中处理同义词、缩写和 token 重叠不敏感的术语）。
3. **本地子串扫描** — 每个生成的关键词在本地对页面标题、别名和正文片段重新匹配。无需额外 LLM 调用；补足噪声容忍的召回。
4. **LLM KB 回退** — 当 lex + 关键词扫描返回的信号不足时，LLM 对 top-N 候选重新针对完整 Wiki 做一次语义筛选。
5. **PPR 图扩展** — 在 `[[wiki-link]]` 图上从候选种子集运行 Personalized PageRank（Haveliwala 2002）。这是实现图感知多跳上下文的关键："比尔·盖茨" → "微软" → "竞争对手"，而不只是字面标题重叠。

级联在任一阶段返回足够信号时截断——没有固定的 5 阶段开销，lex 足够时无需 LLM 调用；只有当 lex + 关键词扫描仍不够时，才会启动语义回退。

### 规模化的 Personalized PageRank

我们使用 Monte Carlo PPR（Fogaras 2005）——3,000 次随机游走 × 每次 50 步——配合 Haveliwala 2002 的死端规则。开销为 **O(K × L)**（K = 游走次数，L = 每次游走的步数），与页面数量无关，因此 2000 页 vault 的扩展延迟与 200 页 vault 相同。

**PPR @5 = 27.1% vs 纯 knn 基线 24.1%** —— 基于项目自有基准语料（该开源 LLM-Wiki 领域唯一已发布的检索基准）。

### 为什么不需要嵌入

我们在 [Issue #175](https://github.com/green-dalii/obsidian-llm-wiki/issues/175) 中有意拒绝了嵌入路径。图谱信号已经在那里——每个 `[[wiki-link]]` 都是一条手动 curated 的"这些内容相关"边，而我们支持的大多数 Provider（Ollama、LM Studio、Anthropic、Bedrock、Kimi、GLM、MiniMax）根本没有 `/v1/embeddings` 端点。添加嵌入模型意味着每个页面一次下载、每个 Provider 一个适配器，而对检索质量没有任何提升。

---

## 🤖 模型推荐

**支持的 Provider（16+，基于 2026-07 来自 models.dev 的交叉核对）：**

| Provider | 系列 | 备注 |
|----------|------|------|
| **Anthropic** | Claude 5 系列 | 原生 PDF；`/v1/messages` 协议 |
| **OpenAI** | GPT-5.6 系列（Sol / Terra / Luna） | 原生 PDF；Platform API Key |
| **Google Gemini** | Gemini 3.6 系列 | 原生 PDF（自 1.5 开始支持文件部分）；OpenAI 兼容端点 |
| **DeepSeek** | DeepSeek V4 系列 | OpenAI 兼容；最低成本档 |
| **Alibaba Qwen** | Qwen3.7/3.8 系列 | OpenAI 兼容（DashScope）|
| **xAI Grok** | Grok 4 系列 | OpenAI 兼容；长上下文 |
| **Moonshot Kimi** | Kimi K3 系列 | OpenAI 兼容；2.8T MoE 前沿 |
| **Zhipu GLM** | GLM-5 系列 | OpenAI 兼容；双语言能力强 |
| **MiniMax** | MiniMax M3 系列 | OpenAI 兼容；1M 上下文 |
| **Step（阶跃星辰）** | Step 3 系列（Flash） | OpenAI 兼容；快速推理 |
| **Tencent Hunyuan** | Hy3 系列 | OpenAI 兼容；开放权重 MoE |
| **Xiaomi MiMo** | MiMo V2.5 系列 | MIT 开源；统一低价 |
| **Google Gemma** | Gemma 4 系列 | 开放权重；262K 上下文 |
| **AWS Bedrock** | Anthropic + OpenAI 变种 | VPC / 合规路径；**API key + SSO + IAM** (v1.27.0, #425) |
| **ChatGPT Plan (Codex OAuth)** | Codex Responses API | 浏览器/设备代码登录；SecretStorage |
| **本地：Ollama, LM Studio, OpenRouter, Anthropic 兼容** | 任何 OpenAI/Anthropic 协议模型 | 自定义 OpenAI 兼容 + Anthropic 兼容（Token Plan / Coding Plan）|

本插件每次查询向 LLM 提供完整的 Wiki 上下文——因此 **长上下文模型胜出**。完整的分级表格（云端 + 本地）见 [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)，来自 [models.dev](https://models.dev/) 交叉核对以确保推荐持续有效。

### 什么更重要

- **🧠 上下文窗口 ≥ 200K tokens**，对于超过 ~500 页的 vault。低于 200K 时，级联可能截断较早阶段以适配。
- **⚖️ 指令遵循质量** 对提取任务比原始 IQ 更重要——选择一个能遵循 Schema 模板的模型，而非排行榜上最大的数字。
- **🔌 嵌入端点无关紧要**——我们不使用嵌入。缺乏 `/v1/embeddings` 的 Provider 完全没问题（我们 16+ 个 Provider 中大部分都不提供）。
- **🦙 本地用于查询，云端用于摄入**——2000 页 vault 的摄入通常需要长上下文云端模型；262K 的本地模型覆盖大部分查询。

关于 PDF / 图片 / Office 摄入，参见特性章节 [文档 / PDF / 图片 摄入](#-文档--pdf--图片-摄入) —— Anthropic、OpenAI、Bedrock、Gemini 原生将 PDF 作为文件部分读取；内置 MinerU 后端（v1.27.0+）与 **Force PDF Support** 覆盖其余全部场景。

### Anthropic vs OpenAI vs Codex OAuth —— 它们是不同的 Provider

- **Anthropic**（及其 Bedrock 变种）—— 单独计费的 Anthropic Platform API Key。
- **OpenAI** —— 单独计费的 OpenAI Platform API Key。
- **ChatGPT Plan (Codex OAuth)** —— 实验性、独立的 Provider，在浏览器或设备代码登录后使用符合条件的 Codex 额度；可用性遵循 OpenAI Codex 身份验证和额度政策，而非计划名称。第三方 Codex 兼容功能，非 OpenAI 合作项目或通用 ChatGPT API。

### AWS Bedrock —— 三种认证模式 (v1.27.0, #425)

设置 → Provider → Bedrock（Anthropic / OpenAI）现在可在三种认证模式中选择其一；Provider 行随后只要求该模式真正需要的输入：

- **API key** —— 原始的 Stage-1 bearer 路径；行为与 v1.26.4 逐字节一致，是已购买 Bedrock API key 的用户的推荐选项。
- **SSO** —— IAM Identity Center 设备流。点击 *Sign in with AWS SSO*，在浏览器中粘贴验证 URL 码，插件通过 SecretStorage 中的 `karpathywiki-bedrock-sso` 接收 SSO token，交换为临时角色凭据，并用手写的 SigV4（不引入 AWS SDK）为每个请求签名。当 SSO 身份恰好暴露一个账户 ID 与角色名时会被自动检测；否则在 Provider 设置中手动输入。
- **IAM** —— 静态 access key，用于没有 SSO 的环境（CI、定时批处理任务）。存储在 SecretStorage 中的 `karpathywiki-bedrock-iam`；内存缓存按 access-key 记忆结果以使 SigV4 签名保持在过期之内。

三种模式共享同一套 Obsidian SecretStorage 规范（凭据不出现在 `data.json`、日志或文档中）以及同一套零 AWS SDK 的手写 OIDC + SigV4 路径。Bedrock region 与认证模式相互独立，在同一 Provider 行配置。

> 📖 **完整选择表格**（云端 + 本地 + PDF OCR + Codex OAuth + 量化 + 硬件等级）→ [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

---

## ❓ 常见问题

### 这个插件到底能做什么？

选择任意笔记、文件夹或文件组；LLM 提取实体和概念，生成带有 `[[双向链接]]` 的互联 Wiki。提问时获得基于*你的*笔记的对话式回答，而非互联网。你的原始 vault 笔记永不修改。

### 如何开始使用？

从 Obsidian 社区插件市场安装 → 选择 Provider → **测试连接** → 在任意笔记上运行 **摄入单个源文件**。首条 Wiki 页面在几秒内出现。见 [快速开始](#-快速开始)。

### 能摄入 PDF、图片和 Office 文档吗？

✅ 可以。Anthropic、OpenAI、Bedrock、Gemini 原生支持 PDF；内置 MinerU 后端（v1.27.0）覆盖其余全部场景（PDF + 图片 + Office）。完整教程——云端 Provider、Apple Silicon OCR、Force PDF Support、缓存管理——见 [docs/PDF-OCR-GUIDE_CN.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE_CN.md)。

### 我现有的 Wiki 安全吗？

✅ 自 v1.0.0 向后兼容。在任何页面设置 `reviewed: true` 以保护不被覆盖。从 v1.24.x 升级不会重写你的 vault；v1.25.0 的 PDF 摄入默认仅缓存，v1.27.0 新增的 PDF + 图片 + Office 摄入也不会改变磁盘上的 Wiki 布局。

### 我的数据会被发送给第三方吗？

🚫 无后端、无分析——插件完全在 Obsidian 内部运行。只有你明确发送用于摄入/查询的文本离开你的设备，且仅发往你配置的 LLM 提供商。如需完全数据本地化，使用 Ollama 或 LM Studio。

### 能用我的语言使用吗？

🌍 界面和 Wiki 输出均为 11 种语言。界面语言和 Wiki 语言相互独立。添加第 12 种语言由贡献者驱动（PR #159 模式）。

### 这和 RAG 聊天机器人有何不同？

🚫 无分块。🚫 无嵌入。🚫 无向量数据库。✅ 在你现有的 `[[wiki-link]]` 图上运行 Personalized PageRank——图感知的多跳上下文、零嵌入成本、完全本地模型支持。

### 该选哪个 LLM？

长上下文模型（≥200K tokens）效果最佳。[模型推荐](#-模型推荐) 一节涵盖了原则；完整分级表格见 [docs/MODEL-GUIDE.md](https://github.com/green-dalii/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)。

### 有公开的基准测试吗？

有——PPR @5 = 27.1% vs 纯 knn 基线 24.1%，基于项目自有语料。完整的管线及基准脚本在 [检索工作原理](#-检索工作原理) 中描述。

### 如何控制 API 成本？

使用粗略或极简提取粒度进行批量摄入。智能批量跳过自动检测已处理文件。自动维护默认关闭。Lint 在运行修复前显示计数——不经你确认不产生费用。

### 如何取消正在运行的操作？

点击状态栏（显示"摄入中… 点击取消"）或 `Cmd+P/Ctrl+P` → "取消当前摄入"。在下一个批次边界干净停止。

### 哪里可以获得帮助？

[GitHub Issues](https://github.com/green-dalii/obsidian-llm-wiki/issues) 提交 Bug · [GitHub Discussions](https://github.com/green-dalii/obsidian-llm-wiki/discussions) 提问与反馈 · 开发者控制台（`Ctrl+Shift+I` / `Cmd+Option+I`）查看插件日志。

---

## 🔒 隐私

本插件已上架 Obsidian 社区插件市场，并接受安全与权限的自动化审核。

- **🚫 无后端、无服务器、无数据收集。** 纯本地软件，运行于 Obsidian 内部。插件不能也不会以任何方式收集、存储或传输你的数据到任何服务器——因为这样的服务器根本不存在。
- **🔐 网络访问是自愿的。** 仅用于与你配置的 LLM 提供商通信。你选择提供商、你输入 API Key、你决定数据去向。
- **📁 Vault 文件访问** 用于 Wiki 管理（阅读笔记、生成页面、扫描死链、检测重复）。插件永不修改你的源文件。
- **📋 剪贴板访问** 仅用于查询弹窗中的"复制"按钮——且仅在你点击时使用。

如需完全数据本地化，使用 Ollama 或 LM Studio。使用本地 Provider 时，你的数据永不离开你的机器。

---

## 💖 支持项目

如果 LLM-Wiki 已成为你知识工作流中重要的一部分，你可以通过以下方式支持其持续开发：

- ☕ **[在 Ko-fi 上请我喝杯咖啡](https://ko-fi.com/greenerdalii)** — 一次性或月度支持
- 💳 **[通过 PayPal 打赏](https://paypal.me/greenerdalii)** — 一次性打赏

感谢以下赞助者对项目的支持：

[@jameses-cyber](https://github.com/jameses-cyber)、[@issaqua](https://github.com/issaqua)、Dikson Choi

---

## 🔭 其他项目

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — 无头摄入 CLI，独立仓库以 npm 包 `karpathywiki-cli` 形式发布。对着磁盘上的 vault 跑同一套 `WikiEngine`，不需要渲染器。安装：`npm i -g karpathywiki-cli`。本仓库内的 `tools/dev-instrument/` 是 dev-only 测量工具，为本插件的发布说明提供每任务成本数据。
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — [pi-coding-agent](https://github.com/earendil-works/pi) 的任务级路由器。每轮开始前，一个小模型判定把你的消息分成例行还是要紧，选中的档位接管整轮。复杂任务还会更进一步：Smart 档像 CTO 一样规划，把实现派发给 Fast 子代理，逐项审核并迭代。升档立即生效，降档要等趋势稳住；每档的回退链能扛住 429 和 5xx。零运行时依赖，MIT。→ [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — pi-shift-router 的 DSH 分支，共享同样的任务级路由设计，但面向 [dsh-coding-agent](https://github.com/earendil-works/dsh) 运行时。同样的判定驱动档位选择、同样的每档回退链，MIT。
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — DSH 版的 `obsidian-plugin-dev` 工作流配套：搭建 Obsidian 插件工作区、驱动 Red→Green TDD 循环、跑 Six-Gate 质量闭环（lint/tsc/test/build/css-lint），并在 `feat/*` 或 `fix/*` 分支上准备可发布的 commit。让跑 DSH 的贡献者获得与维护者同样的脚手架 + gate 体验，无需从 CLAUDE.md 复制粘贴。

---

## 📜 许可证与致谢

Apache License, Version 2.0 — 详见 [LICENSE](../LICENSE) 和 [NOTICE](../NOTICE)。

**构建于：**
- 💡 [Andrej Karpathy 的 LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — 原始概念
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v6](https://ai-sdk.dev/)（`@ai-sdk/openai`、`@ai-sdk/anthropic`、`@ai-sdk/openai-compatible`）通过 Obsidian `requestUrl`
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) 和 [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — 检索算法

**维护者：** [@green-dalii](https://github.com/green-dalii)

[![Star History Chart](https://api.star-history.com/chart?repos=green-dalii/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
