# 🤖 Model Guide

This page expands on the [README → Models](../README.md#-models) overview with a **pick-by-tier table** (cloud + local) and a **last-verified** date so the recommendations stay traceable. For live pricing and per-model capability flags (function calling, structured output, multimodal, PDF), check [models.dev](https://models.dev/) — it's the canonical open-source catalog the AI SDK and this plugin both use.

**Last verified:** 2026-11-06 · **Source:** [models.dev](https://models.dev/), cross-checked against each provider's model list.

> **This page names model families, not versions.** Providers add, rename and retire versions on their own schedule, so a version number written here is wrong within weeks — and a guide that is wrong about a model ID is worse than one that says nothing. Pick the family in the plugin's model picker, where the provider's current list is the authority. Family names below are read from [models.dev](https://models.dev/)'s provider catalogs, not from memory: Anthropic `opus` / `sonnet` / `haiku` / `fable`; OpenAI `gpt` with the `sol` / `astra` / `terra` / `luna` tiers plus the `o` reasoning line; Google `gemini-pro` / `gemini-flash` / `gemini-flash-lite` and open-weight `gemma`; DeepSeek `flash` / `pro`; Moonshot `kimi-k`; xAI `grok`; Alibaba `qwen-max` / `qwen-plus` / `qwen-flash` / `qwen-coder`; Zhipu `glm` / `glm-flash` / `glm-air`; MiniMax `minimax-m`; StepFun `step-flash`; Poolside `laguna`; Tencent `hunyuan`; Xiaomi `mimo`. The same applies to prices and context windows below — they are the shape of the tier, not a quoted figure.

---

## Why this page exists

The plugin feeds the LLM your full Wiki context per query — so **long-context models win**. The recommendations below are tiered by *quality / cost / hardware* so you can pick by what you actually need, not by what's trending on a leaderboard. Two principles govern the picks:

- **🧠 Context window ≥ 200K tokens** for vaults over ~500 pages. Below 200K the cascade's assembled context starts getting truncated.
- **⚖️ Instruction-following quality** matters more than raw IQ for the extraction task — pick a model that follows the schema template, not the biggest leaderboard number.

**Embedding endpoints are irrelevant** — we don't use embeddings. A provider that lacks `/v1/embeddings` is fine (most of our 15+ providers do).

---

## ☁️ Cloud Model Picks

> Pricing and availability change often. The cost column describes the tier; for the number, check the provider's pricing page.

| Tier | Model family | Context | Why |
|------|--------------|---------|-----|
| **Flagship** | **Claude Fable** | 1M tokens | Anthropic's most capable family; best instruction-following and extraction quality |
| **Flagship** | Claude Opus | 1M tokens | Anthropic reasoning flagship |
| **Flagship** | OpenAI GPT (Astra tier) | ~1M tokens | OpenAI's newest top tier; premium cost |
| **Flagship** | **Moonshot Kimi** | 1M tokens | Large open-weight MoE frontier; best-in-class coding benchmarks |
| **Balanced** | **Claude Sonnet** | 1M tokens | Anthropic's balanced tier — the usual production choice |
| **🌟 Value** | **DeepSeek Flash** | 1M tokens | Lowest-cost tier; ideal for batch ingestion |
| **🌟 Value** | **Gemini Flash** | 1M tokens | Strong speed/cost ratio |
| **🌟 Value** | **Qwen Plus** | 1M tokens | Alibaba DashScope API; strong agent/coding |
| **🌟 Value** | **Grok** | 500K tokens | xAI flagship; smaller window than the rest |
| **Lightweight** | **Gemini Flash Lite** | 1M tokens | Cheapest Gemini tier; ideal for small wikis and smoke tests |
| **Lightweight** | **Laguna** (Poolside) | 1M tokens | Open-weight coding model; speed champion |
| **Lightweight** | **Gemma** (26B A4B / 31B) | 256K tokens | Google's open-weight series; strong instruction following |
| **Lightweight** | **Step Flash** (StepFun) | 256K tokens | Fast inference, strong agent performance |
| **Lightweight** | **MiniMax** | 1M tokens | Large in/out context at low cost |
| **Lightweight** | **Tencent Hunyuan** | 256K tokens | Tencent Cloud billing, open-weight |
| **Budget** | **DeepSeek Pro** | 128K tokens | Best quality/cost for output-heavy work |
| **Budget** | **Xiaomi MiMo** | 1M tokens | Flat pricing; strong 1M-context option |
| **Budget** | **Zhipu GLM** | 1M tokens | Strong bilingual support |

**Data source:** capability and context figures checked against [models.dev](https://models.dev/) and provider API docs. Chat and coding subscription tiers change often; re-check before committing to a provider.

The four flagships are all premium-tier models:

- **Claude Fable** — Anthropic's best family. Best instruction-following, cleanest Markdown output, largest effective context for multi-shot schema templates.
- **Claude Opus** — Anthropic's reasoning flagship. Strong alternative when Fable is at capacity.
- **OpenAI GPT (Astra tier)** — OpenAI's newest top tier. Best for agentic coding and multi-step tool orchestration. The `sol`, `terra` and `luna` tiers scale down from it; a `-pro` suffix marks the deeper-reasoning variant inside any tier.
- **Moonshot Kimi** — China's best open-weight family. Top-tier coding benchmarks at a fraction of the flagship per-token cost.

For *ingest* of a 2,000-page vault where each note is 5K tokens, the cost difference between flagships is dominated by the ingest rate-limit guardian, not the per-token price.

### Picking a value pick

The 🌟 value picks are interchangeable for batch ingest. Choose by:

- **DeepSeek Flash** — if you have DeepSeek API access and the lowest per-token cost matters (subject to DeepSeek's rate limits at peak hours).
- **Gemini Flash** — if you want Google Cloud billing.
- **Qwen Plus** — if you want Alibaba Cloud billing and strong agent/coding performance.
- **Grok** — if you want xAI billing (smaller context — plan accordingly).

### Budget picks

For cost-sensitive workloads, three families stand out below the mid-tier output price:

- **DeepSeek Pro** — the best quality/cost ratio for output-heavy extraction work, at a smaller context window.
- **Xiaomi MiMo** — flat-priced, 1M-context. Good balance of context and cost.
- **Zhipu GLM** — 1M context with strong bilingual support.

---

## 🦙 Local Model Recommendations (Ollama / LM Studio)

Local inference wins on data sovereignty, offline use, and zero API cost. The trade-off is context window (most sit between 8K–128K; recent open-weight families reach 262K) and instruction following vs. flagship cloud models. **Pick by your hardware budget:** larger parameter counts buy world knowledge and instruction fidelity (better extraction quality, fewer hallucinations); smaller counts buy speed and memory headroom but pay for it in hallucinations and weaker long-context reasoning. The sweet spot on a 24 GB Apple Silicon or single consumer GPU is the 26B-31B class (Gemma) or equivalent.

| Model family | Params | Context | Why |
|--------------|--------|---------|-----|
| **Qwen (open-weight)** | multiple sizes | 128K–1M | Open-source series (Apache-2.0); available via Ollama / LM Studio / llama.cpp |
| **Gemma 31B IT** | 31B dense | 262K | Strong instruction following, clean Markdown output |
| **Gemma 26B A4B IT** | 26B / 4B MoE | 262K | Lower memory than 31B dense at comparable quality |

### Quantization

MLX 4-bit on Apple Silicon is typically 1.5–2× faster than GGUF Q4_K_M at the same effective bitrate. GGUF Q4_K_M is the default cross-platform choice; reach for Q5/Q8 only if you have the VRAM headroom and notice quality regression at Q4.

### Context strategy

When your Wiki grows past ~500 pages, a 262K local model still sees most of the context the Query engine assembles, but ingest on a 2000-page vault will outrun it. Common pattern: cloud for ingest + local for query. For full local setups, the 27B/35B-A3B class is the sweet spot.

### Hardware tiers

| Hardware | Recommended class | Why |
|----------|--------------------|-----|
| 16 GB Mac (M1/M2 base) | Gemma E2B / E4B IT (CPU), Qwen GGUF Q4 | E2B/E4B runs comfortably on CPU; Qwen fits with moderate quantization |
| 24 GB Mac (M1 Pro / M2 Pro / M3 Pro) | Qwen @ MLX 4-bit or Gemma 31B IT @ Q4 | The sweet spot — full quality, fits in unified memory |
| 48 GB Mac (M1/M2/M3/M4 Max) | Qwen (larger size) or Gemma 31B IT @ 8-bit | Quality ceiling on Apple Silicon |
| Single 24 GB consumer GPU | Qwen @ GGUF Q4_K_M or Gemma 31B IT @ Q4 | Cross-platform default |
| Dual 24 GB GPUs (NVLink not required) | Qwen (larger size) @ GGUF Q4_K_M | Splits the weights across two cards |

---

## 🔌 Anthropic-Compatible (Token Plan / Coding Plan)

If your provider offers an Anthropic-compatible API endpoint (Anthropic's `/v1/messages` protocol), select "Anthropic Compatible" in the plugin and enter your provider's Base URL and API Key. The plugin uses the Anthropic provider adapter transparently. Common Anthropic-compatible plans:

- **Token Plan** — providers that resell Anthropic API access with token-based pricing (no Claude Code subscription required).
- **Coding Plan** — providers that bundle Anthropic API access with a coding-tool subscription (e.g. Claude Code, Cursor, Zed).

No model-table pick is needed if your provider has a fixed catalog. The plugin talks the standard `/v1/messages` protocol regardless of how the provider bills.

---

## 💳 OpenAI vs ChatGPT Plan (Codex OAuth) — they are distinct

- **OpenAI** — separately billed OpenAI Platform API key.
- **ChatGPT Plan (Codex OAuth)** — experimental, distinct provider that uses eligible Codex allowance after browser or device-code sign-in; availability follows OpenAI Codex authentication and allowance policies, not plan name. Third-party Codex compatibility, not an OpenAI partnership or a general ChatGPT API.

OAuth credentials live only in Obsidian SecretStorage. Sign-out clears the secret.

---

## 🔍 Verifying picks yourself

For any model you're evaluating:

1. **Pricing & capability flags** — [models.dev](https://models.dev/) is the canonical open-source catalog. The [JSON API](https://models.dev/api.json) returns the full database.
2. **Multimodal / PDF support** — check the model's `modalities` and `attachment` fields on models.dev before assuming it can read a PDF file part.
3. **Effective context vs. nominal context** — long-context models often degrade past 60-70% of nominal; a 1M-context model may be reliable only to ~700K for complex schema extraction. Run your own quick test.
4. **Rate limits & cost** — provider pricing pages. DeepSeek and OpenRouter change tier structures often; cross-check before committing.

**Last updated:** 2026-11-06 — verify picks at [models.dev](https://models.dev/) and provider pricing pages.
