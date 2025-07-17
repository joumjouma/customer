const functions = require("firebase-functions");
const axios = require("axios");

const INSTANCE_ID = "instance131940";
const TOKEN = "8eoza1gyk2md4sic";
const API_URL = `https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`;

exports.sendWhatsAppMessageV2 = functions
  .runWith({ platform: 'gcfv1' })
  .https.onCall(async (data, context) => {
    const { to, message } = data;
    try {
      const res = await axios.post(
        API_URL,
        {
          to: to,
          body: message,
          priority: 10,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${TOKEN}`,
          },
        },
      );
      return { success: true, data: res.data };
    } catch (error) {
      const errMsg =
        error && error.response && error.response.data
          ? error.response.data
          : error;
      console.error("UltraMsg WhatsApp send error:", errMsg);
      throw new functions.https.HttpsError(
        "internal",
        `Failed to send WhatsApp message: ${errMsg}`
      );
    }
  });
