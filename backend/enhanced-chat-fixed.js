const db = require('./db');
require('dotenv').config();
const axios = require('axios');

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
   GROK AI PROCESSING
========================= */

async function processWithGrok(message) {
  try {
    const response = await grokApi.post('/chat/completions', {
      model: "grok-2-latest",
      messages: [
        {
          role: "system",
          content: `You are a pharmacy assistant. Extract medicine names and quantities from user messages. 
          Return JSON format: {"medicines": [{"name": "medicine name", "quantity": number}], "intent": "order/search/inquiry"}.
          If no quantity mentioned, use null. If multiple medicines, include all.`
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
    return JSON.parse(aiResponse);
  } catch (error) {
    console.error('Grok API Error:', error);
    // Fallback to basic parsing
    return {
      medicines: [{ name: message, quantity: null }],
      intent: "search"
    };
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

    // =========================
    // HARD GUARD: QUANTITY FIRST
    // =========================
    const msgTrim = String(message).trim();
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
      
      for(const m of orderSession.medicines){
        const pricePerTablet = parseFloat(m.price_per_tablet) || 0;
        const medTotal = m.quantity * pricePerTablet;
        total += medTotal;
        summary += `💊 ${m.name}\n`;
        summary += `   Qty: ${m.quantity} tablets\n`;
        summary += `   Price: ₹${pricePerTablet.toFixed(2)} each\n`;
        summary += `   Subtotal: ₹${medTotal.toFixed(2)}\n`;
        
        // Check if prescription is required by looking up the medicine
        const medRs = await db.query('SELECT * FROM medicines WHERE id = $1', [m.id]);
        const prescriptionRequired = medRs.rows.length > 0 ? false : false; // Default to false since column doesn't exist
        summary += `   Prescription: ${prescriptionRequired ? 'Required' : 'Not required'}\n\n`;
      }
      
      summary += `💰 **Total: ₹${total.toFixed(2)}**\n\n`;
      summary += `Proceed with order? (Y/N)`;

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

          // Insert order items and update stock
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
            
            // Update stock safely - update stock_packets instead of total_tablets
            // Calculate how many packets to reduce based on tablets ordered
            const medInfo = await db.query('SELECT tablets_per_packet FROM medicines WHERE id = $1', [m.id]);
            const tabletsPerPacket = medInfo.rows[0]?.tablets_per_packet || 1;
            const packetsToReduce = Math.ceil(m.quantity / tabletsPerPacket);
            
            await db.query(
              `UPDATE medicines 
               SET stock_packets = stock_packets - $1 
               WHERE id = $2 AND stock_packets >= $1`,
              [packetsToReduce, m.id]
            );
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
    ========================= */
    if (orderSession.stage === 'initial' && orderSession.medicines.length > 0) {
      if (/^(y|yes)$/i.test(message)) {
        debugLog(`User wants to add more medicines`);
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply: '💊 What medicine would you like to add?' });
      }
      
      if (/^(n|no)$/i.test(message)) {
        debugLog(`User wants to proceed to checkout`);
        orderSession.stage = 'ask_customer';
        return res.json({ reply: '👤 Please provide your details: Name Age Mobile\n(e.g., "John Doe 25 9876543210")' });
      }
    }

    /* =========================
       GROK AI-POWERED MESSAGE PROCESSING
    ========================= */
    debugLog(`=== GROK AI MESSAGE PROCESSING ===`);
    debugLog(`Message: "${message}"`);
    debugLog(`Stage: ${orderSession.stage}`);
    debugLog(`Pending medicine: ${JSON.stringify(orderSession.pendingMedicine)}`);
    
    // Use Grok AI to understand the message
    const aiResult = await processWithGrok(message);
    debugLog(`Grok result: ${JSON.stringify(aiResult)}`);
    
    // Process each medicine extracted by Grok AI
    for(const medItem of aiResult.medicines){
      // Clean up medicine name - remove extra spaces
      const cleanMedName = medItem.name.trim();
      
      if(medItem.quantity === null){
        // User only provided medicine name; first verify it exists in DB
        const rsNameOnly = await db.query(
          `SELECT * FROM medicines 
           WHERE (name ILIKE $1 OR brand ILIKE $1)
           LIMIT 1`,
          [`%${cleanMedName}%`]
        );

        if (rsNameOnly.rows.length === 0) {
          return res.json({ reply:` ${cleanMedName} not found.` });
        }

        const medMatch = rsNameOnly.rows[0];

        orderSession.stage='ask_quantity';
        orderSession.pendingMedicine={ id: medMatch.id, name: medMatch.name };
        debugLog(`Setting pending medicine to: ${JSON.stringify(orderSession.pendingMedicine)}`);
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply:` ${medMatch.name} — quantity?` });
      }

      const rs = await db.query(
        `SELECT * FROM medicines 
         WHERE (name ILIKE $1 OR brand ILIKE $1)
         LIMIT 1`,
        [`%${cleanMedName}%`]
      );

      if(rs.rows.length===0){
        return res.json({ reply:` ${cleanMedName} not found.` });
      }

      const med = rs.rows[0];
      debugLog(`Found medicine: ${med.name}`);

      // Skip prescription check since column doesn't exist
      const total = medItem.quantity * parseFloat(med.price_per_tablet) || 0;
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

    return res.json({ reply: responseMessage });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ reply: '❌ Server error' });
  }
}

module.exports = { enhancedChatHandler };
