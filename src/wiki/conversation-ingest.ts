// Conversation Ingestor — extract Wiki knowledge from chat conversations.
// Extracted from WikiEngine.

import {
  EngineContext,
  SourceAnalysis,
  ContradictionInfo,
  IngestReport,
} from '../types';
import { PROMPTS } from '../prompts';
import { slugify } from '../core/slug';
import { parseJsonResponse } from '../core/json';
import { cleanMarkdownResponse } from '../core/markdown';
import { applySectionLabels } from './system-prompts';
import { renderTemplate } from '../core/template-renderer';
import { resolveModelForTask } from '../core/model-resolver';
import { getText } from '../core/i18n';
import { UNIVERSAL_LINK_CONSTRAINTS } from './prompts/constraints';
import { TOKENS_CONVERSATION_EXTRACTION, TOKENS_CONVERSATION_PAGE, TOKENS_PAGE_GENERATION, TOKENS_QUERY_SAVE_DEDUP } from '../constants';
import { PageFactory } from './page-factory';
import { SourceAnalysisLLMSchema, ConversationDedupStatusLLMSchema } from '../llm-sdk/output-schemas';
import { callLlm } from '../core/llm-dispatch';
import { localDateStamp } from '../core/format';

export interface ConversationOrchestration {
  ensureWikiStructure: () => Promise<void>;
  apiDelay: (ms?: number) => Promise<void>;
  generateIndex: () => Promise<void>;
  updateLog: (operation: string, analysis: SourceAnalysis, contradictions: ContradictionInfo[]) => Promise<void>;
}

export interface ConversationHistory {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
}

export function formatConversation(history: ConversationHistory): string {
  return history.messages.map(msg => {
    const role = msg.role === 'user' ? '👤 User' : '🤖 Wiki';
    const time = new Date(msg.timestamp).toLocaleTimeString();
    return `### ${role} (${time})\n\n${msg.content}\n\n---\n`;
  }).join('\n');
}

export class ConversationIngestor {
  constructor(
    private ctx: EngineContext,
    private pageFactory: PageFactory,
    private orch: ConversationOrchestration
  ) {}

