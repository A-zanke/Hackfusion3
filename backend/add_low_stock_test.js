const db = require('./db');

async function addLowStockTest() {
  try {
    // Add some test medicines with low stock
    const testMedicines = [
      {
        name: 'Paracetamol 500mg',
        category: 'Pain Relief',
        brand: 'Tylenol',
        stock_packets: 2,
        tablets_per_packet: 10,
        total_tablets: 20,
        price_per_tablet: 2.50,
        expiry_date: '2024-12-31',
        low_stock_threshold: 30,
        prescription_required: false,
        description: 'Pain relief medication'
      },
      {
        name: 'Ibuprofen 400mg',
        category: 'Pain Relief',
        brand: 'Advil',
        stock_packets: 1,
        tablets_per_packet: 15,
        total_tablets: 15,
        price_per_tablet: 3.00,
        expiry_date: '2024-11-30',
        low_stock_threshold: 30,
        prescription_required: false,
        description: 'Anti-inflammatory medication'
      },
      {
        name: 'Amoxicillin 250mg',
        category: 'Antibiotic',
        brand: 'Generic',
        stock_packets: 1,
        tablets_per_packet: 8,
        total_tablets: 8,
        price_per_tablet: 5.00,
        expiry_date: '2024-10-15',
        low_stock_threshold: 30,
        prescription_required: true,
        description: 'Antibiotic medication'
      }
    ];

    for (const med of testMedicines) {
      await db.query(`
        INSERT INTO medicines (name, category, brand, stock_packets, tablets_per_packet, total_tablets, 
        price_per_tablet, expiry_date, low_stock_threshold, prescription_required, description, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `, [med.name, med.category, med.brand, med.stock_packets, med.tablets_per_packet, 
         med.total_tablets, med.price_per_tablet, med.expiry_date, med.low_stock_threshold, 
         med.prescription_required, med.description]);
    }

    console.log('Added 3 test medicines with low stock');
    
    // Check the result
    const lowStockCount = await db.query('SELECT COUNT(*) FROM medicines WHERE is_deleted = false AND total_tablets < 30');
    console.log(`Total medicines with < 30 tablets: ${lowStockCount.rows[0].count}`);
    
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

addLowStockTest();
