const axios = require('axios');

async function testChat() {
    try {
        console.log('Testing chat endpoint...');
        
        // Test a simple message
        const response = await axios.post('http://localhost:5000/chat', {
            message: 'hello',
            history: []
        });
        
        console.log('Response:', response.data);
        console.log('Test passed!');
    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testChat();
