const { OpenAI } = require("openai");
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: process.env.GROK_BASE_URL || "https://api.groq.com/openai/v1"
});

async function processWithGroq(message, history = []) {
  try {
    const prompt = `
You are an intelligent multi-lingual pharmacy assistant.
Detect:
- medicines: list of medicines mentioned and optional quantities
- intent: "order" | "search" | "inquiry" | "add_stock" | "remove_medicine"
- action: "check_stock" | "add_stock" | "order" | "remove" | "other"
- language: "en" | "hi" | "mr"

Return STRICT JSON:
{
  "medicines": [{"name": "name", "quantity": number|null}],
  "intent": "order",
  "action": "check_stock",
  "language": "en",
  "thinking": "your internal reasoning"
}

Notes:
- If the user asks "Do we have Dolo?" or "Dolo hai kya?", action = "check_stock".
- If the user wants to add/increase stock (e.g. "add 10 Dolo", "stock add karo"), action = "add_stock", intent = "add_stock".
- If the user wants to remove/delete (e.g. "delete Aspirin", "Aspirin remove karo"), action = "remove", intent = "remove_medicine".
- Detect language from the message.
- If no quantity is mentioned, use null.
- If multiple medicines, include all.
`;

    const response = await openai.chat.completions.create({
      model: process.env.GROK_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: prompt },
        ...history.map(h => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        })),
        { role: "user", content: message }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const text = response.choices[0].message.content;
    return JSON.parse(text);
  } catch (error) {
    console.error('Groq API Error:', error);
    throw error;
  }
}

module.exports = { processWithGroq };
