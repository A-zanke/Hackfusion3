const db = require('./db');
require('dotenv').config();
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
  return String(s||'')
    .replace(/(?:tablet|tablets|tabs?|capsules?|pills?|mg|mcg|g)/gi,'')
    .replace(/\s{2,}/g,' ')
    .trim();
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
    debugLog(`Top-of-handler state: stage=${orderSession.stage}, pending=${orderSession.pendingMedicine}`);
    
    if (orderSession.stage === 'ask_quantity' && orderSession.pendingMedicine && /^\d+$/.test(msgTrim)) {
      debugLog(`Entering EARLY quantity branch with qty='${msgTrim}' for pending='${orderSession.pendingMedicine}'`);
      const qty = parseInt(msgTrim, 10);
      const itemName = orderSession.pendingMedicine;

      const rs = await db.query(
        'SELECT * FROM medicines WHERE is_deleted=FALSE AND (name ILIKE $1 OR brand ILIKE $1) LIMIT 1',
        [`%${itemName}%`]
      );

      if(rs.rows.length===0){
        debugLog(`Pending medicine not found in DB: ${itemName}`);
        orderSession.stage='initial';
        orderSession.pendingMedicine=null;
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply:`❌ ${itemName} not found.` });
      }

      const med = rs.rows[0];
      debugLog(`DB match for pending: ${med.name}`);

      if(med.prescription_required){
        debugLog(`Pending medicine requires prescription: ${med.name}`);
        orderSession.stage = 'confirm_prescription';
        orderSession.pendingPrescription = {
          id: med.id,
          name: med.name,
          quantity: qty,
          price_per_tablet: med.price_per_tablet
        };
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({
          reply:`⚠️ ${med.name} requires prescription. Proceed? (yes / no)`
        });
      }

      const total = qty * med.price_per_tablet;
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
        reply:`✅ Added ${med.name} (${qty} tablets)  
💰 Cart: ₹${cartTotal.toFixed(2)}

Would you like to add more medicines? (Y/N)`
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
    debugLog(`Pending medicine: ${orderSession.pendingMedicine}`);
    debugLog(`Message: "${message}"`);
    debugLog(`Is digits: ${/^\d+$/.test(message)}`);
    debugLog(`Condition match: ${orderSession.stage === 'ask_quantity' && orderSession.pendingMedicine && /^\d+$/.test(message)}`);
    
    if(
      orderSession.stage === 'ask_quantity' &&
      orderSession.pendingMedicine &&
      /^\d+$/.test(message)
    ){
      const qty = parseInt(message,10);
      const itemName = orderSession.pendingMedicine;

      debugLog(`=== QUANTITY RESPONSE ===`);
      debugLog(`User replied with quantity ${qty} for medicine: "${itemName}"`);
      debugLog(`Current pending medicine: ${orderSession.pendingMedicine}`);

      const rs = await db.query(
        `SELECT * FROM medicines 
         WHERE is_deleted=FALSE 
         AND (name ILIKE $1 OR brand ILIKE $1)
         LIMIT 1`,
        [`%${itemName}%`]
      );

      if(rs.rows.length===0){
        orderSession.stage='initial';
        orderSession.pendingMedicine=null;
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply:`❌ ${itemName} not found.` });
      }

      const med = rs.rows[0];
      debugLog(`Found medicine: ${med.name}`);

      if(med.prescription_required){
        orderSession.stage='confirm_prescription';
        orderSession.pendingPrescription = {
          id:med.id,
          name:med.name,
          quantity:qty,
          price_per_tablet:med.price_per_tablet
        };
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({
          reply:`⚠️ ${med.name} requires prescription. Proceed? (yes / no)`
        });
      }

      const total = qty * med.price_per_tablet;
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
        reply:`✅ Added ${med.name} (${qty} tablets)  
💰 Cart: ₹${cartTotal.toFixed(2)}`
      });
    }

    /* =========================
       CUSTOMER DETAILS
    ========================= */
    if(orderSession.stage === 'ask_customer'){
      const m = message.match(/^([A-Za-z ]+)\s+(\d{1,3})\s+(\d{10})$/);
      if(!m) return res.json({ reply:'❌ Format: Name Age Mobile' });

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
        const medTotal = m.quantity * m.price_per_tablet;
        total += medTotal;
        summary += `💊 ${m.name}\n`;
        summary += `   Qty: ${m.quantity} tablets\n`;
        summary += `   Price: ₹${m.price_per_tablet.toFixed(2)} each\n`;
        summary += `   Subtotal: ₹${medTotal.toFixed(2)}\n`;
        
        // Check if prescription is required by looking up the medicine
        const medRs = await db.query('SELECT prescription_required FROM medicines WHERE id = $1', [m.id]);
        const prescriptionRequired = medRs.rows.length > 0 ? medRs.rows[0].prescription_required : false;
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
        // Place the order
        let total = orderSession.medicines.reduce((s,m)=>s+m.total_price,0);

        await db.query('BEGIN');
        const ins = await db.query(
          `INSERT INTO orders (customer_name,customer_age,customer_mobile,total_price,status)
           VALUES ($1,$2,$3,$4,'completed') RETURNING id`,
          [
            orderSession.customer.name,
            orderSession.customer.age,
            orderSession.customer.mobile,
            total
          ]
        );

        for(const m of orderSession.medicines){
          await db.query(
            `INSERT INTO order_items (order_id,medicine_id,quantity,price_at_time)
             VALUES ($1,$2,$3,$4)`,
            [ins.rows[0].id, m.id, m.quantity, m.price_per_tablet]
          );
        }

        await db.query('COMMIT');

        // Generate detailed order confirmation
        let confirmation = `🧾 **Order Placed Successfully!**\n\n`;
        confirmation += `Order ID: ORD-${ins.rows[0].id}\n\n`;
        
        for(const m of orderSession.medicines){
          confirmation += `💊 ${m.name} - ${m.quantity} tablets\n`;
        }
        
        confirmation += `\n💰 Total Amount: ₹${total.toFixed(2)}\n`;
        confirmation += `📦 Order Status: Completed\n`;
        confirmation += `🚚 Delivery: Standard delivery`;

        orderSession = {
          medicines:[],
          stage:'initial',
          pendingMedicine:null,
          pendingPrescription:null,
          customer:{ name:null, age:null, mobile:null }
        };

        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

        return res.json({ reply: confirmation });
      } else if(/^[Nn]$/i.test(message)){
        orderSession.stage='initial';
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply: '❌ Order cancelled. You can continue adding medicines or start a new order.' });
      } else {
        return res.json({ reply: 'Please enter Y to confirm or N to cancel.' });
      }
    }

    /* =========================
       NORMAL MESSAGE
    ========================= */
    debugLog(`=== NORMAL MESSAGE ===`);
    debugLog(`Message: "${message}"`);
    debugLog(`Stage: ${orderSession.stage}`);
    debugLog(`Pending medicine: ${orderSession.pendingMedicine}`);
    
    const items = ruleParse(message);
    debugLog(`Parsed items: ${JSON.stringify(items)}`);

    for(const item of items){
      if(item.quantity === null){
        orderSession.stage='ask_quantity';
        orderSession.pendingMedicine=item.name;
        debugLog(`Setting pending medicine to: ${item.name}`);
        sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
        return res.json({ reply:`💊 ${item.name} — quantity?` });
      }

      const rs = await db.query(
        `SELECT * FROM medicines 
         WHERE is_deleted=FALSE 
         AND (name ILIKE $1 OR brand ILIKE $1)
         LIMIT 1`,
        [`%${item.name}%`]
      );

      if(rs.rows.length===0){
        return res.json({ reply:`❌ ${item.name} not found.` });
      }

      const med = rs.rows[0];

      if(med.prescription_required){
        orderSession.stage='confirm_prescription';
        orderSession.pendingPrescription={
          id:med.id,
          name:med.name,
          quantity:item.quantity,
          price_per_tablet:med.price_per_tablet
        };
        return res.json({
          reply:`⚠️ ${med.name} requires prescription. Proceed? (yes / no)`
        });
      }

      const total = item.quantity * med.price_per_tablet;
      orderSession.medicines.push({
        id:med.id,
        name:med.name,
        quantity:item.quantity,
        price_per_tablet:med.price_per_tablet,
        total_price:total
      });
    }

    // Handle Y/N responses for adding more medicines
    if (/^(y|yes)$/i.test(message) && orderSession.medicines.length > 0) {
      debugLog(`User wants to add more medicines`);
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
      return res.json({ reply: '💊 What medicine would you like to add?' });
    }
    
    if (/^(n|no)$/i.test(message) && orderSession.medicines.length > 0) {
      debugLog(`User wants to proceed to checkout`);
      orderSession.stage = 'ask_customer';
      sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });
      return res.json({ reply: '👤 Please provide your details: Name Age Mobile\n(e.g., "John Doe 25 9876543210")' });
    }

    const cartTotal = orderSession.medicines.reduce((s,m)=>s+m.total_price,0);
    sessionsByKey.set(sessionKey,{ sessionState:orderSession, expiresAt:nextDayMidnightTs() });

    return res.json({
      reply:`✅ Added  
💰 Cart: ₹${cartTotal.toFixed(2)}  
Add more (Y/N) or type *proceed*`
    });

  }catch(err){
    console.error(err);
    return res.status(500).json({ reply:'❌ Server error' });
  }
}

module.exports = { enhancedChatHandler };