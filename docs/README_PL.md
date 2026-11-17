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
- previous: v1.30.0 (MINOR — a token ceiling on the answer context, Extraction Focus in the settings tab, and crystallized-hub reporting)
- last-updated: 2026-11-17
- alternate-names: Karpathy LLM Wiki, LLM Wiki Obsidian, Obsidian wiki plugin, graph-based RAG, no-embedding RAG, Personalized PageRank retrieval, Obsidian second brain
- search-intents: "Obsidian RAG without embeddings", "Obsidian wiki plugin", "Personalized PageRank Obsidian", "graph-based note retrieval", "Karpathy LLM Wiki implementation", "Obsidian knowledge base auto-generation", "Obsidian graph view + AI", "Obsidian second brain plugin", "Obsidian note link graph AI", "Obsidian plugin 11 languages", "Obsidian plugin 15 LLM providers", "no-vector-DB RAG", "Obsidian PDF ingest AI", "Obsidian Codex OAuth", "Obsidian Bedrock plugin", "Obsidian Bedrock SSO", "Obsidian MinerU", "Obsidian Word PPT Excel ingest", "Obsidian IAM credentials"
- features: graph-based retrieval, Personalized PageRank (Haveliwala 2002), Monte Carlo PPR (Fogaras 2005), 5-stage seed-selection cascade, Tier 1/Tier 2 duplicate detection, 11-language UI + 11-language wiki output (independent), 15+ LLM providers (Anthropic, OpenAI, Bedrock [API key + SSO/IAM], Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, Codex OAuth), MinerU multi-format ingest (PDF + images + Office), PDF ingest (cache-only, OCR paths), lint health scan, Smart Fix All, source-page verbatim quotes, ingest candidate gate, per-step taskPolicies UI, Obsidian Graph View integration, zero-embedding zero-vector-DB architecture, local-first mode
- direct-competitors: nashsu/llm_wiki (Tauri desktop app), SamurAIGPT/llm-wiki-agent (Claude Code / Codex / OpenCode / Gemini CLI skill), atomicstrata/llm-wiki-compiler (TypeScript CLI, chunk-based retrieval)
- retrieval-benchmark: PPR @5 = 27.1% vs pure-kNN 24.1% (a project vault corpus, not a public benchmark set)
- author: green-dalii / Greener-Dalii (https://github.com/green-dalii)
- co-maintainer: DocTpoint (https://github.com/DocTpoint)
- canonical: https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_PL.md
-->

![Baner wtyczki Karpathy LLM Wiki — sieć powiązanych stron wiki zbudowana z twoich notatek w Obsidianie](/docs/assets/llm_wiki_banner.webp)

# 🧠 Wtyczka Karpathy LLM Wiki do Obsidiana

> Wtyczka do Obsidiana, która zamienia twoje notatki w połączoną bazę wiedzy, o którą można pytać — pomysł [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) wbudowany w edytor, w którym już piszesz.

**Pełna punktacja w przeglądzie Obsidiana • Wyszukiwanie po grafie bez embeddingów • 11 języków natywnie • Natywne wczytywanie PDF, obrazów i Office • Działa z każdym dostawcą • Najpierw lokalnie • Bez backendu • Zgodne z RODO**

![Version](https://img.shields.io/github/v/release/GD4AI/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-15%2B-cyan?style=flat-square) <br>
![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml)

[English](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_CN.md) | [繁體中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_KO.md) | [Deutsch](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_DE.md) | [Français](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_FR.md) | [Español](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ES.md) | [Português](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_PT.md) | [Italiano](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_IT.md) | [Русский](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_RU.md) | [Nederlands](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_NL.md) | **Polski**

[Oficjalna strona](https://llmwiki.greenerai.top/) | [Sklep z wtyczkami Obsidiana](https://community.obsidian.md/plugins/karpathywiki) | [Blog](https://llmwiki.greenerai.top/blog/) | [Dyskusje](https://github.com/GD4AI/obsidian-llm-wiki/discussions)

🤔 [Dlaczego ta wtyczka?](#-dlaczego-ta-wtyczka) | 🚀 [Szybki start](#-szybki-start) | ✨ [Funkcje](#-funkcje) | 🌐 [Ekosystem](#-ekosystem) | 🔍 [Jak działa wyszukiwanie](#-jak-działa-wyszukiwanie) | 🤖 [Modele](#-modele) | ❓ [FAQ](#-faq) | 🔒 [Prywatność](#-prywatność)

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD)

> Karpathy LLM Wiki jest darmowa, działa u ciebie i nie ma własnego backendu. Jeśli oszczędza ci czas, jedna kawa utrzymuje ją przy życiu — a ⭐ pomaga tak samo.

---

## 🤔 Dlaczego ta wtyczka?

Piszesz notatki. Leżą w folderach. Aby zobaczyć, co z czym się wiąże, musisz pamiętać wątki sprzed miesięcy.

**Istnieją inne otwarte realizacje pomysłu Karpathy'ego na LLM Wiki, ale żadna nie jest wtyczką do Obsidiana instalowaną jednym kliknięciem.** Większość to narzędzia wiersza poleceń, umiejętności dla Claude Code albo osobne aplikacje desktopowe; ta działa wewnątrz Obsidiana — z widokiem grafu, wstążką i paletą poleceń.

### Jak wypadamy na tle innych

|  | **Karpathy LLM Wiki** (ta wtyczka) | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|
| **Forma** | ✅ Wtyczka do Obsidiana, jedno kliknięcie | 🟡 aplikacja desktopowa na Tauri | 🟡 umiejętność dla Claude Code / Codex / OpenCode / Gemini CLI | 🟡 potok TypeScript w wierszu poleceń |
| **Zależności** | ✅ Brak — tylko wtyczka | 🟡 środowisko Python + sqlite | 🟡 środowisko Claude Code / Codex / OpenCode | ❌ model embeddingów + baza wektorowa (według ich dokumentacji) |
| **i18n (interfejs + wynik wiki)** | ✅ 11 języków | 🟡 angielski / chiński | ❌ tylko angielski | ❌ tylko angielski |
| **Dostawcy LLM** | ✅ 15+ (Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, zgodne z Anthropic, …) | 🟡 zgodne z OpenAI | 🟡 przez abonament Claude Code / Codex | 🟡 zgodne z OpenAI |
| **Wyszukiwanie i pytania** | ✅ **PPR + Monte Carlo** po grafie `[[wiki-link]]` | 🟡 wygaszanie po 2 krokach (heurystyka z 4 sygnałów) | 🟡 wykrywanie społeczności Louvain | 🟡 BM25 + semantyka po fragmentach |
| **Wizualizacja grafu** | ✅ wbudowany widok grafu Obsidiana (bez dodatkowego rozmiaru) | 🟡 własny sigma.js + graphology w aplikacji | 🟡 vis.js w osobnym `graph.html` | ❌ przeglądarka tylko do odczytu |
| **Formaty wejściowe** | ✅ **Markdown + PDF + obrazy + Office (DOCX/PPTX/XLSX)** — jeden przełącznik wybiera między PDF u dostawcy (Anthropic / OpenAI / Bedrock / Gemini) a wbudowanym backendem MinerU dla wielu formatów | 🟡 Markdown + PDF | 🟡 tylko Markdown i pliki kodu | 🟡 tylko Markdown |

### Trzy decyzje podjęte celowo

- **🪟 Obsidian jest środowiskiem.** Żadnego terminala, osobnej aplikacji, Dockera ani Pythona. Instalujesz z biblioteki wtyczek, klikasz Wczytaj, a wiki jest w twoim skarbcu od pierwszej sekundy. Widok grafu Obsidiana rysuje twoją sieć `[[wiki-link]]` — wbudowany, bez dodatkowego rozmiaru pakietu.
- **🧭 Prosto i samodzielnie.** Zero zależności: ani modelu embeddingów, ani bazy wektorowej, ani pakietu pip. Jedna wtyczka czyta twoje notatki, rozmawia z modelem i zapisuje strony do skarbca.
- **🔌 Dowolny model, za który już płacisz.** Anthropic, Bedrock, OpenAI, ChatGPT Plan (Codex OAuth), Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, usługa zgodna z Anthropic, własny punkt końcowy — ponad piętnaście dostawców i żaden nie musi mieć punktu końcowego embeddingów.

### Dla kogo to jest

- **Chcesz zacząć w 5 minut.** Instalujesz z biblioteki wtyczek, wybierasz dostawcę, wczytujesz jedną notatkę. Strony wiki pojawiają się w `wiki/` w kilka sekund, bez wiersza poleceń, bez Pythona i bez bazy wektorowej.
- **Chcesz odpowiedzi z własnych notatek,** przy czym każda odpowiedź wskazuje strony, z których pochodzi. Ollama lub LM Studio trzymają całe wywołanie na twoim komputerze.
- **Piszesz lub czytasz w jednym z 11 języków.** Interfejs i wynik wiki są niezależne: chińska wiki pod polskim interfejsem to obsługiwany układ.
- **Chcesz konserwacji jednym kliknięciem.** Kontrola lint i Inteligentna automatyczna naprawa trzymają w ryzach duplikaty, martwe odsyłacze i osierocone strony bez ręcznej pracy.

**Nie dla ciebie**, jeśli szukasz ogólnego zamiennika ChatGPT, wyszukiwania po zbiorach zewnętrznych, takich jak Confluence czy arXiv, albo usługi hostowanej ze współpracą zespołu. Odpowiedzi pochodzą ze skarbca, wczytywanie obejmuje skarbiec i pliki spoza niego, a backendu nie ma czym się dzielić.

---

## 🚀 Szybki start

**Wymagania:** Obsidian 1.11.4 lub nowszy, na komputerze albo telefonie. Nic więcej — bez Node, bez Pythona, bez kontenera. Twój klucz API albo model lokalny, który klucza nie potrzebuje; poświadczenia są w SecretStorage Obsidiana i dlatego 1.11.4 jest dolną granicą.

1. **Zainstaluj.** Obsidian → Ustawienia → Wtyczki społeczności → Przeglądaj → szukaj „Karpathy LLM Wiki” → Zainstaluj → Włącz. Możesz też wejść na [stronę wtyczki](https://community.obsidian.md/plugins/karpathywiki) i kliknąć **Add to Obsidian**.
   
   ![Karpathy LLM Wiki zainstalowana i włączona na liście wtyczek Obsidiana](/docs/assets/readme/readme-02-install.webp)
2. **Ustaw dostawcę.** Otwórz Ustawienia → Karpathy LLM Wiki → wybierz dostawcę (OpenAI, Anthropic, Ollama, ChatGPT Plan (Codex OAuth) itd.) → wpisz klucz API (przy modelu lokalnym niepotrzebny) → kliknij **Test połączenia** → Zapisz.
3. **Wczytaj jedną notatkę.** Dwie drogi:
   - **⌨️ Klawiatura:** `Cmd+P/Ctrl+P` → „Wczytaj jedno źródło” → wybierz plik Markdown (albo PDF, od v1.25.0).
   - **🖱️ Ikona we wstążce:** kliknij **ikonę naklejki** we wstążce po lewej stronie Obsidiana, aby od razu wczytać notatkę, którą masz otwartą — bez szukania w menu.
   
   Pierwsze strony wiki pojawiają się w `wiki/sources/`, `wiki/entities/` i `wiki/concepts/` w kilka sekund.
   
   ![Po lewej notatka, po prawej strona z niej utworzona — właściwości, opis i powiązane pojęcia](/docs/assets/readme/readme-01-before-after.webp)
4. **Pytaj swoją wiki.** Też dwie drogi:
   - **⌨️ Klawiatura:** `Cmd+P/Ctrl+P` → „Zadaj pytanie do wiki”.
   - **🖱️ Ikona we wstążce:** kliknij **ikonę dymka** we wstążce po lewej stronie.
   
   Po prawej otwiera się panel boczny, jak u kopilota, w którym rozmawiasz ze swoją wiki. Odpowiedzi niosą `[[wiki-link]]` z powrotem do twojego grafu wiedzy.

![Odpowiedź Query Wiki w panelu po prawej, gdzie każde twierdzenie ma przypis do strony wiki, z której pochodzi](/docs/assets/readme/readme-07-query-citations.webp)

To wszystko. Wtyczka nie zmienia twoich notatek — tworzy tylko nowe strony w `wiki/`. **Wczytaj** i **Zadaj pytanie do wiki** są przypięte do wstążki po lewej, więc zawsze w zasięgu jednego kliknięcia. (`Cmd` na macOS, `Ctrl` na Windows i Linuksie.)

### Najważniejsze polecenia

| Polecenie | Co robi |
|---------|--------------|
| **📥 Wczytaj jedno źródło** | `Cmd+P/Ctrl+P` → „Wczytaj jedno źródło” — wybierz plik Markdown albo **PDF (od v1.25.0)** i dostaniesz strony encji, pojęć i źródła. *Także: 🖱️ ikona naklejki przy otwartej notatce.* |
| **📂 Wczytaj z folderu** | `Cmd+P/Ctrl+P` → „Wczytaj z folderu” — wczytuje wszystkie notatki z folderu, z inteligentnym pomijaniem już wczytanych |
| **📑 Wczytaj wiele plików** | `Cmd+P/Ctrl+P` → „Wczytaj wiele plików” — wybierz podzbiór w drzewie z dwoma panelami (z kolejką i anulowaniem pojedynczego pliku) |
| **🔍 Zadaj pytanie do wiki** | `Cmd+P/Ctrl+P` → „Zadaj pytanie do wiki” — rozmowa z wiki w panelu po prawej; odpowiedzi niosą `[[wiki-link]]`. *Także: 🖱️ ikona dymka.* |
| **🛠️ Skontroluj wiki** | `Cmd+P/Ctrl+P` → „Skontroluj wiki” — pełna kontrola: duplikaty, martwe odsyłacze, puste strony, strony osierocone, brakujące aliasy, sprzeczności |
| **⚡ Inteligentna naprawa wszystkiego** | w oknie lint — naprawa jednym kliknięciem w kolejności przyczyn, z raportem po każdym etapie |
| **📋 Utwórz indeks ponownie** | `Cmd+P/Ctrl+P` → „Utwórz indeks ponownie” — odbudowuje `wiki/index.md` z obecnymi stronami i aliasami |
| **⏹ Zatrzymaj** | `Cmd+P/Ctrl+P` → „Zatrzymaj wczytywanie” albo kliknij pasek stanu — zatrzymuje się czysto na granicy kolejnej rundy |
| **📊 Historia** | `Cmd+P/Ctrl+P` → „Historia operacji” — przeszukiwalny widok wcześniejszych wczytań, raportów lint i konserwacji |

![Wszystkie polecenia Karpathy LLM Wiki, zgrupowane pod jednym prefiksem w palecie poleceń Obsidiana](/docs/assets/readme/readme-03-commands.webp)

| Przed | Po |
|--------|-------|
| `notes/machine-learning.md` (jeden płaski plik) | `wiki/concepts/supervised-learning.md` z `[[odsyłaczami w obie strony]]`, aliasami, przypisaniem źródła i wpisem w `wiki/index.md` |

> 📖 Opisy krok po kroku są w [Dyskusjach GitHub → Poradniki](https://github.com/GD4AI/obsidian-llm-wiki/discussions/categories/guides). Przydatne? [Daj repozytorium gwiazdkę](https://github.com/GD4AI/obsidian-llm-wiki), aby śledzić wydania.

---

## ✨ Funkcje

### 📚 Jakość wiedzy

- **🔍 Wyodrębnianie encji i pojęć** — model wyodrębnia encje (osoby, organizacje, produkty, wydarzenia) i pojęcia (teorie, metody, terminy) do osobnych stron. Ilość jest konfigurowalna (od Minimalnie do Dokładnie, plus Własne), więc wymieniasz koszt na głębokość.
- **🏷️ Aliasy są obowiązkowe** — każda strona dostaje co najmniej jeden alias (tłumaczenie, skrót, wariant), dzięki czemu duplikaty da się znaleźć także między językami.
- **🔄 Duplikaty w dwóch progach** — próg 1 (ta sama nazwa: inny język, skrót, bardzo podobny tytuł) jest sprawdzany zawsze; próg 2 (wspólne odsyłacze, średnie podobieństwo) bierze to, co zostało z budżetu tokenów.
- **🧩 Scalanie i stan sprzeczności** — duplikaty są scalane z zachowaniem aliasów; sprzeczności są oznaczane wraz ze źródłem; strony z `reviewed: true` nigdy nie są nadpisywane.
- **🎨 Jedna lista tagów, twoja** — tagi, które strona może nosić, pochodzą z zagnieżdżonych tagów twoich notatek, z tagów już obecnych na stronach wiki oraz z listy *Własne* w Ustawienia → Wiki → Lista tagów. Prompt, kontrola zapisu, lint i ponowne tagowanie czytają tę jedną listę, więc to, co dostaje model, trafia na dysk; wartość spoza listy jest odrzucana i nigdy nie zapisywana. Małe modele nadal się mylą (mniej więcej co dziesiąta runda zwraca własną taksonomię) — kontrola to wychwytuje, a lint zgłasza stronę. Punkt zaczepienia projektu: [Issue #328](https://github.com/GD4AI/obsidian-llm-wiki/issues/328).

![Wygenerowana strona pojęcia: tag z listy, z którym ją zapisano, aliasy AF i AFib, definicja oraz powiązane strony](/docs/assets/readme/readme-04-entity-page.webp)

### 📄 Dokumenty, PDF i obrazy

Sześć dróg, wybieranych przy każdym wczytaniu:

1. **🧾 Wbudowany backend MinerU** — Ustawienia → Konfiguracja wiki → Konwerter do Markdown → *MinerU*. PDF, obrazy (PNG/JPG/WebP/GIF/BMP i inne) oraz Office (DOC/DOCX/PPT/PPTX/XLS/XLSX) przez [dokładny parser MinerU](https://mineru.net/apiManage/docs). Token jest w SecretStorage i wygasa po około 90 dniach, więc błąd 401 mówi, że token prawdopodobnie wygasł, i wskazuje stronę do jego odnowienia. Limity to 200 MB i 200 stron na PDF oraz 256 MB i 10 000 plików na archiwum. To droga dla skanowanych artykułów i plików Office, w których liczy się układ.
2. **☁️ Dostawcy w chmurze z PDF** — Anthropic, OpenAI, Google Gemini i AWS Bedrock (warianty Anthropic i OpenAI) czytają PDF od razu jako część pliku. Nic więcej poza wyborem dostawcy.
3. **🖥️ Lokalny OCR na Apple Silicon** — [oMLX](https://github.com/jundot/omlx) zawiera Microsoft Markitdown jako wbudowany konwerter PDF na Markdown. Włącz Markitdown w oMLX, wczytaj [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) (3B, 570M aktywnych, otwarty od 2026-06) jako model obrazu, wskaż wtyczce oMLX jako własnego dostawcę zgodnego z OpenAI, włącz **Zawsze próbuj PDF** i wybierz model multimodalny, który serwuje oMLX. PDF nigdy nie opuszcza twojego komputera.
4. **🛠️ Narzędzie zewnętrzne (serwis MinerU)** — użyj [usługi MinerU Extractor](https://mineru.net/OpenSourceTools/Extractor), gdy wolisz szybki interfejs od konfigurowania tokenu API. Pobierz przekonwertowany plik `.md`, połóż go w skarbcu poza folderem wiki i wczytaj jako zwykłą notatkę Markdown.
5. **🔌 Zawsze próbuj PDF** — dla każdego innego punktu końcowego zgodnego z OpenAI lub Anthropic, który przyjmuje części pliku, wtyczka próbuje wywołania (Ustawienia → Konfiguracja LLM → Zaawansowane). Decyduje punkt końcowy; odmowa pojawia się jako komunikat w twoim języku.
6. **🖼️ Obrazy w Markdownie** — włącz *Analizuj obrazy w notatkach podczas wczytywania* w ustawieniach zaawansowanych, aby analizować każde odpowiednie lokalne osadzenie `![[image.png]]` i `![alt](image.png)`. Każdy obraz idzie z najbliższymi akapitami, w pakietach po 20 MiB, i może mieć najwyżej 10 MiB; obrazy z internetu nie są nigdy pobierane. Jeśli chcesz mieć co czytać przy każdym obrazie, włącz też *Zapisuj materiał obrazowy na stronie źródłowej* — strona źródłowa dostanie zwijaną sekcję kontrolną.

**Uwaga o plikach Office:** Obsidian nie wyświetla sam `.docx`, `.xlsx` ani `.pptx` ([formaty plików](https://obsidian.md/help/file-formats)), więc praktyczna droga to: MinerU zamienia plik na `.md`, wtyczka wczytuje ten `.md` jako strony wiki, a oryginał zostaje do wglądu. Jeśli chcesz podglądać pliki Office w Obsidianie, użyj wtyczki takiej jak Pandoc Plugin, Docxer, Md Importer albo Office Reader.

**Co łączy wszystkie drogi:**

- **🗄️ Ograniczony bufor** — `.obsidian/plugins/karpathywiki/pdf-cache/` trzyma przekonwertowany Markdown, kluczowany hashem treści, modelem i wersją konwertera; łącznie 100 MB, 1000 pozycji, 10 MB na pozycję, z usuwaniem najdawniej użytych.
- **📝 Opcjonalny plik towarzyszący w skarbcu** — Ustawienia → Konfiguracja wiki → Folder wiki → *Zapisuj przekonwertowany Markdown w skarbcu* zapisuje `<basename>.pdf.md` obok pliku PDF (domyślnie wyłączone; domyślnie działa tylko bufor).
- **🛡️ Dosłowne przepisywanie w promptcie** — konwersja w stylu OCR ze znacznikami `[nieczytelne]` i `[rycina: ...]` przeciw wymyślaniu treści; jeśli mały model lokalny opakuje wynik w blok kodu, jest on czyszczony przed zapisem do bufora.
- **🔁 Dosłowne cytaty na stronie źródłowej (v1.27.0, #496)** — każda wygenerowana strona `sources/<slug>.md` ma sekcję `Wzmianki w źródle`, zbudowaną z tych samych dosłownych cytatów, które wyodrębnianie zebrało dla każdej encji i pojęcia (tekst, o którym model już pokazał, że go widzi). Dzięki temu dokument źródłowy jest jedyną stroną wiki z prawdziwym, sprawdzalnym powiązaniem z własnym tekstem.

📖 **Pełne opisy każdej drogi** (dostawcy w chmurze, poziomy sprzętowe oMLX, instalacja MinerU, pielęgnacja bufora) → [docs/PDF-OCR-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 Pytania i konserwacja

**Wyszukiwanie i odpowiedzi**

- **🧭 Kaskada PPR w 5 etapach** — zobacz [Jak działa wyszukiwanie](#-jak-działa-wyszukiwanie). Personalized PageRank po `[[wiki-link]]` daje kontekst przechodzący przez graf o wiele kroków.
- **🔤 Ocena leksykalna z treścią strony** — szybka ścieżka ocenia tytuł, aliasy, podsumowanie **i samą treść** wzorem BM25F, więc najdłuższy tekst na stronie trafia do oceny. To największa zmiana w trafności, jaką projekt wprowadził.
- **🧩 Kształtowanie list powiązanych** — jedna strona-węzeł nie przeciąga już do siebie wszystkich pozostałych. Listy powiązane są przeliczane przy każdym zapisie z nazw, które przetrwały, uszeregowane i ograniczone.
- **🔁 Powrót do starego szeregowania** — Ustawienia → Zaawansowane → *Stary sposób szeregowania wyników* używa poprzedniego, ręcznie dostrajanego liniowego szeregowania. Domyślnie wyłączone; nowe szeregowanie jest domyślne, a przełącznik jest drogą powrotną.
- **📏 Budżet odpowiedzi to 16 000 tokenów, a potok mówi, kiedy się kończy** — odpowiedź nie urywa się już po cichu na budżecie. Kontekst jest dopasowywany do budżetu stron przed złożeniem, więc 20 stron jest w prompcie z planu, a nie z przypadku.
- **🔖 Przypisy w formie akademickiej** — kompozytor rośnie razem z treścią, a *wyczyść historię* czyści także zapis.
- **🪟 Panel boczny po prawej** — Query Wiki otwiera się w panelu po prawej, jak u kopilota (od v1.22.1), a nie w oknie na środku ekranu.
**Konserwacja i naprawa**

- **🔍 Kontrola lint** — jedno polecenie wychwytuje duplikaty, martwe odsyłacze, puste strony, strony osierocone, brakujące aliasy i sprzeczności. Wymienia też węzły, których sąsiedztwo już się wykrystalizowało: węzeł zastępujący powiązania, których treść nie potrafi już nawiązać.
- **⚡ Inteligentna naprawa wszystkiego** — naprawa jednym kliknięciem w kolejności przyczyn: uzupełnij aliasy → scal duplikaty → napraw martwe odsyłacze → podlinkuj strony osierocone → uzupełnij puste strony, z raportem po każdym etapie.
  
  ![Raport lint wiki — linia stanu, znalezione martwe odsyłacze i przycisk, który naprawia je w jednym przebiegu](/docs/assets/readme/readme-08-lint-report.webp)
- **🚧 Zostawianie martwych odsyłaczy** — Ustawienia → Zaawansowane → *Twórz puste strony dla odsyłaczy donikąd* (domyślnie włączone). Wyłącz to, a martwy odsyłacz zostanie widoczny w każdym raporcie lint, dopóki prawdziwe źródło go nie zdefiniuje, zamiast zamieniać się w pustą stronę. Zasada z #197 — nigdy nie uzupełniaj bez źródła — zostaje bez zmian; ten przełącznik decyduje tylko, czy pusta strona ma powstać.
- **📊 Panel historii operacji** — przeszukiwalny i filtrowany widok wcześniejszych wczytań, raportów lint i przebiegów konserwacji.
**Kontrole, które działają, zanim zapłacisz za wywołanie**

- **🛡️ Kontrola przed wczytaniem** — puste notatki, notatki z samymi spacjami i notatki z samym frontmatterem są odrzucane przed jakimkolwiek wywołaniem modelu; ten sam hash treści łapie identyczne pliki na różnych ścieżkach.
- **🚦 Kontrola kandydatów** — opcjonalna (`skipMentionOnlyCandidates`, domyślnie wyłączona). Kandydat, którego nazwa pada tylko w nawiasie, w wyliczeniu albo w krótkim punkcie listy, odpada, zanim kosztuje generowanie i wywołanie dedup. Działa tylko dla języków z zmierzonym profilem; język bez profilu nigdy nie jest filtrowany po cichu, a notatki w innym języku nie są filtrowane wcale.
- **🎛️ Reguły dla kroków** — LLM Zaawansowane → pole reguł dla kroków; nadpisujesz tryb tekstowy lub poziom rozumowania dla jednego kroku bez zmiany pozostałych. Wbudowana podstawa zostaje dla kroków, których nie wymienisz.

### 🦙 Najpierw lokalnie

- **🖥️ Ollama, LM Studio, OpenRouter, własny punkt końcowy** — od razu z pudełka. Modele lokalne sprawdzają się przy pytaniach (mniejsze okna kontekstu); wczytanie skarbca na 2 000 stron zwykle wymaga modelu w chmurze z długim kontekstem.
- **📄 Ścieżka OCR dla PDF jest w pełni lokalna na Apple Silicon** — zobacz [Dokumenty, PDF i obrazy](#-dokumenty-pdf-i-obrazy) powyżej.
- **🔐 ChatGPT Plan (Codex OAuth)** — na komputerze przez lokalne przekierowanie, na telefonie kodem jednorazowym; poświadczenia są tylko w SecretStorage Obsidiana. (Pełne wyjaśnienie granicy między dostawcami jest w [Anthropic vs OpenAI vs Codex OAuth](#anthropic-vs-openai-vs-codex-oauth--to-różni-dostawcy) poniżej.)

### 🌐 Język

- **🌍 11 języków interfejsu** — angielski, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano, Русский, Nederlands, Polski. Język interfejsu i język wyniku wiki są niezależne — wiki może być chińska, gdy interfejs jest polski.
  
  ![Język interfejsu i język wyniku wiki to dwa osobne ustawienia, więc chińska wiki może działać pod polskim interfejsem](/docs/assets/readme/readme-06-language-settings.webp)
- **📚 11 języków wyniku wiki** — ten sam zestaw; wybór w Ustawienia → Konfiguracja wiki. Opcja *Wpisz własny* dla języka spoza listy.
- **Wszystkie teksty interfejsu przetłumaczone na każdy język** — każda etykieta, okno i komunikat. Dodanie 12. języka robią współtwórcy (PR #159 jest wzorem).
- **🔧 Własne nagłówki dla dostawcy** — pole tekstowe zaraz pod bazowym adresem API. Jedna pozycja `Nazwa: wartość` w wierszu, wysyłana z każdym żądaniem. Jest ustawienie gotowe dla OpenCode i wariant `(Responses)` dla punktów końcowych mówiących po `/v1/responses`.
- **📡 Strumień, który przetrwa zablokowane źródło** — gdy żądanie z innego źródła jest odrzucane, strumień jest ponawiany przez transport `node:https` na komputerze, zamiast przechodzić na odpowiedź buforowaną, a nieudane przejście awaryjne jest zapisywane, nie połykane.

### ⚙️ Ustawienia, które kształtują przebieg

Większość decyzji wtyczka podejmuje za ciebie. Te osiem ustawień to zmienia, a każde jest odpowiedzią na błąd, na który ktoś trafił.

| Ustawienie | Gdzie | Co zmienia |
|---|---|---|
| **Strumieniuj żądania wczytywania** | Zaawansowane | `auto` strumieniuje na telefonie, `always` i `never` wymuszają wybór. To strumieniowanie trzyma długie wczytanie w limicie bezczynności dostawcy. |
| **Poziom rozumowania** | LLM Zaawansowane | domyślny / niski / średni / wysoki. AI SDK tłumaczy poziom u każdego dostawcy, więc nie ma tu ręcznie wpisywanego pola dostawcy. |
| **Maksymalna liczba tokenów wyjściowych na wywołanie** | LLM Zaawansowane | Działa w obie strony: podnieś, gdy model rozumujący wydaje budżet przed napisaniem, obniż, aby ograniczyć koszt. Puste pole prosi model o jego własny limit. |
| **Okno kontekstu modelu** | LLM Zaawansowane | Limit nie może przekroczyć okna, więc mały model lokalny nigdy nie dostaje liczby, której nie przyjmie. |
| **Równoległe wywołania modelu** | Dostawca | 1–20 wywołań naraz. Wyżej kończy duże wczytanie szybciej; niżej trzyma model lokalny w granicach pamięci. |
| **Ukierunkowanie wyodrębniania** i **Wymagania dotyczące treści** | Ustawienia zaawansowane | Dowolny tekst wpisywany do `schema/config.md`. Kształtuje to, co model wyodrębnia, bez ręcznej edycji schematu. |
| **Tryb odpowiedzi i rozumowanie według kroku** | LLM Zaawansowane | Nadpisz tryb tekstowy lub poziom rozumowania dla jednego kroku — wyodrębnianie, scalanie, pytania — bez ruszania pozostałych. |
| **Wykluczone pliki** | lista Obsidiana | Wczytywanie folderu, obserwowanie plików i ścieżka automatyczna respektują wykluczenia ustawione w Obsidianie, więc wtyczka i Obsidian rozumieją „poza zakresem” tak samo. |

---

## 🌐 Ekosystem

Wtyczka współpracuje z resztą twojego zestawu w Obsidianie — każde narzędzie poniżej wpina się w graf `[[wiki-link]]` bez zmian w kodzie.

- **📄 [MinerU dla wielu formatów](https://mineru.net/apiManage/docs) (wbudowane od v1.27.0)** — to, co było osobnym krokiem w wierszu poleceń lub w interfejsie, jest teraz przełącznikiem; pełna tabela dróg jest w [Dokumenty, PDF i obrazy](#-dokumenty-pdf-i-obrazy). [Usługa online MinerU](https://mineru.net/OpenSourceTools/Extractor) zostaje dla tych, którzy wolą szybki interfejs od tokenu API; [własny hosting MinerU](https://github.com/opendatalab/mineru) też jest możliwy.
- **🕸️ Widok grafu Obsidiana** — otwórz zwykły graf na dowolnej stronie wiki; każdy `[[wiki-link]]` staje się węzłem, a każdy odsyłacz zwrotny krawędzią. Wbudowane, bez dodatkowego rozmiaru.
  
  ![Widok grafu Obsidiana na wygenerowanej wiki — strony źródeł, encji i pojęć jako jeden spójny graf](/docs/assets/readme/readme-05-graph-view.webp)
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** — oficjalne rozszerzenie do przeglądarki. Zapisuj strony (artykuły, wpisy blogów, wątki z Reddita, Hacker News, przepisy, artykuły naukowe, transkrypcje z YouTube przez Interpreter) do dowolnego folderu skarbca, a potem uruchom polecenie `Wczytaj z folderu`, aby wyodrębnić encje i pojęcia w jednym przebiegu.
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** — pytaj wiki jak bazę danych przez DQL (`LIST FROM "wiki/entities" WHERE contains(tags, "person")`) albo API JS. Wtyczka zapisuje na każdej stronie zwykły frontmatter (`tags:`, `type:`, `aliases:`), więc Dataview działa od razu.
- **🌿 Git** — trzymaj skarbiec w systemie kontroli wersji (dowolnym klientem Git). Wtyczka nigdy nie przepisuje twoich plików źródłowych; tworzy tylko nowe strony w `wiki/`, więc `git diff` czysto oddziela twoją pracę od treści wygenerowanej przez model.
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** — zamień dowolną notatkę w prezentację przez frontmatter Marp (`marp: true`). Strony wiki to czysty Markdown, więc stają się slajdami bez dodatkowej konwersji.
- **🖼️ Canvas** — nieskończone płótno Obsidiana. Przeciągnij karty wiki na Canvas, aby złożyć przewodniki do nauki, mapy myśli albo przeglądy badań z `[[wiki-link]]`, nie wychodząc ze skarbca.

---

## 🔍 Jak działa wyszukiwanie

Większość wtyczek do „wyszukiwania z AI” tnie notatki na fragmenty i wkłada je do bazy wektorowej. My tego nie robimy. [Argument Karpathy'ego przeciw RAG](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) mówi, że cięcie na fragmenty psuje zdolność modelu do rozumowania po całym grafie wiedzy — i ten argument broni się w praktyce. Zamiast tego idziemy po grafie, który już utrzymujesz, pisząc `[[wiki-link]]`.

### Kaskada 5 etapów wyboru punktów startowych

Gdy pytasz „Kto założył Microsoft?”, Query Wiki przechodzi pięć etapów, zanim powstanie odpowiedź:

1. **Szybka ścieżka leksykalna** — BM25F po każdym tytule encji i pojęcia, po aliasach, podsumowaniu **i samej treści**, z nasycaniem na pole i IDF po prawdziwej tabeli częstości dokumentów. Darmowa, natychmiastowa i stanowiąca bramę dla wszystkiego dalej.
2. **Słowa kluczowe od modelu** — model proponuje 8–12 słów kluczowych w wielu językach na podstawie twojego pytania (synonimy, skróty i terminy słabo pokrywające się literowo, w jednym wywołaniu).
3. **Lokalne przeszukanie tekstu** — każde zaproponowane słowo jest ponownie dopasowywane lokalnie do tytułów, aliasów i fragmentów treści. Bez dodatkowego wywołania modelu; dopełnia odporność na szum.
4. **Powrót do bazy wiedzy przez model** — gdy ścieżka leksykalna i szukanie słów dają słaby sygnał, model przykłada najlepszych N kandydatów jeszcze raz do całej wiki.
5. **Rozszerzenie po grafie przez PPR** — Personalized PageRank (Haveliwala 2002) po grafie `[[wiki-link]]`, startując z wybranych punktów. To daje kontekst przechodzący przez graf: „Bill Gates” → „Microsoft” → „konkurenci”, a nie tylko dosłowną zbieżność tytułu.

Kaskada kończy się na etapie, który dał dość sygnału — bez stałego kosztu 5 etapów, bez wywołań modelu, gdy ścieżka leksykalna wystarcza, i z semantycznym powrotem tylko wtedy, gdy ścieżka leksykalna ze słowami kluczowymi nie wystarcza.

### Rozszerzanie pytania i droga powrotna

Gdy kaskada dochodzi do grafu, pytanie jest rozszerzane dwa razy, zanim wybrane zostaną punkty startowe: najpierw terminami z samej wiki, potem terminami proponowanymi przez model. Każde przejście ma wagę, a zysk jest zmierzony na skarbcach projektu, nie założony — na dwóch skarbcach zapisanych przez to wydanie rozszerzenie jest warte **+0,086** i **+0,113** przy r@10, a przedział w obu przypadkach wyklucza zero. Twierdzenie jest celowo wąskie: forma ważona *nie* jest mierzalnie lepsza od prostego sklejenia, a przełącznik uruchamiający poprzednie szeregowanie jest dla tych, którym wyniki się pogorszyły.

Ustawienia → Zaawansowane → *Stary sposób szeregowania wyników* uruchamia poprzednie, ręcznie dostrajane liniowe szeregowanie. Nowe jest domyślne; przełącznik jest drogą powrotną.

### Personalized PageRank na skalę

Używamy Monte Carlo PPR (Fogaras 2005) — 3 000 losowych wędrówek po 50 kroków — z regułą ślepych zaułków z Haveliwali 2002. Koszt to **O(K × L)** (K = wędrówki, L = kroki wędrówki) i nie zależy od liczby stron, więc skarbiec na 2 000 stron ma to samo opóźnienie rozszerzenia co skarbiec na 200.

**PPR @5 = 27,1% wobec 24,1% dla czystego kNN** na skarbcu projektu. Zbiór nie jest publiczny, więc czytaj tę liczbę jako porównanie, które projekt zmierzył dla siebie, a nie jako twierdzenie o twoim skarbcu; `tools/dev-instrument/run-recall-harness.mjs` to narzędzie, które mierzy trafność na skarbcu.

### Dlaczego bez embeddingów

Ścieżkę embeddingów odrzuciliśmy świadomie w [Issue #175](https://github.com/GD4AI/obsidian-llm-wiki/issues/175). Sygnał już jest w grafie — każdy `[[wiki-link]]` to ręcznie położona krawędź „te rzeczy są powiązane”, a większość obsługiwanych dostawców (Ollama, LM Studio, Anthropic, Bedrock, Kimi, GLM, MiniMax) nie ma w ogóle punktu końcowego `/v1/embeddings`. Dodanie modelu embeddingów oznaczałoby pobieranie na każdą stronę, adapter na każdego dostawcę i zero zysku w trafności.

---

## 🤖 Modele

Piętnastu nazwanych dostawców plus dowolny punkt końcowy zgodny z OpenAI lub Anthropic. Tabela wyboru według poziomu — chmura, lokalnie, OCR, kwantyzacja, sprzęt — jest w [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md), ostatnio sprawdzona 2026-11-06 względem [models.dev](https://models.dev/).

- **Chmura z najwyższej półki** — Anthropic, OpenAI, Google Gemini, xAI Grok, Moonshot Kimi, Zhipu GLM, MiniMax. Natywny PDF w Anthropic, OpenAI i Gemini.
- **Tańsze i otwarte** — DeepSeek, Alibaba Qwen, Step, Tencent Hunyuan, Xiaomi MiMo, Google Gemma.
- **Korporacyjne** — AWS Bedrock (warianty Anthropic i OpenAI, z kluczem API, SSO albo IAM) oraz ChatGPT Plan przez Codex OAuth.
- **Lokalne i bramy** — Ollama, LM Studio, OpenRouter, bramy zgodne z Anthropic.

Ta wtyczka podaje modelowi przy każdym pytaniu cały kontekst wiki, więc **wygrywają modele z długim kontekstem**.

### Co się liczy

- **🧠 Okno kontekstu 200K tokenów lub więcej** dla skarbców powyżej około 500 stron. Poniżej 200K kaskada może porzucić wcześniejsze etapy, aby się zmieścić.
- **⚖️ Trzymanie się instrukcji** waży więcej niż surowa inteligencja przy wyodrębnianiu — wybierz model, który trzyma się szablonu schematu, a nie ten z najwyższą liczbą w rankingu.
- **🔌 Punkt końcowy embeddingów jest nieistotny** — nie używamy embeddingów. Dostawca bez `/v1/embeddings` jest w porządku (większość naszych 15+ dostawców go nie ma).
- **🦙 Lokalnie do pytań, chmura do wczytywania** — wczytanie skarbca na 2 000 stron zwykle wymaga modelu w chmurze z długim kontekstem; lokalny model z 262K pokrywa większość pytań.

O wczytywaniu PDF, obrazów i Office przeczytasz w [Dokumenty, PDF i obrazy](#-dokumenty-pdf-i-obrazy) w sekcji funkcji — Anthropic, OpenAI, Bedrock i Gemini czytają PDF natywnie; wbudowany backend MinerU (od v1.27.0) i **Zawsze próbuj PDF** pokrywają resztę.

### Anthropic vs OpenAI vs Codex OAuth — to różni dostawcy

- **Anthropic** (i jego wariant w Bedrock) — osobno rozliczany klucz API platformy Anthropic.
- **OpenAI** — osobno rozliczany klucz API platformy OpenAI.
- **ChatGPT Plan (Codex OAuth)** — eksperymentalny, osobny dostawca, który po zalogowaniu w przeglądarce lub kodem jednorazowym korzysta z przysługującego limitu Codex; dostępność zależy od logowania i zasad limitu OpenAI Codex, a nie od nazwy planu. To zgodność z Codex od stron trzecich, nie partnerstwo z OpenAI i nie ogólne API ChatGPT.

### AWS Bedrock — trzy tryby logowania (v1.27.0, #425)

Ustawienia → Dostawca → Bedrock (Anthropic / OpenAI) pozwala teraz wybrać jeden z trzech trybów; wiersz dostawcy pyta potem o to, czego ten tryb naprawdę potrzebuje:

- **Klucz API** — pierwotna droga z tokenem noszonym z etapu 1; zachowanie jest bajt w bajt takie samo jak w v1.26.4 i to zalecany wybór dla tych, którzy już płacą za klucz API Bedrock.
- **SSO** — przepływ urządzenia IAM Identity Center. Kliknij *Zaloguj się przez AWS SSO*, wklej w przeglądarce kod z adresu weryfikacji, a wtyczka dostaje token SSO przez `karpathywiki-bedrock-sso` w SecretStorage, wymienia go na tymczasowe poświadczenia roli i podpisuje każde żądanie własnym SigV4 (bez dodawania AWS SDK). Identyfikator konta i nazwa roli są wykrywane same, gdy tożsamość SSO ma dokładnie po jednym; w innym razie wpisz je w ustawieniach dostawcy.
- **IAM** — stałe klucze dostępu dla środowisk bez SSO (CI, zadania wsadowe z harmonogramu). Trzymane w `karpathywiki-bedrock-iam` w SecretStorage; bufor w pamięci pamięta na klucz dostępu, aby podpisywanie SigV4 mieściło się w okresie ważności.

Wszystkie trzy tryby dzielą tę samą zasadę Obsidiana dla SecretStorage (żadnych poświadczeń w `data.json`, logach ani dokumentacji) i tę samą drogę OIDC i SigV4 bez AWS SDK. Region Bedrock jest niezależny od trybu logowania i ustawia się w tym samym wierszu dostawcy.

> 📖 **Pełna tabela wyboru** (chmura + lokalnie + OCR dla PDF + Codex OAuth + kwantyzacja + poziomy sprzętowe) → [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

## ❓ FAQ

### Co ta wtyczka właściwie robi?

Wybierasz notatkę, folder albo zaznaczenie: model wyodrębnia encje i pojęcia i zapisuje połączoną wiki z `[[odsyłaczami w obie strony]]`. Zadajesz pytanie, a odpowiedź pochodzi z tych stron, z przypisami. Twoje notatki nie są nigdy zmieniane.

### Czy moja obecna wiki jest bezpieczna?

✅ Zgodność wsteczna od v1.0.0. Ustaw `reviewed: true` na stronie, aby chronić ją przed nadpisaniem. Aktualizacja z v1.24.x nie przepisuje skarbca; wczytywanie PDF w v1.25.0 działa domyślnie tylko przez bufor, a v1.27.0 dodaje PDF, obrazy i Office bez zmiany układu plików wiki.

### Czy mogę wczytywać PDF-y, obrazy i pliki Office?

✅ Tak. Anthropic, OpenAI, Bedrock i Gemini czytają PDF natywnie; wbudowany backend MinerU (v1.27.0) pokrywa resztę (PDF + obrazy + Office). Pełny opis — dostawcy w chmurze, OCR na Apple Silicon, Zawsze próbuj PDF, pielęgnacja bufora — jest w [docs/PDF-OCR-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md).

### Czy moje dane są gdzieś wysyłane?

🚫 Bez backendu, bez analityki — wtyczka działa w całości w Obsidianie. Twojego komputera opuszcza tylko tekst, który sam wysyłasz do wczytania lub w pytaniu, i tylko do dostawcy, którego ustawisz. Jeśli chcesz pełnej lokalności, użyj Ollamy albo LM Studio.

### Czy mogę używać wtyczki w swoim języku?

🌍 11 języków dla interfejsu i dla wyniku wiki, ustawianych osobno. 12. język dodają współtwórcy (wzorem jest PR #159).

### Czym to się różni od chatbota RAG?

Bez cięcia na fragmenty, bez embeddingów, bez bazy wektorowej. Personalized PageRank idzie po grafie `[[wiki-link]]`, który już utrzymujesz, co daje kontekst przez wiele kroków bez kosztu embeddingów.

### Którego modelu użyć?

Z długim kontekstem: 200K tokenów lub więcej dla skarbców powyżej około 500 stron. Tabela według poziomów jest w [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md).

### Czy jest publiczny benchmark?

PPR @5 = 27,1% wobec 24,1% dla czystego kNN, zmierzone na skarbcu projektu — [Jak działa wyszukiwanie](#-jak-działa-wyszukiwanie) mówi, co to dowodzi, a czego nie.

### Jak kontrolować koszty API?

Używaj ilości Zgrubnie albo Minimalnie przy wczytywaniu zbiorczym. Inteligentne pomijanie rozpoznaje pliki już wczytane. Automatyczne utrzymanie jest domyślnie WYŁĄCZONE. Lint pokazuje liczby przed naprawą — nic nie jest płatne bez twojej zgody.

### Jak zatrzymać trwającą operację?

Kliknij pasek stanu (jest tam „Wczytywanie… kliknij, aby zatrzymać”) albo `Cmd+P/Ctrl+P` → „Zatrzymaj wczytywanie”. Zatrzymuje się czysto na granicy kolejnej rundy.

### Gdzie szukać pomocy?

[GitHub Issues](https://github.com/GD4AI/obsidian-llm-wiki/issues) na błędy · [Dyskusje GitHub](https://github.com/GD4AI/obsidian-llm-wiki/discussions) na pytania i pomysły · konsola programisty (`Ctrl+Shift+I` / `Cmd+Option+I`) na logi wtyczki.

---

## 🔒 Prywatność

Ta wtyczka jest w Obsidian Community Plugin Market i przechodzi automatyczny przegląd pod kątem bezpieczeństwa i uprawnień.

- **🚫 Bez własnego backendu, bez telemetrii, bez zbierania danych.** To zwykłe lokalne oprogramowanie działające w Obsidianie. Wtyczka nie prowadzi serwera i niczego nigdzie nie zgłasza.
- **🔐 Dostęp do sieci jest opcjonalny i jawny.** Istnieje tylko po to, by docierać do usług, które *ty* ustawiasz: twojego dostawcy LLM oraz — jeśli włączysz backend MinerU — `mineru.net`. To drugie to wyjątek wart nazwania: wysyła dokument do jurysdykcji, której nie wybrałeś i która nie publikuje zasad przechowywania. [Gdzie przetwarzany jest twój dokument](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md#-where-your-document-is-processed) wymienia każdą drogę i miejsce, do którego trafia plik.
- **📁 Dostęp do plików skarbca** służy zarządzaniu wiki (czytanie notatek, tworzenie stron, szukanie martwych odsyłaczy, wykrywanie duplikatów). Wtyczka nigdy nie zmienia twoich plików źródłowych.
- **📋 Dostęp do schowka** jest używany wyłącznie przez przycisk „Kopiuj” w oknie Query — i tylko gdy go klikniesz.

Jeśli chcesz pełnej lokalności, użyj Ollamy albo LM Studio. Z dostawcą lokalnym twoje dane nigdy nie opuszczają komputera.

---

## 💖 Wsparcie

Jeśli Karpathy LLM Wiki stała się częścią twojej pracy z wiedzą:

- ☕ **[Postaw mi Ko-fi](https://ko-fi.com/greenerdalii)** — jednorazowo albo co miesiąc
- 💳 **[Napiwek przez PayPal](https://paypal.me/greenerdalii)** — jednorazowo

Dziękujemy za wsparcie projektu:

[@jameses-cyber](https://github.com/jameses-cyber), [@issaqua](https://github.com/issaqua), Dikson Choi

### Współtworzenie

Zgłoszenia błędów i pull-requesty są równie przydatne. [CONTRIBUTING.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CONTRIBUTING.md) opisuje budowanie, pętlę testów i kontrole, które zmiana musi przejść; [CODE_OF_CONDUCT.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CODE_OF_CONDUCT.md) jest krótki. [ROADMAP.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/ROADMAP.md) pokazuje plany, a [CHANGELOG.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CHANGELOG.md) zapisuje, co zostało wydane.

Budowanie ze źródeł: `pnpm install`, `pnpm build:dev`, `pnpm gate:1` — ostatnie to lint, kontrola architektury, sprawdzenie typów, build, testy i lint CSS w jednym poleceniu. `tools/dev-instrument/` to narzędzie pomiarowe dla programistów: uruchamia prawdziwe `WikiEngine.ingestSource` na folderze z dysku bez Obsidiana i pokazuje zużycie tokenów oraz czas dla każdego zadania, i stąd pochodzą liczby wydajności w changelogu. Wersja dla użytkownika jest w osobnym repozytorium — `npm i -g karpathywiki-cli`.

---

## 🔭 Inne projekty

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — ten sam `WikiEngine` bez interfejsu: `npm i -g karpathywiki-cli`, potem `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`.
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — router na poziomie zadania dla [pi-coding-agent](https://github.com/earendil-works/pi): mały sędzia oznacza każdą turę jako rutynową albo ważną, a wybrany poziom steruje modelem, narzędziami i łańcuchem przejść awaryjnych. MIT. → [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — ten sam projekt routingu dla środowiska [dsh-coding-agent](https://github.com/earendil-works/dsh). MIT.
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — sposób pracy nad wtyczkami Obsidiana po stronie DSH: zakłada obszar roboczy, prowadzi pętlę czerwony→zielony, uruchamia te same kontrole jakości co to repozytorium i zostawia gotową do wydania gałąź `feat/*` albo `fix/*`.

---

## 📜 Licencja i podziękowania

Apache License, Version 2.0 — zobacz [LICENSE](LICENSE), [NOTICE](NOTICE) i [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

**Zbudowane na:**
- 💡 [Andrej Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — pierwotny pomysł
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v7](https://ai-sdk.dev/) (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) przez `requestUrl` z Obsidiana
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) i [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — algorytmy wyszukiwania

**Opiekunowie:** [@green-dalii](https://github.com/green-dalii) (autor) · [@DocTpoint](https://github.com/DocTpoint) (współopiekun od września 2026)

[![Star History Chart](https://api.star-history.com/chart?repos=GD4AI/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
