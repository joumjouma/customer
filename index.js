
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);

const functions = require("firebase-functions");
const fetch = require("node-fetch");

exports.sendWhatsAppMessageV2 = functions
  .runWith({ platform: 'gcfv1' })
  .https.onCall(async (data, context) => {
    const { to, message } = data;
    try {
      let formattedPhone = to;
      if (to.startsWith('+')) {
        formattedPhone = to.substring(1);
      }
      if (formattedPhone.startsWith('253')) {
        // already correct
      } else if (formattedPhone.startsWith('77')) {
        formattedPhone = '253' + formattedPhone;
      }
      const response = await fetch(
        "https://api.ultramsg.com/instance131940/messages/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: formattedPhone,
            body: message,
            token: "8eoza1gyk2md4sic",
          }),
        }
      );
      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error("UltraMsg WhatsApp send error:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Failed to send WhatsApp message: ${error.message}`
      );
    }
  });

// Firestore trigger: notify customer when ride status changes to assigned/active
exports.notifyCustomerOnRideAssigned = functions.firestore
  .document('rideRequests/{rideId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Only trigger if status changes from 'waiting' to 'assigned' or 'active'
    if (
      before.status === 'waiting' &&
      (after.status === 'assigned' || after.status === 'active') &&
      after.customerPhone
    ) {
      let formattedPhone = after.customerPhone;
      if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.substring(1);
      }
      if (formattedPhone.startsWith('253')) {
        // already correct
      } else if (formattedPhone.startsWith('77')) {
        formattedPhone = '253' + formattedPhone;
      }
      const message =
        "Un chauffeur a été trouvé pour votre course ! Ouvrez l'application Caval pour voir les détails.";
      try {
        const response = await fetch(
          "https://api.ultramsg.com/instance131940/messages/chat",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: formattedPhone,
              body: message,
              token: "8eoza1gyk2md4sic",
            }),
          }
        );
        const result = await response.json();
        console.log('WhatsApp message sent to customer:', result);
      } catch (error) {
        console.error('Error sending WhatsApp to customer:', error);
      }
    }
    return null;
  }); 