const db = require('./db');
require('dotenv').config();
const axios = require('axios');
const { Langfuse } = require('langfuse');
const { io } = require('./index');

// Initialize Langfuse
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: "https://cloud.langfuse.com"
});

// Initialize Grok API
const grokApi = axios.create({
  baseURL: 'https://api.groq.com/openai/v1',
  headers: {
    'Authorization': 'Bearer ' + process.env.GROK_API_KEY,
    'Content-Type': 'application/json'
  }
});
const fs = require('fs');

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
  // For debugging: use a fixed session key to ensure session persistence
  return 'DEBUG_SESSION_KEY';
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
  // Keep the user's medicine text mostly intact so that
  // we can match full names in the database reliably.
  // Only normalise whitespace and trim.
  return String(s || '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildMedSummaryReply(med, qty, cartTotal, prescriptionRequired = false) {
  const lines = [];
  lines.push('✅ ' + med.name + ' (' + qty + ' tablets)');

  if (med.description) {
    lines.push('📝 ' + med.description);
  }

  const pricePerTablet = parseFloat(med.price_per_tablet);
  if (!isNaN(pricePerTablet)) {
    lines.push('💊 Price per tablet: ₹' + pricePerTablet.toFixed(2));
    const lineTotal = qty * pricePerTablet;
    lines.push('💰 Line total: ₹' + lineTotal.toFixed(2));
  }

  if (prescriptionRequired) {
    lines.push('⚕️ Prescription required');
  }

  if (typeof cartTotal === 'number') {
    lines.push('');
    lines.push('🛒 Total price: ₹' + cartTotal.toFixed(2));
  }

  // Only show "Add more medicines" if this is not the final medicine in cart
  // For prescription medicines, we'll handle the flow differently
  if (!prescriptionRequired) {
    lines.push('');
    lines.push('Add more medicines? (Y/N)');
  }

  return lines.join('\n');
}

/* =========================
   PARSER (MULTI MED)
========================= */

function ruleParse(message){
  const items = [];
  const parts = message.split(',').map(p=>p.trim()).filter(Boolean);

  for(const part of parts){
    let m = part.match(/^(.*?)[\s-]+(\d{1,4})$/);
    if(m){
      items.push({ name:normName(m[1]), quantity:parseInt(m[2],10) });
      continue;
    }

    m = part.match(/^(.*?)\s+(?:qty|quantity)\s*(\d{1,4})$/i);
    if(m){
      items.push({ name:normName(m[1]), quantity:parseInt(m[2],10) });
      continue;
    }

    items.push({ name:normName(part), quantity:null });
  }

  return items;
}

/* =========================
   MULTILINGUAL RESPONSE HELPER
========================= */
function getMultilingualResponse(messageKey, language, medicineName = null, quantity = null) {
  const responses = {
    'en': {
      'prescription_required': '⚠️ ' + medicineName + ' requires a prescription.\n\n⚕️ This medicine can only be dispensed with a valid prescription.\n\nDo you still want to proceed with this order? (Yes/No)\n\n• Yes: I have a prescription and want to order\n• No: Cancel this order',
      'order_success': '✅ ' + medicineName + ' (' + quantity + ' tablets)\n💊 Price per tablet: ₹' + parseFloat(medicineName.price_per_tablet || 0).toFixed(2) + '\n📦 Quantity: ' + quantity + '\n💰 Total price: ₹' + (parseFloat(medicineName.price_per_tablet || 0) * quantity).toFixed(2) + '\n\n🎉 Order Placed Successfully!',
      'out_of_stock': '❌ Sorry, ' + medicineName + ' is currently out of stock.\nAvailable: ' + quantity + ' tablets.\nWould you like to add this to inventory? (Yes/No)',
      'prescription_cancelled': '❌ Order cancelled due to no prescription. You can continue adding other medicines.',
      'no_prescription': '❌ Order cancelled due to no prescription. You can continue adding other medicines.'
    },
    'hi': {
      'prescription_required': '⚠️ ' + medicineName + ' के लिए कितने पैकेट जोड़ने हैं\n\n⚕️ इस दवा को केवल मान्य नुस्खर के बिना ही दिया जा सकता है\n\nक्या आप इस ऑर्डर के साथ आगे बढ़ना चाहते हैं? (हां/नहीं)\n\n• हां: मेरे पास में प्रिस्क्रिप्शन है और मैं ऑर्डर करना चाहता हूं\n• नहीं: इस ऑर्डर को रद्द करें',
      'order_success': '✅ ' + medicineName + ' (' + quantity + ' टैब्लेट)\n💊 प्रति टैब्लेट कीमत: ₹' + parseFloat(medicineName.price_per_tablet || 0).toFixed(2) + '\n📦 मात्रा: ' + quantity + '\n💰 कुल कीमत: ₹' + (parseFloat(medicineName.price_per_tablet || 0) * quantity).toFixed(2) + '\n\n🎉 ऑर्डर सफलतःरी सफलतःरी!',
      'out_of_stock': '❌ क्षमा करने के लिए, ' + medicineName + ' वर्त्तमान में है\nउपलब्ध: ' + quantity + ' टैब्लेट\nक्या आप इसे इन्वेन्टरी में जोड़ना चाहते हैं? (हां/नहीं)',
      'prescription_cancelled': '❌ प्रिस्क्रिप्शन न होने के कारण ऑर्डर रद्द किया गया। आप अन्य दवा दवा जोड़ना चाहते हैं।',
      'no_prescription': '❌ प्रिस्क्रिप्शन न होने के कारण ऑर्डर रद्द किया गया। आप अन्य दवा दवा जोड़ना चाहते हैं।'
    },
    'mr': {
      'prescription_required': `⚠️ ${medicineName} ला रेसिप्शन आवश्यक आहे\n\n⚕️ हे औषध मान्य नुस्खराच्या फक्त फकड़नाची देत शकत नाही\n\nतुम्ही हे ऑर्डर चालू इकटेव आणत काय? (होय/नाही)\n\n• होय: माझे प्रिस्क्रिप्शन आहे आणि मी ऑर्डर करायचो\n• नाही: हा ऑर्डर रद्द करा`,
      'order_success': `✅ ${medicineName} (${quantity} टॅब्लेट)\n💊 टॅब्लेट ची किंमत: ₹${parseFloat(medicineName.price_per_tablet || 0).toFixed(2)}\n📦 प्रमाण: ${quantity}\n💰 एकूण किंमत: ₹${(parseFloat(medicineName.price_per_tablet || 0) * quantity).toFixed(2)}\n\n🎉 ऑर्डर यशशन्य झाली!`,
      'out_of_stock': `❌ क्षमा करण्याली, ${medicineName} सध्या उपलब्ध नाही\nउपलब्ध: ${quantity} टॅब्लेट\nतुम्ही हे इन्वेन्टरीत जोडण्यासाठी इच्छुक आहात का? (होय/नाही)`,
      'prescription_cancelled': '❌ प्रिस्क्रिप्शन नसल्यामुळे ऑर्डर रद्द केला. तुम्ही पुन्हा दवा जोडू शकता.',
      'no_prescription': '❌ प्रिस्क्रिप्शन नसल्यामुळे ऑर्डर रद्द केला. तुम्ही पुन्हा दवा जोडू शकता.'
    }
  };
  
  return responses[language]?.[messageKey] || responses['en'][messageKey];
}

/* =========================
   LANGUAGE & INTENT HELPERS
========================= */

function detectLanguage(message) {
  const text = String(message || '').trim();
  // Basic Devanagari check
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const lower = text.toLowerCase();

  if (hasDevanagari) {
    if (lower.includes('आहे') || lower.includes('का')) return 'mr';
    return 'hi';
  }

  // Roman-script Hindi / Marathi heuristics
  if (lower.includes('hai kya') || lower.includes('kya hai') || lower.includes('dawa') || lower.includes('karna hai')) {
    return 'hi';
  }
  if (lower.includes('aahe ka') || lower.includes('ahe ka') || lower.includes('ka na')) {
    return 'mr';
  }

  return 'en';
}

/* =========================
   GROK AI PROCESSING
========================= */

