const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function processWithGemini(message, history = []) {
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

    // Filter history to ensure it starts with a 'user' role, as required by Gemini
    let formattedHistory = [];
    let foundFirstUser = false;
    
    for (const h of history) {
      if (!foundFirstUser && h.role === 'user') {
        foundFirstUser = true;
      }
      
      if (foundFirstUser) {
        // Ensure alternating roles if possible, or just push if different from last
        const role = h.role === 'assistant' ? 'model' : 'user';
        if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === role) {
          // If consecutive same roles, append content to the last one (safety measure)
          formattedHistory[formattedHistory.length - 1].parts[0].text += "\n" + h.content;
        } else {
          formattedHistory.push({
            role: role,
            parts: [{ text: h.content }],
          });
        }
      }
    }
    
    // If the last message in history is 'user', Gemini might complain if we then send another user message via sendMessage.
    // However, usually history is meant to be the preceding context. 
    // If formattedHistory ends with 'user', we could remove it or handle it.
    // But startChat + sendMessage usually works if the history is clean.

    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await chat.sendMessage(prompt + "\n\nUser Message: " + message);
    const response = await result.response;
    const text = response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}

module.exports = { processWithGemini };
