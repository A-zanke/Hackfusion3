// Natural Conversational AI Handler with Fuzzy Matching
const db = require('./db');
const axios = require('axios');

const naturalChatHandler = async (req, res) => {
    const { message, context } = req.body;
    
    try {
        // First, get available medicines for context
        const medicinesResult = await db.query('SELECT name, price_per_tablet, stock_packets * tablets_per_packet + individual_tablets as total_stock FROM medicines WHERE is_deleted = FALSE ORDER BY name ASC');
        const medicines = medicinesResult.rows;
        
        // Enhanced Grok prompt with fuzzy matching capabilities
        const response = await axios.post('https://api.x.ai/v1/chat/completions', {
            model: "grok-beta",
            messages: [
                {
                    role: "system",
                    content: `You are PharmaAI Pro - a natural, conversational pharmacy assistant with advanced medicine name matching.

MEDICINE MATCHING RULES:
- Match variations: "digine syrup" → "Digene Syrup", "digne syrun" → "Digene Syrup"
- Handle typos: "paracetamol" → "Paracetamol", "paracitamol" → "Paracetamol"
- Fuzzy matching: "combiflam" → "Combiflam Tablets"
- Brand names: "crocin" → "Crocin", "dolo" → "Dolo-650"

AVAILABLE MEDICINES:
${medicines.map(m => `- ${m.name} (₹${m.price_per_tablet}/tablet, ${m.total_stock} in stock)`).join('\n')}

CONVERSATION FLOW:
1. If user mentions medicine (even with typos/variations):
   - Find the closest match from available medicines
   - Say: "Yes! I found [correct medicine name]. How many do you need?"
   - Show +/- buttons for quantity selection

2. If quantity mentioned:
   - Confirm: "Great! [quantity] of [medicine]. Total will be ₹[price]"
   - Show order summary with QR code

3. If medicine not found:
   - Ask: "I don't have [medicine]. Would you like to see available alternatives?"

RESPONSE FORMAT (JSON):
{
  "reply": "natural conversational response",
  "action": "show_quantity_selector|show_order_summary|ask_alternatives",
  "data": {
    "medicine": "correct_medicine_name",
    "original_input": "user_input",
    "confidence": 95,
    "quantity": null,
    "price_per_tablet": 5,
    "available_stock": 100
  }
}

EXAMPLES:
User: "order digine syrup"
Response: {"reply": "Yes! I found Digene Syrup. How many bottles do you need?", "action": "show_quantity_selector", "data": {"medicine": "Digene Syrup"}}

User: "do you have digne syrun"
Response: {"reply": "Yes! I found Digene Syrup. It's available. How many would you like?", "action": "show_quantity_selector", "data": {"medicine": "Digene Syrup"}}`
                },
                {
                    role: "user",
                    content: message
                }
            ],
            temperature: 0.3,
            max_tokens: 200,
            headers: {
                'Authorization': `Bearer ${process.env.GROK_API_KEY}`
            }
        });

        const aiResponse = response.data.choices[0].message.content;
        
        try {
            const parsed = JSON.parse(aiResponse);
            
            // Add QR code if order is confirmed
            if (parsed.action === 'show_order_summary' && parsed.data.quantity) {
                const totalPrice = parsed.data.quantity * parsed.data.price_per_tablet;
                const orderId = 'ORD' + Date.now();
                
                const { generatePaymentQR } = require('./qr-generator');
                const qrCode = await generatePaymentQR(totalPrice, orderId, parsed.data.medicine);
                
                parsed.data.qr_code = qrCode;
                parsed.data.total_price = totalPrice;
                parsed.data.order_id = orderId;
            }
            
            res.json(parsed);
        } catch (parseError) {
            // Fallback to plain text if JSON parsing fails
            res.json({
                reply: aiResponse,
                action: 'plain_response',
                data: null
            });
        }
        
    } catch (error) {
        console.error('Natural chat error:', error);
        res.status(500).json({ error: 'Failed to process natural conversation' });
    }
};

module.exports = { naturalChatHandler };
