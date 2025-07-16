// WhatsApp Integration Test Script
// Run this to test your UltraMsg WhatsApp integration

const https = require('https');

// Your UltraMsg credentials
const INSTANCE_ID = "instance131940";
const TOKEN = "8eoza1gyk2md4sic";

// Test function
async function testWhatsAppMessage(phoneNumber) {
  try {
    console.log("🧪 Testing WhatsApp Integration...");
    console.log("📱 Phone Number:", phoneNumber);
    console.log("🔑 Instance ID:", INSTANCE_ID);
    
    const testMessage = `🧪 *Test WhatsApp Integration*

Bonjour Test Driver,

Ceci est un test de l'intégration WhatsApp pour Eco-share.

📍 *Départ:* Test Address
🎯 *Destination:* Test Destination
💰 *Prix:* Fdj1000

⏰ *Temps estimé:* ~15 min

*Test réussi si vous recevez ce message!*

Merci!
Eco-share Team`;

    console.log("📝 Message:", testMessage);

    const postData = JSON.stringify({
      to: phoneNumber,
      body: testMessage,
      token: TOKEN,
    });

    const options = {
      hostname: 'api.ultramsg.com',
      port: 443,
      path: `/${INSTANCE_ID}/messages/chat`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            console.log("✅ Response Status:", res.statusCode);
            console.log("📊 Result:", JSON.stringify(result, null, 2));
            
            if (res.statusCode === 200) {
              console.log("🎉 WhatsApp test completed successfully!");
              console.log("📱 Check your WhatsApp for the test message.");
            } else {
              console.log("❌ WhatsApp test failed!");
              console.log("🔍 Check the error details above.");
            }
            
            resolve(result);
          } catch (error) {
            console.error("💥 Error parsing response:", error);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error("💥 Error testing WhatsApp:", error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error("💥 Error testing WhatsApp:", error);
    throw error;
  }
}

// Usage instructions
console.log("🚀 WhatsApp Integration Test");
console.log("============================");
console.log("");
console.log("To test your WhatsApp integration:");
console.log("1. Replace the phone number below with a real number");
console.log("2. Run: node test-whatsapp.js");
console.log("3. Check the WhatsApp number for the test message");
console.log("");

// Replace this with a real phone number for testing
const testPhoneNumber = "+25377702036"; // Replace with actual number

// Run the test
testWhatsAppMessage(testPhoneNumber)
  .then(() => {
    console.log("✅ Test completed!");
  })
  .catch((error) => {
    console.log("❌ Test failed:", error.message);
  }); 