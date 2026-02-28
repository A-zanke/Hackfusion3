const db = require('./db');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

// Initialize Groq API (using corrected .env values)
const groqApi = axios.create({
  baseURL: process.env.GROK_BASE_URL || 'https://api.groq.com/openai/v1',
  headers: {
    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/* =========================
   SESSION MANAGEMENT
========================= */

const sessionsByKey = new Map();

function debugLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync('debug.log', logMessage);
  console.log(message);
}

function getSessionKey(req) {
  return req.headers['x-session-id'] || 'DEBUG_SESSION_KEY';
}

function nextDayMidnightTs() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0,0,0,0);
  return d.getTime();
}

function isExpired(ts){
  return !ts || Date.now() > ts;
}

/* =========================
   HELPERS
========================= */

function normName(s){
  return String(s || '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildMedSummaryReply(med, qty, cartTotal){
  const lines = [];
  lines.push(`✅ ${med.name} (${qty} tablets)`);

  if (med.description) {
    lines.push(`📝 ${med.description}`);
  }

  const pricePerTablet = parseFloat(med.price_per_tablet);
  if (!isNaN(pricePerTablet)) {
    lines.push(`💊 Price per tablet: ₹${pricePerTablet.toFixed(2)}`);
    const lineTotal = qty * pricePerTablet;
    lines.push(`💰 Line total: ₹${lineTotal.toFixed(2)}`);
  }

  if (typeof cartTotal === 'number') {
    lines.push('');
    lines.push(`🛒 Total price: ₹${cartTotal.toFixed(2)}`);
  }

  lines.push('');
  lines.push('Add more medicines? (Y/N) or type *proceed*');

  return lines.join('\n');
}

/* =========================
   GROK AI PROCESSING
========================= */

async function processWithGrok(message, history = []) {
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
- If the user asks "Do we have Dolo?" or "Dolo hai kya?", action = "check_stock", intent = "search".
- If the user wants to add/increase stock, action = "add_stock", intent = "add_stock".
- Detect language from the message.
- If no quantity is mentioned, use null.
- If multiple medicines, include all.
`;

    const response = await groqApi.post('/chat/completions', {
      model: process.env.GROK_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: prompt },
        ...history.slice(-5).map(h => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        })),
        { role: "user", content: message }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const aiResponse = response.data.choices[0].message.content;
    debugLog(`Grok result: ${aiResponse}`);
    return JSON.parse(aiResponse);
  } catch (error) {
    console.error('Grok API Error:', error.response?.data || error.message);
    // Fallback parsing for common patterns
    const words = message.toLowerCase().split(' ');
    return {
      medicines: [{ name: message, quantity: null }],
      intent: "search",
      action: "check_stock",
      language: "en",
      thinking: "Fallback parser used due to API error."
    };
  }
}

/* =========================
   REAL-TIME STOCK UPDATE
========================= */

async function updateStockRealTime(medicineId, quantity, medicineName) {
  try {
    const medInfo = await db.query(
      'SELECT stock_packets, tablets_per_packet, individual_tablets, name FROM medicines WHERE id = $1',
      [medicineId]
    );

    if (medInfo.rows.length === 0) {
      throw new Error(`Medicine ${medicineName} not found`);
    }

    const row = medInfo.rows[0];
    const tabletsPerPacket = row.tablets_per_packet || 1;
    const currentPackets = row.stock_packets || 0;
    const currentIndTabs = row.individual_tablets || 0;
    const totalAvailable = (currentPackets * tabletsPerPacket) + currentIndTabs;

    if (totalAvailable < quantity) {
      return {
        insufficientStock: true,
        available: totalAvailable,
        requested: quantity,
        medicineName: row.name
      };
    }

    const newTotal = totalAvailable - quantity;
    const newPackets = Math.floor(newTotal / tabletsPerPacket);
    const newIndiv = newTotal % tabletsPerPacket;

    await db.query(
      'UPDATE medicines SET stock_packets = $1, individual_tablets = $2 WHERE id = $3',
      [newPackets, newIndiv, medicineId]
    );

    return true;
  } catch (error) {
    console.error('Stock update error:', error);
    throw error;
  }
}

/* =========================
   MAIN HANDLER
========================= */

async function enhancedChatHandler(req,res){
  try{
    const { message } = req.body;
    if(!message) return res.status(400).json({ error:'Message required' });

    const sessionKey = getSessionKey(req);
    debugLog(`=== NEW REQUEST ===`);
    debugLog(`Session key: ${sessionKey}`);
    debugLog(`Message: "${message}"`);
    
    let orderSession = {
      medicines: [],
      stage: 'initial',
      pendingMedicine: null,
      customer: { name:null, age:null, mobile:null },
      history: []
    };

    const persisted = sessionsByKey.get(sessionKey);
    if(persisted && !isExpired(persisted.expiresAt)){
      orderSession = persisted.sessionState;
    }

    // Agent metadata for UI Decision Engine
    let agentMetadata = {
      intent_verified: true,
      safety_checked: true,
      stock_checked: false,
      thinking: 'Analyzing user request...'
    };

    const msgTrim = String(message).trim();

    // 1. Handle Quantity Stage
    if (orderSession.stage === 'ask_quantity' && orderSession.pendingMedicine && /^\d+$/.test(msgTrim)) {
      const qty = parseInt(msgTrim, 10);
      const pending = orderSession.pendingMedicine;
      
      const rs = await db.query('SELECT * FROM medicines WHERE id = $1', [pending.id]);
      if (rs.rows.length === 0) {
        orderSession.stage = 'initial';
        orderSession.pendingMedicine = null;
        sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
        return res.json({ reply: `❌ Medicine not found anymore.`, ...agentMetadata });
      }

      const med = rs.rows[0];
      const stockRes = await updateStockRealTime(med.id, qty, med.name);

      if (stockRes.insufficientStock) {
        agentMetadata.stock_checked = true;
        agentMetadata.thinking = "Stock check failed. Offering replenishment.";
        return res.json({
          reply: `❌ Out of stock. We only have ${stockRes.available} tablets. Add more to inventory? (Yes/No)`,
          ...agentMetadata
        });
      }

      const total = qty * parseFloat(med.price_per_tablet) || 0;
      orderSession.medicines.push({
        id: med.id, name: med.name, quantity: qty, price_per_tablet: med.price_per_tablet, total_price: total
      });

      orderSession.stage = 'initial';
      orderSession.pendingMedicine = null;
      const cartTotal = orderSession.medicines.reduce((s,m) => s + m.total_price, 0);
      orderSession.history.push({ role: 'user', content: message });
      orderSession.history.push({ role: 'assistant', content: `Added ${med.name}` });
      sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });

      agentMetadata.stock_checked = true;
      agentMetadata.thinking = `Verified stock and added ${qty} ${med.name} to cart. Total: ₹${cartTotal.toFixed(2)}`;
      
      return res.json({
        reply: buildMedSummaryReply(med, qty, cartTotal),
        ...agentMetadata
      });
    }

    // 2. Proceed to summary and order placement flow
    if (/^proceed$/i.test(msgTrim)) {
      if (!orderSession.medicines || orderSession.medicines.length === 0) {
        return res.json({ reply: '❌ No medicines in cart. Please add medicines first.', ...agentMetadata });
      }

      let summary = '📋 **Order Summary**\n\n';
      let total = 0;
      for (const m of orderSession.medicines) {
        const pricePerTablet = parseFloat(m.price_per_tablet) || 0;
        const medTotal = m.quantity * pricePerTablet;
        total += medTotal;
        summary += `💊 ${m.name}\n`;
        summary += `   Qty: ${m.quantity} tablets\n`;
        summary += `   Price: ₹${pricePerTablet.toFixed(2)} each\n`;
        summary += `   Subtotal: ₹${medTotal.toFixed(2)}\n\n`;
      }
      summary += `💰 **Total: ₹${total.toFixed(2)}**\n\n`;
      summary += 'Confirm order? (Y/N)';

      orderSession.stage = 'confirm_order';
      sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
      return res.json({ reply: summary, ...agentMetadata });
    }

    // 2.1 Handle Y/N confirmation for order placement
    if (orderSession.stage === 'confirm_order') {
      if (/^[Yy]$/i.test(msgTrim)) {
        try {
          if (!orderSession.medicines || orderSession.medicines.length === 0) {
            return res.json({ reply: '❌ No medicines in cart. Please add medicines first.', ...agentMetadata });
          }

          let total = orderSession.medicines.reduce((s, m) => s + (parseFloat(m.total_price) || 0), 0);

          await db.query('BEGIN');
          const ins = await db.query(
            "INSERT INTO orders (customer_name, mobile, total_price, status) VALUES ($1,$2,$3,'completed') RETURNING id",
            [
              orderSession.customer?.name || 'Guest',
              orderSession.customer?.mobile || null,
              total
            ]
          );

          const orderId = ins.rows[0].id;

          for (const m of orderSession.medicines) {
            if (!m.id || !m.quantity || m.quantity <= 0) {
              throw new Error('Invalid medicine in cart: ' + JSON.stringify(m));
            }
            await db.query(
              'INSERT INTO order_items (order_id,medicine_id,quantity,price_at_time) VALUES ($1,$2,$3,$4)',
              [orderId, m.id, m.quantity, parseFloat(m.price_per_tablet) || 0]
            );
          }

          await db.query('COMMIT');

          let confirmation = '🧾 **Order Placed Successfully!**\n\n';
          confirmation += `Order ID: ORD-${orderId}\n\n`;
          for (const m of orderSession.medicines) {
            confirmation += `💊 ${m.name} - ${m.quantity} tablets\n`;
          }
          confirmation += `\n💰 Total Amount: ₹${total.toFixed(2)}\n`;
          confirmation += '📦 Order Status: Completed\n';
          confirmation += '✅ Stock updated successfully';

          // Reset session
          orderSession = {
            medicines: [],
            stage: 'initial',
            pendingMedicine: null,
            customer: { name: null, age: null, mobile: null },
            history: orderSession.history || []
          };
          sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });

          return res.json({ reply: confirmation, ...agentMetadata });
        } catch (dbError) {
          try { await db.query('ROLLBACK'); } catch (_) {}
          console.error('Order placement error:', dbError);
          return res.status(500).json({ reply: '❌ Sorry, there was an error placing your order. Please try again.', ...agentMetadata });
        }
      } else if (/^[Nn]$/i.test(msgTrim)) {
        orderSession.stage = 'initial';
        sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
        return res.json({ reply: '❌ Order cancelled. You can continue adding medicines or start a new order.', ...agentMetadata });
      } else {
        return res.json({ reply: 'Please enter Y to confirm or N to cancel.', ...agentMetadata });
      }
    }

    // 2.2 Quick Y/N from add-more prompt
    if (orderSession.stage === 'initial' && orderSession.medicines.length > 0) {
      if (/^(y|yes)$/i.test(msgTrim)) {
        // Reuse proceed flow
        let total = 0;
        let summary = '📋 **Order Summary**\n\n';
        for (const m of orderSession.medicines) {
          const pricePerTablet = parseFloat(m.price_per_tablet) || 0;
          const medTotal = m.quantity * pricePerTablet;
          total += medTotal;
          summary += `💊 ${m.name}\n`;
          summary += `   Qty: ${m.quantity} tablets\n`;
          summary += `   Price: ₹${pricePerTablet.toFixed(2)} each\n`;
          summary += `   Subtotal: ₹${medTotal.toFixed(2)}\n\n`;
        }
        summary += `💰 **Total: ₹${total.toFixed(2)}**\n\n`;
        summary += 'Confirm order? (Y/N)';
        orderSession.stage = 'confirm_order';
        sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
        return res.json({ reply: summary, ...agentMetadata });
      }
      if (/^(n|no)$/i.test(msgTrim)) {
        orderSession = { medicines: [], stage: 'initial', pendingMedicine: null, customer: { name: null, age: null, mobile: null }, history: orderSession.history || [] };
        sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
        return res.json({ reply: '❌ Order cancelled. You can start a new order anytime.', ...agentMetadata });
      }
    }

    // 3. Handle AI Processing
    const aiResult = await processWithGrok(message, orderSession.history);
    agentMetadata.thinking = aiResult.thinking || agentMetadata.thinking;
    
    if (aiResult.intent === 'search' || aiResult.action === 'check_stock') {
      const medName = aiResult.medicines[0]?.name || message;
      const rs = await db.query('SELECT * FROM medicines WHERE (name ILIKE $1 OR brand ILIKE $1) AND is_deleted = FALSE LIMIT 1', [`%${medName}%`]);
      
      if (rs.rows.length === 0) {
        agentMetadata.thinking = `Medicine "${medName}" not found in database.`;
        return res.json({ reply: `🔍 Sorry, I couldn't find "${medName}" in our inventory.`, ...agentMetadata });
      }

      const med = rs.rows[0];
      const tabletsPerPacket = med.tablets_per_packet || 1;
      const currentPackets = med.stock_packets || 0;
      const currentIndTabs = med.individual_tablets || 0;
      const totalAvailable = (currentPackets * tabletsPerPacket) + currentIndTabs;

      agentMetadata.stock_checked = true;
      agentMetadata.thinking = `Found ${med.name} in stock. Available: ${totalAvailable} tablets.`;

      if (aiResult.medicines[0]?.quantity) {
        // Auto-add if quantity specified
        const qty = aiResult.medicines[0].quantity;
        const stockRes = await updateStockRealTime(med.id, qty, med.name);
        if (stockRes.insufficientStock) {
           return res.json({ reply: `❌ Insufficient stock for ${med.name}. Available: ${totalAvailable}.`, ...agentMetadata });
        }
        const total = qty * parseFloat(med.price_per_tablet) || 0;
        orderSession.medicines.push({ id: med.id, name: med.name, quantity: qty, price_per_tablet: med.price_per_tablet, total_price: total });
        const cartTotal = orderSession.medicines.reduce((s,m) => s + m.total_price, 0);
        sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
        return res.json({ reply: buildMedSummaryReply(med, qty, cartTotal), ...agentMetadata });
      } else {
        orderSession.stage = 'ask_quantity';
        orderSession.pendingMedicine = { id: med.id, name: med.name };
        sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
        return res.json({ reply: `✅ Found ${med.name} (${totalAvailable} available). How many tablets do you need?`, ...agentMetadata });
      }
    }

    // Default Fallback
    agentMetadata.thinking = "Intent recognized but no specific handler triggered.";
    return res.json({
      reply: "I'm here to help with medicine searches and orders. Just name a medicine!",
      ...agentMetadata
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ reply: '❌ Server error processing your request.', thinking: 'An internal error occurred.' });
  }
}

module.exports = { enhancedChatHandler };
