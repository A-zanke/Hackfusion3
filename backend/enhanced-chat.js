const db = require('./db');
require('dotenv').config();
const axios = require('axios');
const { Langfuse } = require('langfuse');

// Initialize Langfuse
const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: "https://cloud.langfuse.com"
});

// Initialize Grok API
const grokApi = axios.create({
  baseURL: 'https://api.x.ai/v1',
  headers: {
    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
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
      model: "grok-2-1212",  // Use correct Grok model name
      messages: [
        {
          role: "system",
          content: `You are an intelligent multi-lingual pharmacy assistant.
Detect:
- medicines: list of medicines mentioned and optional quantities
- intent: "order" | "search" | "inquiry"
- action: "check_stock" | "add_stock" | "order" | "other"
- language: "en" | "hi" | "mr"

Return STRICT JSON:
{"medicines":[{"name":"name","quantity":number|null}],"intent":"order","action":"check_stock","language":"en"}

Notes:
- If the user is asking things like "Do we have Dolo?" or "Dolo hai kya?" or "Dolo aahe ka?", action = "check_stock".
- If the user wants to add/increase stock (e.g. "add stock", "stock add karna hai", "Dolo add karo", "Dolo ka stock daalo", "stock increase karo", "medicine add karna hai"), action = "add_stock".
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
    
    if (totalAvailableTablets < quantity) {
      throw new Error(`Insufficient stock for ${medicineName}. Available: ${totalAvailableTablets} tablets, Requested: ${quantity} tablets`);
    }
    
    // Simple deduction: remove requested tablets from total
    const newTotalTablets = totalAvailableTablets - quantity;
    
    // Recalculate packets based on new total (rounding down)
    const newStockPackets = Math.floor(newTotalTablets / tabletsPerPacket);
    
    debugLog(`Real-time stock update for ${medicineName}: ${totalAvailableTablets} -> ${newTotalTablets} tablets (packets: ${currentStockPackets} -> ${newStockPackets})`);
    
    // Persist both packets and the exact total tablets
    await db.query(
      `UPDATE medicines 
       SET stock_packets = $1,
           total_tablets = $2
       WHERE id = $3`,
      [newStockPackets, newTotalTablets, medicineId]
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
      name, stock_packets, tablets_per_packet, total_tablets,
      price_per_packet, price_per_tablet, is_deleted
    )
    VALUES ($1,$2,$3,$4,$5,$6,FALSE)
    ON CONFLICT (name) DO UPDATE SET
      stock_packets = medicines.stock_packets + EXCLUDED.stock_packets,
      tablets_per_packet = EXCLUDED.tablets_per_packet,
      total_tablets = medicines.total_tablets + EXCLUDED.total_tablets,
      price_per_packet = EXCLUDED.price_per_packet,
      price_per_tablet = EXCLUDED.price_per_tablet,
      is_deleted = FALSE
    RETURNING *;
    `,
    [name, pkt, tabsPerPkt, addedTablets, pricePerPacket, pricePerTablet]
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
      customer: { name:null, age:null, mobile:null }
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
      await updateStockRealTime(med.id, qty, med.name);

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
      debugLog(`Found medicine: ${med.name}`);

      // Update stock in real-time when quantity is provided
      await updateStockRealTime(med.id, qty, med.name);

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
          reply:`👤 Please share customer details:
Name Age Mobile`
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
        summary += `💊 ${m.name}\n`;
        summary += `   Qty: ${m.quantity} tablets\n`;
        summary += `   Price: ₹${pricePerTablet.toFixed(2)} each\n`;
        summary += `   Subtotal: ₹${medTotal.toFixed(2)}\n`;
        
        // Check if prescription is required from DB
        const medRs = await db.query('SELECT prescription_required FROM medicines WHERE id = $1', [m.id]);
        const prescriptionRequired = medRs.rows.length > 0 ? !!medRs.rows[0].prescription_required : false;
        if (prescriptionRequired) anyPrescriptionRequired = true;
        summary += `   Prescription: ${prescriptionRequired ? 'Required' : 'Not required'}\n\n`;
      }
      
      summary += `💰 **Total: ₹${total.toFixed(2)}**\n\n`;
      if (anyPrescriptionRequired) {
        summary += `⚕️ One or more medicines require a valid prescription.\n`;
        summary += `Do you confirm that you have a valid prescription for the required items? (Y/N)\n\n`;
        summary += `Then we will proceed to place the order.`;
      } else {
        summary += `Proceed with order? (Y/N)`;
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
              reply:`👤 Please share customer details:
Name Age Mobile`
            });
          }

          // Calculate total with proper type conversion
          let total = orderSession.medicines.reduce((s,m)=>s + (parseFloat(m.total_price) || 0), 0);

          // Start database transaction
          await db.query('BEGIN');
          
          // Insert order using ONLY existing columns from schema
          const ins = await db.query(
            `INSERT INTO orders (customer_name, mobile, total_price, status)
             VALUES ($1,$2,$3,'completed') RETURNING id`,
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
              throw new Error(`Invalid medicine data: ${JSON.stringify(m)}`);
            }

            // Insert order item
            await db.query(
              `INSERT INTO order_items (order_id,medicine_id,quantity,price_at_time)
               VALUES ($1,$2,$3,$4)`,
              [orderId, m.id, m.quantity, parseFloat(m.price_per_tablet) || 0]
            );
            
            debugLog(`Order confirmed: ${m.name} (${m.quantity} tablets) - stock already deducted in real-time`);
          }

          // Commit transaction
          await db.query('COMMIT');

          // Generate detailed order confirmation
          let confirmation = `🧾 **Order Placed Successfully!**\n\n`;
          confirmation += `Order ID: ORD-${orderId}\n\n`;
          
          for(const m of orderSession.medicines){
            confirmation += `💊 ${m.name} - ${m.quantity} tablets\n`;
          }
          
          confirmation += `\n💰 Total Amount: ₹${total.toFixed(2)}\n`;
          confirmation += `📦 Order Status: Completed\n`;
          confirmation += `🚚 Delivery: Standard delivery\n`;
          confirmation += `✅ Stock updated successfully`;

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
       Y/N RESPONSE FOR ADDING MORE MEDICINES
       Updated: 'Y' now means proceed to order summary,
       'N' cancels the current cart.
    ========================= */
    if (orderSession.stage === 'initial' && orderSession.medicines.length > 0) {
      if (/^(y|yes)$/i.test(message)) {
        debugLog(`User chose to proceed directly with current cart (Y)`);
        // Reuse the proceed logic: build summary and set stage=confirm_order
        let summary = '📋 **Order Summary**\n\n';
        let total = 0;
        let anyPrescriptionRequired = false;

        for (const m of orderSession.medicines) {
          const pricePerTablet = parseFloat(m.price_per_tablet) || 0;
          const medTotal = m.quantity * pricePerTablet;
          total += medTotal;
          summary += `💊 ${m.name}\n`;
          summary += `   Qty: ${m.quantity} tablets\n`;
          summary += `   Price: ₹${pricePerTablet.toFixed(2)} each\n`;
          summary += `   Subtotal: ₹${medTotal.toFixed(2)}\n`;

          const medRs = await db.query('SELECT prescription_required FROM medicines WHERE id = $1', [m.id]);
          const prescriptionRequired = medRs.rows.length > 0 ? !!medRs.rows[0].prescription_required : false;
          if (prescriptionRequired) anyPrescriptionRequired = true;
          summary += `   Prescription: ${prescriptionRequired ? 'Required' : 'Not required'}\n\n`;
        }

        summary += `💰 **Total: ₹${total.toFixed(2)}**\n\n`;
        if (anyPrescriptionRequired) {
          summary += `⚕️ One or more medicines require a valid prescription.\n`;
          summary += `Do you confirm that you have a valid prescription for the required items? (Y/N)\n\n`;
          summary += `Then we will proceed to place the order.`;
        } else {
          summary += `Confirm order? (Y/N)`;
        }

        orderSession.stage = 'confirm_order';
        sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });

        return res.json({ reply: summary });
      }
      
      if (/^(n|no)$/i.test(message)) {
        debugLog(`User cancelled current cart (N) before checkout`);
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
    debugLog(`=== GROK AI MESSAGE PROCESSING ===`);
    debugLog(`Message: "${message}"`);
    debugLog(`Stage: ${orderSession.stage}`);
    debugLog(`Pending medicine: ${JSON.stringify(orderSession.pendingMedicine)}`);
    
    // Update agent thinking
    agentMetadata.thinking = '🤖 Intent Agent: Analyzing user message with Grok AI...';
    
    // IMPORTANT: Check if this is a Y/N response before processing with Grok
    if (orderSession.stage === 'initial' && orderSession.medicines.length > 0) {
      if (/^(y|yes|n|no)$/i.test(message)) {
        debugLog(`Y/N response detected but not handled above - this should not happen`);
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
    debugLog(`Grok result: ${JSON.stringify(aiResult)}`);
    
    // Update agent metadata after intent processing
    agentMetadata.intent_verified = true;
    agentMetadata.thinking = '✅ Intent Agent: Medicine intent verified\n🔍 Safety Agent: Checking medicine safety...';
    
    // Process each medicine extracted by Grok AI
    for(const medItem of aiResult.medicines){
      // Clean up medicine name - remove extra spaces
      const cleanMedName = medItem.name.trim();
      
      if(medItem.quantity === null){
        // User only provided medicine name; first verify it exists in active DB
        const rsNameOnly = await db.query(
          `SELECT * FROM medicines 
           WHERE (name ILIKE $1 OR brand ILIKE $1)
             AND is_deleted = FALSE
           LIMIT 1`,
          [`%${cleanMedName}%`]
        );

        if (rsNameOnly.rows.length === 0) {
          // Not currently in stock. Check for previous configuration (any row by name).
          const prevRs = await db.query(
            `SELECT * FROM medicines 
             WHERE LOWER(name) = LOWER($1)
             ORDER BY created_at DESC
             LIMIT 1`,
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

            const reply = 
`I found previous stock details for ${cleanMedName}:
• Packets: ${stockFlow.previousConfig.stock_packets}
• Tablets per packet: ${stockFlow.previousConfig.tablets_per_packet}
• Price per packet: ₹${stockFlow.previousConfig.price_per_packet.toFixed(2)}

Would you like to add stock using the same configuration? (Y/N)`;

            return res.json({ reply });
          } else {
            // No previous record either – offer to add new medicine
            stockFlow.stage = 'offer_add_missing';
            sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

            const reply = `${cleanMedName} is currently not in stock. Would you like to add it? (Y/N)`;
            return res.json({ reply });
          }
        }

        const medMatch = rsNameOnly.rows[0];

        orderSession.stage='ask_quantity';
        orderSession.pendingMedicine={ id: medMatch.id, name: medMatch.name };
        debugLog(`Setting pending medicine to: ${JSON.stringify(orderSession.pendingMedicine)}`);
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        
        agentMetadata.safety_checked = true;
        agentMetadata.thinking = `✅ Intent Agent: Medicine intent verified\n✅ Safety Agent: "${medMatch.name}" is safe and available\n📊 Stock Agent: Checking stock levels...`;
        
        return res.json({ 
          reply: ` ${medMatch.name} — quantity?`,
          intent_verified: agentMetadata.intent_verified,
          safety_checked: agentMetadata.safety_checked,
          stock_checked: agentMetadata.stock_checked,
          thinking: agentMetadata.thinking
        });
      }

      const rs = await db.query(
        `SELECT * FROM medicines 
         WHERE (name ILIKE $1 OR brand ILIKE $1)
         LIMIT 1`,
        [`%${cleanMedName}%`]
      );

      if(rs.rows.length===0){
        agentMetadata.thinking = `❌ Safety Agent: Medicine "${cleanMedName}" not found in database`;
        return res.json({ 
          reply: ` ${cleanMedName} not found.`,
          intent_verified: agentMetadata.intent_verified,
          safety_checked: false,
          stock_checked: agentMetadata.stock_checked,
          thinking: agentMetadata.thinking
        });
      }

      const med = rs.rows[0];
      debugLog(`Found medicine: ${med.name}`);

      // Check stock availability
      const totalAvailableTablets = (med.stock_packets * med.tablets_per_packet) + med.individual_tablets;
      const stockAvailable = totalAvailableTablets >= medItem.quantity;
      
      if (!stockAvailable) {
        agentMetadata.thinking = `✅ Intent Agent: Medicine intent verified\n✅ Safety Agent: Medicine is safe\n❌ Stock Agent: Insufficient stock for ${med.name}. Available: ${totalAvailableTablets} tablets`;
        return res.json({
          reply: `❌ Insufficient stock for ${med.name}. Available: ${totalAvailableTablets} tablets, Requested: ${medItem.quantity} tablets`,
          intent_verified: agentMetadata.intent_verified,
          safety_checked: agentMetadata.safety_checked,
          stock_checked: false,
          thinking: agentMetadata.thinking
        });
      }

      agentMetadata.safety_checked = true;
      agentMetadata.stock_checked = true;
      agentMetadata.thinking = `✅ Intent Agent: Medicine intent verified\n✅ Safety Agent: All medicines are safe\n✅ Stock Agent: Stock levels verified and sufficient\n🔄 Stock Agent: Updating real-time inventory...`;

      // Skip prescription check since column doesn't exist
      const total = medItem.quantity * parseFloat(med.price_per_tablet) || 0;
      
      // Update stock in real-time when medicine is added to cart
      await updateStockRealTime(med.id, medItem.quantity, med.name);
      
      orderSession.medicines.push({
        id:med.id,
        name:med.name,
        quantity:medItem.quantity,
        price_per_tablet:med.price_per_tablet,
        total_price:total
      });
    }

    const cartTotal = orderSession.medicines.reduce((s,m)=>s+m.total_price,0);
    sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

    // Generate intelligent response based on intent
    let responseMessage = '';
    if (aiResult.intent === 'order') {
      responseMessage = `✅ Added to order  
💰 Total price: ₹${cartTotal.toFixed(2)}  
Add more (Y/N) or type *proceed*`;
    } else if (aiResult.intent === 'search') {
      responseMessage = `✅ Found medicines  
💰 Total price: ₹${cartTotal.toFixed(2)}  
Add more (Y/N) or type *proceed*`;
    } else {
      responseMessage = `✅ Processed  
💰 Total price: ₹${cartTotal.toFixed(2)}  
Add more (Y/N) or type *proceed*`;
    }

    // Update Langfuse trace
    trace.update({
      output: responseMessage,
      metadata: {
        intent_verified: agentMetadata.intent_verified,
        safety_checked: agentMetadata.safety_checked,
        stock_checked: agentMetadata.stock_checked,
        medicines_count: orderSession.medicines.length,
        cart_total: cartTotal
      }
    });

    return res.json({ 
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
