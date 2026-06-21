/**
 * Tony AI Proxy - Vercel Serverless Function (RAG)
 *
 * - Retrieves the most relevant chunks from knowledge_base.json (keyword search,
 *   no vector DB needed) and feeds ONLY those to Gemini.
 * - Tony answers strictly from the course notes and refuses off-topic questions.
 * - Returns source page links so Tony can guide students to the right module.
 * - API keys stay server-side and rotate across tony1..tony5 (random start to
 *   spread load across keys under heavy class usage).
 */

import KB from '../knowledge_base.json' with { type: 'json' };

// ---------- Retrieval ----------

const STOP = new Set(('a an the is are was were be been being of to in on for and or ' +
  'with as at by from this that these those it its do does what which how why when ' +
  'where who whom can could should would will i you we they me my your our explain ' +
  'tell about give define difference between vs').split(' '));

function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}

// Pre-tokenize the corpus once per cold start.
const CORPUS = KB.map((c, i) => ({
  i,
  text: c.text || '',
  section: c.section || '',
  title: c.page_title || '',
  url: c.url || '',
  tokens: tokenize(`${c.text} ${c.section} ${c.page_title}`),
}));

function retrieve(query, k = 8) {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const qSet = new Set(qTokens);

  const scored = CORPUS.map(c => {
    let score = 0;
    for (const t of c.tokens) if (qSet.has(t)) score += 1;
    // Boost matches that appear in the heading/section/title (more topical).
    const titleTokens = tokenize(`${c.section} ${c.title}`);
    for (const t of titleTokens) if (qSet.has(t)) score += 1.5;
    // Slightly prefer meatier paragraphs over fragments.
    if (c.text.length > 120) score += 0.25;
    return { ...c, score };
  }).filter(c => c.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// ---------- Handler ----------

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const { query, history } = req.body || {};
  if (!query || !query.trim()) {
    return res.status(400).json({ error: { message: 'Query is required.' } });
  }

  const apiKeys = [
    process.env.tony1, process.env.tony2, process.env.tony3,
    process.env.tony4, process.env.tony5,
    ...((process.env.TONY_API_KEYS || '').split(',')),
  ].map(k => (k || '').trim()).filter(Boolean);

  if (apiKeys.length === 0) {
    return res.status(500).json({ error: { message: 'No API keys configured. Set tony1..tony5 in Vercel Environment Variables.' } });
  }

  // 1) Retrieve relevant course content.
  const hits = retrieve(query, 8);

  // Build a compact, cited context block + the list of source pages.
  const sourcesMap = new Map();
  const contextLines = hits.map((h, n) => {
    if (h.url && !sourcesMap.has(h.url)) {
      sourcesMap.set(h.url, h.title || h.url);
    }
    return `[${n + 1}] (${h.title}) ${h.text}`;
  });
  const sources = [...sourcesMap].map(([url, title]) => ({ url, title }));
  const context = contextLines.join('\n');

  // 2) Build the grounded prompt.
  const SYSTEM = `You are "Tony", a friendly AI study assistant for a university Machine Learning course (the "D.I. Notes" website).

STRICT RULES:
1. Answer ONLY using the COURSE NOTES provided below. Do not use outside knowledge.
2. If the notes do not contain the answer, say you can only help with topics covered in this ML course, and suggest the closest module the student could check.
3. Refuse anything unrelated to Machine Learning / Data Science / this course (politics, coding help unrelated to ML, personal chat, etc.) — politely redirect.
4. Explain like a patient tutor: clear, simple, student-friendly, with a short example when helpful.
5. When relevant, point the student to the page to read more (the website links are shown to them automatically).
6. Keep answers concise (a few short paragraphs max) unless asked to elaborate.
7. Never invent facts, formulas, or page names that are not in the notes.`;

  const historyText = Array.isArray(history)
    ? history.slice(-6).map(m => `${m.role === 'user' ? 'Student' : 'Tony'}: ${m.text}`).join('\n')
    : '';

  const prompt = `${SYSTEM}

===== COURSE NOTES (retrieved for this question) =====
${context || '(no relevant notes found)'}
=====================================================

${historyText ? `Conversation so far:\n${historyText}\n` : ''}Student's question: ${query}

Tony's answer (grounded ONLY in the notes above):`;

  // 3) Call Gemini, rotating keys starting from a random offset.
  const model = 'gemini-2.5-flash';
  const start = Math.floor(Math.random() * apiKeys.length);
  let lastError = null;

  for (let n = 0; n < apiKeys.length; n++) {
    const apiKey = apiKeys[(start + n) % apiKeys.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        }),
      });
      const data = await response.json();

      if (data.error) {
        lastError = data.error;
        continue; // try next key (quota / invalid key / etc.)
      }

      const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return res.status(200).json({ answer, sources });
    } catch (err) {
      lastError = { message: err.message };
      continue;
    }
  }

  const quota = /quota|rate|429|resource has been exhausted/i.test(lastError?.message || '');
  return res.status(quota ? 429 : 500).json({
    error: {
      message: quota
        ? 'Tony is very busy right now (lots of students!). Please wait a few seconds and try again.'
        : `Tony had a problem: ${lastError?.message || 'unknown error'}`,
    },
  });
}