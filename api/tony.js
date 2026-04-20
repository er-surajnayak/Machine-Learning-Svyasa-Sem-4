/**
 * Tony AI Proxy - Vercel Serverless Function
 * Pure LLM chatbot — API keys are hidden on the server side.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, systemPrompt } = req.body;

  if (!query) {
    return res.status(400).json({ error: { message: 'Query is required.' } });
  }

  // Load keys from Vercel Environment Variables (set as: tony1, tony2, tony3, tony4)
  const apiKeys = [
    process.env.tony1,
    process.env.tony2,
    process.env.tony3,
    process.env.tony4,
    // Also support old TONY_API_KEYS comma-separated fallback
    ...(process.env.TONY_API_KEYS || "").split(',')
  ].filter(k => k && k.trim().length > 0);

  console.log(`Tony: Found ${apiKeys.length} API key(s).`);

  if (apiKeys.length === 0) {
    return res.status(500).json({ error: { message: 'No API keys configured. Set tony1/tony2/tony3/tony4 in Vercel Environment Variables.' } });
  }

  const SYSTEM = systemPrompt || `You are "Tony", a specialized AI assistant for a Machine Learning university course.
YOUR RULES:
1. ONLY answer questions related to Machine Learning, Data Science, or AI topics.
2. If asked something unrelated, politely decline.
3. Give clear, student-friendly explanations with examples.
4. Be encouraging and educational in tone.`;

  const prompt = `${SYSTEM}\n\nUser: ${query}\nTony:`;

  // Try each key until one works
  let lastError = null;
  for (const apiKey of apiKeys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-latest:generateContent?key=${apiKey.trim()}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();

      if (data.error) {
        console.error(`Tony: Key failed — ${data.error.message}`);
        lastError = data.error;
        continue; // Try next key
      }

      // Success — return result
      return res.status(200).json(data);

    } catch (err) {
      console.error(`Tony: Fetch error — ${err.message}`);
      lastError = { message: err.message };
      continue; // Try next key
    }
  }

  // All keys failed
  return res.status(500).json({
    error: {
      message: lastError?.message?.includes('quota')
        ? 'All API keys have hit their quota. Please wait a minute and try again.'
        : `All API keys failed. Last error: ${lastError?.message}`
    }
  });
}
