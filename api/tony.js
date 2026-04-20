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
  // You should set TONY_API_KEYS as a comma-separated string in Vercel Dashboard
  // Example: AIza...,AIza...,AIza...
  const keysStr = process.env.TONY_API_KEYS || "";
  const apiKeys = keysStr.split(',').filter(k => k.trim().length > 0);

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
    1. ONLY answer questions related to Machine Learning and the course content provided in the context.
    2. If a user asks something unrelated to Machine Learning, politely decline.
    3. Use the provided CONTEXT to give accurate, course-specific answers. 
    4. If the user's question is about ML but not in the context, you may use your internal knowledge but KEEP IT RELEVANT.
    5. Keep responses professional, educational, and concise.
    
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
