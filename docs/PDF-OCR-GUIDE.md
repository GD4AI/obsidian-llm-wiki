# 📄 PDF Ingest & OCR Guide

**Last updated:** 2026-09-12

The Karpathy LLM Wiki plugin ingests documents through four paths that share the same Markdown output cache — what differs is **what runs the model**. The plugin can (a) send a PDF straight to a cloud provider's `/v1/chat/completions` or `/v1/messages` (Anthropic) endpoint as a file part, (b) route PDF / images / Office documents through the **built-in MinerU backend** (v1.27.0+, no extra setup), (c) run a fully local pipeline on Apple Silicon via [oMLX](https://github.com/jundot/omlx) + Markitdown, or (d) accept Markdown converted elsewhere (MinerU's online extractor for users who prefer a UI over an API token) as a regular text source. This page covers all four paths in the order: simplest → most flexible.

> 📖 Quick setup walkthroughs are in the [README → PDF ingest](../README.md#-pdf-ingest-v1250-mineru-backend-v1270) section. This page is the long form.

---

## 🌍 Where your document is processed

The plugin runs no server of its own, but the paths above do not all send your file to the same place — and one of them is not a place you choose. This table is the whole answer; the sections below cover how to pick a path.

| Path | What happens to the file |
|------|--------------------------|
| **Cloud provider, native PDF** | The PDF bytes are read from your vault and sent as a *file part* to the chat provider **you configured** — Anthropic, OpenAI, Google, or AWS Bedrock. It is processed in that provider's region: **the United States by default** for Anthropic, OpenAI and Google, and **the region you configured** for Bedrock, where `eu-central-1` (Frankfurt) serves the same models. OpenAI also offers EU data residency for API customers on request. |
| **Built-in MinerU backend** | The document is uploaded to `https://mineru.net/api/v4`, operated by OpenDataLab (Shanghai AI Lab) on Aliyun infrastructure. |
| **Local OCR** (oMLX + Markitdown on Apple Silicon) | Nothing leaves your machine. This is the only path where the document never crosses a network boundary. |
| **Markdown from elsewhere** | The plugin sees only the text you hand it; whatever produced that Markdown is outside its scope. |

**MinerU's retention terms.** `mineru.net` publishes API documentation but no privacy policy, retention statement, or data-processing agreement that we were able to find. Until a self-hosted endpoint ships ([Issue #404](https://github.com/green-dalii/obsidian-llm-wiki/issues/404)), treat an upload there as leaving your control.

**The provider path is yours to choose, and that is the point.** The plugin never picks a provider on its own — it sends the file to whichever one you configured, under your account and their terms. If your documents are legal, medical, or otherwise jurisdiction-bound, use local OCR, or the cloud path with a provider you already hold a DPA with.

---

## ☁️ Cloud providers with native PDF support

These providers accept PDF file parts directly. No conversion step, no cache orchestration — the provider does everything. Turn on **Force PDF Support** if your provider's name is hidden behind a custom base URL.

| Provider | Model capability | Cost | Notes |
|----------|------------------|------|-------|
| **Anthropic** | Claude Opus 4.8, Sonnet 5, Fable 5 all read PDFs natively | $3-15/M output | Best multi-page table fidelity; clean Markdown output |
| **OpenAI** | GPT-5.6 Luna / Sol / Terra read PDFs natively | $10-60/M output | Strongest on dense scientific layouts |
| **Google Gemini** | Gemini 3.6 Flash, 3.5 Flash Lite — native PDF file parts (since 1.5) | $0.1-1.5/M output | OpenAI-compatible endpoint; 1.05M context |
| **AWS Bedrock** (Anthropic) | Same as Anthropic, billed through AWS | Same as Anthropic | Useful for VPC / compliance |
| **AWS Bedrock** (OpenAI) | Same as OpenAI, billed through AWS | Same as OpenAI | Useful for VPC / compliance |

For other OpenAI/Anthropic-compatible endpoints (DeepSeek, Kimi, GLM, MiniMax, OpenRouter, custom), the PDF support depends on whether the endpoint accepts file parts. **Force PDF Support** in Settings → LLM Configuration → Advanced tells the plugin to attempt the call; the endpoint decides, and failures surface as a localized Notice guiding you to disable the toggle.

---

## 🆕 Built-in MinerU backend (v1.27.0+, #404)

**As of v1.27.0 the plugin ships native MinerU integration** — no CLI, no separate process, no manual conversion step. One setting flip and PDF / images / Office documents route through [MinerU's Precise parser](https://mineru.net/apiManage/docs) inside the plugin.

### What it accepts

| Format | Extensions |
|---|---|
| PDF | `.pdf` |
| Images | `.png`, `.jpg`, `.jpeg`, `.jp2`, `.webp`, `.gif`, `.bmp` |
| Office | `.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx` |

MinerU's Precise parser handles complex multi-modal documents (text + images + formulas + tables) and converts formulas to LaTeX. The plugin caches the result by `(content hash, model, converter version)` — re-ingesting the same file with the same setup is free.

### Obsidian's native format support — important for Office files

Obsidian's accepted file formats ([file-formats](https://obsidian.md/help/file-formats)) cover Markdown, images, audio, video, and PDF — **but not `.docx` / `.xlsx` / `.pptx`**. So the practical workflow for Office files is: MinerU converts to `.md`, the plugin ingests the `.md` into wiki pages (entities, concepts, sources), and the original Office file is kept in the vault for reference but cannot be inlined-previewed. If you need to inline-preview Office files, use a community plugin such as **Pandoc Plugin**, **Docxer**, **Md Importer**, or **Office Reader**.

### Setup (2 steps)

1. **Get a MinerU API token.** Sign up at [mineru.net](https://mineru.net/apiManage/docs) and copy the token from the API management page.
2. **Configure the plugin.** Settings → Karpathy LLM Wiki → Wiki Configuration → **Markdown Conversion Backend** → pick *MinerU*. Paste the token — it lives in Obsidian SecretStorage, not `data.json` (same discipline as provider API keys).

Click **Test Connection**, then **Save Settings**. `Cmd+P/Ctrl+P` → "Ingest single source" → pick a PDF / image / Office file. The plugin handles the upload, polling, and Markdown cache write transparently.

### Server caps (MinerU side)

- **200 MB / 200 pages per PDF**
- **256 MB / 10,000 files per archive**

For larger jobs, split the source or pre-process into smaller batches. The plugin does not currently chunk single PDFs above the cap.

### When to pick it over the other paths

- **Mixed PDF + Office + images in one workflow** — MinerU handles all three formats through one backend; cloud-native PDF support is PDF-only, local OCR is PDF-only.
- **Complex scientific PDFs with formulas / multi-column layouts** — MinerU's Precise parser is tuned for this and the LaTeX output drops cleanly into a wiki page.
- **Scanned documents where layout matters** — MinerU's OCR preserves structure that pure-vision LLM calls tend to flatten.

If you only ingest plain-text PDFs and care most about cost, **cloud providers with native PDF support** (Anthropic / OpenAI / Bedrock / Gemini) are still the simplest path — see the previous section.

### Privacy-sensitive users: self-host MinerU

The plugin does **not** currently support a self-hosted MinerU endpoint. The base URL is fixed at `https://mineru.net/api/v4` (`MINERU_API_BASE_URL` in `src/constants.ts`) and no setting or secret overrides it, so deploying MinerU yourself is not a path you can take today. It is tracked as [Issue #404](https://github.com/green-dalii/obsidian-llm-wiki/issues/404).

Until it lands, the two options that keep a document under your control are **local OCR** (oMLX + Markitdown on Apple Silicon) and the **cloud provider path** against a provider you hold terms with — both described above, and compared per path in [Where your document is processed](#-where-your-document-is-processed).

---

## 🖥️ Local PDF OCR on Apple Silicon (oMLX + Markitdown)

For a fully local pipeline on Apple Silicon, the recommended setup uses [oMLX](https://github.com/jundot/omlx) — an LLM inference server with continuous batching and SSD-tiered KV caching, optimized for M-series chips. oMLX **already integrates** Microsoft [Markitdown](https://github.com/microsoft/markitdown) as a built-in PDF→Markdown backend, so no separate install of Markitdown is needed. Just enable it in oMLX.

### Recommended stack

| Layer | Project | Role |
|-------|---------|------|
| **Inference server** | [oMLX](https://github.com/jundot/omlx) | Serves an OpenAI-compatible endpoint. Apple Silicon native. |
| **PDF → Markdown** | Markitdown (built into oMLX) | Microsoft's PDF/DOCX/PPTX → Markdown conversion. Enable in oMLX settings. |
| **Visual recognition** | [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) | 3B total / 570M-active end-to-end OCR, open-sourced 2026-06. Handles long documents in one forward pass. Loaded as the vision model in oMLX. |
| **Summarization** | Your local LLM (any model oMLX serves) | Does the entity/concept extraction just like a cloud provider would. |

The PDF never leaves your machine. Markitdown does the structural conversion locally, Unlimited-OCR does the visual recognition locally, and the local LLM does the summarization locally. The plugin's cache (`.obsidian/plugins/karpathywiki/pdf-cache/`) then keeps re-ingests instant.

### Setup (3 steps)

1. **Install oMLX** and **enable its built-in Markitdown backend** (Settings → Backends → Markitdown → ON). No separate Markitdown install needed.
2. **Load Baidu Unlimited-OCR as the vision model** — point oMLX at the model weights (Hugging Face: `baidu/Unlimited-OCR`).
3. **Configure the plugin** — Settings → Karpathy LLM Wiki → Provider → **Custom OpenAI-Compatible**, Base URL = oMLX's local server, **Force PDF Support** ON, pick the multimodal model oMLX is serving.

Click **Test Connection**, then **Save Settings**. `Cmd+P/Ctrl+P` → "Ingest single source" → pick a PDF.

### Hardware expectations

OCR models are all relatively lightweight — you don't need a multi-tier table. Two bands cover every scenario:

| Hardware | Recommended model | Why |
|----------|--------------------|------|
| 8 GB RAM (any system) | **GLM-OCR** (0.9B, MIT), **Baidu Unlimited-OCR** (3B / 570M-active), or **Qwen3-VL-2B** | The three lightweights. GLM-OCR is the OCR specialist (94.6 OmniDocBench), Unlimited-OCR is the long-document OCR (handles 50+ page docs in one forward pass), Qwen3-VL-2B is a general VLM. All three fit comfortably in 8 GB RAM. |
| 16 GB+ RAM (any system) | **Qwen3-VL-4B/8B** @ MLX 4-bit or GGUF Q4_K_M, **DeepSeek-OCR-2** (vLLM), **Baidu Unlimited-OCR** | More memory buys larger models: Qwen3-VL-8B fits at 16 GB, Qwen3-VL-32B at 32 GB+, and DeepSeek-OCR-2 (91.09 OmniDocBench) is the dedicated OCR option. Upgrade the vision model as your hardware allows, but the three 8 GB choices already handle most real-world PDFs. |


### Fallback: any local multimodal LLM

If oMLX/Markitdown is unavailable (Linux/Windows or older Macs without M-series), you can point **Force PDF Support** at a local multimodal LLM — **but first check whether your server actually accepts PDF file parts**. The OpenAI-compatible `/v1/chat/completions` wire format carries `text` and `image` content parts; a PDF `file` part is not part of that standard and most local servers do not consume it:

- **Ollama** — accepts only text and base64-image parts. A PDF file part is rejected (400 from the server).
- **LM Studio** — likewise validates image blocks as real image binaries; a PDF sent as an image block is rejected.
- **llama.cpp / vLLM** — support varies by build and model. Verify against your own server before relying on this path; if it works, set the plugin's Base URL to the server's endpoint and pick the multimodal model name.

For local servers that reject PDF parts, the reliable pattern is to **convert the PDF before the LLM call** — the oMLX + Markitdown stack above, or any external converter (MinerU extractor, `markitdown` CLI, marker) — and ingest the resulting Markdown as a regular text source. The plugin's cache key includes the model, so switching models invalidates stale entries automatically.

---

## 🛠️ Third-party PDF-to-Markdown services (optional, pre-v1.27.0 path)

If you need professional-grade PDF extraction **without using the built-in MinerU backend above**, route the converted Markdown through the plugin as a normal text source.

### [MinerU](https://mineru.net/OpenSourceTools/Extractor) — open-source PDF/Office/HTML → Markdown converter

[MinerU](https://mineru.net/OpenSourceTools/Extractor) is an open-source document extraction tool from Shanghai AI Lab's OpenDataLab team (17.4k GitHub stars, Apache-2.0). It handles complex multi-modal PDFs (text + images + formulas + tables) as well as **Word, PowerPoint, Excel, HTML, and images**, preserves structure, and converts formulas to LaTeX. Works on CPU and GPU, cross-platform (Windows/Linux/Mac).

**For most users — use the built-in MinerU backend above**, or fall back to the [MinerU Extractor online service](https://mineru.net/OpenSourceTools/Extractor) if you want a UI rather than the in-plugin setting. To route through the plugin as text:

1. Open the [MinerU Extractor online service](https://mineru.net/OpenSourceTools/Extractor) and upload your document (PDF, Word, PPT, Excel, HTML, or image).
2. Download the converted `.md` file.
3. In Obsidian, drop the `.md` file anywhere in your vault **outside the wiki folder** (the wiki folder is the plugin's auto-generated output directory configured in Settings → Wiki Configuration → Wiki Folder — default `wiki/`; do not place input notes inside it).
4. Run `Cmd+P/Ctrl+P` → "Ingest single source" on that file. The plugin ingests it as a regular Markdown note.

This path still works for users who can't or don't want to wire up an API token, but it's slower (manual upload/download) than the built-in backend.

**For privacy-sensitive users — self-host MinerU:**

See [Self-host MinerU](#privacy-sensitive-users-self-host-mineru) in the **Built-in MinerU backend** section above for the full deployment notes.

---

## ⚙️ How the plugin's PDF cache works

The plugin's PDF cache lives in `.obsidian/plugins/karpathywiki/pdf-cache/` and is keyed by **content hash + model + converter version**. Re-ingesting the same PDF with the same setup returns the cached Markdown with no LLM call. Three-defense-layer housekeeping keeps the cache bounded:

- **100 MB total** — hard cap on cache size
- **1000 entries** — hard cap on number of cached PDFs
- **10 MB single-entry** — hard cap on per-PDF converted Markdown

LRU-by-mtime eviction runs on plugin startup and at the start of every batch ingest. The cache lives in `.obsidian/` (Obsidian's plugin config dir), not in your vault — your vault is not modified by default.

Turn on **Write PDF Markdown to Vault** in Settings → Wiki Configuration → Wiki Folder if you want a `<basename>.pdf.md` sidecar next to the source PDF after conversion. Off by default; cache-only is the default.

---

## When to use which path

| Use case | Best path |
|----------|-----------|
| One-off research paper, no setup | Cloud (Anthropic or OpenAI) |
| Mixed PDF + Office + images in one workflow | Built-in MinerU backend (v1.27.0+) |
| Academic PDFs with formulas / multi-column | Cloud OR built-in MinerU OR third-party |
| Privacy-sensitive PDFs (legal, medical) | Local oMLX on Apple Silicon OR self-hosted MinerU |
| Scanned PDFs (image-based) | Local oMLX + Unlimited-OCR OR built-in MinerU |
| Large batch (100+ PDFs) | Cloud (cheaper at scale) OR built-in MinerU pre-process then cloud ingest |
| Offline / flight mode | Local oMLX on Apple Silicon |
| Linux/Windows with consumer GPU | Local llama.cpp multimodal + Force PDF Support |

The plugin handles all paths identically. The local-vs-cloud-vs-MinerU-vs-third-party decision is just which `Base URL` you point at, which backend setting you flip, or which `.md` files you ingest from your vault.
**Last updated:** 2026-09-12 — added *Where your document is processed* (per-path residency: the provider's **region** on the native path — US by default for Anthropic, OpenAI and Google, the region you configured for Bedrock, and EU residency available from OpenAI; `mineru.net` on the MinerU path and its missing retention statement; and the one fully local path); corrected the self-host MinerU note, which pointed at a `karpathywiki-mineru-base-url` SecretStorage key that does not exist in the source. (2026-08-27: Built-in MinerU backend added with #404; path-decision table updated; four ingest paths reordered simplest-first.)
