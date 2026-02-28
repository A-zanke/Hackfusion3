const { processWithGemini } = require('./gemini-service');

async function test() {
  console.log('--- Testing Gemini Integration ---');
  
  const messages = [
    "Order 2 tablets of Dolo 650",
    "Add 10 packets of Paracetamol",
    "Delete Aspirin",
    "Dolo hai kya?",
    "Aspirin remove karo"
  ];

  for (const msg of messages) {
    console.log(`\nUser: "${msg}"`);
    try {
      const result = await processWithGemini(msg);
      console.log('Gemini Result:', JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
}

test();
