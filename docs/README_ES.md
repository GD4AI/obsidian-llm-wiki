<!--
Metadatos SEO (no visibles para el usuario, los parsean rastreadores y LLM):
- name: karpathy-llm-wiki-plugin-for-obsidian
- type: software / plugin comunitario de Obsidian / generador de base de conocimiento / alternativa a RAG
- license: Apache-2.0
- language: TypeScript
- runtime: Obsidian >= 1.11.4 (escritorio + móvil)
- dependencies: cero dependencias en tiempo de ejecución (Vercel AI SDK v7 empaquetado)
- obsidian-plugin-id: karpathywiki
- obsidian-marketplace: https://community.obsidian.md/plugins/karpathywiki
- repo: https://github.com/GD4AI/obsidian-llm-wiki
- sister-cli-repo: https://github.com/green-dalii/obsidian-llm-wiki-cli
- docs: README.md + docs/README_<locale>.md (11 idiomas) + docs/MODEL-GUIDE.md + docs/PDF-OCR-GUIDE.md
- first-published: 2025-09 (v0.1.0)
- latest: v1.31.0
- release-notes: https://github.com/GD4AI/obsidian-llm-wiki/releases
- previous: v1.30.0 (MINOR — un techo de tokens para el contexto de la respuesta, Extraction Focus en los ajustes y un informe de hubs cristalizados)
- last-updated: 2026-11-12
- alternate-names: Karpathy LLM Wiki, LLM Wiki Obsidian, plugin wiki para Obsidian, RAG basado en grafos, RAG sin embeddings, recuperación con Personalized PageRank, segundo cerebro Obsidian
- search-intents: "Obsidian RAG sin embeddings", "plugin wiki Obsidian", "Personalized PageRank Obsidian", "recuperación de notas basada en grafos", "implementación de Karpathy LLM Wiki", "generación automática de base de conocimiento en Obsidian", "Obsidian Graph View + IA", "plugin segundo cerebro Obsidian", "IA sobre el grafo de enlaces de notas", "plugin Obsidian 11 idiomas", "plugin Obsidian 15 proveedores LLM", "RAG sin base de datos vectorial", "ingesta de PDF en Obsidian con IA", "Obsidian Codex OAuth", "plugin Obsidian Bedrock", "Obsidian Bedrock SSO", "Obsidian MinerU", "ingesta de Word PPT Excel en Obsidian", "credenciales IAM en Obsidian"
- features: recuperación basada en grafos, Personalized PageRank (Haveliwala 2002), Monte Carlo PPR (Fogaras 2005), cascada de selección de semillas en 5 etapas, detección de duplicados Tier 1/Tier 2, interfaz en 11 idiomas + salida del wiki en 11 idiomas (independientes), 15+ proveedores LLM (Anthropic, OpenAI, Bedrock [clave API + SSO/IAM], Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, Codex OAuth), ingesta multi-formato con MinerU (PDF + imágenes + Office), ingesta de PDF (solo caché, rutas OCR), escaneo de salud con Lint, Corrección inteligente global, citas literales en la página fuente, filtro de candidatos de ingesta, taskPolicies por paso en la interfaz, integración con el Graph View de Obsidian, arquitectura sin embeddings ni base de datos vectorial, modo local primero
- direct-competitors: nashsu/llm_wiki (aplicación de escritorio Tauri), SamurAIGPT/llm-wiki-agent (skill para Claude Code / Codex / OpenCode / Gemini CLI), atomicstrata/llm-wiki-compiler (CLI en TypeScript, recuperación por fragmentos)
- retrieval-benchmark: PPR @5 = 27.1% frente a kNN puro 24.1% (corpus de un vault del proyecto, no un conjunto de referencia público)
- author: green-dalii / Greener-Dalii (https://github.com/green-dalii)
- co-maintainer: DocTpoint (https://github.com/DocTpoint)
- canonical: https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md
-->

![Banner del plugin Karpathy LLM Wiki — una red de páginas wiki conectadas entre sí, construida a partir de tus notas de Obsidian](assets/llm_wiki_banner.webp)

# 🧠 Karpathy LLM Wiki Plugin para Obsidian

> Un plugin de Obsidian que convierte tus notas en una base de conocimiento conectada y consultable: la idea del [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), integrada en el editor donde ya escribes.

**Puntuación perfecta en la revisión de Obsidian • Recuperación por grafo sin embeddings • 11 idiomas nativos • Ingesta nativa de PDF + imágenes + Office • Funciona con cualquier proveedor • Local primero • Sin backend • Compatible con RGPD**

![Version](https://img.shields.io/github/v/release/GD4AI/obsidian-llm-wiki?style=flat-square) ![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square) ![Obsidian](https://img.shields.io/badge/obsidian-1.11.4%2B-purple?style=flat-square) ![Languages](https://img.shields.io/badge/languages-11-informational?style=flat-square) ![Providers](https://img.shields.io/badge/providers-15%2B-cyan?style=flat-square) <br>
![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=483699&label=downloads&query=$[karpathywiki].downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json&style=flat-square) [![Release Obsidian plugin](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml/badge.svg)](https://github.com/GD4AI/obsidian-llm-wiki/actions/workflows/release.yml)

[English](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/README.md) | [简体中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_CN.md) | [繁體中文](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_ZH-Hant.md) | [日本語](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_JA.md) | [한국어](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_KO.md) | [Deutsch](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_DE.md) | [Français](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_FR.md) | **Español** | [Português](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_PT.md) | [Italiano](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_IT.md) | [Русский](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/README_RU.md)

[Sitio oficial](https://llmwiki.greenerai.top/) | [Mercado de Obsidian](https://community.obsidian.md/plugins/karpathywiki) | [Blog](https://llmwiki.greenerai.top/blog/) | [Debate](https://github.com/GD4AI/obsidian-llm-wiki/discussions)

🤔 [Por qué este plugin?](#-por-qué-este-plugin) | 🚀 [Inicio rápido](#-inicio-rápido) | ✨ [Características](#-características) | 🌐 [Ecosistema](#-ecosistema) | 🔍 [Cómo funciona la recuperación](#-cómo-funciona-la-recuperación) | 🤖 [Modelos](#-modelos) | ❓ [FAQ](#-faq) | 🔒 [Privacidad](#-privacidad)

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H7V1228WMD)

> Karpathy LLM Wiki es gratuito, se aloja en tu equipo y no tiene backend propio. Si te ahorra tiempo, un café mantiene el proyecto en marcha — y una ⭐ ayuda igual.

---

## 🤔 Por qué este plugin?

Escribes notas. Se quedan en carpetas. Encontrar qué se relaciona con qué obliga a recordar hilos que olvidaste hace meses.

**Ya existen otras reimplementaciones de código abierto de la idea LLM Wiki de Karpathy, pero ninguna llega como un plugin de Obsidian de un clic.** La mayoría son herramientas CLI, skills de Claude Code o aplicaciones de escritorio aparte; esta se ejecuta dentro de Obsidian, con el Graph View, la cinta lateral y la paleta de comandos incluidos.

### Cómo nos comparamos

|  | **Karpathy LLM Wiki** (este plugin) | nashsu / llm_wiki | SamurAIGPT / llm-wiki-agent | atomicstrata / llm-wiki-compiler |
|---|---|---|---|---|
| **Entrega** | ✅ Plugin de Obsidian de un clic | 🟡 Aplicación de escritorio Tauri | 🟡 Skill para Claude Code / Codex / OpenCode / Gemini CLI | 🟡 Pipeline CLI en TypeScript |
| **Dependencias** | ✅ Ninguna — solo el plugin | 🟡 Runtime de Python + sqlite | 🟡 Runtime de Claude Code / Codex / OpenCode | ❌ Modelo de embeddings + base de datos vectorial (según su documentación) |
| **i18n (interfaz + salida del wiki)** | ✅ 11 idiomas | 🟡 EN / 中文 | ❌ Solo EN | ❌ Solo EN |
| **Proveedores LLM** | ✅ 15+ (Anthropic, OpenAI, Bedrock, Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Codex OAuth, Ollama, LM Studio, OpenRouter, Anthropic-Compatible, …) | 🟡 Compatible con OpenAI | 🟡 Suscripción vía Claude Code / Codex | 🟡 Compatible con OpenAI |
| **Recuperación y consulta** | ✅ **PPR + Monte Carlo** sobre el grafo `[[wiki-link]]` | 🟡 Decaimiento de 2 saltos (heurística de 4 señales) | 🟡 Detección de comunidades Louvain | 🟡 BM25 + semántico sobre fragmentos |
| **Visualización del grafo** | ✅ Graph View nativo de Obsidian (integrado, sin tamaño extra) | 🟡 sigma.js + graphology propios en la app de escritorio | 🟡 vis.js `graph.html` (archivo aparte) | ❌ Visor de solo lectura en el navegador |
| **Formatos de ingesta** | ✅ **Markdown + PDF + imágenes + Office (DOCX/PPTX/XLSX)** — un interruptor alterna entre el PDF nativo (Anthropic / OpenAI / Bedrock / Gemini) y el backend multi-formato MinerU integrado | 🟡 Markdown + PDF | 🟡 Solo Markdown / archivos de código | 🟡 Solo Markdown |

### Tres cosas que elegimos a propósito, no por accidente

- **🪟 Obsidian es el runtime.** Ni terminal, ni aplicación aparte, ni Docker, ni Python. Instala desde Plugins comunitarios, pulsa Ingestar y el wiki vive en tu vault desde el primer segundo. El Graph View nativo de Obsidian dibuja tu grafo `[[wiki-link]]`: viene integrado, sin tamaño extra en el paquete.
- **🧭 Limpio y autocontenido.** Cero dependencias: ni modelo de embeddings, ni base de datos vectorial, ni paquete de pip. Un solo plugin lee tus notas, habla con un LLM y escribe páginas en tu vault.
- **🔌 Cualquier modelo que ya pagues.** Anthropic, Bedrock, OpenAI, ChatGPT Plan (Codex OAuth), Gemini, DeepSeek, Qwen, Grok, Kimi, GLM, MiniMax, Step, Hunyuan, MiMo, Gemma, Ollama, LM Studio, OpenRouter, endpoint compatible con Anthropic o personalizado: más de quince proveedores, y a ninguno se le exige tener un endpoint de embeddings.

### Para quién es

- **Quieres montarlo en 5 minutos.** Instala desde Plugins comunitarios → elige un proveedor → ingesta una nota. Las páginas aparecen en `wiki/` en segundos, sin CLI, sin Python y sin base de datos vectorial que levantar antes.
- **Quieres respuestas sacadas de tus propias notas,** y que cada respuesta cite las páginas de las que sale. Ollama o LM Studio mantienen la llamada entera en tu máquina.
- **Escribes o lees en cualquiera de los 11 idiomas.** La interfaz y la salida del wiki son independientes: un wiki en chino detrás de una interfaz en inglés es una configuración admitida.
- **Quieres mantenimiento con un clic.** El escaneo de salud de Lint y la Corrección inteligente global mantienen a raya los duplicados, los enlaces rotos y las páginas huérfanas sin que las revises a mano.

**No es para ti si** buscas un sustituto general de ChatGPT, RAG sobre corpus externos como Confluence o arXiv, o un servicio alojado con colaboración en equipo. Las respuestas salen de tu vault, la ingesta cubre tu vault más archivos sueltos, y no hay backend que compartir.

---

## 🚀 Inicio rápido

**Requisitos:** Obsidian 1.11.4 o superior, en escritorio o en móvil. Nada más: ni Node, ni Python, ni contenedor. Tu propia clave API, o un modelo local sin clave alguna; las credenciales viven en Obsidian SecretStorage, y de ahí viene ese mínimo de 1.11.4.

1. **Instala.** Obsidian → Configuración → Plugins comunitarios → Examinar → busca "Karpathy LLM Wiki" → Instalar → Habilitar. O abre la [página del plugin comunitario](https://community.obsidian.md/plugins/karpathywiki) y haz clic en **Add to Obsidian**.
   
   ![Karpathy LLM Wiki instalado y habilitado en la lista de plugins comunitarios de Obsidian](assets/readme/readme-02-install.webp)
2. **Configura un proveedor.** Abre Configuración → Karpathy LLM Wiki → elige un proveedor (OpenAI, Anthropic, Ollama, ChatGPT Plan (Codex OAuth), etc.) → introduce la clave API (no hace falta con un modelo local) → haz clic en **Probar conexión** → Guardar.
3. **Ingesta una nota.** Dos caminos:
   - **⌨️ Teclado:** `Cmd+P/Ctrl+P` → "Ingestar fuente individual" → elige cualquier archivo Markdown (o PDF, v1.25.0+).
   - **🖱️ Icono de la cinta:** haz clic en el **icono de pegatina** de la cinta izquierda de Obsidian e ingesta al instante la nota que tengas abierta, sin buscar en menús.
   
   Tus primeras páginas aparecen en `wiki/sources/`, `wiki/entities/` y `wiki/concepts/` en segundos.
   
   ![A la izquierda la nota original; a la derecha, la página que generó su ingesta, con propiedades, descripción y conceptos relacionados](assets/readme/readme-01-before-after.webp)
4. **Consulta tu wiki.** Dos caminos:
   - **⌨️ Teclado:** `Cmd+P/Ctrl+P` → "Consultar wiki".
   - **🖱️ Icono de la cinta:** haz clic en el **icono de bocadillo de mensaje** de la cinta izquierda de Obsidian.
   
   Se abre un panel acoplado a la derecha, al estilo Copilot, donde puedes conversar con tu wiki. Las respuestas llevan `[[wiki-links]]` que vuelven a tu grafo de conocimiento.

![Una respuesta de consulta en el panel acoplado a la derecha, con cada afirmación remitida a la página del wiki de la que salió](assets/readme/readme-07-query-citations.webp)

Eso es todo. El plugin no toca nada de tus notas originales: solo crea páginas nuevas dentro de `wiki/`. Los comandos Ingestar fuente individual y Consultar wiki están fijados a la cinta izquierda, para llegar con un clic en cualquier momento. (`Cmd` en macOS, `Ctrl` en Windows y Linux.)

### Comandos principales

| Comando | Qué hace |
|---------|--------------|
| **📥 Ingestar fuente individual** | `Cmd+P/Ctrl+P` → "Ingestar fuente individual" — elige un archivo Markdown o **PDF (v1.25.0+)** y obtienes páginas de entidades, conceptos y wiki. *También: 🖱️ el icono de pegatina de la cinta sobre la nota activa.* |
| **📂 Ingestar desde carpeta** | `Cmd+P/Ctrl+P` → "Ingestar desde carpeta" — ingesta por lotes todas las notas de una carpeta, con salto inteligente de lotes |
| **📑 Ingerir varios archivos** | `Cmd+P/Ctrl+P` → "Ingerir varios archivos" — elige un subconjunto en un árbol de archivos de dos paneles (con cola en vivo y cancelación por archivo) |
| **🔍 Consultar wiki** | `Cmd+P/Ctrl+P` → "Consultar wiki" — conversa con tu wiki en un panel acoplado a la derecha; las respuestas llevan `[[wiki-links]]`. *También: 🖱️ el icono de bocadillo de mensaje de la cinta.* |
| **🛠️ Verificar wiki** | `Cmd+P/Ctrl+P` → "Verificar wiki" — escaneo de salud completo: duplicados, enlaces rotos, páginas vacías, huérfanas, alias ausentes, contradicciones |
| **⚡ Corrección inteligente global** | dentro del modal de Lint — reparación en orden causal con un clic e informe por fase |
| **📋 Regenerar índice** | `Cmd+P/Ctrl+P` → "Regenerar índice" — reconstruye `wiki/index.md` con las páginas y los alias actuales |
| **⏹ Cancelar** | `Cmd+P/Ctrl+P` → "Cancelar ingesta actual" o clic en la barra de estado — se detiene limpiamente en el siguiente límite de lote |
| **📊 Historial de ingesta** | `Cmd+P/Ctrl+P` → "Ver historial de ingesta" — interfaz con búsqueda para ingestas pasadas, informes de Lint y ejecuciones de mantenimiento |

![La paleta de comandos de Obsidian, con todos los comandos de Karpathy LLM Wiki agrupados bajo un mismo prefijo](assets/readme/readme-03-commands.webp)

| Antes | Después |
|-------|---------|
| `notes/machine-learning.md` (un archivo plano) | `wiki/concepts/supervised-learning.md` con `[[enlaces bidireccionales]]`, alias, atribución a la fuente y una entrada en `wiki/index.md` |

> 📖 Tutoriales paso a paso en [GitHub Discussions → Guías](https://github.com/GD4AI/obsidian-llm-wiki/discussions/categories/guides). ¿Te ha servido? [Dale una estrella al repositorio](https://github.com/GD4AI/obsidian-llm-wiki) para seguir las versiones.

---

## ✨ Características

### 📚 Calidad del conocimiento

- **🔍 Extracción de entidades y conceptos** — el LLM convierte entidades (personas, organizaciones, productos, eventos) y conceptos (teorías, métodos, términos) en páginas propias. La granularidad es configurable (Mínima → Fina, más Personalizada), así que eliges entre coste y profundidad.
- **🏷️ Alias obligatorios** — cada página llega con al menos un alias (traducción, abreviatura, variante), de modo que la detección de duplicados entre idiomas funciona.
- **🔄 Detección de duplicados por niveles** — el Nivel 1 (coincidencia directa de nombre: entre idiomas, abreviatura, títulos muy parecidos) se verifica siempre; el Nivel 2 (enlaces compartidos, similitud media) gasta el presupuesto de tokens que queda.
- **🧩 Fusión inteligente y estado de contradicción** — los duplicados se fusionan conservando los alias; las contradicciones se marcan con su fuente; las páginas con `reviewed: true` quedan protegidas contra la sobrescritura.
- **🎨 Un solo vocabulario de etiquetas, el tuyo** — las etiquetas que una página puede llevar salen de las etiquetas anidadas de tus notas, de las que ya están en las páginas del wiki y de la lista *Personalizado* de Configuración → Configuración del Wiki → Vocabulario de etiquetas. El prompt, el filtro de escritura, el lint y el reetiquetado leen esa única lista, así que lo que se le ofrece al modelo es lo que acaba en disco; un valor fuera de ella se descarta, nunca se escribe. Los modelos pequeños todavía se desvían (alrededor de una ejecución de cada diez devuelve la taxonomía propia del modelo); el filtro lo detecta y Lint informa de la página. Ancla de diseño: [Issue #328](https://github.com/GD4AI/obsidian-llm-wiki/issues/328).

![Una página de concepto generada: la etiqueta del vocabulario con la que se escribió, sus alias AF y AFib, su definición y las páginas relacionadas](assets/readme/readme-04-entity-page.webp)

### 📄 Ingesta de documentos / PDF / imágenes

Seis rutas de entrada, conmutables en cada ingesta:

1. **🧾 Backend MinerU integrado** — Configuración → Configuración del Wiki → Backend de conversión Markdown → *MinerU*. PDF, imágenes (PNG/JPG/WebP/GIF/BMP y más) y Office (DOC/DOCX/PPT/PPTX/XLS/XLSX) a través del [parser Precise de MinerU](https://mineru.net/apiManage/docs). El token vive en SecretStorage; caduca a los 90 días aproximadamente, así que un 401 dice que el token probablemente ha caducado y nombra la página donde renovarlo. Los límites son 200 MB / 200 páginas por PDF y 256 MB / 10 000 archivos por comprimido. Es la ruta para artículos escaneados y archivos Office donde la maquetación importa.
2. **☁️ Proveedores en la nube con PDF nativo** — Anthropic, OpenAI, Google Gemini y AWS Bedrock (variantes Anthropic y OpenAI) leen los PDF como partes de archivo sin configurar nada. Nada más allá de elegir el proveedor.
3. **🖥️ OCR local en Apple Silicon** — [oMLX](https://github.com/jundot/omlx) incluye Microsoft Markitdown como backend PDF→Markdown integrado. Activa Markitdown en oMLX, carga [Baidu Unlimited-OCR](https://huggingface.co/baidu/Unlimited-OCR) (3B / 570M activos, publicado en abierto en 2026-06) como modelo de visión, apunta el plugin a oMLX como proveedor personalizado compatible con OpenAI, activa **Force PDF Support** y elige el modelo multimodal que sirve oMLX. El PDF nunca sale de tu máquina.
4. **🛠️ Extractor de terceros (interfaz web de MinerU)** — usa el [servicio MinerU Extractor](https://mineru.net/OpenSourceTools/Extractor) para una conversión manual rápida cuando no quieras configurar un token de API. Descarga el `.md` convertido, déjalo en tu vault fuera de la carpeta del wiki e ingéstalo como una nota Markdown normal.
5. **🔌 Force PDF Support** — para cualquier otro endpoint compatible con OpenAI o Anthropic que acepte partes de archivo, el plugin intenta la llamada (Configuración → Configuración LLM → Parámetros avanzados de LLM). Decide el endpoint; los fallos aparecen como un aviso localizado.
6. **🖼️ Imágenes incrustadas en Markdown** — activa *Analizar imágenes incrustadas durante la ingesta de Markdown* en los ajustes avanzados y se analizará cada incrustación local `![[image.png]]` y `![alt](image.png)` que cumpla los requisitos. Cada imagen se analiza junto a sus párrafos Markdown más cercanos, se envía en paquetes de evidencia visual de 20 MiB y tiene un tope de 10 MiB; las URL remotas nunca se descargan. Si quieres una salida comprobable por imagen, activa además *Guardar la evidencia visual de las imágenes incrustadas en la página fuente* para añadir una sección de auditoría plegable a la página fuente generada.

**Advertencia para los formatos Office:** Obsidian no renderiza `.docx` / `.xlsx` / `.pptx` de forma nativa ([file-formats](https://obsidian.md/help/file-formats)), así que el flujo práctico con archivos Office es: MinerU los convierte a `.md`, el plugin ingesta ese `.md` en páginas del wiki y el archivo Office original se queda como referencia. Si necesitas previsualizar archivos Office dentro de Obsidian, usa un plugin comunitario como Pandoc Plugin / Docxer / Md Importer / Office Reader.

**Mecánica común a todas las rutas:**

- **🗄️ Caché acotada** — `.obsidian/plugins/karpathywiki/pdf-cache/` guarda el Markdown convertido, indexado por hash de contenido + modelo + versión del conversor; topes de 100 MB en total / 1000 entradas / 10 MB por entrada, con desalojo LRU por mtime.
- **📝 Archivo auxiliar opcional en el vault** — Configuración → Configuración del Wiki → Carpeta del Wiki → *Write PDF Markdown to Vault* escribe `<basename>.pdf.md` junto al PDF de origen (desactivado por defecto: lo predeterminado es solo caché).
- **🛡️ Prompt de transcripción literal** — conversión de estilo OCR con marcadores anti-alucinación `[illegible]` / `[figure: ...]`; el envoltorio de bloques Markdown que añaden los modelos locales pequeños se limpia antes de escribir en la caché.
- **🔁 Citas literales en la página fuente (v1.27.0, #496)** — cada página `sources/<slug>.md` generada lleva ahora una sección `Mentions in Source` construida con las mismas citas literales que la extracción capturó por entidad y concepto (la prosa que el modelo ya demostró ver), así que el documento de origen es la única página del wiki con un rastro real y fundamentado hasta su texto fuente.

📖 **Tutoriales completos de configuración** para todas las rutas (proveedores en la nube, niveles de hardware de oMLX, instalación de MinerU, mantenimiento de la caché) → [docs/PDF-OCR-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md)

### 💬 Consulta y mantenimiento

**Recuperación y respuestas**

- **🧭 Cascada PPR de 5 etapas** — consulta [Cómo funciona la recuperación](#-cómo-funciona-la-recuperación). Personalized PageRank sobre `[[wiki-link]]` aporta contexto de varios saltos con la forma del grafo.
- **🔤 Puntuación léxica que lee el cuerpo del texto** — la ruta rápida puntúa con BM25F el título, los alias, el resumen **y el cuerpo del texto**, así que el texto más largo de una página llega al puntuador. Es el mayor cambio de cobertura que ha hecho este proyecto.
- **🧩 Modelado de las páginas relacionadas** — una página hub ya no puede arrastrar hacia sí a todas las demás. Las listas de relacionadas se recalculan en cada escritura a partir de los nombres que sobrevivieron, ordenados y con un tope.
- **🔁 Interruptor del puntuador anterior** — Ajustes avanzados → *Clasificador de consultas antiguo* ejecuta la ordenación lineal anterior, ajustada a mano, en lugar de la nueva. Desactivado por defecto; la nueva ordenación es la predeterminada y el interruptor es la vuelta atrás.
- **📏 El presupuesto de la respuesta es de 16 000 tokens, y la canalización avisa cuando se agota** — la respuesta ya no se detiene en silencio al llegar al presupuesto. El contexto se ajusta a un presupuesto de páginas antes del ensamblado, así que hay 20 páginas en el prompt por plan y no por suerte.
- **🔖 Citas con forma académica** — el compositor crece con el contenido, y *borrar historial* borra de verdad el registro.
- **🪟 Panel acoplado a la derecha** — Consultar wiki se abre en un panel lateral derecho al estilo Copilot (v1.22.1+) en lugar de en un modal centrado.

**Mantenimiento y reparación**

- **🔍 Escaneo de salud de Lint** — un solo comando detecta duplicados, enlaces rotos, páginas vacías, huérfanas, alias ausentes y contradicciones. También lista las páginas hub cuyo vecindario se ha cristalizado: un hub que suplanta conexiones que el contenido ya no puede establecer.
- **⚡ Corrección inteligente global** — reparación en orden causal con un clic: rellenar alias → fusionar duplicados → arreglar enlaces rotos → enlazar huérfanas → expandir páginas vacías, con informe por fase.
  
  ![El informe de Lint del wiki: la línea de estado, los enlaces rotos que encontró y el botón de corrección que los repara en una sola pasada](assets/readme/readme-08-lint-report.webp)
- **🚧 Resultado de dejar el enlace como está en la corrección de enlaces rotos** — Ajustes avanzados → *Crear páginas de stub para enlaces sin resolver* (activado por defecto). Si lo desactivas, un enlace roto sigue visible en cada informe de lint hasta que una fuente real lo defina, en lugar de convertirse en una página de relleno vacía. La barrera de no-expandir-sin-fuente del #197 no cambia; este control decide solo si el stub se escribe o no.
- **📊 Panel de historial de operaciones** — interfaz con búsqueda y filtros para ingestas pasadas, informes de lint y ejecuciones de mantenimiento.

**Barreras que actúan antes de que una llamada se pague**

- **🛡️ Filtro previo a la ingesta** — las notas vacías, en blanco o con solo frontmatter se rechazan antes de cualquier llamada al LLM; la deduplicación por hash de contenido detecta archivos idénticos en rutas distintas.
- **🚦 Filtro de candidatos de ingesta** — opcional (`skipMentionOnlyCandidates`, desactivado por defecto). Un candidato nombrado solo dentro de un paréntesis, una enumeración o un elemento de lista corto se poda antes de costar una generación y una llamada de deduplicación. Solo se aplica a idiomas con un perfil medido; un idioma sin perfil nunca se filtra en silencio, y las notas multilingües no se filtran en absoluto.
- **🎛️ Políticas de tarea por paso** — Parámetros avanzados de LLM → campo de políticas de tarea; sobrescribe el modo de texto o el nivel de razonamiento de un paso concreto sin tocar el código. La base integrada se mantiene intacta para los pasos que no listes.

### 🦙 Local primero

- **🖥️ Ollama, LM Studio, OpenRouter, endpoint personalizado** — listos para usar. Los modelos locales sirven para consultar (con ventanas de contexto más pequeñas); la ingesta de un vault de 2000 páginas normalmente necesita un modelo en la nube de contexto largo.
- **📄 La ruta de OCR de PDF es completamente local en Apple Silicon** — consulta [Ingesta de documentos / PDF / imágenes](#-ingesta-de-documentos--pdf--imágenes) más arriba.
- **🔐 ChatGPT Plan (Codex OAuth)** — bucle de retorno en escritorio o código de dispositivo en móvil; las credenciales viven solo en Obsidian SecretStorage. (La explicación completa de las fronteras entre proveedores está más abajo, en [Anthropic vs OpenAI vs Codex OAuth](#anthropic-vs-openai-vs-codex-oauth--son-proveedores-distintos).)

### 🌐 Idioma

- **🌍 11 idiomas de interfaz** — English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Português, Italiano, Русский. La interfaz y el idioma de salida del wiki son independientes: tu wiki puede estar en chino mientras la interfaz está en inglés.
  
  ![El idioma de la interfaz y el idioma de salida del wiki son dos ajustes separados, así que un wiki en chino puede correr detrás de una interfaz en inglés](assets/readme/readme-06-language-settings.webp)
- **📚 11 idiomas de salida del wiki** — el mismo conjunto; se eligen en Configuración → Configuración del Wiki. Opción de *entrada personalizada* para prompts puntuales.
- **Todas las cadenas de la interfaz traducidas en cada idioma** — cada etiqueta, cada modal y cada aviso. Añadir un duodécimo idioma depende de contribuciones (el patrón del PR #159).
- **🔧 Cabeceras personalizadas por proveedor** — un campo de texto libre justo debajo de la API Base URL. Una línea `Name: value` por línea, enviada con cada petición. Incluye un preajuste de OpenCode y una variante `(Responses)` para los endpoints que hablan `/v1/responses`.
- **📡 Un flujo que sobrevive a un origen bloqueado** — cuando se rechaza una petición de otro origen, el flujo se reintenta por un transporte `node:https` de escritorio en lugar de degradarse a una respuesta en búfer, y un reintento fallido queda registrado en vez de silenciarse.

### ⚙️ Ajustes que condicionan una ejecución

El plugin decide por ti casi todo lo que hace. Estos ocho ajustes cambian eso, y cada uno es la respuesta a un fallo con el que alguien se topó.

| Ajuste | Dónde | Qué cambia |
|---|---|---|
| **Streaming de las peticiones de ingesta** | Ajustes avanzados | `auto` usa streaming en móvil; `always` y `never` fuerzan la elección. El streaming es lo que mantiene una ingesta larga por debajo del tiempo de inactividad que impone el proveedor. |
| **Nivel de razonamiento** | Parámetros avanzados de LLM | predeterminado / bajo / medio / alto. El AI SDK traduce el nivel en función del proveedor, así que no hay ningún campo de proveedor escrito a mano. |
| **Máx. tokens de salida por llamada** | Parámetros avanzados de LLM | Ahora funciona en las dos direcciones: súbelo cuando un modelo de razonamiento gasta el presupuesto antes de escribir, bájalo para limitar el coste. En blanco, el modelo pone su propio techo. |
| **Ventana de contexto del modelo** | Parámetros avanzados de LLM | El techo ya no puede superar la ventana, así que a un modelo local pequeño nunca se le envía un número que no puede aceptar. |
| **Concurrencia LLM** | Configuración LLM | De 1 a 20 llamadas en paralelo. Un valor alto hace que una ingesta grande termine antes; uno bajo mantiene un modelo local dentro de su memoria. |
| **Prioridad de extracción** y **Additional Content Rules** | Ajustes avanzados | Texto libre que se escribe en `schema/config.md`. Moldean lo que el modelo extrae sin que edites el esquema a mano. |
| **Modo de salida y razonamiento por paso** | Parámetros avanzados de LLM | Sobrescribe el modo de texto o el nivel de razonamiento de un paso —extracción, fusión, consulta— sin cambiar los demás. |
| **Archivos excluidos** | La propia lista de Obsidian | La ingesta de carpetas, el vigilante de archivos y la ruta automática respetan las exclusiones que fijes en Obsidian, así que el plugin y Obsidian coinciden en qué queda fuera de alcance. |

---

## 🌐 Ecosistema

El plugin encaja con el resto de tu stack de Obsidian: cada herramienta de abajo se conecta al grafo `[[wiki-link]]` sin cambios de código.

- **📄 [Backend multi-formato MinerU](https://mineru.net/apiManage/docs) (integrado desde v1.27.0)** — lo que antes era un paso aparte de CLI o interfaz ahora es un interruptor del plugin; consulta [Ingesta de documentos / PDF / imágenes](#-ingesta-de-documentos--pdf--imágenes) para la tabla completa de rutas. El [servicio web de MinerU](https://mineru.net/OpenSourceTools/Extractor) sigue disponible para quien prefiere una interfaz rápida antes que un token de API; [autoalojar MinerU](https://github.com/opendatalab/mineru) también es una opción.
- **🕸️ Obsidian Graph View** — abre el grafo nativo en cualquier página del wiki; cada `[[wiki-link]]` se vuelve un nodo y cada enlace de vuelta, una arista. Integrado, sin tamaño extra en el paquete.
  
  ![El Graph View nativo de Obsidian sobre un wiki generado: páginas de fuente, entidad y concepto formando un solo grafo conectado](assets/readme/readme-05-graph-view.webp)
- **✂️ [Obsidian Web Clipper](https://obsidian.md/clipper)** — extensión oficial del navegador. Guarda páginas web (artículos, entradas de blog, hilos de Reddit, Hacker News, recetas, artículos de investigación, transcripciones de YouTube vía Interpreter) en cualquier carpeta de tu vault y luego ejecuta el comando Ingestar desde carpeta del plugin para extraer entidades y conceptos por lotes.
- **📊 [Dataview](https://github.com/blacksmithgu/obsidian-dataview)** — consulta el wiki como una base de datos con DQL (`LIST FROM "wiki/entities" WHERE contains(tags, "person")`) o con la API de JS. El plugin escribe frontmatter estándar (`tags:`, `type:`, `aliases:`) en cada página, así que las consultas de Dataview funcionan sin configurar nada.
- **🌿 Git** — versiona tu vault con cualquier cliente de Git. El plugin nunca reescribe tus archivos de origen; solo crea páginas nuevas bajo `wiki/`, así que `git diff` separa con claridad tus ediciones del contenido generado por el LLM.
- **🎞️ [Marp Slides](https://github.com/samuele-cozzi/obsidian-marp-slides)** — convierte cualquier nota de Obsidian en diapositivas mediante el frontmatter de Marp (`marp: true`). Las páginas del wiki son Markdown puro, así que se renderizan como diapositivas sin conversión adicional.
- **🖼️ Canvas** — el lienzo infinito nativo de Obsidian. Arrastra tarjetas del wiki a un Canvas para montar guías de estudio, mapas mentales o resúmenes de investigación a partir de `[[wiki-links]]` sin salir del vault.

---

## 🔍 Cómo funciona la recuperación

La mayoría de los plugins de "búsqueda con IA" trocean tus notas en fragmentos y los meten en una base de datos vectorial. Nosotros no. El [argumento de Karpathy contra el RAG](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) es que trocear rompe la capacidad del LLM de razonar sobre todo tu grafo de conocimiento, y en la práctica ese argumento se sostiene. En su lugar recorremos el grafo que ya mantienes al escribir `[[wiki-links]]`.

### La cascada de selección de semillas en 5 etapas

Cuando preguntas "¿Quién fundó Microsoft?", Consultar wiki recorre cinco etapas antes de generar ninguna respuesta:

1. **Ruta léxica rápida** — BM25F sobre el título, los alias, el resumen **y el cuerpo** de cada entidad y concepto, con saturación por campo e IDF sobre una tabla real de frecuencia documental. Gratis, instantánea y el paso que gobierna todo lo que viene después.
2. **Generación de palabras clave con el LLM** — el LLM propone de 8 a 12 palabras clave en varios idiomas a partir de tu consulta (resuelve sinónimos, abreviaturas y términos que se resisten a la coincidencia de tokens en una sola llamada).
3. **Escaneo local de subcadenas** — cada palabra clave generada se vuelve a buscar localmente en títulos, alias y fragmentos del cuerpo. Sin llamada adicional al LLM; redondea la cobertura tolerante al ruido.
4. **Rescate por el LLM sobre la base de conocimiento** — cuando la ruta léxica y el escaneo de palabras clave devuelven señales débiles, el LLM vuelve a sembrar los N candidatos mejores contra todo el wiki en una pasada semántica.
5. **Expansión del grafo con PPR** — Personalized PageRank (Haveliwala 2002) sobre el grafo `[[wiki-link]]` partiendo del conjunto de semillas candidatas. Esto es lo que aporta contexto de varios saltos con la forma del grafo: "Bill Gates" → "Microsoft" → "competidores", no solo coincidencia literal de títulos.

La cascada se corta en la etapa que haya devuelto señal suficiente: no hay un coste fijo de cinco etapas, no hay llamadas al LLM cuando la ruta léxica basta, y el rescate semántico solo entra cuando la ruta léxica y el escaneo de palabras clave por sí solos no llegan.

### Expansión de la consulta, y una vuelta atrás

Cuando la cascada llega a la etapa del grafo, la consulta se expande dos veces antes de elegir las semillas: primero con los términos del propio wiki y luego otra vez con términos propuestos por el LLM. Cada pasada lleva un peso, y la ganancia está medida sobre los vaults del proyecto, no supuesta: en los dos vaults sobre los que se escribió la versión actual, la expansión vale **+0.086** y **+0.113** en r@10, y en ambos casos el intervalo excluye el cero. La afirmación es deliberadamente estrecha: la forma ponderada **no** es mediblemente mejor que la concatenación simple, y el interruptor que ejecuta el puntuador anterior está ahí para quien obtiene peores resultados.

Ajustes avanzados → *Clasificador de consultas antiguo* ejecuta en su lugar el puntuador lineal anterior, ajustado a mano. La ordenación nueva es la predeterminada; el interruptor es la vuelta atrás.

### Personalized PageRank a escala

Usamos Monte Carlo PPR (Fogaras 2005) —3000 caminatas aleatorias × 50 pasos cada una— con la regla de callejón sin salida de Haveliwala 2002. El coste es **O(K × L)** (K = caminatas, L = pasos por caminata), independiente del número de páginas, así que un vault de 2000 páginas ve la misma latencia de expansión que uno de 200.

**PPR @5 = 27.1% frente a la línea base de kNN puro 24.1%** en un vault del proyecto. El corpus no es público, así que lee la cifra como la comparación que el proyecto midió para sí mismo, no como una afirmación sobre tu vault; `tools/dev-instrument/run-recall-harness.mjs` es el arnés que mide la cobertura contra un vault.

### Por qué sin embeddings

Rechazamos la ruta de los embeddings a propósito en el [Issue #175](https://github.com/GD4AI/obsidian-llm-wiki/issues/175). La señal del grafo ya está ahí: cada `[[wiki-link]]` es una arista "estos están relacionados" curada a mano, y la mayoría de los proveedores que soportamos (Ollama, LM Studio, Anthropic, Bedrock, Kimi, GLM, MiniMax) no ofrecen ningún endpoint `/v1/embeddings`. Añadir un modelo de embeddings significaría una descarga por página, un adaptador por proveedor y ningún beneficio en la calidad de la recuperación.

---

## 🤖 Modelos

Quince proveedores con nombre propio, más cualquier endpoint compatible con OpenAI o con Anthropic. La tabla para elegir por nivel —nube, local, OCR, cuantización, hardware— está en [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md), verificada por última vez el 2026-11-06 contra [models.dev](https://models.dev/).

- **Nube de frontera** — Anthropic, OpenAI, Google Gemini, xAI Grok, Moonshot Kimi, Zhipu GLM, MiniMax. PDF nativo en Anthropic, OpenAI y Gemini.
- **Económicos y de peso abierto** — DeepSeek, Alibaba Qwen, Step, Tencent Hunyuan, Xiaomi MiMo, Google Gemma.
- **Empresa** — AWS Bedrock (variantes Anthropic y OpenAI, con autenticación por clave API, SSO o IAM) y ChatGPT Plan mediante Codex OAuth.
- **Local y pasarelas** — Ollama, LM Studio, OpenRouter, pasarelas compatibles con Anthropic.

El plugin le pasa al LLM el contexto completo de tu wiki en cada consulta, así que **ganan los modelos de contexto largo**.

### Qué importa

- **🧠 Ventana de contexto ≥ 200K tokens** para vaults de más de ~500 páginas. Por debajo de 200K, la cascada puede descartar etapas anteriores para caber.
- **⚖️ La calidad del seguimiento de instrucciones** importa más que la inteligencia bruta en la tarea de extracción: elige un modelo que siga la plantilla del esquema, no el número más alto de la clasificación.
- **🔌 El endpoint de embeddings es irrelevante** — no usamos embeddings. Un proveedor sin `/v1/embeddings` sirve igual (la mayoría de nuestros 15+ proveedores no lo ofrecen).
- **🦙 Local para consultar, nube para ingestar** — la ingesta de un vault de 2000 páginas normalmente necesita un modelo en la nube de contexto largo; un modelo local de 262K cubre la mayoría de las consultas.

Para ingestar PDF, imágenes y Office, consulta [Ingesta de documentos / PDF / imágenes](#-ingesta-de-documentos--pdf--imágenes) en Características: Anthropic, OpenAI, Bedrock y Gemini leen los PDF como partes de archivo de forma nativa; el backend MinerU integrado (v1.27.0+) y **Force PDF Support** cubren todo lo demás.

### Anthropic vs OpenAI vs Codex OAuth — son proveedores distintos

- **Anthropic** (y su variante en Bedrock) — clave API de Anthropic Platform, facturada aparte.
- **OpenAI** — clave API de OpenAI Platform, facturada aparte.
- **ChatGPT Plan (Codex OAuth)** — proveedor experimental y distinto, que usa la cuota de Codex que te corresponda tras iniciar sesión en el navegador o con código de dispositivo; la disponibilidad sigue las políticas de autenticación y de cuota de OpenAI Codex, no el nombre del plan. Es compatibilidad de terceros con Codex, no una asociación con OpenAI ni una API general de ChatGPT.

### AWS Bedrock — tres modos de autenticación (v1.27.0, #425)

Configuración → Proveedor → Bedrock (Anthropic / OpenAI) elige ahora uno de tres modos de autenticación; la fila del proveedor pide después solo los datos que ese modo necesita de verdad:

- **Clave API** — la ruta bearer original de la etapa 1; el comportamiento es idéntico byte a byte al de v1.26.4 y es la opción recomendada para quien ya paga una clave API de Bedrock.
- **SSO** — flujo de dispositivo de IAM Identity Center. Pulsa *Iniciar sesión con AWS SSO*, pega en el navegador el código de la URL de verificación, y el plugin recibe un token SSO a través de `karpathywiki-bedrock-sso` en SecretStorage, lo canjea por credenciales temporales de rol y firma cada petición con SigV4 hecho a mano (sin añadir el SDK de AWS). El ID de cuenta y el nombre del rol se detectan solos cuando la identidad SSO expone exactamente uno de cada; si no, se introducen en los ajustes del proveedor.
- **IAM** — claves de acceso estáticas para entornos sin SSO (CI, procesos por lotes programados). Se guardan en `karpathywiki-bedrock-iam` en SecretStorage; la caché en memoria memoriza por clave de acceso para mantener la firma SigV4 dentro de la expiración.

Los tres modos comparten la misma disciplina de Obsidian SecretStorage (ninguna credencial en `data.json`, en registros ni en documentación) y la misma ruta OIDC + SigV4 hecha a mano sin SDK de AWS. La región de Bedrock es independiente del modo de autenticación y se configura en la misma fila del proveedor.

> 📖 **Tabla completa para elegir** (nube + local + OCR de PDF + Codex OAuth + cuantización + niveles de hardware) → [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md)

## ❓ FAQ

### ¿Qué hace el plugin exactamente?

Elige una nota, una carpeta o una selección: el LLM extrae entidades y conceptos y escribe un wiki interconectado con `[[enlaces bidireccionales]]`. Haz una pregunta y la respuesta sale de esas páginas, con citas. Tus notas originales no se modifican nunca.

### ¿Está a salvo mi wiki actual?

✅ Compatible hacia atrás desde v1.0.0. Pon `reviewed: true` en cualquier página para protegerla frente a la sobrescritura. Actualizar desde v1.24.x no reescribe tu vault; la ingesta de PDF de v1.25.0 es solo caché por defecto, y v1.27.0 añade ingesta nativa de PDF + imágenes + Office sin cambiar la disposición del wiki en disco.

### ¿Puedo ingestar PDF, imágenes y documentos de Office?

✅ Sí. Anthropic, OpenAI, Bedrock y Gemini leen los PDF de forma nativa; el backend MinerU integrado (v1.27.0) cubre todo lo demás (PDF + imágenes + Office). El tutorial completo —proveedores en la nube, OCR en Apple Silicon, Force PDF Support, mantenimiento de la caché— está en [docs/PDF-OCR-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md).

### ¿Se envían mis datos a alguna parte?

🚫 Sin backend, sin analítica: el plugin se ejecuta entero dentro de Obsidian. Solo sale de tu dispositivo el texto que envías explícitamente para ingestar o consultar, y solo hacia el proveedor LLM que configures. Para una localidad total de los datos, usa Ollama o LM Studio.

### ¿Puedo usar el plugin en mi idioma?

🌍 11 idiomas, tanto para la interfaz como para la salida del wiki, y se ajustan por separado. Un duodécimo depende de contribuciones (el PR #159 es el patrón).

### ¿En qué se diferencia de un chatbot RAG?

Sin troceado, sin embeddings y sin base de datos vectorial. Personalized PageRank recorre el grafo `[[wiki-link]]` que ya mantienes, y eso da contexto de varios saltos con coste cero de embeddings.

### ¿Qué LLM debería usar?

Uno de contexto largo: ≥200K tokens para vaults de más de ~500 páginas. La tabla por niveles está en [docs/MODEL-GUIDE.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/MODEL-GUIDE.md).

### ¿Hay algún benchmark publicado?

PPR @5 = 27.1% frente a una línea base de kNN puro de 24.1%, medido en un vault del proyecto: [Cómo funciona la recuperación](#-cómo-funciona-la-recuperación) dice qué prueba y qué no prueba esa cifra.

### ¿Cómo controlo el coste de la API?

Usa granularidad Gruesa o Mínima para ingestar por lotes. El salto inteligente de lotes detecta los archivos ya ingeridos. El Mantenimiento automático está DESACTIVADO por defecto. Lint muestra los recuentos antes de ejecutar las correcciones: no se cobra nada sin tu aprobación.

### ¿Cómo cancelo una operación en curso?

Haz clic en la barra de estado (muestra "Ingiriendo... clic para cancelar") o `Cmd+P/Ctrl+P` → "Cancelar ingesta actual". Se detiene limpiamente en el siguiente límite de lote.

### ¿Dónde pido ayuda?

[GitHub Issues](https://github.com/GD4AI/obsidian-llm-wiki/issues) para informar de errores · [GitHub Discussions](https://github.com/GD4AI/obsidian-llm-wiki/discussions) para preguntas y propuestas · la consola de desarrollador (`Ctrl+Shift+I` / `Cmd+Option+I`) para los registros del plugin.

---

## 🔒 Privacidad

Este plugin está en el Mercado de Plugins Comunitarios de Obsidian y pasa una revisión automatizada de seguridad y permisos.

- **🚫 Sin backend propio, sin telemetría y sin recogida de datos.** Software puramente local que se ejecuta dentro de Obsidian. El plugin no opera ningún servidor y no informa de nada a nadie.
- **🔐 El acceso a la red es opcional y explícito.** Solo existe para llegar a servicios que configuras *tú*: tu proveedor LLM y, si activas el backend de documentos MinerU, `mineru.net`. Ese segundo caso es la excepción que conviene nombrar: sube el documento a una jurisdicción que no elegiste y que no publica ninguna política de retención. [Dónde se procesa tu documento](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/docs/PDF-OCR-GUIDE.md#-where-your-document-is-processed) enumera todas las rutas y a dónde va el archivo.
- **📁 El acceso a los archivos del vault** sirve para gestionar el wiki (leer notas, generar páginas, buscar enlaces rotos, detectar duplicados). El plugin nunca modifica tus archivos de origen.
- **📋 El acceso al portapapeles** lo usa exclusivamente el botón "Copiar" del modal de consulta, y solo cuando haces clic.

Para una localidad total de los datos, usa Ollama o LM Studio. Con un proveedor local, tus datos nunca salen de tu máquina.

---

## 💖 Apoyar el proyecto

Si Karpathy LLM Wiki se ha vuelto una parte importante de tu forma de trabajar con el conocimiento:

- ☕ **[Invítame a un Ko-fi](https://ko-fi.com/greenerdalii)** — una vez o cada mes
- 💳 **[Propina por PayPal](https://paypal.me/greenerdalii)** — propina puntual

Gracias a quienes apoyan el proyecto:

[@jameses-cyber](https://github.com/jameses-cyber), [@issaqua](https://github.com/issaqua), Dikson Choi

### Contribuir

Los informes de errores y las pull requests sirven igual. [CONTRIBUTING.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CONTRIBUTING.md) cubre la compilación, el ciclo de pruebas y las comprobaciones que debe pasar un cambio; [CODE_OF_CONDUCT.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CODE_OF_CONDUCT.md) es corto. [ROADMAP.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/ROADMAP.md) muestra lo que está planeado y [CHANGELOG.md](https://github.com/GD4AI/obsidian-llm-wiki/blob/main/CHANGELOG.md) registra lo que ya salió.

Compilar desde el código fuente: `pnpm install`, `pnpm build:dev` y `pnpm gate:1`; este último lanza en un solo comando el lint, la comprobación de arquitectura, la comprobación de tipos, la compilación, las pruebas y el lint de CSS. `tools/dev-instrument/` es el instrumento de medición, solo para desarrollo: ejecuta el `WikiEngine.ingestSource` real contra una carpeta del disco sin runtime de Obsidian e imprime el recuento de tokens y el tiempo real por tarea, que es de donde salen las cifras de rendimiento del registro de cambios. La CLI para usuarios vive en un repositorio hermano: `npm i -g karpathywiki-cli`.

---

## 🔭 Otros proyectos

- **[obsidian-llm-wiki-cli](https://github.com/green-dalii/obsidian-llm-wiki-cli)** — el mismo `WikiEngine` sin renderizador: `npm i -g karpathywiki-cli` y luego `karpathywiki-cli ingest --sources <path> --wiki <path> --provider <id> --key <key>`.
- **[pi-shift-router](https://github.com/green-dalii/pi-shift-router)** — un enrutador por turno para [pi-coding-agent](https://github.com/earendil-works/pi): un juez pequeño marca cada turno como rutinario o de peso, y el nivel que elige gobierna el modelo, las herramientas y la cadena de respaldo. MIT. → [shiftrouter.greenerai.top](https://shiftrouter.greenerai.top)
- **[dsh-shift-router](https://github.com/green-dalii/dsh-shift-router)** — el mismo diseño de enrutamiento para el runtime [dsh-coding-agent](https://github.com/earendil-works/dsh). MIT.
- **[dsh-plugin-dev-skill](https://github.com/green-dalii/dsh-plugin-dev-skill)** — el flujo de trabajo para plugins de Obsidian del lado de DSH: monta un espacio de trabajo, conduce un bucle rojo→verde, ejecuta las mismas comprobaciones de calidad que este repositorio y deja una rama `feat/*` o `fix/*` lista para publicar.

---

## 📜 Licencia y créditos

Apache License, versión 2.0 — consulta [LICENSE](../LICENSE), [NOTICE](../NOTICE) y [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md).

**Construido sobre:**
- 💡 [LLM Wiki de Andrej Karpathy](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — el concepto original
- 🛠️ [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- 🔌 [Vercel AI SDK v7](https://ai-sdk.dev/) (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`) a través de `requestUrl` de Obsidian
- 🧮 [Personalized PageRank (Haveliwala 2002)](https://www-cs.stanford.edu/~taherh/papers/topic-sensitive-pagerank-tkde.pdf) y [Monte Carlo PPR (Fogaras 2005)](https://www.cs.cmu.edu/~dpelleg/download/pagerank.pdf) — algoritmos de recuperación

**Mantenedores:** [@green-dalii](https://github.com/green-dalii) (autor) · [@DocTpoint](https://github.com/DocTpoint) (comantenedor desde septiembre de 2026)

[![Star History Chart](https://api.star-history.com/chart?repos=GD4AI/obsidian-llm-wiki&type=timeline&legend=bottom-right&sealed_token=Xa2Oeo4ZXfP48muFa_nEj7wrUaENRLnE0bXSZM7EKTUhHHlmnDFmmxSW80NS8-kXm4kDDMbdzkrZ0MtcqUcmAxB1a1FVVmIIimncTWL9Zg7Ms7j8gnjdCpd0-SyvSc5ubCtUB2zkqtn_V4alrEi7UbBpTlNTdHPva_Vuar5lx9d-ousGG-zhpUk3cGaw)](https://www.star-history.com/?repos=green-dalii%2Fobsidian-llm-wiki&type=timeline&legend=bottom-right)
