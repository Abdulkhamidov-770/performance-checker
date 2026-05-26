/**
 * Multi-provider AI klient
 * Qo'llab-quvvatlanadigan provayderlar:
 *   - Google Gemini (AI Studio — BEPUL) — tavsiya etiladi
 *   - Anthropic Claude
 *
 * Provider avtomatik aniqlanadi:
 *   GEMINI_API_KEY    → Google Gemini
 *   ANTHROPIC_API_KEY → Anthropic Claude
 *   --api-key sk-ant-... → Anthropic
 *   --api-key AIza...   → Gemini
 */

const MAX_TOKENS = 1500;
const MAX_TOKENS_BATCH = 8000;

const SYSTEM_PROMPT =
  'Sen frontend performance ekspertisan. ' +
  'Faqat berilgan kod asosida tahlil qil. ' +
  'Har doim faqat sof JSON qaytarasan — markdown, blok yoki izoh qoshmasin. ' +
  'Javob toghridan-toghri { bilan boshlanishi va } bilan tugashi kerak.';

function detectProvider(apiKey) {
  if (!apiKey) {
    if (process.env.GEMINI_API_KEY) return { provider: 'gemini', key: process.env.GEMINI_API_KEY };
    if (process.env.GOOGLE_API_KEY) return { provider: 'gemini', key: process.env.GOOGLE_API_KEY };
    if (process.env.ANTHROPIC_API_KEY) return { provider: 'anthropic', key: process.env.ANTHROPIC_API_KEY };
    throw new Error(
      'API key topilmadi.\n\n' +
      '  Google AI Studio (BEPUL):\n' +
      '    Windows: set GEMINI_API_KEY=AIza...\n' +
      '    Mac/Linux: export GEMINI_API_KEY=AIza...\n\n' +
      '  Anthropic Claude:\n' +
      '    Windows: set ANTHROPIC_API_KEY=sk-ant-...\n' +
      '    Mac/Linux: export ANTHROPIC_API_KEY=sk-ant-...\n\n' +
      '  Yoki CLI da: --api-key AIza... (Gemini) yoki --api-key sk-ant-... (Anthropic)'
    );
  }
  if (apiKey.startsWith('AIza')) return { provider: 'gemini', key: apiKey };
  if (apiKey.startsWith('sk-ant-') || apiKey.startsWith('sk-')) return { provider: 'anthropic', key: apiKey };
  return { provider: 'gemini', key: apiKey };
}

export async function callClaudeAPI(prompt, apiKey) {
  const { provider, key } = detectProvider(apiKey);
  return provider === 'gemini' ? callGemini(prompt, key) : callAnthropic(prompt, key);
}

/**
 * Batch chaqiruv — barcha findinglarni bitta API so'rovda tahlil qiladi.
 * Rate limit muammosini hal qiladi.
 * @param {string} batchPrompt - Barcha findinglarni o'z ichiga olgan prompt
 * @param {string|null} apiKey
 * @returns {Array} - Har finding uchun AI natijasi
 */
export async function callClaudeAPIBatch(batchPrompt, apiKey) {
  const { provider, key } = detectProvider(apiKey);
  return provider === 'gemini' ? callGeminiBatch(batchPrompt, key) : callAnthropicBatch(batchPrompt, key);
}

async function callGemini(prompt, apiKey) {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: MAX_TOKENS,
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });
  } catch (err) {
    throw new Error(`Gemini API xato: ${err.message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 400) throw new Error('Gemini: noto\'g\'ri so\'rov.');
    if (response.status === 401 || response.status === 403) throw new Error('Gemini API key noto\'g\'ri.');
    if (response.status === 429) throw new Error('Gemini rate limit. Biroz kuting.');
    throw new Error(`Gemini API xato ${response.status}: ${body.slice(0, 150)}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!rawText) throw new Error(`Gemini bo'sh javob (${data.candidates?.[0]?.finishReason})`);
  return parseJSONResponse(rawText);
}

async function callAnthropic(prompt, apiKey) {
  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err) {
    throw new Error(`Anthropic API xato: ${err.message}`);
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('Anthropic API key noto\'g\'ri.');
    if (response.status === 429) throw new Error('Anthropic rate limit. Biroz kuting.');
    throw new Error(`Anthropic API xato ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content?.filter(b => b.type === 'text')?.map(b => b.text)?.join('') || '';
  return parseJSONResponse(rawText);
}

async function callGeminiBatch(prompt, apiKey) {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: MAX_TOKENS_BATCH,
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });
  } catch (err) {
    throw new Error(`Gemini API xato: ${err.message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 400) throw new Error('Gemini: noto\'g\'ri so\'rov.');
    if (response.status === 401 || response.status === 403) throw new Error('Gemini API key noto\'g\'ri.');
    if (response.status === 429) throw new Error('Gemini rate limit. Biroz kuting.');
    throw new Error(`Gemini API xato ${response.status}: ${body.slice(0, 150)}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!rawText) throw new Error(`Gemini bo'sh javob (${data.candidates?.[0]?.finishReason})`);
  return parseArrayOrObjectResponse(rawText);
}

async function callAnthropicBatch(prompt, apiKey) {
  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: MAX_TOKENS_BATCH,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err) {
    throw new Error(`Anthropic API xato: ${err.message}`);
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('Anthropic API key noto\'g\'ri.');
    if (response.status === 429) throw new Error('Anthropic rate limit. Biroz kuting.');
    throw new Error(`Anthropic API xato ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content?.filter(b => b.type === 'text')?.map(b => b.text)?.join('') || '';
  return parseArrayOrObjectResponse(rawText);
}

function parseArrayOrObjectResponse(raw) {
  if (!raw || raw.trim() === '') throw new Error('Bo\'sh javob');
  const trimmed = raw.trim();
  try { return JSON.parse(trimmed); } catch {}
  const block = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (block) { try { return JSON.parse(block[1].trim()); } catch {} }
  // Array yoki object qidirish
  const arrMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch {} }
  const objMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
  return null;
}

function parseJSONResponse(raw) {
  if (!raw || raw.trim() === '') throw new Error('Bo\'sh javob');
  try { return JSON.parse(raw.trim()); } catch {}
  const block = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (block) { try { return JSON.parse(block[1].trim()); } catch {} }
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  return {
    explanation: raw.slice(0, 500),
    fix_code: null, fix_explanation: null,
    performance_impact: null, priority: 3,
    priority_reason: 'Parse xatosi', related_files: [], _parseError: true,
  };
}

