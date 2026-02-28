const axios = require('axios');

async function testStockReplenishment() {
    try {
        console.log('=== Testing Stock Replenishment Flow ===\n');
        
        // Test 1: Request medicine with insufficient stock
        console.log('Test 1: Requesting medicine with insufficient stock');
        const response1 = await axios.post('http://localhost:5000/chat', {
            message: 'Aceclofenac Tabletten - 100'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': 'test-session-1'
            }
        });
        
        console.log('Response 1:', response1.data.reply);
        console.log('Expected: Out of stock message with Yes/No option\n');
        
        // Test 2: Answer "Yes" to add stock
        console.log('Test 2: Answering "Yes" to add stock');
        const response2 = await axios.post('http://localhost:5000/chat', {
            message: 'Yes'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': 'test-session-1'
            }
        });
        
        console.log('Response 2:', response2.data.reply);
        console.log('Expected: "Please provide medicine name:"\n');
        
        // Test 3: Provide medicine name
        console.log('Test 3: Providing medicine name');
        const response3 = await axios.post('http://localhost:5000/chat', {
            message: 'Aceclofenac Tabletten'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': 'test-session-1'
            }
        });
        
        console.log('Response 3:', response3.data.reply);
        console.log('Expected: "Enter total number of packets:"\n');
        
        // Test 4: Enter number of packets
        console.log('Test 4: Entering number of packets');
        const response4 = await axios.post('http://localhost:5000/chat', {
            message: '10'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': 'test-session-1'
            }
        });
        
        console.log('Response 4:', response4.data.reply);
        console.log('Expected: "Enter number of tablets per packet:"\n');
        
        // Test 5: Enter tablets per packet
        console.log('Test 5: Entering tablets per packet');
        const response5 = await axios.post('http://localhost:5000/chat', {
            message: '20'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': 'test-session-1'
            }
        });
        
        console.log('Response 5:', response5.data.reply);
        console.log('Expected: "Enter price per packet:"\n');
        
        // Test 6: Enter price per packet
        console.log('Test 6: Entering price per packet');
        const response6 = await axios.post('http://localhost:5000/chat', {
            message: '100'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': 'test-session-1'
            }
        });
        
        console.log('Response 6:', response6.data.reply);
        console.log('Expected: Success message with total stock and price per tablet\n');
        
        console.log('=== All tests completed ===');
        
    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

testStockReplenishment();