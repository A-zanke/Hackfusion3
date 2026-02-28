const db = require('./db');
const { io } = require('./index');

// Session management
const sessionsByKey = new Map();

function debugLog(message) {
    console.log('[DEBUG] ' + message);
}

function getSessionKey(req) {
    return req.headers['x-session-id'] || 'default';
}

function isExpired(expiresAt) {
    return Date.now() > expiresAt;
}

function nextDayMidnightTs() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
}

// Real-time stock update with insufficient stock handling
async function updateStockRealTime(medicineId, quantity, medicineName) {
    try {
        const medInfo = await db.query(
            'SELECT stock_packets, tablets_per_packet, total_tablets FROM medicines WHERE id = $1',
            [medicineId]
        );

        if (medInfo.rows.length === 0) {
            throw new Error('Medicine not found for stock update');
        }

        const currentStockPackets = medInfo.rows[0].stock_packets ?? 0;
        const tabletsPerPacket = medInfo.rows[0].tablets_per_packet ?? 1;
        const currentTotalTablets = medInfo.rows[0].total_tablets ?? (currentStockPackets * tabletsPerPacket);
        
        const totalAvailableTablets = currentTotalTablets;
        
        // Check if stock is insufficient
        if (totalAvailableTablets < quantity) {
            return {
                insufficientStock: true,
                available: totalAvailableTablets,
                requested: quantity,
                medicineName: medicineName
            };
        }
        
        // Update stock
        const newTotalTablets = totalAvailableTablets - quantity;
        const newStockPackets = Math.floor(newTotalTablets / tabletsPerPacket);
        const newIndividualTablets = newTotalTablets % tabletsPerPacket;
        
        await db.query(
            'UPDATE medicines SET stock_packets = $1, individual_tablets = $2 WHERE id = $3',
            [newStockPackets, newIndividualTablets, medicineId]
        );
        
        return true;
    } catch (error) {
        console.error('Stock update error:', error);
        throw error;
    }
}

// Main chat handler with stock replenishment flow
async function enhancedChatHandler(req, res) {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });

        const sessionKey = getSessionKey(req);
        debugLog('=== NEW REQUEST ===');
        debugLog('Session key: ' + sessionKey);
        debugLog('Message: "' + message + '"');
        
        let orderSession = {
            medicines: [],
            stage: 'initial',
            pendingMedicine: null,
            pendingPrescription: null,
            customer: { name: null, age: null, mobile: null }
        };

        const persisted = sessionsByKey.get(sessionKey);
        debugLog('Persisted session: ' + JSON.stringify(persisted));
        
        if (persisted && !isExpired(persisted.expiresAt)) {
            orderSession = persisted.sessionState;
            debugLog('Loaded existing session - Stage: ' + orderSession.stage);
        } else {
            debugLog('Starting new session');
        }

        // Ensure stock add flow state
        if (!orderSession.stockAddFlow) {
            orderSession.stockAddFlow = {
                stage: 'idle',
                medicineName: null,
                packets: null,
                tabletsPerPacket: null,
                packetPrice: null
            };
        }
        const stockAddFlow = orderSession.stockAddFlow;

        // STOCK ADD FLOW HANDLING
        if (stockAddFlow.stage === 'ask_add_stock_confirmation') {
            if (/^(yes|y|haan|ha|ho)$/i.test(message)) {
                stockAddFlow.stage = 'add_stock_name';
                sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
                return res.json({
                    reply: 'Please provide medicine name:'
                });
            } else if (/^(no|n|nahi|na)$/i.test(message)) {
                stockAddFlow.stage = 'idle';
                stockAddFlow.medicineName = null;
                sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
                return res.json({
                    reply: '❌ Medicine not added to inventory.'
                });
            } else {
                return res.json({
                    reply: 'Please answer with Yes or No.'
                });
            }
        }
        
        if (stockAddFlow.stage === 'add_stock_name') {
            stockAddFlow.medicineName = message.trim();
            stockAddFlow.stage = 'add_stock_packets';
            sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
            return res.json({
                reply: 'Enter total number of packets:'
            });
        }
        
        if (stockAddFlow.stage === 'add_stock_packets') {
            const packets = parseInt(message.trim());
            if (isNaN(packets) || packets <= 0) {
                return res.json({
                    reply: 'Please enter a valid number of packets (greater than 0).'
                });
            }
            stockAddFlow.packets = packets;
            stockAddFlow.stage = 'add_stock_tablets_per_packet';
            sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
            return res.json({
                reply: 'Enter number of tablets per packet:'
            });
        }
        
        if (stockAddFlow.stage === 'add_stock_tablets_per_packet') {
            const tabletsPerPacket = parseInt(message.trim());
            if (isNaN(tabletsPerPacket) || tabletsPerPacket <= 0) {
                return res.json({
                    reply: 'Please enter a valid number of tablets per packet (greater than 0).'
                });
            }
            stockAddFlow.tabletsPerPacket = tabletsPerPacket;
            stockAddFlow.stage = 'add_stock_packet_price';
            sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
            return res.json({
                reply: 'Enter price per packet:'
            });
        }
        
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
                    'INSERT INTO medicines (name, stock_packets, tablets_per_packet, individual_tablets, price_per_packet, price_per_tablet, is_deleted) VALUES ($1, $2, $3, 0, $4, $5, FALSE) RETURNING *',
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
                
                sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
                
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
                sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
                
                return res.json({
                    reply: '❌ Error adding medicine to inventory. Please try again.'
                });
            }
        }

        // Handle quantity input for existing medicines
        if (orderSession.stage === 'ask_quantity' && orderSession.pendingMedicine && /^\d+$/.test(message)) {
            const qty = parseInt(message, 10);
            const pending = orderSession.pendingMedicine;
            const searchName = typeof pending === 'string' ? pending : pending.name;

            const rs = (pending && pending.id)
                ? await db.query('SELECT * FROM medicines WHERE id = $1 LIMIT 1', [pending.id])
                : await db.query('SELECT * FROM medicines WHERE (name ILIKE $1 OR brand ILIKE $1) LIMIT 1', [`%${searchName}%`]);

            if (rs.rows.length === 0) {
                const label = searchName || 'selected medicine';
                orderSession.stage = 'initial';
                orderSession.pendingMedicine = null;
                sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
                return res.json({ reply: '❌ ' + label + ' not found.' });
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
                sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });
                
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

            orderSession.stage = 'initial';
            orderSession.pendingMedicine = null;

            const cartTotal = orderSession.medicines.reduce((s, m) => s + m.total_price, 0);
            sessionsByKey.set(sessionKey, { sessionState: orderSession, expiresAt: nextDayMidnightTs() });

            debugLog('✅ Added ' + med.name + ' (' + qty + ') - Total: ₹' + total.toFixed(2));

            return res.json({
                reply: '✅ Added to order\n💰 Total price: ₹' + cartTotal.toFixed(2) + '\nAdd more (Y/N) or type *proceed*'
            });
        }

        // Default response for unrecognized input
        return res.json({
            reply: 'I didn\'t understand that. Please try again.'
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ reply: '❌ Server error' });
    }
}

module.exports = { enhancedChatHandler };