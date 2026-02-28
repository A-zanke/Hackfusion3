const axios = require('axios');

async function testChat() {
  try {
    console.log('Testing chat with search for "Aceclofenac"...');
    const response = await axios.post('http://localhost:5000/chat', {
      message: 'Aceclofenac Tabletten'
    });
    
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(response.data, null, 2));
    
    if (response.data.reply && response.data.thinking && response.data.intent_verified !== undefined) {
      console.log('✅ Success: Metadata and thinking received!');
    } else {
      console.log('❌ Failure: Missing metadata or thinking.');
    }
  } catch (error) {
    console.error('❌ Error during test:', error.response?.data || error.message);
  }
}

testChat();
