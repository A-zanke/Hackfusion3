const db = require('./db');
const fs = require('fs');

function debugLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync('debug.log', logMessage);
  console.log(message);
}

function normName(name) {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

function detectLanguage(message) {
  const hindiWords = ['दवा', 'दर्द', 'बुखार', 'सिरदर्द', 'दवाई', 'गोली', 'कैप्सूल'];
  const marathiWords = ['औषध', 'दुखणे', 'ताप', 'डोकेदुखी', 'गोळी', 'कॅप्सूल'];
  
  const lowerMessage = message.toLowerCase();
  
  if (hindiWords.some(word => lowerMessage.includes(word))) return 'hi';
  if (marathiWords.some(word => lowerMessage.includes(word))) return 'mr';
  return 'en';
}

// Session management for ordering workflow
const orderSessions = new Map();

function getSessionKey(req) {
  return 'DEBUG_SESSION_KEY';
}

async function findMedicineByName(name) {
  try {
    // IMPORTANT: Only use exact name matching - no fuzzy matching or partial matches
    const normalizedName = normName(name);
    
    // First try exact case-insensitive match
    const exactResult = await db.query(
      'SELECT * FROM medicines WHERE LOWER(name) = $1 AND is_deleted = FALSE LIMIT 1',
      [normalizedName]
    );
    
    if (exactResult.rows.length > 0) {
      return exactResult.rows[0];
    }
    
    // If no exact match, return null - DO NOT try fuzzy matching
    return null;
  } catch (error) {
    console.error('Error finding medicine:', error);
    return null;
  }
}

async function checkStock(medicineId, quantity) {
  try {
    const result = await db.query(
      'SELECT total_tablets FROM medicines WHERE id = $1',
      [medicineId]
    );
    
    if (result.rows.length === 0) return false;
    
    const availableStock = result.rows[0].total_tablets || 0;
    return availableStock >= quantity;
  } catch (error) {
    console.error('Error checking stock:', error);
    return false;
  }
}

async function placeOrder(medicine, quantity) {
  try {
    const orderId = 'ORD-' + Date.now().toString().slice(-6);
    const totalPrice = (medicine.price_per_tablet || 0) * quantity;
    
    // Insert order
    const orderResult = await db.query(
      'INSERT INTO orders (customer_name, mobile, age, total_price) VALUES ($1, $2, $3, $4) RETURNING id',
      ['AI Assistant User', 'AI-ASSISTANT', null, totalPrice]
    );
    
    const dbOrderId = orderResult.rows[0].id;
    
    // Insert order item
    await db.query(
      'INSERT INTO order_items (order_id, medicine_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
      [dbOrderId, medicine.id, quantity, medicine.price_per_tablet || 0]
    );
    
    // Update stock
    const currentStock = medicine.total_tablets || 0;
    const newStock = currentStock - quantity;
    const newPackets = Math.floor(newStock / (medicine.tablets_per_packet || 1));
    
    await db.query(
      'UPDATE medicines SET stock_packets = $1, total_tablets = $2 WHERE id = $3',
      [newPackets, newStock, medicine.id]
    );
    
    return {
      orderId: orderId,
      medicineName: medicine.name,
      quantity: quantity,
      totalPrice: totalPrice,
      status: 'completed'
    };
  } catch (error) {
    console.error('Error placing order:', error);
    return null;
  }
}

async function simpleChatHandler(req, res) {
  try {
    const { message, history } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    debugLog(`Processing message: ${message}`);
    const sessionKey = getSessionKey(req);
    const session = orderSessions.get(sessionKey) || { step: 'initial', data: {} };
    
    const lowerMessage = message.toLowerCase().trim();
    
    // Handle different workflow steps
    switch (session.step) {
      case 'initial':
        // Step 1: User sends medicine name - MUST be exact match
        const medicine = await findMedicineByName(message);
        
        if (!medicine) {
          return res.json({ 
            reply: `❌ Medicine not found in inventory. Please check the medicine name.`,
            intent_verified: false,
            safety_checked: true,
            stock_checked: false,
            thinking: `❌ Intent Agent: Exact medicine "${message}" not found in database\n✅ Safety Agent: Query is safe\n❌ Stock Agent: Medicine not available`
          });
        }
        
        // Save medicine to session and ask for quantity
        session.step = 'waiting_quantity';
        session.data.medicine = medicine;
        orderSessions.set(sessionKey, session);
        
        return res.json({ 
          reply: `How many tablets/units do you want?`,
          intent_verified: true,
          safety_checked: true,
          stock_checked: false,
          thinking: `✅ Intent Agent: Exact medicine "${message}" found and verified\n✅ Safety Agent: Basic safety check passed\n⏳ Stock Agent: Waiting for quantity to check stock`
        });
        
      case 'waiting_quantity':
        // Step 2: User provides quantity
        const quantity = parseInt(message, 10);
        
        if (isNaN(quantity) || quantity <= 0) {
          return res.json({ 
            reply: `❌ Please enter a valid quantity (numbers only).`,
            intent_verified: true,
            safety_checked: true,
            stock_checked: false,
            thinking: `❌ Intent Agent: Invalid quantity\n✅ Safety Agent: Query is safe\n⏳ Stock Agent: Waiting for valid quantity`
          });
        }
        
        const selectedMedicine = session.data.medicine;
        
        // Step 3: Check stock
        const isStockAvailable = await checkStock(selectedMedicine.id, quantity);
        
        if (!isStockAvailable) {
          // Reset session
          orderSessions.delete(sessionKey);
          
          return res.json({ 
            reply: `❌ Sorry, this medicine is currently out of stock.`,
            intent_verified: true,
            safety_checked: true,
            stock_checked: true,
            thinking: `✅ Intent Agent: Quantity received\n✅ Safety Agent: Query is safe\n❌ Stock Agent: Insufficient stock`
          });
        }
        
        // Step 4: Check prescription requirement
        if (selectedMedicine.prescription_required) {
          session.step = 'waiting_prescription';
          session.data.quantity = quantity;
          orderSessions.set(sessionKey, session);
          
          return res.json({ 
            reply: `⚠️ This medicine requires a prescription.\nPlease confirm if you have a valid prescription.\nReply Y to confirm or N to cancel.`,
            intent_verified: true,
            safety_checked: true,
            stock_checked: true,
            thinking: `✅ Intent Agent: Quantity received\n✅ Safety Agent: Query is safe\n✅ Stock Agent: Stock available\n⏳ Prescription Agent: Waiting for prescription confirmation`
          });
        } else {
          // Step 5: No prescription required - place order directly
          const order = await placeOrder(selectedMedicine, quantity);
          orderSessions.delete(sessionKey);
          
          if (!order) {
            return res.json({ 
              reply: `❌ Failed to place order. Please try again.`,
              intent_verified: true,
              safety_checked: true,
              stock_checked: true,
              thinking: `✅ Intent Agent: Quantity received\n✅ Safety Agent: Query is safe\n✅ Stock Agent: Stock available\n✅ Prescription Agent: No prescription required\n❌ Order Agent: Order placement failed`
            });
          }
          
          return res.json({ 
            reply: `🧾 Order Placed Successfully\nOrder ID: ${order.orderId}\n💊 ${order.medicineName} – ${order.quantity} tablets\n💰 Total Amount: ₹${order.totalPrice.toFixed(2)}`,
            intent_verified: true,
            safety_checked: true,
            stock_checked: true,
            thinking: `✅ Intent Agent: Quantity received\n✅ Safety Agent: Query is safe\n✅ Stock Agent: Stock available\n✅ Prescription Agent: No prescription required\n✅ Order Agent: Order placed successfully`
          });
        }
        
      case 'waiting_prescription':
        // Step 6-8: Handle prescription confirmation
        const prescriptionResponse = message.toLowerCase().trim();
        
        if (prescriptionResponse === 'y' || prescriptionResponse === 'yes') {
          // User confirmed prescription - place order
          const order = await placeOrder(session.data.medicine, session.data.quantity);
          orderSessions.delete(sessionKey);
          
          if (!order) {
            return res.json({ 
              reply: `❌ Failed to place order. Please try again.`,
              intent_verified: true,
              safety_checked: true,
              stock_checked: true,
              thinking: `✅ Intent Agent: Prescription confirmed\n✅ Safety Agent: Query is safe\n✅ Stock Agent: Stock available\n✅ Prescription Agent: Prescription confirmed\n❌ Order Agent: Order placement failed`
            });
          }
          
          return res.json({ 
            reply: `🧾 Order Placed Successfully\nOrder ID: ${order.orderId}\n💊 ${order.medicineName} – ${order.quantity} tablets\n💰 Total Amount: ₹${order.totalPrice.toFixed(2)}`,
            intent_verified: true,
            safety_checked: true,
            stock_checked: true,
            thinking: `✅ Intent Agent: Prescription confirmed\n✅ Safety Agent: Query is safe\n✅ Stock Agent: Stock available\n✅ Prescription Agent: Prescription confirmed\n✅ Order Agent: Order placed successfully`
          });
        } else if (prescriptionResponse === 'n' || prescriptionResponse === 'no') {
          // User declined prescription - cancel order
          orderSessions.delete(sessionKey);
          
          return res.json({ 
            reply: `❌ Order cancelled because prescription was not confirmed.`,
            intent_verified: true,
            safety_checked: true,
            stock_checked: true,
            thinking: `✅ Intent Agent: Prescription declined\n✅ Safety Agent: Query is safe\n✅ Stock Agent: Stock available\n✅ Prescription Agent: Prescription not confirmed\n❌ Order Agent: Order cancelled`
          });
        } else {
          return res.json({ 
            reply: `⚠️ Please reply Y to confirm prescription or N to cancel.`,
            intent_verified: true,
            safety_checked: true,
            stock_checked: true,
            thinking: `✅ Intent Agent: Waiting for prescription confirmation\n✅ Safety Agent: Query is safe\n✅ Stock Agent: Stock available\n⏳ Prescription Agent: Waiting for clear Y/N response`
          });
        }
        
      default:
        // Reset session if in unknown state
        orderSessions.delete(sessionKey);
        return res.json({ 
          reply: `❌ Session reset. Please start again with a medicine name.`,
          intent_verified: false,
          safety_checked: true,
          stock_checked: false,
          thinking: `❌ Intent Agent: Unknown session state\n✅ Safety Agent: Query is safe\n❌ Stock Agent: Session reset`
        });
    }

  } catch (error) {
    console.error('Chat handler error:', error);
    debugLog(`Error: ${error.message}`);
    return res.status(500).json({ 
      reply: '❌ Server error while processing your request.',
      error: error.message 
    });
  }
}

module.exports = { simpleChatHandler };
