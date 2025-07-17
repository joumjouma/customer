import axios from 'axios';

const INSTANCE_ID = 'instance131940';
const TOKEN = '8eoza1gyk2md4sic';
const API_URL = `https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`;

/**
 * Send a WhatsApp message via UltraMsg
 * @param {string} to - Recipient phone number in international format (e.g. 253XXXXXXXX)
 * @param {string} message - Message text
 * @returns {Promise<object>} - API response
 */
export async function sendWhatsAppMessage(to, message) {
  try {
    const res = await axios.post(
      API_URL,
      {
        to,
        body: message,
        priority: 10,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`,
        },
      }
    );
    return res.data;
  } catch (error) {
    console.error('UltraMsg WhatsApp send error:', error?.response?.data || error);
    throw error;
  }
} 