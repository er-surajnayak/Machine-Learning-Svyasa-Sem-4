/**
 * Tony AI Proxy - Vercel Serverless Function
 * This hides the API keys from the frontend and handles rotation on the server.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, context, model } = req.body;

  // Get keys from Vercel Environment Variables
  // Looking for individual keys as requested: tony1, tony2, tony3, tony4
  const individualKeys = [
    process.env.tony1,
    process.env.tony2,
    process.env.tony3,
    process.env.tony4
  ].filter(k => k && k.trim().length > 0);

  // Also check for the original comma-separated string as a fallback
  const keysStr = process.env.TONY_API_KEYS || "";
  const batchKeys = keysStr.split(',').filter(k => k.trim().length > 0);

  const apiKeys = individualKeys.length > 0 ? individualKeys : batchKeys;

  if (apiKeys.length === 0) {
    return res.status(500).json({ error: { message: 'No API keys configured on server.' } });
  }

  // Randomly pick a key or use a simple rotation (stateless random is fine for serverless)
  const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
  
  // Use model from request or default
  const modelName = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;

  const prompt = `
    SYSTEM INSTRUCTIONS:
    You are "Tony", a specialized AI assistant for this specific Machine Learning course.
    
    STRICT RULES:
    1. ONLY answer questions related to Machine Learning. 
    2. For Machine Learning questions, use the provided CONTEXT as your primary source of truth to ensure consistency with the course materials.
    3. If the user asks something NOT in the context but still related to ML, use your extensive internal knowledge to provide a helpful, accurate answer.
    4. If the user asks something UNRELATED to Machine Learning (e.g., life advice, jokes, food, pop culture), politely respond: "I am Tony, a specialized ML assistant. I can only help you with topics related to Machine Learning and this course."
    5. Keep responses professional, educational, and easy to understand.
    
    CONTEXT FROM COURSE:
    ${context || "No specific context found."}
    
    USER QUESTION:
    ${query}
    
    TONY'S RESPONSE:
  `;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: { message: 'Internal Server Error connecting to Gemini.' } });
  }
}
