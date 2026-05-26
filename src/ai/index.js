/**
 * Qatlam 3 — AI Grounding orchestrator
 * Muhim: AI TOPIB BERMAYDI — tushuntiradi va fix taklif qiladi.
 */
import { extractFileContext } from './extractors/ast-context.js';
import { buildGroundedPrompt, buildBatchPrompt } from './prompts/prompt-builder.js';
import { callClaudeAPI, callClaudeAPIBatch } from './prompts/claude-client.js';
import { aggregateFindings } from './aggregator.js';
import { buildAIReport } from './reporters/ai-reporter.js';

export async function runAIAnalysis(opts) {
  const {
    findings = [],
    projectPath = '.',
    apiKey,
    maxFindings = 20,
    outputDir = './perf-reports',
    format = 'console',
  } = opts;

  // API key — env variable dan yoki CLI dan (claude-client.js da aniqlanadi)
  const resolvedKey = apiKey
    || process.env.GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.ANTHROPIC_API_KEY
    || null;

  if (findings.length === 0) {
    console.log('\n✅ AI analiz: topilma yoq, hamma narsa joyida!\n');
    return { aiResults: [], summary: { total: 0, processed: 0 } };
  }

  console.log(`\n🤖  AI Qatlam — ${findings.length} ta topilmadan eng muhimlarini tahlil qiladi...\n`);

  const prioritized = aggregateFindings(findings, maxFindings);
  console.log(`   📋 ${prioritized.length} ta finding AI ga yuboriladi\n`);

  // Barcha findinglar uchun fayl kontekstlarini parallel yuklash
  console.log('   📂 Fayl kontekstlari yuklanmoqda...');
  const items = await Promise.all(
    prioritized.map(async (finding) => {
      const context = await extractFileContext(finding, projectPath).catch(() => null);
      return { finding, context };
    })
  );

  // BATCH rejim: bitta API so'rovda barcha findinglarni tahlil qilamiz
  // Bu Gemini Free tier rate limit muammosini hal qiladi
  const aiResults = [];
  console.log('   🚀 Batch so\'rov yuborilmoqda (1 ta so\'rov barcha findinglar uchun)...\n');

  try {
    const batchPrompt = buildBatchPrompt(items);
    const batchResponse = await callClaudeAPIBatch(batchPrompt, resolvedKey);

    // Batch javob array bo'lishi kerak
    const responses = Array.isArray(batchResponse) ? batchResponse : [];

    for (let i = 0; i < items.length; i++) {
      const { finding, context } = items[i];
      const ai = responses[i] || { error: 'Batch javobda bu finding uchun natija topilmadi' };
      const ok = !ai.error;
      console.log(`   [${i + 1}/${items.length}] ${finding.rule} — ${ok ? '✓' : '⚠ ' + ai.error}`);
      aiResults.push({
        finding,
        context: context ? { file: context.file, lines: context.extractedLines, totalLines: context.totalLines } : null,
        ai,
      });
    }
  } catch (err) {
    // Batch muvaffaqiyatsiz bo'lsa, individual so'rovlarga fallback qilamiz
    console.log(`   ⚠ Batch muvaffaqiyatsiz (${err.message}). Individual so'rovlarga o'tilmoqda...\n`);
    let processed = 0;

    for (const { finding, context } of items) {
      process.stdout.write(`   [${++processed}/${items.length}] ${finding.rule}...`);
      try {
        const prompt = buildGroundedPrompt(finding, context);
        const response = await callClaudeAPI(prompt, resolvedKey);
        aiResults.push({
          finding,
          context: context ? { file: context.file, lines: context.extractedLines, totalLines: context.totalLines } : null,
          ai: response,
        });
        process.stdout.write(' ✓\n');
      } catch (indErr) {
        process.stdout.write(` ⚠ ${indErr.message}\n`);
        aiResults.push({ finding, context: null, ai: { error: indErr.message } });
      }
      if (processed < items.length) await sleep(4000); // 4s = 15 RPM limit uchun xavfsiz
    }
  }

  const summary = {
    total: findings.length,
    processed: aiResults.length,
    successful: aiResults.filter(r => !r.ai.error).length,
    failed: aiResults.filter(r => r.ai.error).length,
    bySeverity: {
      critical: aiResults.filter(r => r.finding.severity === 'critical').length,
      warning: aiResults.filter(r => r.finding.severity === 'warning').length,
    },
  };

  await buildAIReport({ aiResults, summary, outputDir, format });
  return { aiResults, summary };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