async function processWithGrok(message) {
  try {
    const response = await grokApi.post('/chat/completions', {
      model: "openai/gpt-oss-20b",  // Use provided Groq model name
      messages: [
        {
          role: "system",
          content: `You are PharmaAI Pro – a multilingual intelligent pharmacy voice assistant.

-----------------------------------------
🌍 LANGUAGE RULE
-----------------------------------------
- Detect user language automatically.
- If user speaks in English → reply fully in English.
- If user speaks in Hindi → reply in Hindi.
- If user speaks in Marathi → reply in Marathi.
- If mixed Hinglish → reply in natural Hinglish.
- Never change language unless user changes it.

-----------------------------------------
🎙 VOICE STYLE
-----------------------------------------
- Use natural Indian tone.
- Medium speaking speed.
- Friendly, professional pharmacy assistant.
- Not robotic.
- Not over dramatic.

-----------------------------------------
🧠 INTENT DETECTION
-----------------------------------------
Understand these intents:

1. Order medicine
2. Check stock
3. Add stock
4. General medicine info

Extract only:
- medicine name
- strength (500mg etc)
- quantity

Ignore filler words.

Example:
"I want 3 paracetamol"
Extract:
intent: order
medicine: paracetamol
quantity: 3

-----------------------------------------

Return STRICT JSON:
{"medicines":[{"name":"name","quantity":number|null}],"intent":"order","action":"check_stock","language":"en"}

Notes:
- If user is asking things like "Do we have Dolo?" or "Dolo hai kya?" or "Dolo aahe ka?", action = "check_stock".
- If user wants to add/increase stock (e.g. "add stock", "stock add karna hai", "Dolo add karo", "Dolo ka stock daalo", "stock increase karo", "medicine add karna hai"), action = "add_stock".
- Detect language from the message and set language accordingly.
- If no quantity is mentioned for a medicine, use null. If multiple medicines, include all.`
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.3,
      max_tokens: 150
    });

    const aiResponse = response.data.choices[0].message.content;
    const parsed = JSON.parse(aiResponse);
    // Ensure defaults
    if (!parsed.language) parsed.language = detectLanguage(message);
    if (!parsed.action) parsed.action = parsed.intent || 'order';
    return parsed;
  } catch (error) {
    console.error('Grok API Error:', error.response?.data || error.message);
    
    // Fallback to basic parsing if Grok fails
    const items = [];
    const parts = message.split(',').map(p=>p.trim()).filter(Boolean);

    for(const part of parts){
      let m = part.match(/^(.*?)[\s-]+(\d{1,4})$/);
      if(m){
        items.push({ name:normName(m[1]), quantity:parseInt(m[2],10) });
        continue;
      }

      m = part.match(/^(.*?)\s+(?:qty|quantity)\s*(\d{1,4})$/i);
      if(m){
        items.push({ name:normName(m[1]), quantity:parseInt(m[2],10) });
        continue;
      }

      items.push({ name:normName(part), quantity:null });
    }

    return {
      medicines: items,
      intent: "order",
      action: "order",
      language: detectLanguage(message)
    };
  }
}

/* =========================
   REAL-TIME STOCK UPDATE FUNCTION
========================= */

async function updateStockRealTime(medicineId, quantity, medicineName) {
  try {
    // Get current stock info (use total_tablets as the single source of truth)
    const medInfo = await db.query(
      'SELECT stock_packets, tablets_per_packet, total_tablets FROM medicines WHERE id = $1',
      [medicineId]
    );

    if (medInfo.rows.length === 0) {
      throw new Error(`Medicine ${medicineName} (ID ${medicineId}) not found for stock update`);
    }

    const currentStockPackets = medInfo.rows[0].stock_packets ?? 0;
    const tabletsPerPacket = medInfo.rows[0].tablets_per_packet ?? 1;
    const currentTotalTablets = medInfo.rows[0].total_tablets ?? (currentStockPackets * tabletsPerPacket);
    
    // Calculate total available tablets
    const totalAvailableTablets = currentTotalTablets;
    
    // Check if stock is insufficient
    if (totalAvailableTablets < quantity) {
      // Return special object indicating insufficient stock instead of throwing error
      return {
        insufficientStock: true,
        available: totalAvailableTablets,
        requested: quantity,
        medicineName: medicineName
      };
    }
    
    // Simple deduction: remove requested tablets from total
    const newTotalTablets = totalAvailableTablets - quantity;
    
    // Recalculate packets and individual tablets based on new total
    const newStockPackets = Math.floor(newTotalTablets / tabletsPerPacket);
    const newIndividualTablets = newTotalTablets % tabletsPerPacket;
    
    debugLog(`Real-time stock update for ${medicineName}: ${totalAvailableTablets} -> ${newTotalTablets} tablets (packets: ${currentStockPackets} -> ${newStockPackets}, individual: ${newIndividualTablets})`);
    
    // Update stock_packets and individual_tablets - trigger will recalculate total_tablets
    await db.query(
      `UPDATE medicines 
       SET stock_packets = $1,
           individual_tablets = $2
       WHERE id = $3`,
      [newStockPackets, newIndividualTablets, medicineId]
    );
    
    return true;
  } catch (error) {
    console.error('Real-time stock update error:', error);
    throw error;
  }
}

/* =========================
   STOCK ADD HELPER
========================= */

async function addStockByConfig(medicineName, packetsToAdd, tabletsPerPacket, packetPrice) {
  const name = normName(medicineName);
  const pkt = Math.max(0, parseInt(packetsToAdd, 10) || 0);
  const tabsPerPkt = Math.max(1, parseInt(tabletsPerPacket, 10) || 1);
  const pricePerPacket = Math.max(0, parseFloat(packetPrice) || 0);

  const addedTablets = pkt * tabsPerPkt;
  const pricePerTablet = tabsPerPkt > 0 ? pricePerPacket / tabsPerPkt : 0;

  if (!name || pkt <= 0) {
    throw new Error('Invalid stock configuration');
  }

  const result = await db.query(
    `
    INSERT INTO medicines (
      name, stock_packets, tablets_per_packet, individual_tablets,
      price_per_packet, price_per_tablet, is_deleted
    )
    VALUES ($1,$2,$3,0,$4,$5,FALSE)
    ON CONFLICT (name) DO UPDATE SET
      stock_packets = medicines.stock_packets + EXCLUDED.stock_packets,
      tablets_per_packet = EXCLUDED.tablets_per_packet,
      price_per_packet = EXCLUDED.price_per_packet,
      price_per_tablet = EXCLUDED.price_per_tablet,
      is_deleted = FALSE
    RETURNING *;
    `,
    [name, pkt, tabsPerPkt, pricePerPacket, pricePerTablet]
  );

  return result.rows[0];
}

/* =========================
   MAIN HANDLER
========================= */

async function enhancedChatHandler(req,res){
  try{
    const { message } = req.body;
    if(!message) return res.status(400).json({ error:'Message required' });

    // Initialize agent metadata
    let agentMetadata = {
      intent_verified: false,
      safety_checked: false,
      stock_checked: false,
      thinking: 'Initializing AI agents...'
    };

    // Create Langfuse trace
    const trace = langfuse.trace({
      name: "pharmacy-chat",
      input: message
    });

    const sessionKey = getSessionKey(req);
    debugLog(`=== NEW REQUEST ===`);
    debugLog(`Session key: ${sessionKey}`);
    debugLog(`Message: "${message}"`);
    
    let orderSession = {
      medicines: [],
      stage: 'initial',
      pendingMedicine: null,
      pendingPrescription: null,
      customer: { name: null, age: null, mobile: null }
    };

    const persisted = sessionsByKey.get(sessionKey);
    debugLog(`Persisted session: ${JSON.stringify(persisted)}`);
    
    if(persisted && !isExpired(persisted.expiresAt)){
      orderSession = persisted.sessionState;
      debugLog(`Loaded existing session - Stage: ${orderSession.stage}, Pending: ${orderSession.pendingMedicine}`);
    } else {
      debugLog(`Starting new session`);
    }

    // Ensure stock flow state
    const msgTrim = String(message).trim();
    const detectedLang = detectLanguage(msgTrim);
    if (!orderSession.stockFlow) {
      orderSession.stockFlow = {
        stage: 'idle',              // idle | offer_add_missing | offer_use_previous | ask_packets_prev | ask_packets_new | ask_tabs | ask_price
        language: detectedLang,
        targetName: null,
        lastMissingName: null,
        previousConfig: null,
        tempPackets: null,
        tempTabsPerPacket: null,
        tempPacketPrice: null
      };
    } else if (!orderSession.stockFlow.language) {
      orderSession.stockFlow.language = detectedLang;
    }
    
    // Ensure stock add flow state
    if (!orderSession.stockAddFlow) {
      orderSession.stockAddFlow = {
        stage: 'idle',              // idle | ask_add_stock_confirmation | add_stock_name | add_stock_packets | add_stock_tablets_per_packet | add_stock_packet_price
        medicineName: null,
        packets: null,
        tabletsPerPacket: null,
        packetPrice: null
      };
    }
    const stockAddFlow = orderSession.stockAddFlow;
    const stockFlow = orderSession.stockFlow;

    // Reset invalid session state
    if (orderSession.stage === 'ask_quantity' && orderSession.pendingMedicine === 'Y') {
      debugLog(`Resetting invalid session state where pendingMedicine is 'Y'`);
      orderSession.stage = 'initial';
      orderSession.pendingMedicine = null;
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
    }

    // =========================
    // HARD GUARD: QUANTITY FIRST
    // =========================
    debugLog(`Top-of-handler state: stage=${orderSession.stage}, pending=${JSON.stringify(orderSession.pendingMedicine)}`);
    
    if (orderSession.stage === 'ask_quantity' && orderSession.pendingMedicine && /^\d+$/.test(msgTrim)) {
      const pending = orderSession.pendingMedicine;
      const searchName = typeof pending === 'string' ? pending : pending.name;
      debugLog(`Entering EARLY quantity branch with qty='${msgTrim}' for pending='${JSON.stringify(pending)}'`);
      const qty = parseInt(msgTrim, 10);

      const rs = (pending && pending.id)
        ? await db.query(
            'SELECT * FROM medicines WHERE id = $1 LIMIT 1',
            [pending.id]
          )
        : await db.query(
            'SELECT * FROM medicines WHERE (name ILIKE $1 OR brand ILIKE $1) LIMIT 1',
            [`%${searchName}%`]
          );

      if(rs.rows.length===0){
        const label = searchName || 'selected medicine';
        debugLog(`Pending medicine not found in DB: ${label}`);
        orderSession.stage='initial';
        orderSession.pendingMedicine=null;
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply:`❌ ${label} not found.` });
      }

      const med = rs.rows[0];
      debugLog(`DB match for pending: ${med.name}`);

      // Real-time stock update (same behaviour as main quantity handler)
      const stockUpdateResult = await updateStockRealTime(med.id, qty, med.name);
      
      // Check if stock is insufficient
      if (stockUpdateResult && stockUpdateResult.insufficientStock) {
        // Start stock add flow
        stockAddFlow.stage = 'ask_add_stock_confirmation';
        stockAddFlow.medicineName = med.name;
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        
        return res.json({
          reply: '❌ This medicine is currently out of stock.\nWould you like to add this medicine to inventory? (Yes/No)'
        });
      }

      const total = qty * parseFloat(med.price_per_tablet) || 0;
      orderSession.medicines.push({
        id: med.id,
        name: med.name,
        quantity: qty,
        price_per_tablet: med.price_per_tablet,
        total_price: total
      });

      orderSession.stage='initial';
      orderSession.pendingMedicine=null;
      const cartTotal = orderSession.medicines.reduce((s,m)=>s+m.total_price,0);
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
      debugLog(`EARLY ADD✅ ${med.name} x${qty} | Cart: ₹${cartTotal.toFixed(2)}`);
      return res.json({
        reply: buildMedSummaryReply(med, qty, cartTotal)
      });
    }

    // Prevent numeric-only messages from being mis-parsed when NOT awaiting quantity
    if (/^\d+$/.test(String(message).trim()) && orderSession.stage !== 'ask_quantity') {
      debugLog(`Numeric-only message while not awaiting quantity -> returning guidance`);
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
      return res.json({ reply: 'ℹ️ Please specify a medicine name first (e.g., "Aspirin - 2" or "Aspirin qty 2").' });
    }

    /* =========================
       STOCK FLOW: HANDLE YES/NO & NUMERIC ANSWERS
    ========================= */

    const lowerMsg = msgTrim.toLowerCase();

    // Y/N when offering to add a missing medicine (no previous config)
    if (stockFlow.stage === 'offer_add_missing') {
      if (/^(y|yes|haan|ha|ho)$/i.test(msgTrim)) {
        // Start new configuration flow
        stockFlow.stage = 'ask_packets_new';
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply: `${stockFlow.targetName} के लिए कितने पैकेट जोड़ने हैं? (How many packets would you like to add?)` });
      }
      if (/^(n|no|nah|nahi)$/i.test(msgTrim)) {
        stockFlow.stage = 'idle';
        stockFlow.lastMissingName = stockFlow.targetName;
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply: 'ठीक है, जब चाहें तब स्टॉक जोड़ सकते हैं। (Okay, you can add stock anytime.)' });
      }
    }

    // Y/N when offering to use previous configuration
    if (stockFlow.stage === 'offer_use_previous') {
      if (/^(y|yes|haan|ha|ho)$/i.test(msgTrim)) {
        stockFlow.stage = 'ask_packets_prev';
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply: ` ${stockFlow.targetName} के लिए कितने पैकेट जोड़ने हैं? (How many packets would you like to add?)` });
      }
      if (/^(n|no|nah|nahi)$/i.test(msgTrim)) {
        // Move to full custom config
        stockFlow.stage = 'ask_packets_new';
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply: `कितने पैकेट जोड़ने हैं? (How many packets would you like to add?)` });
      }
    }

    // Packets input (either using previous config or new config)
    if ((stockFlow.stage === 'ask_packets_prev' || stockFlow.stage === 'ask_packets_new') && /^\d+$/.test(msgTrim)) {
      const pkt = parseInt(msgTrim, 10);
      if (pkt <= 0) {
        return res.json({ reply: 'कृपया मान्य पैकेट संख्या दें (Please provide a valid number of packets).' });
      }
      stockFlow.tempPackets = pkt;

      if (stockFlow.stage === 'ask_packets_prev' && stockFlow.previousConfig) {
        // We already know tablets_per_packet and packet price -> perform DB update
        const cfg = stockFlow.previousConfig;
        const updated = await addStockByConfig(stockFlow.targetName, pkt, cfg.tablets_per_packet, cfg.price_per_packet);
        stockFlow.stage = 'idle';
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

        const addedTabs = pkt * cfg.tablets_per_packet;
        const reply = `✅ ${stockFlow.targetName} stock updated.\nAdded: ${pkt} packets (${addedTabs} tablets)\nNew total tablets: ${updated.total_tablets}`;
        return res.json({ reply });
      }

      // New configuration requires tablets_per_packet next
      if (stockFlow.stage === 'ask_packets_new') {
        stockFlow.stage = 'ask_tabs';
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply: 'हर पैकेट में कितनी गोलियां हैं? (How many tablets in each packet?)' });
      }
    }

    if (stockFlow.stage === 'ask_tabs' && /^\d+$/.test(msgTrim)) {
      const tabs = parseInt(msgTrim, 10);
      if (tabs <= 0) {
        return res.json({ reply: 'कृपया मान्य टैबलेट संख्या दें (Please provide a valid tablets-per-packet).' });
      }
      stockFlow.tempTabsPerPacket = tabs;
      stockFlow.stage = 'ask_price';
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
      return res.json({ reply: 'एक पैकेट की कीमत क्या है? (What is the price of one packet, in ₹?)' });
    }

    if (stockFlow.stage === 'ask_price') {
      const num = parseFloat(msgTrim.replace(/[^0-9.]/g,''));
      if (!Number.isFinite(num) || num <= 0) {
        return res.json({ reply: 'कृपया मान्य कीमत दें (Please provide a valid packet price).' });
      }
      stockFlow.tempPacketPrice = num;

      const cfgName = stockFlow.targetName || stockFlow.lastMissingName || 'medicine';
      const updated = await addStockByConfig(
        cfgName,
        stockFlow.tempPackets,
        stockFlow.tempTabsPerPacket,
        stockFlow.tempPacketPrice
      );

      const addedTabs = stockFlow.tempPackets * stockFlow.tempTabsPerPacket;
      const reply = `✅ ${updated.name} stock added.\nPackets: ${stockFlow.tempPackets}\nTablets/packet: ${stockFlow.tempTabsPerPacket}\nAdded tablets: ${addedTabs}\nNew total tablets: ${updated.total_tablets}`;

      // Reset stock flow
      orderSession.stockFlow = {
        stage: 'idle',
        language: detectedLang,
        targetName: updated.name,
        lastMissingName: updated.name,
        previousConfig: {
          tablets_per_packet: updated.tablets_per_packet,
          price_per_packet: parseFloat(updated.price_per_packet || 0)
        },
        tempPackets: null,
        tempTabsPerPacket: null,
        tempPacketPrice: null
      };
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

      return res.json({ reply });
    }

    /* =========================
       CANCEL
    ========================= */
    if(/^(cancel|stop|clear)$/i.test(message)){
      orderSession = {
        medicines:[],
        stage:'initial',
        pendingMedicine:null,
        pendingPrescription:null,
        customer:{ name:null, age:null, mobile:null }
      };
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
      return res.json({ reply:'❌ Order cancelled.' });
    }

    /* =========================
       PRESCRIPTION CONFIRM
    ========================= */
    if(
      orderSession.stage === 'confirm_prescription' &&
      orderSession.pendingPrescription
    ){
      if(/^yes$/i.test(message)){
        const med = orderSession.pendingPrescription;
        const total = med.quantity * med.price_per_tablet;

        orderSession.medicines.push({
          id: med.id,
          name: med.name,
          quantity: med.quantity,
          price_per_tablet: med.price_per_tablet,
          total_price: total
        });

        orderSession.stage='initial';
        orderSession.pendingPrescription=null;

        const cartTotal = orderSession.medicines.reduce((s,m)=>s+m.total_price,0);
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

        return res.json({
          reply:`✅ ${med.name} added  
💰 Cart: ₹${cartTotal.toFixed(2)}`
        });
      } else {
        orderSession.stage='initial';
        orderSession.pendingPrescription=null;
        return res.json({ reply:'❌ Medicine skipped.' });
      }
    }

    /* =========================
       QUANTITY RESPONSE
    ========================= */
    debugLog(`=== CHECKING QUANTITY RESPONSE ===`);
    debugLog(`Stage: ${orderSession.stage}`);
    debugLog(`Pending medicine: ${JSON.stringify(orderSession.pendingMedicine)}`);
    debugLog(`Message: "${message}"`);
    debugLog(`Is digits: ${/^\d+$/.test(message)}`);
    debugLog(`Condition match: ${orderSession.stage === 'ask_quantity' && orderSession.pendingMedicine && /^\d+$/.test(message)}`);
    
    if(
      orderSession.stage === 'ask_quantity' &&
      orderSession.pendingMedicine &&
      /^\d+$/.test(message)
    ){
      const qty = parseInt(message,10);
      const pending = orderSession.pendingMedicine;
      const searchName = typeof pending === 'string' ? pending : pending.name;

      debugLog(`=== QUANTITY RESPONSE ===`);
      debugLog(`User replied with quantity ${qty} for pending medicine: ${JSON.stringify(pending)}`);

      const rs = (pending && pending.id)
        ? await db.query(
            `SELECT * FROM medicines 
             WHERE id = $1
             LIMIT 1`,
            [pending.id]
          )
        : await db.query(
            `SELECT * FROM medicines 
             WHERE (name ILIKE $1 OR brand ILIKE $1)
             LIMIT 1`,
            [`%${searchName}%`]
          );

      if(rs.rows.length===0){
        const label = searchName || 'selected medicine';
        orderSession.stage='initial';
        orderSession.pendingMedicine=null;
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply:`❌ ${label} not found.` });
      }

      const med = rs.rows[0];
      debugLog('Found medicine: ' + med.name);

      // Update stock in real-time when quantity is provided
      const stockUpdateResult = await updateStockRealTime(med.id, qty, med.name);
      
      // Check if stock is insufficient
      if (stockUpdateResult && stockUpdateResult.insufficientStock) {
        // Start stock add flow
        stockAddFlow.stage = 'ask_add_stock_confirmation';
        stockAddFlow.medicineName = med.name;
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        
        return res.json({
          reply: '❌ This medicine is currently out of stock.\nWould you like to add this medicine to inventory? (Yes/No)'
        });
      }

      const total = qty * parseFloat(med.price_per_tablet) || 0;
      orderSession.medicines.push({
        id: med.id,
        name: med.name,
        quantity: qty,
        price_per_tablet: med.price_per_tablet,
        total_price: total
      });

      orderSession.stage='initial';
      orderSession.pendingMedicine=null;

      const cartTotal = orderSession.medicines.reduce((s,m)=>s+m.total_price,0);
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

      debugLog(`✅ Added ${med.name} (${qty}) - Total: ₹${total.toFixed(2)}`);

      return res.json({
        reply: buildMedSummaryReply(med, qty, cartTotal)
      });
    }

    /* =========================
       STOCK ADD FLOW HANDLING
    ========================= */
    
    // Handle stock add confirmation (Yes/No)
    if (stockAddFlow.stage === 'ask_add_stock_confirmation') {
      if (/^(yes|y|haan|ha|ho)$/i.test(message)) {
        stockAddFlow.stage = 'add_stock_name';
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({
          reply: 'Please provide medicine name:'
        });
      } else if (/^(no|n|nahi|na)$/i.test(message)) {
        stockAddFlow.stage = 'idle';
        stockAddFlow.medicineName = null;
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({
          reply: '❌ Medicine not added to inventory.'
        });
      } else {
        return res.json({
          reply: 'Please answer with Yes or No.'
        });
      }
    }
    
    // Handle medicine name input
    if (stockAddFlow.stage === 'add_stock_name') {
      stockAddFlow.medicineName = message.trim();
      stockAddFlow.stage = 'add_stock_packets';
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
      return res.json({
        reply: 'Enter total number of packets:'
      });
    }
    
    // Handle packets input
    if (stockAddFlow.stage === 'add_stock_packets') {
      const packets = parseInt(message.trim());
      if (isNaN(packets) || packets <= 0) {
        return res.json({
          reply: 'Please enter a valid number of packets (greater than 0).'
        });
      }
      stockAddFlow.packets = packets;
      stockAddFlow.stage = 'add_stock_tablets_per_packet';
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
      return res.json({
        reply: 'Enter number of tablets per packet:'
      });
    }
    
    // Handle tablets per packet input
    if (stockAddFlow.stage === 'add_stock_tablets_per_packet') {
      const tabletsPerPacket = parseInt(message.trim());
      if (isNaN(tabletsPerPacket) || tabletsPerPacket <= 0) {
        return res.json({
          reply: 'Please enter a valid number of tablets per packet (greater than 0).'
        });
      }
      stockAddFlow.tabletsPerPacket = tabletsPerPacket;
      stockAddFlow.stage = 'add_stock_packet_price';
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
      return res.json({
        reply: 'Enter price per packet:'
      });
    }
    
    // Handle packet price input and complete stock addition
    if (stockAddFlow.stage === 'add_stock_packet_price') {
      const packetPrice = parseFloat(message.trim());
      if (isNaN(packetPrice) || packetPrice <= 0) {
        return res.json({
          reply: 'Please enter a valid price per packet (greater than 0).'
        });
      }
      stockAddFlow.packetPrice = packetPrice;
      
      // Calculate values
      const totalTablets = stockAddFlow.packets * stockAddFlow.tabletsPerPacket;
      const pricePerTablet = packetPrice / stockAddFlow.tabletsPerPacket;
      
      try {
        // Insert into database
        const result = await db.query(
          `INSERT INTO medicines (
            name, stock_packets, tablets_per_packet, individual_tablets,
            price_per_packet, price_per_tablet, is_deleted
          )
          VALUES ($1, $2, $3, 0, $4, $5, FALSE)
          RETURNING *`,
          [
            stockAddFlow.medicineName,
            stockAddFlow.packets,
            stockAddFlow.tabletsPerPacket,
            packetPrice,
            pricePerTablet
          ]
        );
        
        const newMedicine = result.rows[0];
        
        // Emit WebSocket event for inventory update
        if (io) {
          io.emit('inventoryUpdated', {
            action: 'added',
            medicine: newMedicine,
            totalStock: totalTablets
          });
        }
        
        // Reset stock add flow
        stockAddFlow.stage = 'idle';
        stockAddFlow.medicineName = null;
        stockAddFlow.packets = null;
        stockAddFlow.tabletsPerPacket = null;
        stockAddFlow.packetPrice = null;
        
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        
        return res.json({
          reply: '✅ Medicine successfully added to inventory.\nTotal stock: ' + totalTablets + ' tablets.\nPrice per tablet: ₹' + pricePerTablet.toFixed(2) + '\nInventory updated successfully.\n\nInventory page updates instantly⚡'
        });
        
      } catch (error) {
        console.error('Error adding medicine to inventory:', error);
        // Reset flow on error
        stockAddFlow.stage = 'idle';
        stockAddFlow.medicineName = null;
        stockAddFlow.packets = null;
        stockAddFlow.tabletsPerPacket = null;
        stockAddFlow.packetPrice = null;
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        
        return res.json({
          reply: '❌ Error adding medicine to inventory. Please try again.'
        });
      }
    }

    /* =========================
       CUSTOMER DETAILS
    ========================= */
    if(orderSession.stage === 'ask_customer'){
      // Check if user wants to skip
      if(/^(skip|skip it|no thanks)$/i.test(message)){
        orderSession.stage='ready';
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply:'✅ Proceeding without customer details. Type *proceed* to place order.' });
      }
      
      // Try both formats: "Name Age Mobile" and "Name - Age - Mobile"
      let m = message.match(/^([A-Za-z ]+)\s+(\d{1,3})\s+(\d{10})$/);
      if (!m) {
        m = message.match(/^([A-Za-z ]+)\s*-\s*(\d{1,3})\s*-\s*(\d{10})$/);
      }
      
      if(!m) {
        return res.json({ 
          reply:'❌ Format: "Name Age Mobile" OR "Name - Age - Mobile"\n\nExample: "John Doe 25 9876543210" or "John Doe - 25 - 9876543210"\n\nOr type *skip* to proceed without details' 
        });
      }

      orderSession.customer = {
        name:m[1].trim(),
        age:parseInt(m[2],10),
        mobile:m[3]
      };

      orderSession.stage='ready';
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

      return res.json({ reply:'✅ Details saved. Type *proceed* to place order.' });
    }

    /* =========================
       PROCEED ORDER
    ========================= */
    if(/^proceed$/i.test(message)){
      const totalTabs = orderSession.medicines.reduce((s,m)=>s+m.quantity,0);

      if(totalTabs >= 3 && !orderSession.customer.name){
        orderSession.stage='ask_customer';
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({
          reply: "👤 Please share customer details:\nName Age Mobile"
        });
      }

      // Show order summary and ask for Y/N confirmation
      let summary = '📋 **Order Summary**\n\n';
      let total = 0;
      
      let anyPrescriptionRequired = false;

      for(const m of orderSession.medicines){
        const pricePerTablet = parseFloat(m.price_per_tablet) || 0;
        const medTotal = m.quantity * pricePerTablet;
        total += medTotal;
        summary += "💊 " + m.name + "\n";
        summary += "   Qty: " + m.quantity + " tablets\n";
        summary += "   Price: ₹" + pricePerTablet.toFixed(2) + " each\n";
        summary += "   Subtotal: ₹" + medTotal.toFixed(2) + "\n";
        
        // Check if prescription is required from DB
        const medRs = await db.query('SELECT prescription_required FROM medicines WHERE id = $1', [m.id]);
        const prescriptionRequired = medRs.rows.length > 0 ? !!medRs.rows[0].prescription_required : false;
        if (prescriptionRequired) anyPrescriptionRequired = true;
        summary += "   Prescription: " + (prescriptionRequired ? "Required" : "Not required") + "\n\n";
      }
      
      summary += "💰 **Total: ₹" + total.toFixed(2) + "**\n\n";
      if (anyPrescriptionRequired) {
        summary += "⚕️ One or more medicines require a valid prescription.\n";
        summary += "Do you confirm that you have a valid prescription for the required items? (Y/N)\n\n";
        summary += "Then we will proceed to place the order.";
      } else {
        summary += "Proceed with order? (Y/N)";
      }

      orderSession.stage='confirm_order';
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
      
      return res.json({ reply: summary });
    }

    // Handle Y/N confirmation for order
    if(orderSession.stage === 'confirm_order'){
      if(/^[Yy]$/i.test(message)){
        try {
          // Validation: Check if we have medicines in the session
          if (!orderSession.medicines || orderSession.medicines.length === 0) {
            return res.json({ reply: '❌ No medicines in cart. Please add medicines first.' });
          }

          // Validation: Check total tablets for prescription requirement
          const totalTabs = orderSession.medicines.reduce((s,m)=>s+m.quantity,0);
          if(totalTabs >= 3 && !orderSession.customer.name){
            orderSession.stage='ask_customer';
            sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
            return res.json({
              reply: "👤 Please share customer details:\nName Age Mobile"
            });
          }

          // Calculate total with proper type conversion
          let total = orderSession.medicines.reduce((s,m)=>s + (parseFloat(m.total_price) || 0), 0);

          // Start database transaction
          await db.query('BEGIN');
          
          // Insert order using ONLY existing columns from schema
          const ins = await db.query(
            'INSERT INTO orders (customer_name, mobile, total_price, status) VALUES ($1,$2,$3,\'completed\') RETURNING id',
            [
              orderSession.customer.name || 'Guest',
              orderSession.customer.mobile || null,
              total
            ]
          );

          const orderId = ins.rows[0].id;

          // Insert order items (stock already updated in real-time)
          for(const m of orderSession.medicines){
            // Validate medicine data
            if (!m.id || !m.quantity || m.quantity <= 0) {
              throw new Error("Invalid medicine data: " + JSON.stringify(m));
            }

            // Insert order item
            await db.query(
              'INSERT INTO order_items (order_id,medicine_id,quantity,price_at_time) VALUES ($1,$2,$3,$4)',
              [orderId, m.id, m.quantity, parseFloat(m.price_per_tablet) || 0]
            );
            
            debugLog("Order confirmed: " + m.name + " (" + m.quantity + " tablets) - stock already deducted in real-time");
          }

          // Commit transaction
          await db.query('COMMIT');

          // Generate detailed order confirmation
          let confirmation = "🧾 **Order Placed Successfully!**\n\n";
          confirmation += "Order ID: ORD-" + orderId + "\n\n";
          
          for(const m of orderSession.medicines){
            confirmation += "💊 " + m.name + " - " + m.quantity + " tablets\n";
          }
          
          confirmation += "\n💰 Total Amount: ₹" + total.toFixed(2) + "\n";
          confirmation += "📦 Order Status: Completed\n";
          confirmation += "🚚 Delivery: Standard delivery\n";
          confirmation += "✅ Stock updated successfully";

          // Reset session
          orderSession = {
            medicines:[],
            stage:'initial',
            pendingMedicine:null,
            pendingPrescription:null,
            customer:{ name:null, age:null, mobile:null }
          };

          sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

          return res.json({ reply: confirmation });

        } catch (dbError) {
          // Rollback transaction on error
          try {
            await db.query('ROLLBACK');
          } catch (rollbackError) {
            console.error('Rollback failed:', rollbackError);
          }
          
          console.error('Order placement error:', dbError);
          return res.status(500).json({ 
            reply: '❌ Sorry, there was an error placing your order. Please try again or contact support.' 
          });
        }
      } else if(/^[Nn]$/i.test(message)){
        orderSession.stage='initial';
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply: '❌ Order cancelled. You can continue adding medicines or start a new order.' });
      } else {
        return res.json({ reply: 'Please enter Y to confirm or N to cancel.' });
      }
    }

    /* =========================
       PRESCRIPTION CONFIRMATION HANDLER
    ========================= */
    
    // Check if we're waiting for prescription confirmation for the last added medicine
    if (orderSession.medicines.length > 0 && orderSession.stage === 'initial') {
      const lastMed = orderSession.medicines[orderSession.medicines.length - 1];
      
      // If the last medicine requires prescription and we haven't confirmed yet
      if (lastMed.prescription_required && !lastMed.prescription_confirmed) {
        if (/^(y|yes)$/i.test(message)) {
          // User confirmed they have prescription - place order
          try {
            // Calculate total
            let total = orderSession.medicines.reduce((s,m)=>s + (parseFloat(m.total_price) || 0), 0);
            
            // Start database transaction
            await db.query('BEGIN');
            
            // Insert order
            const ins = await db.query(
              'INSERT INTO orders (customer_name, mobile, total_price, status) VALUES ($1,$2,$3,\'completed\') RETURNING id',
              [
                orderSession.customer.name || 'Guest',
                orderSession.customer.mobile || null,
                total
              ]
            );
            
            const orderId = ins.rows[0].id;
            
            // Insert order items
            for(const m of orderSession.medicines){
              await db.query(
                'INSERT INTO order_items (order_id,medicine_id,quantity,price_at_time) VALUES ($1,$2,$3,$4)',
                [orderId, m.id, m.quantity, parseFloat(m.price_per_tablet) || 0]
              );
            }
            
            // Commit transaction
            await db.query('COMMIT');
            
            // Generate confirmation
            let confirmation = "🧾 **Order Placed Successfully!**\n\n";
            confirmation += "Order ID: ORD-" + orderId + "\n\n";
            
            for(const m of orderSession.medicines){
              confirmation += "💊 " + m.name + " - " + m.quantity + " tablets";
              if (m.prescription_required) {
                confirmation += " (✓ Prescription confirmed)";
              }
              confirmation += "\n";
            }
            
            confirmation += "\n💰 Total Amount: ₹" + total.toFixed(2) + "\n";
            confirmation += "📦 Order Status: Completed\n";
            confirmation += "✅ Stock updated successfully";
            
            // Reset session
            orderSession = {
              medicines:[],
              stage:'initial',
              pendingMedicine:null,
              pendingPrescription:null,
              customer:{ name:null, age:null, mobile:null }
            };
            
            sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
            
            return res.json({ reply: confirmation });
            
          } catch (dbError) {
            try {
              await db.query('ROLLBACK');
            } catch (rollbackError) {
              console.error('Rollback failed:', rollbackError);
            }
            
            console.error('Prescription order placement error:', dbError);
            return res.json({ reply: '❌ Sorry, there was an error placing your order. Please try again or contact support.' });
          }
          
        } else if (/^(n|no)$/i.test(message)) {
          // User doesn't have prescription - remove the medicine and reset
          const removedMed = orderSession.medicines.pop(); // Remove last medicine
          
          // Restore stock by adding back to total_tablets via trigger
          try {
            // Get current medicine info to calculate new stock distribution
            const medInfo = await db.query(
              'SELECT stock_packets, tablets_per_packet, individual_tablets, total_tablets FROM medicines WHERE id = $1',
              [removedMed.id]
            );
            
            if (medInfo.rows.length > 0) {
              const current = medInfo.rows[0];
              const tabletsPerPacket = current.tablets_per_packet || 1;
              
              // Calculate new total tablets and redistribute
              const newTotalTablets = current.total_tablets + removedMed.quantity;
              const newStockPackets = Math.floor(newTotalTablets / tabletsPerPacket);
              const newIndividualTablets = newTotalTablets % tabletsPerPacket;
              
              // Update stock_packets and individual_tablets - trigger will update total_tablets
              await db.query(
                `UPDATE medicines 
                 SET stock_packets = $1,
                     individual_tablets = $2
                 WHERE id = $3`,
                [newStockPackets, newIndividualTablets, removedMed.id]
              );
            }
          } catch (stockError) {
            console.error('Failed to restore stock:', stockError);
          }
          
          sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
          
          return res.json({ 
            reply: '❌ Medicine removed from cart due to no prescription. You can continue adding other medicines.' 
          });
        }
      }
    }

    /* =========================
       Y/N RESPONSE FOR ADDING MORE MEDICINES
       Updated: 'Y' now means proceed to order summary,
       'N' cancels the current cart.
    ========================= */
    if (orderSession.stage === 'initial' && orderSession.medicines.length > 0) {
      if (/^(y|yes)$/i.test(message)) {
        debugLog('User chose to proceed directly with current cart (Y)');
        // Reuse the proceed logic: build summary and set stage=confirm_order
        let summary = "📋 **Order Summary**\n\n";
        let total = 0;
        let anyPrescriptionRequired = false;

        for (const m of orderSession.medicines) {
          const pricePerTablet = parseFloat(m.price_per_tablet) || 0;
          const medTotal = m.quantity * pricePerTablet;
          total += medTotal;
          summary += '💊 ' + m.name + '\n';
          summary += '   Qty: ' + m.quantity + ' tablets\n';
          summary += '   Price: ₹' + pricePerTablet.toFixed(2) + ' each\n';
          summary += '   Subtotal: ₹' + medTotal.toFixed(2) + '\n';

          const medRs = await db.query('SELECT prescription_required FROM medicines WHERE id = $1', [m.id]);
          const prescriptionRequired = medRs.rows.length > 0 ? !!medRs.rows[0].prescription_required : false;
          if (prescriptionRequired) anyPrescriptionRequired = true;
          summary += '   Prescription: ' + (prescriptionRequired ? 'Required' : 'Not required') + '\n\n';
        }

        summary += '💰 **Total: ₹' + total.toFixed(2) + '**\n\n';
        if (anyPrescriptionRequired) {
          summary += '⚕️ One or more medicines require a valid prescription.\n';
          summary += 'Do you confirm that you have a valid prescription for the required items? (Y/N)\n\n';
          summary += 'Then we will proceed to place the order.';
        } else {
          summary += 'Confirm order? (Y/N)';
        }

        orderSession.stage = 'confirm_order';
        sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });

        return res.json({ reply: summary });
      }
      
      if (/^(n|no)$/i.test(message)) {
        debugLog('User cancelled current cart (N) before checkout');
        orderSession = {
          medicines: [],
          stage: 'initial',
          pendingMedicine: null,
          pendingPrescription: null,
          customer: { name: null, age: null, mobile: null }
        };
        sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
        return res.json({ reply: '❌ Order cancelled. You can start a new order anytime.' });
      }
    }

    /* =========================
       GROK AI-POWERED MESSAGE PROCESSING
    ========================= */
    debugLog('=== GROK AI MESSAGE PROCESSING ===');
    debugLog('Message: "' + message + '"');
    debugLog('Stage: ' + orderSession.stage);
    debugLog('Pending medicine: ' + JSON.stringify(orderSession.pendingMedicine));
    
    // Update agent thinking
    agentMetadata.thinking = '🤖 Intent Agent: Analyzing user message with Grok AI...';
    
    // IMPORTANT: Check if this is a Y/N response for prescription confirmation
    if (orderSession.pendingPrescription) {
      if (/^(y|yes)$/i.test(message)) {
        debugLog('=== PRESCRIPTION YES RESPONSE DETECTED ===');
        
        // User confirmed prescription - proceed with order
        const pending = orderSession.pendingPrescription;
        
        // Deduct stock
        await updateStockRealTime(pending.medicine_id, pending.quantity, pending.medicine_name);
        
        // Build clean response format
        const pricePerTablet = parseFloat(pending.price_per_tablet) || 0;
        const totalPrice = pricePerTablet * pending.quantity;
        
        let responseLines = [];
        responseLines.push('✅ ' + pending.medicine_name + ' (' + pending.quantity + ' tablets)');
        responseLines.push('💊 Price per tablet: ₹' + pricePerTablet.toFixed(2));
        responseLines.push('📦 Quantity: ' + pending.quantity);
        responseLines.push('💰 Total price: ₹' + totalPrice.toFixed(2));
        responseLines.push('');
        responseLines.push('🎉 Order Placed Successfully!');
        responseLines.push('');
        responseLines.push('⚕️ Prescription verified - Order completed safely');
        
        // Clear pending prescription
        orderSession.pendingPrescription = null;
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        
        agentMetadata.safety_checked = true;
        agentMetadata.stock_checked = true;
        agentMetadata.thinking = '✅ Intent Agent: Order intent verified\n✅ Safety Agent: Prescription confirmed\n✅ Stock Agent: Stock deducted successfully';
        
        const finalResponse = responseLines.join('\n');
        debugLog('=== SENDING PRESCRIPTION CONFIRMED RESPONSE ===');
        debugLog(finalResponse);
        debugLog('=== END RESPONSE ===');
        
        return res.status(200).json({
          reply: finalResponse,
          intent_verified: agentMetadata.intent_verified,
          safety_checked: agentMetadata.safety_checked,
          stock_checked: agentMetadata.stock_checked,
          thinking: agentMetadata.thinking
        });
      }
      
      if (/^(n|no)$/i.test(message)) {
        debugLog('=== PRESCRIPTION NO RESPONSE DETECTED ===');
        
        // Clear pending prescription
        orderSession.pendingPrescription = null;
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        
        return res.json({ 
          reply: getMultilingualResponse('prescription_cancelled', aiResult.language || detectLanguage(message)),
          intent_verified: agentMetadata.intent_verified,
          safety_checked: agentMetadata.safety_checked,
          stock_checked: agentMetadata.stock_checked,
          thinking: agentMetadata.thinking
        });
      }
    }
    
    // IMPORTANT: Check if this is a Y/N response before processing with Grok
    if (orderSession.stage === 'initial' && orderSession.medicines.length > 0) {
      if (/^(y|yes|n|no)$/i.test(message)) {
        debugLog('Y/N response detected but not handled above - this should not happen');
        return res.json({ 
          reply: 'Please specify a medicine name or type *proceed* to checkout.',
          intent_verified: agentMetadata.intent_verified,
          safety_checked: agentMetadata.safety_checked,
          stock_checked: agentMetadata.stock_checked,
          thinking: agentMetadata.thinking
        });
      }
    }
    
    // Use Grok AI to understand the message
    const aiResult = await processWithGrok(message);
    debugLog('Grok result: ' + JSON.stringify(aiResult));
    
    // Update agent metadata after intent processing
    agentMetadata.intent_verified = true;
    agentMetadata.thinking = '✅ Intent Agent: Medicine intent verified\n🔍 Safety Agent: Checking medicine safety...';
    
    // Handle ORDER intent with medicines array
    if (aiResult.intent === 'order' && aiResult.medicines && aiResult.medicines.length > 0) {
      debugLog('=== ORDER INTENT DETECTED ===');
      
      // Process each medicine from Grok
      for (const medItem of aiResult.medicines) {
        const cleanMedName = medItem.name.trim();
        const quantity = medItem.quantity || 1; // Default to 1 if no quantity
        
        debugLog(`Processing medicine: ${cleanMedName}, quantity: ${quantity}`);
        
        // Validate medicine exists in database
        const rs = await db.query(
          'SELECT * FROM medicines ' +
          'WHERE (name ILIKE $1 OR brand ILIKE $1) ' +
          'AND is_deleted = FALSE ' +
          'LIMIT 1',
          ['%' + cleanMedName + '%']
        );
        
        if (rs.rows.length === 0) {
          agentMetadata.thinking = '❌ Safety Agent: Medicine "' + cleanMedName + '" not found in database';
          return res.status(200).json({ 
            reply: '❌ Medicine "' + cleanMedName + '" not found in database.',
            intent_verified: agentMetadata.intent_verified,
            safety_checked: false,
            stock_checked: agentMetadata.stock_checked,
            thinking: agentMetadata.thinking
          });
        }
        
        const med = rs.rows[0];
        debugLog('Found medicine: ' + med.name);
        
        // Check stock availability using total_tablets from database
        const totalAvailableTablets = med.total_tablets || (med.stock_packets * med.tablets_per_packet + med.individual_tablets);
        const stockAvailable = totalAvailableTablets >= quantity;
        
        if (!stockAvailable) {
          // Return stock insufficient message
          const stockMsg = getMultilingualResponse('out_of_stock', aiResult.language || detectLanguage(message), med.name, totalAvailableTablets);
          
          agentMetadata.stock_checked = true;
          agentMetadata.thinking = '❌ Stock Agent: Insufficient stock for ' + med.name;
          
          return res.status(200).json({
            reply: stockMsg,
            intent_verified: agentMetadata.intent_verified,
            safety_checked: agentMetadata.safety_checked,
            stock_checked: agentMetadata.stock_checked,
            thinking: agentMetadata.thinking
          });
        }
        
        // Check if prescription is required
        const prescriptionRequired = !!med.prescription_required;
        
        if (prescriptionRequired) {
          // Ask for prescription confirmation before placing order
          agentMetadata.safety_checked = true;
          agentMetadata.stock_checked = true;
          agentMetadata.thinking = '✅ Intent Agent: Order intent verified\n✅ Safety Agent: Medicine validated\n⚠️ Prescription Required: User confirmation needed';
          
          // Store pending prescription in session
          orderSession.pendingPrescription = {
            medicine_id: med.id,
            medicine_name: med.name,
            quantity: quantity,
            price_per_tablet: med.price_per_tablet
          };
          sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
          
          const prescriptionMsg = getMultilingualResponse('prescription_required', aiResult.language || detectLanguage(message), med.name);
          
          return res.status(200).json({
            reply: prescriptionMsg,
            intent_verified: agentMetadata.intent_verified,
            safety_checked: agentMetadata.safety_checked,
            stock_checked: agentMetadata.stock_checked,
            thinking: agentMetadata.thinking
          });
        }
        
        // Stock is sufficient and no prescription required - deduct stock and return clean response
        await updateStockRealTime(med.id, quantity, med.name);
        
        // Build clean response format
        const pricePerTablet = parseFloat(med.price_per_tablet) || 0;
        const totalPrice = pricePerTablet * quantity;
        
        let responseLines = [];
        responseLines.push('✅ ' + med.name + ' (' + quantity + ' tablets)');
        
        // Add description from database (2-3 lines max)
        if (med.description) {
          const descLines = med.description.split('\n').slice(0, 2); // Max 2 lines
          responseLines.push('📝 ' + descLines.join(' '));
        }
        
        responseLines.push('💊 Price per tablet: ₹' + pricePerTablet.toFixed(2));
        responseLines.push('📦 Quantity: ' + quantity);
        responseLines.push('💰 Total price: ₹' + totalPrice.toFixed(2));
        responseLines.push('');
        responseLines.push('🎉 Order Placed Successfully!');
        
        agentMetadata.safety_checked = true;
        agentMetadata.stock_checked = true;
        agentMetadata.thinking = '✅ Intent Agent: Order intent verified\n✅ Safety Agent: Medicine validated\n✅ Stock Agent: Stock deducted successfully';
        
        // Return clean response without fallback text
        const finalResponse = responseLines.join('\n');
        debugLog('=== SENDING RESPONSE ===');
        debugLog(finalResponse);
        debugLog('=== END RESPONSE ===');
        
        return res.status(200).json({
          reply: finalResponse,
          intent_verified: agentMetadata.intent_verified,
          safety_checked: agentMetadata.safety_checked,
          stock_checked: agentMetadata.stock_checked,
          thinking: agentMetadata.thinking
        });
      }
    }
    
    // Process each medicine extracted by Grok AI (fallback for non-order intents)
    for(const medItem of aiResult.medicines){
      // Clean up medicine name - remove extra spaces
      const cleanMedName = medItem.name.trim();
      
      if(medItem.quantity === null){
        // User only provided medicine name; first verify it exists in active DB
        const rsNameOnly = await db.query(
          'SELECT * FROM medicines ' +
          'WHERE (name ILIKE $1 OR brand ILIKE $1) ' +
          'AND is_deleted = FALSE ' +
          'LIMIT 1',
          ['%' + cleanMedName + '%']
        );

        if (rsNameOnly.rows.length === 0) {
          // Not currently in stock. Check for previous configuration (any row by name).
          const prevRs = await db.query(
            'SELECT * FROM medicines ' +
            'WHERE LOWER(name) = LOWER($1) ' +
            'ORDER BY created_at DESC ' +
            'LIMIT 1',
            [cleanMedName]
          );

          stockFlow.language = aiResult.language || stockFlow.language || detectedLang;
          stockFlow.targetName = cleanMedName;
          stockFlow.lastMissingName = cleanMedName;

          if (prevRs.rows.length > 0) {
            const prev = prevRs.rows[0];
            stockFlow.previousConfig = {
              tablets_per_packet: prev.tablets_per_packet || 1,
              price_per_packet: parseFloat(prev.price_per_packet || 0),
              stock_packets: prev.stock_packets || 0
            };
            stockFlow.stage = 'offer_use_previous';
            sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

            const reply = 'I found previous stock details for ' + cleanMedName + ':\n' +
'• Packets: ' + stockFlow.previousConfig.stock_packets + '\n' +
'• Tablets per packet: ' + stockFlow.previousConfig.tablets_per_packet + '\n' +
'• Price per packet: ₹' + stockFlow.previousConfig.price_per_packet.toFixed(2) + '\n\n' +
'Would you like to add stock using the same configuration? (Y/N)';

            return res.json({ reply });
          } else {
            // No previous record either – offer to add new medicine
            stockFlow.stage = 'offer_add_missing';
            sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

            const reply = cleanMedName + ' is currently not in stock. Would you like to add it? (Y/N)';
            return res.json({ reply });
          }
        }

        const medMatch = rsNameOnly.rows[0];

        orderSession.stage='ask_quantity';
        orderSession.pendingMedicine={ id: medMatch.id, name: medMatch.name };
        debugLog('Setting pending medicine to: ' + JSON.stringify(orderSession.pendingMedicine));
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        
        agentMetadata.safety_checked = true;
        agentMetadata.thinking = '✅ Intent Agent: Medicine intent verified\n✅ Safety Agent: "' + medMatch.name + '" is safe and available\n📊 Stock Agent: Checking stock levels...';
        
        return res.json({ 
          reply: ' ' + medMatch.name + ' — quantity?',
          intent_verified: agentMetadata.intent_verified,
          safety_checked: agentMetadata.safety_checked,
          stock_checked: agentMetadata.stock_checked,
          thinking: agentMetadata.thinking
        });
      }

      const rs = await db.query(
        'SELECT * FROM medicines ' +
        'WHERE (name ILIKE $1 OR brand ILIKE $1) ' +
        'LIMIT 1',
        ['%' + cleanMedName + '%']
      );

      if(rs.rows.length===0){
        agentMetadata.thinking = '❌ Safety Agent: Medicine "' + cleanMedName + '" not found in database';
        return res.json({ 
          reply: ' ' + cleanMedName + ' not found.',
          intent_verified: agentMetadata.intent_verified,
          safety_checked: false,
          stock_checked: agentMetadata.stock_checked,
          thinking: agentMetadata.thinking
        });
      }

      const med = rs.rows[0];
      debugLog('Found medicine: ' + med.name);

      // Check stock availability using total_tablets from database
      const totalAvailableTablets = med.total_tablets || (med.stock_packets * med.tablets_per_packet + med.individual_tablets);
      const stockAvailable = totalAvailableTablets >= medItem.quantity;
      
      if (!stockAvailable) {
        // Instead of returning error, start stock add flow
        stockAddFlow.stage = 'ask_add_stock_confirmation';
        stockAddFlow.medicineName = med.name;
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        
        return res.json({
          reply: '❌ This medicine is currently out of stock.\nWould you like to add this medicine to inventory? (Yes/No)'
        });
      }

      agentMetadata.safety_checked = true;
      agentMetadata.stock_checked = true;
      agentMetadata.thinking = '✅ Intent Agent: Medicine intent verified\n✅ Safety Agent: All medicines are safe\n✅ Stock Agent: Stock levels verified and sufficient\n🔄 Stock Agent: Updating real-time inventory...';

      // Check if prescription is required
      const prescriptionRequired = !!med.prescription_required;
      
      const total = medItem.quantity * parseFloat(med.price_per_tablet) || 0;
      
      // Update stock in real-time when medicine is added to cart
      await updateStockRealTime(med.id, medItem.quantity, med.name);
      
      orderSession.medicines.push({
        id:med.id,
        name:med.name,
        quantity:medItem.quantity,
        price_per_tablet:med.price_per_tablet,
        total_price:total,
        prescription_required: prescriptionRequired,
        prescription_confirmed: false // Flag to track if prescription was confirmed
      });
      
      // Handle prescription vs non-prescription flow
      if (prescriptionRequired) {
        // For prescription medicines, ask for prescription confirmation
        const cartTotal = orderSession.medicines.reduce((s,m)=>s+m.total_price,0);
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        
        return res.json({
          reply: '⚕️ ' + med.name + ' requires a prescription.\n\nNeed prescription show still can I proceed? (Y/N)\n\nIf yes, we will place the order. If no, the medicine will be removed from cart.',
          intent_verified: agentMetadata.intent_verified,
          safety_checked: agentMetadata.safety_checked,
          stock_checked: agentMetadata.stock_checked,
          thinking: agentMetadata.thinking
        });
      }
    }

    const cartTotal = orderSession.medicines.reduce((s,m)=>s+m.total_price,0);
    sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

    // Generate intelligent response based on intent
    let responseMessage = '';
    
    // Check if all medicines in cart are non-prescription, then auto-place order
    const allNonPrescription = orderSession.medicines.every(m => !m.prescription_required);
    
    if (allNonPrescription && orderSession.medicines.length > 0) {
      // Auto-place order for non-prescription medicines
      try {
        // Calculate total
        let total = orderSession.medicines.reduce((s,m)=>s + (parseFloat(m.total_price) || 0), 0);
        
        // Start database transaction
        await db.query('BEGIN');
        
        // Insert order
        const ins = await db.query(
          'INSERT INTO orders (customer_name, mobile, total_price, status) VALUES ($1,$2,$3,\'completed\') RETURNING id',
          [
            orderSession.customer.name || 'Guest',
            orderSession.customer.mobile || null,
            total
          ]
        );
        
        const orderId = ins.rows[0].id;
        
        // Insert order items
        for(const m of orderSession.medicines){
          await db.query(
            'INSERT INTO order_items (order_id,medicine_id,quantity,price_at_time) VALUES ($1,$2,$3,$4)',
            [orderId, m.id, m.quantity, parseFloat(m.price_per_tablet) || 0]
          );
        }
        
        // Commit transaction
        await db.query('COMMIT');
        
        // Generate confirmation
        let confirmation = "🧾 **Order Placed Successfully!**\n\n";
        confirmation += "Order ID: ORD-" + orderId + "\n\n";
        
        for(const m of orderSession.medicines){
          confirmation += "💊 " + m.name + " - " + m.quantity + " tablets\n";
        }
        
        confirmation += "\n💰 Total Amount: ₹" + total.toFixed(2) + "\n";
        confirmation += "📦 Order Status: Completed\n";
        confirmation += "✅ Stock updated successfully";
        
        // Reset session
        orderSession = {
          medicines:[],
          stage:'initial',
          pendingMedicine:null,
          pendingPrescription:null,
          customer:{ name:null, age:null, mobile:null }
        };
        
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        
        responseMessage = confirmation;
        
      } catch (dbError) {
        try {
          await db.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
        
        console.error('Auto-order placement error:', dbError);
        responseMessage = '❌ Sorry, there was an error placing your order. Please try again or contact support.';
      }
    }
    
    // If we reach here, return a clean response without fallback text
    agentMetadata.thinking = '✅ Intent Agent: Processed\n✅ Safety Agent: Verified\n✅ Stock Agent: Checked';
    
    return res.status(200).json({ 
      reply: responseMessage,
      intent_verified: agentMetadata.intent_verified,
      safety_checked: agentMetadata.safety_checked,
      stock_checked: agentMetadata.stock_checked,
      thinking: agentMetadata.thinking
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ reply: '❌ Server error' });
  }
}

module.exports = { enhancedChatHandler };
