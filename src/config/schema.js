/**
 * perf.config.js uchun zod schema. Action-oriented xato xabarlari.
 */
import { z } from 'zod';

const SeverityCount = z.object({
  critical: z.number().int().min(0).optional(),
  warning: z.number().int().min(0).optional(),
}).optional();

const BundleSize = z.object({
  totalJS: z.number().int().positive().optional(),
  totalCSS: z.number().int().positive().optional(),
  initialJS: z.number().int().positive().optional(),
}).optional();

const Lighthouse = z.object({
  performance: z.number().int().min(0).max(100).optional(),
  accessibility: z.number().int().min(0).max(100).optional(),
  bestPractices: z.number().int().min(0).max(100).optional(),
}).optional();

const WebVitals = z.object({
  LCP: z.number().positive().optional(),
  INP: z.number().positive().optional(),
  CLS: z.number().nonnegative().optional(),
  FCP: z.number().positive().optional(),
  TTFB: z.number().positive().optional(),
  TBT: z.number().nonnegative().optional(),
}).optional();

const RuntimeBudget = z.object({
  lighthouseScore: z.number().int().min(0).max(100).optional(),
  longTaskCount: z.number().int().nonnegative().optional(),
  totalTransferSize: z.number().positive().optional(),
  jsTransferSize: z.number().positive().optional(),
  imageTransferSize: z.number().positive().optional(),
  maxComponentRenders: z.number().int().positive().optional(),
  domNodes: z.number().int().positive().optional(),
  jsHeapMB: z.number().positive().optional(),
}).optional();

const Budget = z.object({
  bundleSize: BundleSize,
  lighthouse: Lighthouse,
  findings: SeverityCount,
  webVitals: WebVitals,
  runtime: RuntimeBudget,
}).optional();

export const PerfConfigSchema = z.object({
  project: z.string().optional(),
  format: z.enum(['console', 'json', 'html', 'all']).optional(),
  outputDir: z.string().optional(),
  budget: Budget,
  ignore: z.array(z.string()).optional(),
  rules: z.record(z.string(), z.union([z.literal('off'), z.literal('info'), z.literal('warning'), z.literal('critical')])).optional(),
}).passthrough(); // foydalanuvchi qo'shimcha maydonlar qo'sha oladi

export const ProjectsConfigSchema = z.object({
  concurrency: z.number().int().positive().max(32).optional(),
  historyDir: z.string().optional(),
  outputDir: z.string().optional(),
  projects: z.array(z.object({
    name: z.string().min(1),
    path: z.string().min(1),
    url: z.string().url().optional(),
    framework: z.enum(['vue', 'vue2', 'vue3', 'react', 'next', 'nuxt']).optional(),
    scenario: z.enum(['desktop', 'mobile', 'slow']).optional(),
    runs: z.number().int().positive().max(10).optional(),
    lighthouse: z.boolean().optional(),
  })).min(1),
});

/**
 * @param {Object} cfg - raw config
 * @returns {Object} { ok: true, data } yoki { ok: false, error: string }
 */
export function validatePerfConfig(cfg) {
  const result = PerfConfigSchema.safeParse(cfg);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: formatZodError(result.error) };
}

export function validateProjectsConfig(cfg) {
  const result = ProjectsConfigSchema.safeParse(cfg);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: formatZodError(result.error) };
}

function formatZodError(error) {
  const lines = ['Config validatsiya xatoligi:'];
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '(root)';
    lines.push(`  • ${path}: ${issue.message}`);
    if (issue.code === 'unrecognized_keys') {
      lines.push(`    Maslahat: kalit nomini tekshiring (camelCase: totalJS, totalCSS).`);
    }
  }
  return lines.join('\n');
}