  async ingestConversation(history: {
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
    }>;
  }): Promise<IngestReport> {
    const startTime = Date.now();
    const client = this.ctx.getClient();
    if (!client) {
      throw new Error('LLM Client not initialized');
    }

    console.debug('=== Starting conversation extraction ===');
    this.ctx.onProgress?.(getText(this.ctx.settings.language, 'convAnalyzing'));

    const actualDate = localDateStamp();
    console.debug('[System time]', actualDate);

    const indexPath = `${this.ctx.settings.wikiFolder}/index.md`;
    const existingWikiIndex = await this.ctx.tryReadFile(indexPath) || 'Wiki is empty';
    console.debug('[Wiki索引]', existingWikiIndex ? '已读取' : '为空');

    const conversationText = formatConversation(history);

    if (existingWikiIndex !== 'Wiki is empty') {
      this.ctx.onProgress?.(getText(this.ctx.settings.language, 'convCheckingExisting'));
      try {
        const dedupResult = await this.checkDedup(existingWikiIndex, conversationText);
        // Issue #398: emit a console.warn so DevTools shows the LLM's actual
        // dedup verdict when the user clicks Save and gets a 0/0/0 notice.
        // The notice itself is surfaced via QueryView.saveToWiki (see
        // QueryView-class.ts — `report.errorMessage`).
        console.debug('[conversation-ingest] dedup verdict:', dedupResult);
        if (dedupResult === 'fully_redundant') {
          console.warn('[conversation-ingest] save skipped: dedup=fully_redundant');
          this.ctx.onProgress?.(getText(this.ctx.settings.language, 'convAlreadyExists'));
          return {
            sourceFile: `Conversation: ${history.messages[0]?.content?.substring(0, 50) || 'unknown'}`,
            createdPages: [],
            updatedPages: [],
            entitiesCreated: 0,
            conceptsCreated: 0,
            failedItems: [],
            contradictionsFound: 0,
            success: true,
            errorMessage: 'Knowledge already exists in Wiki',
          };
        }
      } catch (error) {
        console.debug('Dedup check failed, proceeding with save:', error);
      }
    }

    const analysisPrompt = `You are a Wiki knowledge extraction assistant.

Existing Wiki Index (use this as reference for entity/concept names):
${existingWikiIndex}

User conversation with AI:
${conversationText}

Convert this conversation into structured Wiki pages.

Focus on:
1. Extracting key knowledge points (not full conversation log)
2. Identifying core concepts and entities discussed
3. Summarizing conversation topic and conclusions
4. Entity/concept names should match existing Wiki pages if possible

Actual conversation date: ${actualDate} (use this, do not generate date yourself)

Output JSON format:
{
  "source_title": "Semantic Topic Title (no date, describe the discussion topic)",
  "summary": "Conversation topic summary",
  "entities": [
    {
      "name": "Short Reference Name",
      "type": "person|organization|project|product|event|place|other",
      "summary": "Entity information summary",
      "mentions_in_source": ["Specific mentions in conversation"]
    }
  ],
  "concepts": [
    {
      "name": "Concept Name",
      "type": "theory|method|field|phenomenon|standard|term|other",
      "summary": "Concept definition",
      "mentions_in_source": ["Specific mentions in conversation"],
      "related_concepts": ["Related Concept 1", "Related Concept 2"]
    }
  ],
  "key_points": ["Point 1", "Point 2"],
  "created_pages": [],
  "updated_pages": []
}

CRITICAL RULES:
- source_title: Semantic title describing discussion topic (NOT date-based generic title)
- entity.name: Choose or extract appropriate name from Wiki index (maintain consistency with existing Wiki)
- concept.name: Same principle - reference Wiki index for concept names
- mentions_in_source: REQUIRED field - list actual mentions in conversation text
- DO NOT output mentions_with_provenance for conversations — the page-factory writes Mentions programmatically with a single citation pointing to the conversation summary page (Issue #244).
- If no entities/concepts found, use empty arrays [] (never omit the field)
- Names should be suitable for [[wiki-links]] referencing (judge appropriate naming based on Wiki index)`;

    const analysisArgs = {
      task: 'conversation-extract' as const,
      model: resolveModelForTask(this.ctx.settings, 'ingest'),
      max_tokens: TOKENS_CONVERSATION_EXTRACTION,
      system: await this.ctx.buildSystemPrompt('conversation'),
      messages: [{
        role: 'user' as const,
        content: analysisPrompt
      }],
      response_format: { type: 'json_object' as const, schema: SourceAnalysisLLMSchema },
      ...(this.ctx.settings.disableThinking ? { enableThinking: false } : {}),
    };
    // v1.26.3 PATCH Issue #443 expanded scope: typed-output path. Same
    // schema (SourceAnalysisLLMSchema) as source-analyzer extract.
    const analysisText = await callLlm(client, analysisArgs);

    const parsed = await parseJsonResponse(analysisText, async (malformedJson: string) => {
      const repairPrompt = `Fix the following malformed JSON. Only fix JSON syntax errors (unescaped quotes, trailing commas, missing brackets). Do NOT change any values or content. Output ONLY the fixed JSON, no other text.\n\n${malformedJson}`;
      const repairArgs = {
        task: 'conversation-extract-retry' as const,
        model: resolveModelForTask(this.ctx.settings, 'ingest'),
        max_tokens: TOKENS_PAGE_GENERATION,
        system: await this.ctx.buildSystemPrompt('conversation'),
        messages: [{ role: 'user' as const, content: repairPrompt }],
        response_format: { type: 'json_object' as const, schema: SourceAnalysisLLMSchema },
        ...(this.ctx.settings.disableThinking ? { enableThinking: false } : {}),
      };
      return callLlm(client, repairArgs);
    }) as SourceAnalysis | null;
    if (!parsed) {
      throw new Error('Conversation analysis JSON parsing failed');
    }

    // The page lists are bookkeeping we own, not content the model reports: the
    // prompt asks for them as empty arrays and we push to them as pages are
    // written. Assert them here rather than trusting the reply to have included
    // them — a model that omits `updated_pages` must not turn into a TypeError
    // several stages later, once pages have already been written to disk.
    parsed.created_pages = parsed.created_pages ?? [];
    parsed.updated_pages = parsed.updated_pages ?? [];

    console.debug('[LLM分析结果]', parsed);
    console.debug('[生成的标题]', parsed.source_title);

    this.ctx.onProgress?.(getText(this.ctx.settings.language, 'convCreatingSummary'));
    await this.orch.ensureWikiStructure();

    const preserveCase = this.ctx.settings.slugCase === 'preserve';
    const semanticSlug = slugify(parsed.source_title, preserveCase);
    const summaryPath = `${this.ctx.settings.wikiFolder}/sources/${semanticSlug}.md`;
    console.debug('[Semantic file path]', summaryPath);

    // Build planned paths before summary so the LLM can reference them
    const convPlannedPaths: string[] = [summaryPath];
    for (const entity of parsed.entities) {
      convPlannedPaths.push(`${this.ctx.settings.wikiFolder}/entities/${slugify(entity.name, preserveCase)}.md`);
    }
    for (const concept of parsed.concepts) {
      convPlannedPaths.push(`${this.ctx.settings.wikiFolder}/concepts/${slugify(concept.name, preserveCase)}.md`);
    }

    const createdPagesList = convPlannedPaths.length > 0
      ? convPlannedPaths.map(p => {
          const relPath = p.replace(this.ctx.settings.wikiFolder + '/', '').replace('.md', '');
          const name = relPath.split('/').pop() || relPath;
          return `- [[${relPath}|${name}]]`;
        }).join('\n')
      : '(none)';

    const tags = parsed.concepts.map(c => c.name).join(', ');

    const summaryPrompt = renderTemplate(PROMPTS.generateSummaryPage, {
      source_title: parsed.source_title,
      content: conversationText.substring(0, 500),
      analysis: JSON.stringify(parsed),
      created_pages_list: createdPagesList,
      source_file: `Conversation: ${parsed.source_title}`,
      date: actualDate,
      tags,
      constraints: UNIVERSAL_LINK_CONSTRAINTS,
    });

    const finalSummaryPrompt = applySectionLabels(summaryPrompt, this.ctx.settings);

    this.ctx.onProgress?.(getText(this.ctx.settings.language, 'convGeneratingSummary'));
    const summaryPageContent = await client.createMessage({
      task: 'conversation-page',
      model: resolveModelForTask(this.ctx.settings, 'ingest'),
      max_tokens: TOKENS_CONVERSATION_PAGE,
      system: await this.ctx.buildSystemPrompt('summary'),
      messages: [{ role: 'user', content: finalSummaryPrompt }],
      ...(this.ctx.settings.disableThinking ? { enableThinking: false } : {}),
    });

    const cleanedSummary = cleanMarkdownResponse(summaryPageContent);
    await this.ctx.createOrUpdateFile(summaryPath, cleanedSummary);
    parsed.created_pages.push(summaryPath);

    const failedItems: Array<{ type: 'entity' | 'concept'; name: string; reason: string }> = [];

    for (const entity of parsed.entities) {
      await this.orch.apiDelay();
      this.ctx.onProgress?.(
        getText(this.ctx.settings.language, 'convSavingEntity').replace('{name}', entity.name)
      );
      try {
        const entityResult = await this.pageFactory.createOrUpdateEntityPage(entity, parsed, { path: summaryPath, basename: semanticSlug }, convPlannedPaths);
        if (entityResult.path) {
          (entityResult.created ? parsed.created_pages : parsed.updated_pages)
            .push(entityResult.path);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`Conversation entity "${entity.name}" failed:`, error);
        failedItems.push({ type: 'entity', name: entity.name, reason });
      }
    }

    for (const concept of parsed.concepts) {
      await this.orch.apiDelay();
      this.ctx.onProgress?.(
        getText(this.ctx.settings.language, 'convSavingConcept').replace('{name}', concept.name)
      );
      try {
        const conceptResult = await this.pageFactory.createOrUpdateConceptPage(concept, parsed, { path: summaryPath, basename: semanticSlug }, convPlannedPaths);
        if (conceptResult.path) {
          (conceptResult.created ? parsed.created_pages : parsed.updated_pages)
            .push(conceptResult.path);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`Conversation concept "${concept.name}" failed:`, error);
        failedItems.push({ type: 'concept', name: concept.name, reason });
      }
    }

    this.ctx.onProgress?.(getText(this.ctx.settings.language, 'convGeneratingIndex'));
    await this.orch.generateIndex();
    // The merge triage fires `onContradiction` here too, but nothing collects
    // it for a conversation run yet — the entry and the report say zero.
    await this.orch.updateLog('conversation', parsed, []);

    const entitiesCreated = parsed.created_pages.filter(p => p.includes('/entities/')).length;
    const conceptsCreated = parsed.created_pages.filter(p => p.includes('/concepts/')).length;

    const report: IngestReport = {
      sourceFile: `Conversation: ${parsed.source_title}`,
      createdPages: parsed.created_pages,
      updatedPages: parsed.updated_pages || [],
      entitiesCreated,
      conceptsCreated,
      failedItems,
      contradictionsFound: 0,
      success: true,
      elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
    };

    console.debug('=== Conversation extraction complete ===');
    console.debug('Created pages:', parsed.created_pages);

    this.ctx.onDone?.(report);
    return report;
  }

  private async checkDedup(wikiIndex: string, conversationText: string): Promise<string> {
    const summary = conversationText.substring(0, 1500);
    const prompt = renderTemplate(PROMPTS.dedupCheck, {
      wiki_index: wikiIndex.substring(0, 3000),
      conversation_summary: summary,
    });

    const client = this.ctx.getClient();
    if (!client) throw new Error('LLM client not initialized');

    const dedupArgs = {
      task: 'conversation-save-dedup' as const,
      model: resolveModelForTask(this.ctx.settings, 'ingest'),
      max_tokens: TOKENS_QUERY_SAVE_DEDUP,
      system: await this.ctx.buildSystemPrompt('conversation'),
      messages: [{ role: 'user' as const, content: prompt }],
      // v1.26.3 PATCH Issue #443 expanded scope: typed-output path. Uses
      // ConversationDedupStatusLLMSchema ({status: string}) on the wire as
      // Tier 0 json_schema — LMStudio accepts, no parse-error fallback to
      // English welcome. Caller falls back to parseJsonResponse on legacy
      // clients without createMessageWithOutput.
      response_format: { type: 'json_object' as const, schema: ConversationDedupStatusLLMSchema },
      ...(this.ctx.settings.disableThinking ? { enableThinking: false } : {}),
    };
    const dedupText = await callLlm(client, dedupArgs);

    const parsed = await parseJsonResponse(dedupText) as { status?: string } | null;
    return parsed?.status || 'entirely_new';
  }
}
