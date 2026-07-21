const WhatsAppAuthorizedNumber = require('../../models/WhatsAppAuthorizedNumber');

const authorizePhoneNumber = async (phoneNumber) => {
  const authorization = await WhatsAppAuthorizedNumber.findAuthorized(phoneNumber);
  return {
    authorized: Boolean(authorization),
    authorization
  };
};

module.exports = { authorizePhoneNumber };
