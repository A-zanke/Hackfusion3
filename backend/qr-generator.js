// QR Code Payment Generator
const QRCode = require('qrcode');

const generatePaymentQR = (amount, orderId, medicineName) => {
    const paymentData = {
        upi: "pharmabuddy@paytm",
        amount: amount,
        order: orderId,
        note: `Payment for ${medicineName}`,
        merchant: "PharmaBuddy Pharmacy"
    };
    
    const upiUrl = `upi://pay?pa=${paymentData.upi}&am=${paymentData.amount}&pn=${paymentData.merchant}&tn=${paymentData.note}`;
    
    return new Promise((resolve, reject) => {
        QRCode.toDataURL(upiUrl, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        }, (err, url) => {
            if (err) reject(err);
            else resolve(url);
        });
    });
};

module.exports = { generatePaymentQR };
