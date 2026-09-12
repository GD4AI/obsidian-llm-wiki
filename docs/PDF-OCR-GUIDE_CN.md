# 📄 PDF 摄入与 OCR 指南

**最后更新：** 2026-09-12

Karpathy LLM Wiki 插件通过四条路径摄入文档，四条路径共享同一个 Markdown 输出缓存 —— 区别在于**由谁来跑模型**。插件可以：(a) 把 PDF 直接发送到云端 provider 的 `/v1/chat/completions` 或（Anthropic 的）`/v1/messages` 端点作为文件部分，(b) 把 PDF / 图片 / Office 文档路由到**内置的 MinerU 后端**（v1.27.0+，零额外配置），(c) 在 Apple Silicon 上通过 [oMLX](https://github.com/jundot/omlx) + Markitdown 跑完全本地流水线，或 (d) 接受外部转换好的 Markdown（MinerU 在线 extractor —— 适合偏好 UI 而非 API token 的用户）作为普通文本源摄入。本页面按"最简单 → 最灵活"的顺序覆盖全部四条路径。

> 📖 快速配置引导在 [README → PDF 摄入](../README.md#-pdf-ingest-v1250-mineru-backend-v1270) 章节。本页面是详细版。

---

## 🌍 你的文档在哪里被处理

插件自身没有服务器，但上面四条路径并非把文件发往同一处 —— 而且其中一处**不是你选的**。下表就是完整答案；如何选择路径见后续章节。

| 路径 | 文件会发生什么 |
|------|----------------|
| **云端 provider，原生 PDF** | PDF 字节从你的仓库读出，作为*文件部分*发往**你配置的**聊天 provider —— Anthropic、OpenAI、Google 或 AWS Bedrock。它在该 provider 的区域内处理：Anthropic、OpenAI、Google **默认在美国**；Bedrock 则是**你配置的区域**（`eu-central-1` 法兰克福可服务同款模型）。OpenAI 另对 API 客户按需提供 EU 数据驻留。 |
| **内置 MinerU 后端** | 文档被上传到 `https://mineru.net/api/v4`，由 OpenDataLab（上海人工智能实验室）运营，跑在阿里云基础设施上。 |
| **本地 OCR**（Apple Silicon 上的 oMLX + Markitdown） | 不出你的机器。这是唯一一条文档从不跨网络边界的路径。 |
| **外部转好的 Markdown** | 插件只看到你交给它的文本；产出该 Markdown 的环节不在插件范围内。 |

**MinerU 的留存条款。** `mineru.net` 公布了 API 文档，但我们**未能找到**其隐私政策、数据留存声明或数据处理协议（DPA）。在自建端点发布之前（[Issue #404](https://github.com/green-dalii/obsidian-llm-wiki/issues/404)），请把向该处的上传视为脱离你的控制。

**provider 路径由你选择，这正是重点。** 插件从不自行挑选 provider —— 它把文件发往你配置的那一家，走你的账号、适用对方的条款。若你的文档涉及法律、医疗或受司法辖区约束，请用本地 OCR，或使用你已与其签有 DPA 的 provider 走云端路径。

---

## ☁️ 原生支持 PDF 的云端 provider

这些 provider 直接接受 PDF 文件部分。无需转换步骤、无需缓存编排 —— provider 全部搞定。如果你的 provider 名字藏在自定义 base URL 后面，开启 **Force PDF Support**。

| Provider | 模型能力 | 价格 | 备注 |
|----------|----------|------|------|
| **Anthropic** | Claude Opus 4.8、Sonnet 5、Fable 5 都原生读 PDF | 输出 $3-15/M | 多页表格保真度最佳；Markdown 输出干净 |
| **OpenAI** | GPT-5.6 Luna / Sol / Terra 原生读 PDF | 输出 $10-60/M | 密集科学排版最强 |
| **Google Gemini** | Gemini 3.6 Flash、3.5 Flash Lite —— 自 1.5 起原生 PDF 文件部分 | 输出 $0.1-1.5/M | OpenAI 兼容端点；1.05M 上下文 |
| **AWS Bedrock**（Anthropic） | 与 Anthropic 相同，通过 AWS 计费 | 与 Anthropic 相同 | VPC / 合规场景 |
| **AWS Bedrock**（OpenAI） | 与 OpenAI 相同，通过 AWS 计费 | 与 OpenAI 相同 | VPC / 合规场景 |

对于其他 OpenAI / Anthropic 兼容端点（DeepSeek、Kimi、GLM、MiniMax、OpenRouter、自定义），PDF 支持取决于该端点是否接受文件部分。**Force PDF Support** 开关在 设置 → LLM 配置 → 高级 里 —— 开启后插件会尝试调用；端点自己决定成败，失败时会弹出本地化的 Notice 引导你关掉开关。

---

## 🆕 内置 MinerU 后端（v1.27.0+，#404）

**v1.27.0 起插件内置原生 MinerU 集成** —— 无需 CLI、无需独立进程、无需手动转换步骤。一个设置开关，PDF / 图片 / Office 文档走插件内的 [MinerU Precise 解析器](https://mineru.net/apiManage/docs)。

### 支持的格式

| 格式 | 扩展名 |
|------|--------|
| PDF | `.pdf` |
| 图片 | `.png`、`.jpg`、`.jpeg`、`.jp2`、`.webp`、`.gif`、`.bmp` |
| Office | `.doc`、`.docx`、`.ppt`、`.pptx`、`.xls`、`.xlsx` |

MinerU Precise 解析器处理复杂多模态文档（文本 + 图片 + 公式 + 表格），并把公式转换为 LaTeX。插件按 `(内容 hash、模型、转换器版本)` 缓存结果 —— 用同样的配置重复摄入同一文件是免费的。

### Obsidian 原生格式支持——Office 文件注意事项

Obsidian 的支持文件类型清单（[file-formats](https://obsidian.md/help/file-formats)）覆盖 Markdown、图片、音频、视频和 PDF —— **但不包括 `.docx` / `.xlsx` / `.pptx`**。所以 Office 文件的实用工作流是：MinerU 转成 `.md` → 插件把 `.md` 摄取为 wiki 页面（实体、概念、来源页），原始 Office 文件留在 vault 供查阅，但**不能被 Obsidian 内联预览**。如果需要内联预览 Office 文件，可使用社区插件 **Pandoc Plugin**、**Docxer**、**Md Importer** 或 **Office Reader**。

### 配置（2 步）

1. **获取 MinerU API token。** 在 [mineru.net](https://mineru.net/apiManage/docs) 注册，从 API 管理页复制 token。
2. **配置插件。** 设置 → Karpathy LLM Wiki → Wiki 配置 → **Markdown 转换后端** → 选 *MinerU*。粘贴 token —— token 存在 Obsidian SecretStorage，不在 `data.json` 里（与 provider API key 同纪律）。

点击 **Test Connection**，然后 **Save Settings**。`Cmd+P/Ctrl+P` → "Ingest single source" → 选一个 PDF / 图片 / Office 文件。插件透明地处理上传、轮询、Markdown 缓存写入。

### 服务端限制（MinerU 侧）

- **单 PDF 200 MB / 200 页**
- **单压缩包 256 MB / 10,000 个文件**

超过限制的任务，请拆分源文件或预处理为更小的批次。插件目前不会切分超过限制的单 PDF。

### 何时选它而非其他路径

- **混合 PDF + Office + 图片的工作流** —— MinerU 一个后端搞定三种格式；云端原生 PDF 只支持 PDF，本地 OCR 也只支持 PDF。
- **含公式 / 多栏排版的复杂科学 PDF** —— MinerU Precise 解析器就是为这个调的，LaTeX 输出干净落入 wiki 页面。
- **需要保留版面结构的扫描件** —— MinerU 的 OCR 保留结构，纯视觉 LLM 调用倾向于把它拍平。

如果你只摄入纯文本 PDF 且最关心成本，**原生支持 PDF 的云端 provider**（Anthropic / OpenAI / Bedrock / Gemini）仍然是最简单的路径 —— 见上一节。

### 隐私敏感用户：自建 MinerU

插件**目前不支持**自建 MinerU 端点。基础 URL 固定为 `https://mineru.net/api/v4`（`src/constants.ts` 中的 `MINERU_API_BASE_URL`），没有任何设置或密钥可以覆盖它，因此自行部署 MinerU 目前不是可行路径。该项由 [Issue #404](https://github.com/green-dalii/obsidian-llm-wiki/issues/404) 跟踪。

在它落地之前，能让文档留在你控制下的两个选项是 **本地 OCR**（Apple Silicon 上的 oMLX + Markitdown）与**云端 provider 路径**（使用你已持有条款的 provider）—— 两者均见上文，逐路径对比见 [你的文档在哪里被处理](#-你的文档在哪里被处理)。

---

## 🖥️ Apple Silicon 上的本地 PDF OCR（oMLX + Markitdown）

在 Apple Silicon 上做完全本地的流水线，推荐用 [oMLX](https://github.com/jundot/omlx) —— 一个带连续批处理和 SSD 分层 KV 缓存的 LLM 推理服务器，针对 M 系列芯片优化。oMLX **已经内置集成**了 Microsoft [Markitdown](https://github.com/microsoft/markitdown) 作为 PDF→Markdown 后端，所以无需单独安装 Markitdown。在 oMLX 里启用即可。

### 推荐栈

| 层 | 项目 | 角色 |
|----|------|------|
| **推理服务器** | [oMLX](https://github.com/jundot/omlx) | 提供 OpenAI 兼容端点。Apple Silicon 原生。 |
| **PDF → Markdown** | Markitdown（oMLX 内置） | Microsoft 的 PDF/DOCX/PPTX → Markdown 转换。在 oMLX 设置里启用。 |
| **视觉识别** | [百度 Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) | 3B 总参 / 570M 激活的端到端 OCR，2026-06 开源。一次前向处理长文档。作为 oMLX 的视觉模型加载。 |
| **摘要** | 你的本地 LLM（oMLX 服务的任意模型） | 像云端 provider 一样做实体/概念抽取。 |

PDF 全程不出本机。Markitdown 在本地做结构转换，Unlimited-OCR 在本地做视觉识别，本地 LLM 在本地做摘要。插件的缓存（`.obsidian/plugins/karpathywiki/pdf-cache/`）让重复摄入瞬时完成。

### 配置（3 步）

1. **安装 oMLX** 并 **启用其内置 Markitdown 后端**（设置 → Backends → Markitdown → 开启）。无需单独安装 Markitdown。
2. **加载百度 Unlimited-OCR 作为视觉模型** —— 让 oMLX 指向模型权重（Hugging Face：`baidu/Unlimited-OCR`）。
3. **配置插件** —— 设置 → Karpathy LLM Wiki → Provider → **Custom OpenAI-Compatible**，Base URL 填 oMLX 的本地服务器，**Force PDF Support** 开启，选择 oMLX 服务的多模态模型。

点击 **Test Connection**，然后 **Save Settings**。`Cmd+P/Ctrl+P` → "Ingest single source" → 选一个 PDF。

### 硬件预期

OCR 模型都相对轻量 —— 不需要多档位表格。两个带宽覆盖全部场景：

| 硬件 | 推荐模型 | 原因 |
|------|----------|------|
| 8 GB RAM（任意系统） | **GLM-OCR**（0.9B，MIT）、**百度 Unlimited-OCR**（3B / 570M 激活）、**Qwen3-VL-2B** | 三款轻量。GLM-OCR 是 OCR 专才（94.6 OmniDocBench），Unlimited-OCR 是长文档 OCR（一次前向处理 50+ 页文档），Qwen3-VL-2B 是通用 VLM。三款都能轻松装进 8 GB RAM。 |
| 16 GB+ RAM（任意系统） | **Qwen3-VL-4B/8B** @ MLX 4-bit 或 GGUF Q4_K_M、**DeepSeek-OCR-2**（vLLM）、**百度 Unlimited-OCR** | 内存越大模型越大：Qwen3-VL-8B 装在 16 GB，Qwen3-VL-32B 装在 32 GB+，DeepSeek-OCR-2（91.09 OmniDocBench）是专用 OCR 选项。随着硬件升级逐渐换更大的视觉模型，但三款 8 GB 的选择已经能处理大多数真实 PDF。 |

### 备选：任意本地多模态 LLM

如果 oMLX / Markitdown 不可用（Linux/Windows 或不带 M 系列的旧 Mac），可以把 **Force PDF Support** 指向本地多模态 LLM —— **但先确认你的服务器真的接受 PDF 文件部分**。OpenAI 兼容的 `/v1/chat/completions` wire 格式只携带 `text` 和 `image` 两种 content part；PDF `file` part 不属于该标准，大多数本地服务器不会消费它：

- **Ollama** —— 只接受 text 和 base64 图片 part。发 PDF file part 会被服务器拒绝（400）。
- **LM Studio** —— 同样会校验 image 块必须是真实的图片二进制；把 PDF 当 image 块发会被拒绝。
- **llama.cpp / vLLM** —— 支持情况因构建版本和模型而异。先在自己的服务器上验证再依赖这条路；如果可用，把插件的 Base URL 指向该服务器端点，模型选择器选多模态模型名。

对拒绝 PDF part 的本地服务器，可靠的做法是**在 LLM 调用前先把 PDF 转好** —— 用上面的 oMLX + Markitdown 栈，或任何外部转换器（MinerU extractor、`markitdown` CLI、marker）—— 再把得到的 Markdown 作为普通文本源摄入。插件的缓存 key 包含模型，所以切换模型会自动让陈旧条目失效。

---

## 🛠️ 第三方 PDF → Markdown 服务（可选，v1.27.0 之前的路径）

如果你需要专业级 PDF 抽取**且不想用上面的内置 MinerU 后端**，把转换好的 Markdown 当作普通文本源喂给插件。

### [MinerU](https://mineru.net/OpenSourceTools/Extractor) —— 开源 PDF/Office/HTML → Markdown 转换器

[MinerU](https://mineru.net/OpenSourceTools/Extractor) 是上海 AI Lab OpenDataLab 团队的开源文档抽取工具（17.4k GitHub stars，Apache-2.0）。它处理复杂多模态 PDF（文本 + 图片 + 公式 + 表格），以及 **Word、PowerPoint、Excel、HTML、图片**，保留结构，把公式转 LaTeX。支持 CPU 和 GPU，跨平台（Windows/Linux/Mac）。

**大多数用户 —— 用上面的内置 MinerU 后端**，或者如果想要 UI 而非插件内设置，回退到 [MinerU Extractor 在线服务](https://mineru.net/OpenSourceTools/Extractor)。要把转换结果作为文本路由到插件：

1. 打开 [MinerU Extractor 在线服务](https://mineru.net/OpenSourceTools/Extractor)，上传你的文档（PDF、Word、PPT、Excel、HTML 或图片）。
2. 下载转换好的 `.md` 文件。
3. 在 Obsidian 里，把 `.md` 文件放到 vault 中 **wiki 文件夹之外** 的任何位置（wiki 文件夹是插件的自动生成输出目录，配置在 设置 → Wiki 配置 → Wiki 文件夹 —— 默认 `wiki/`；不要把输入笔记放进去）。
4. 对该文件运行 `Cmd+P/Ctrl+P` → "Ingest single source"。插件把它当作普通 Markdown 笔记摄入。

这条路径对不能或不打算接 API token 的用户仍然有效，但比内置后端慢（手动上传/下载）。

**隐私敏感用户 —— 自建 MinerU：**

见上方 **内置 MinerU 后端** 章节里的 [自建 MinerU](#隐私敏感用户自建-mineru) 段，那里是完整部署说明。

---

## ⚙️ 插件的 PDF 缓存如何工作

插件的 PDF 缓存在 `.obsidian/plugins/karpathywiki/pdf-cache/`，按 **内容 hash + 模型 + 转换器版本** 取 key。用同样的配置重复摄入同一 PDF 直接返回缓存的 Markdown，零 LLM 调用。三层防御性 housekeeping 让缓存有界：

- **总计 100 MB** —— 缓存总大小硬上限
- **1000 条目** —— 缓存 PDF 数量硬上限
- **单条目 10 MB** —— 单个 PDF 转换后 Markdown 大小硬上限

LRU-by-mtime 驱逐在插件启动时和每次批量摄入开始时运行。缓存在 `.obsidian/`（Obsidian 的插件配置目录），不在 vault 里 —— 默认情况下 vault 不被修改。

如果要在源 PDF 旁边写一个 `<basename>.pdf.md` 侧车文件，在 设置 → Wiki 配置 → Wiki 文件夹 里开启 **Write PDF Markdown to Vault**。默认关闭；cache-only 是默认。

---

## 何时用哪条路径

| 使用场景 | 推荐路径 |
|----------|----------|
| 一次性研究论文，无需配置 | Cloud（Anthropic 或 OpenAI） |
| 混合 PDF + Office + 图片的工作流 | 内置 MinerU 后端（v1.27.0+） |
| 含公式 / 多栏的学术 PDF | Cloud 或内置 MinerU 或第三方 |
| 隐私敏感 PDF（法律、医疗） | Apple Silicon 上的本地 oMLX 或自建 MinerU |
| 扫描版 PDF（基于图片） | 本地 oMLX + Unlimited-OCR 或内置 MinerU |
| 大批量（100+ PDF） | Cloud（规模化更便宜）或内置 MinerU 预处理后再云端摄入 |
| 离线 / 飞行模式 | Apple Silicon 上的本地 oMLX |
| Linux/Windows + 消费级 GPU | 本地 llama.cpp 多模态 + Force PDF Support |

插件对所有路径处理方式一致。本地 vs 云端 vs MinerU vs 第三方的选择，只是"指向哪个 Base URL"、"翻哪个后端开关"、"从 vault 里摄入哪些 `.md` 文件"的差别。
**最后更新：** 2026-09-12 —— 新增 *你的文档在哪里被处理*（逐路径说明：原生路径下 provider 的**区域**——三家默认美国、Bedrock 为你配置的区域、OpenAI 可申请 EU 驻留；MinerU 路径下的 `mineru.net` 及其缺失的留存声明；以及唯一完全本地的路径）；修正自建 MinerU 说明 —— 其中指向的 `karpathywiki-mineru-base-url` SecretStorage 键在源码中并不存在。（2026-08-27：新增内置 MinerU 后端（#404）；更新路径决策表；按“最简单 → 最灵活”重排四条摄入路径。）
