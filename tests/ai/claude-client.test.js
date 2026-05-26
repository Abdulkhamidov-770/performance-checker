/**
 * Claude/Gemini client — parseJSONResponse va detectProvider ni test qilamiz.
 * fetch ni mock qilib API call'larni tekshiramiz.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callClaudeAPI } from '../../src/ai/prompts/claude-client.js';

const VALID_JSON = {
  explanation: 'foo',
  fix_code: 'bar',
  fix_explanation: 'baz',
  performance_impact: 'qux',
  priority: 1,
  priority_reason: 'reason',
  related_files: [],
};

describe('callClaudeAPI — provider detection', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  it('AIza... key → Gemini endpoint', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_JSON) }] } }],
      }),
    });
    await callClaudeAPI('test', 'AIzaTestKey');
    const url = fetchSpy.mock.calls[0][0];
    expect(url).toContain('generativelanguage.googleapis.com');
  });

  it('sk-ant-... key → Anthropic endpoint', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify(VALID_JSON) }],
      }),
    });
    await callClaudeAPI('test', 'sk-ant-TestKey');
    const url = fetchSpy.mock.calls[0][0];
    expect(url).toContain('api.anthropic.com');
  });

  it('key yo\'q → throw helpful error', async () => {
    await expect(callClaudeAPI('test', null)).rejects.toThrow(/API key/);
  });

  it('env GEMINI_API_KEY ham detect bo\'ladi', async () => {
    process.env.GEMINI_API_KEY = 'AIzaEnv';
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_JSON) }] } }],
      }),
    });
    await callClaudeAPI('test', null);
    const url = fetchSpy.mock.calls[0][0];
    expect(url).toContain('generativelanguage');
  });
});

describe('callClaudeAPI — JSON parse', () => {
  let fetchSpy;

  beforeEach(() => { fetchSpy = vi.spyOn(globalThis, 'fetch'); });
  afterEach(() => { fetchSpy.mockRestore(); });

  it('toza JSON parse qilinadi', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify(VALID_JSON) }],
      }),
    });
    const r = await callClaudeAPI('test', 'sk-ant-K');
    expect(r.explanation).toBe('foo');
    expect(r.priority).toBe(1);
  });

  it('```json ... ``` block ichidan ham parse qilinadi', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '```json\n' + JSON.stringify(VALID_JSON) + '\n```' }],
      }),
    });
    const r = await callClaudeAPI('test', 'sk-ant-K');
    expect(r.explanation).toBe('foo');
  });

  it('text + JSON aralash — { ... } topib parse qiladi', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Mana javob: ' + JSON.stringify(VALID_JSON) + ' tamom.' }],
      }),
    });
    const r = await callClaudeAPI('test', 'sk-ant-K');
    expect(r.explanation).toBe('foo');
  });

  it('butunlay xato JSON → fallback object qaytariladi (_parseError)', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'this is not json at all just words and stuff' }],
      }),
    });
    const r = await callClaudeAPI('test', 'sk-ant-K');
    expect(r._parseError).toBe(true);
    expect(r.explanation).toBeDefined();
  });
});

describe('callClaudeAPI — error handling', () => {
  let fetchSpy;
  beforeEach(() => { fetchSpy = vi.spyOn(globalThis, 'fetch'); });
  afterEach(() => { fetchSpy.mockRestore(); });

  it('401 → "API key noto\'g\'ri"', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 401, text: async () => '' });
    await expect(callClaudeAPI('t', 'sk-ant-K')).rejects.toThrow(/key.*noto/i);
  });

  it('429 → rate limit', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 429, text: async () => '' });
    await expect(callClaudeAPI('t', 'sk-ant-K')).rejects.toThrow(/rate limit/i);
  });

  it('network error → ko\'rsatuvchi xato', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    await expect(callClaudeAPI('t', 'sk-ant-K')).rejects.toThrow(/network down|API/);
  });
});
