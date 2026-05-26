/**
 * Job runner — perf-check CLI'ni child_process orqali ishga tushiradi,
 * stdout/stderr ni real vaqtda WebSocket subscriber'larga uzatadi,
 * SQLite ga skan natijalarini yozadi.
 */
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDB } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../bin/perf-check.js');
const REPORTS_ROOT = resolve(__dirname, '../../perf-reports');
const LOGS_ROOT = resolve(__dirname, '../../.perf-data/logs');

class JobRunner extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
    this.jobs = new Map(); // jobId -> { proc, logs[], status, ... }
    mkdirSync(LOGS_ROOT, { recursive: true });
    mkdirSync(REPORTS_ROOT, { recursive: true });
    this._cleanupOrphanJobs();
  }

  /**
   * Server qayta ishga tushganda, DB da 'running' deb yotgan job'larni
   * 'failed' qilib belgilash (jarayon yo'qolgan).
   */
  _cleanupOrphanJobs() {
    try {
      const db = getDB();
      const orphans = db.prepare("SELECT id FROM scans WHERE status = 'running'").all();
      if (orphans.length) {
        db.prepare(`
          UPDATE scans SET status='failed', finished_at=?, error_message='Server qayta ishga tushdi — job uzilgan'
          WHERE status='running'
        `).run(Date.now());
        console.log(`Job-runner: ${orphans.length} ta orphan job 'failed' deb belgilandi`);
      }
    } catch (err) {
      console.error('Orphan cleanup xato:', err.message);
    }
  }

  /**
   * Yangi skan boshlash.
   * @param {object} opts
   * @param {object} opts.project — DB dan projects qatori
   * @param {string[]} opts.layers — ['static','runtime','ai']
   * @param {object} opts.config — { scenario, runs, apiKey, ... }
   * @returns {string} jobId
   */
  start({ project, layers, config = {} }) {
    const jobId = nanoid(10);
    const args = this._buildArgs({ project, layers, config, jobId });
    const reportDir = join(REPORTS_ROOT, jobId);
    const logPath = join(LOGS_ROOT, `${jobId}.log`);
    mkdirSync(reportDir, { recursive: true });

    const env = {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    };
    if (config.geminiApiKey) env.GEMINI_API_KEY = config.geminiApiKey;
    if (config.anthropicApiKey) env.ANTHROPIC_API_KEY = config.anthropicApiKey;

    const proc = spawn(process.execPath, [CLI_PATH, ...args], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const job = {
      id: jobId,
      projectId: project.id,
      status: 'running',
      exitCode: null,
      logs: [],
      proc,
      logPath,
      reportDir,
      layers,
      startedAt: Date.now(),
      finishedAt: null,
    };
    this.jobs.set(jobId, job);

    // DB yozish
    const db = getDB();
    db.prepare(`
      INSERT INTO scans (id, project_id, layers, scenario, runs, status, log_path, report_dir, started_at)
      VALUES (@id, @projectId, @layers, @scenario, @runs, 'running', @logPath, @reportDir, @startedAt)
    `).run({
      id: jobId,
      projectId: project.id,
      layers: JSON.stringify(layers),
      scenario: config.scenario || project.scenario || 'desktop',
      runs: config.runs || 3,
      logPath,
      reportDir,
      startedAt: job.startedAt,
    });

    const fileBuffer = [];
    const appendLog = (stream, chunk) => {
      const text = stripAnsi(chunk.toString());
      const entry = { stream, text, ts: Date.now() };
      job.logs.push(entry);
      if (job.logs.length > 5000) job.logs.shift();
      fileBuffer.push(`[${stream}] ${text}`);
      this.emit(`log:${jobId}`, entry);
    };

    proc.stdout.on('data', chunk => appendLog('out', chunk));
    proc.stderr.on('data', chunk => appendLog('err', chunk));

    proc.on('error', err => {
      job.status = 'failed';
      job.errorMessage = err.message;
      this._finalize(job, fileBuffer);
    });

    proc.on('close', code => {
      job.exitCode = code;
      job.status = code === 0 ? 'completed' : (code === null ? 'cancelled' : 'failed');
      this._finalize(job, fileBuffer);
    });

    return jobId;
  }

  _finalize(job, fileBuffer) {
    job.finishedAt = Date.now();
    try {
      writeFileSync(job.logPath, fileBuffer.join(''));
    } catch {}

    const summary = extractSummary(job.reportDir);

    const db = getDB();
    db.prepare(`
      UPDATE scans
      SET status=@status, exit_code=@exitCode, finished_at=@finishedAt,
          error_message=@errorMessage, result_summary=@summary
      WHERE id=@id
    `).run({
      id: job.id,
      status: job.status,
      exitCode: job.exitCode,
      finishedAt: job.finishedAt,
      errorMessage: job.errorMessage || null,
      summary: summary ? JSON.stringify(summary) : null,
    });

    // Snapshot yozish (trend uchun) — regression aniqlash bilan
    if (summary?.findings) {
      try {
        const regression = detectRegression(db, job.projectId, summary);
        db.prepare(`
          INSERT INTO snapshots (project_id, scan_id, taken_at, lighthouse, lcp, inp, cls,
            total_kb, critical_count, warning_count, info_count, regression)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          job.projectId,
          job.id,
          job.finishedAt,
          summary.lighthouse,
          summary.lcp,
          summary.inp,
          summary.cls,
          summary.totalKb,
          summary.findings.critical || 0,
          summary.findings.warning || 0,
          summary.findings.info || 0,
          regression ? 1 : 0,
        );
        if (regression) summary.regression = regression;
      } catch (err) {
        console.error('Snapshot yozishda xato:', err.message);
      }
    }

    this.emit(`status:${job.id}`, {
      status: job.status,
      exitCode: job.exitCode,
      finishedAt: job.finishedAt,
      summary,
    });
  }

  _buildArgs({ project, layers, config, jobId }) {
    const reportDir = join(REPORTS_ROOT, jobId);
    const hasStatic = layers.includes('static');
    const hasRuntime = layers.includes('runtime');
    const hasAI = layers.includes('ai');

    // 'full' rejimi static+runtime+ai birga
    if (hasStatic && hasRuntime) {
      const args = ['full', '--project', project.path, '--output', reportDir];
      if (project.url) args.push('--url', project.url);
      if (config.scenario || project.scenario) args.push('--scenario', config.scenario || project.scenario);
      if (project.framework && project.framework !== 'auto') args.push('--framework', project.framework);
      if (config.runs) args.push('--runs', String(config.runs));
      if (!hasAI) args.push('--no-ai');
      if (project.chrome_profile) args.push('--chrome-profile', project.chrome_profile);
      if (project.user_data_dir) args.push('--user-data-dir', project.user_data_dir);
      return args;
    }

    if (hasRuntime) {
      const args = ['runtime', '--url', project.url || '', '--output', reportDir, '--format', 'all'];
      if (config.scenario || project.scenario) args.push('--scenario', config.scenario || project.scenario);
      if (project.framework && project.framework !== 'auto') args.push('--framework', project.framework);
      if (config.runs) args.push('--runs', String(config.runs));
      if (project.chrome_profile) args.push('--chrome-profile', project.chrome_profile);
      if (project.user_data_dir) args.push('--user-data-dir', project.user_data_dir);
      return args;
    }

    if (hasAI) {
      return ['ai', '--project', project.path, '--output', reportDir, '--format', 'html'];
    }

    // Default: faqat static
    return ['--project', project.path, '--output', reportDir, '--format', 'all'];
  }

  /**
   * Subscriber qo'shish — mavjud loglar + live stream.
   * @returns {function} unsubscribe
   */
  subscribe(jobId, listener) {
    const job = this.jobs.get(jobId);
    if (job) {
      // Avvalgi loglarni yuborish
      for (const entry of job.logs) listener({ type: 'log', ...entry });
      if (job.status !== 'running') {
        listener({ type: 'status', status: job.status, exitCode: job.exitCode });
        return () => {};
      }
    }
    const logHandler = (data) => listener({ type: 'log', ...data });
    const statusHandler = (data) => listener({ type: 'status', ...data });
    this.on(`log:${jobId}`, logHandler);
    this.on(`status:${jobId}`, statusHandler);
    return () => {
      this.off(`log:${jobId}`, logHandler);
      this.off(`status:${jobId}`, statusHandler);
    };
  }

  cancel(jobId) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') return false;
    try {
      job.proc.kill('SIGTERM');
      setTimeout(() => {
        if (job.status === 'running') job.proc.kill('SIGKILL');
      }, 3000);
      return true;
    } catch {
      return false;
    }
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }
}

function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
}

/**
 * Hisobot JSON faylini o'qib snapshot uchun summary chiqaradi.
 * 3 ta CLI variant uchun ishlaydi: static-only, runtime-only, full.
 */
function extractSummary(reportDir) {
  const candidates = [
    'perf-report.json',          // static, runtime yoki full
    'runtime-report.json',       // ehtimol kelajakda
  ];
  for (const name of candidates) {
    const path = join(reportDir, name);
    if (!existsSync(path)) continue;
    try {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      // 1) Full pipeline: { meta: { findings: { critical, warning, info } }, runtime, ... }
      if (data.meta?.findings && typeof data.meta.findings === 'object'
          && 'critical' in data.meta.findings) {
        return {
          findings: data.meta.findings,
          lighthouse: extractLighthouse(data.runtime?.lighthouseResult),
          lcp: data.runtime?.rawMetrics?.vitals?.LCP ?? null,
          inp: data.runtime?.rawMetrics?.vitals?.INP ?? null,
          cls: data.runtime?.rawMetrics?.vitals?.CLS ?? null,
          totalKb: data.runtime?.rawMetrics?.network?.totalTransferKB ?? null,
          source: 'full',
        };
      }
      // 2) Static-only yoki runtime-only: { findings, summary: { bySeverity, ... }, meta? }
      if (data.summary?.bySeverity) {
        const isRuntime = !!(data.rawMetrics || data.lighthouseResult);
        return {
          findings: data.summary.bySeverity,
          lighthouse: isRuntime ? extractLighthouse(data.lighthouseResult) : null,
          lcp: isRuntime ? data.rawMetrics?.vitals?.LCP ?? null : null,
          inp: isRuntime ? data.rawMetrics?.vitals?.INP ?? null : null,
          cls: isRuntime ? data.rawMetrics?.vitals?.CLS ?? null : null,
          totalKb: isRuntime ? data.rawMetrics?.network?.totalTransferKB ?? null : null,
          source: isRuntime ? 'runtime' : 'static',
        };
      }
    } catch (err) {
      // Fayl buzilgan bo'lsa, davom etamiz
    }
  }
  return null;
}

function extractLighthouse(lhResult) {
  const score = lhResult?.categories?.performance?.score;
  return typeof score === 'number' ? Math.round(score * 100) : null;
}

/**
 * Regression aniqlash — oldingi snapshot bilan solishtirib.
 * Kritik o'sish, Lighthouse -5pt, LCP +20%.
 */
function detectRegression(db, projectId, current) {
  const prev = db.prepare(`
    SELECT * FROM snapshots WHERE project_id = ? ORDER BY taken_at DESC LIMIT 1
  `).get(projectId);
  if (!prev) return null;

  const reasons = [];
  const curCritical = current.findings?.critical || 0;
  if (curCritical > (prev.critical_count || 0)) {
    reasons.push(`critical ${prev.critical_count || 0} → ${curCritical}`);
  }
  if (current.lighthouse != null && prev.lighthouse != null
      && current.lighthouse < prev.lighthouse - 5) {
    reasons.push(`Lighthouse ${prev.lighthouse} → ${current.lighthouse}`);
  }
  if (current.lcp && prev.lcp && current.lcp > prev.lcp * 1.2) {
    reasons.push(`LCP ${Math.round(prev.lcp)}ms → ${Math.round(current.lcp)}ms`);
  }
  return reasons.length ? reasons.join(', ') : null;
}

export const jobRunner = new JobRunner();
