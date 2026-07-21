const logger = require('./logger');

const getConfig = () => ({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0'
});

const sendTextMessage = async (to, text) => {
  const config = getConfig();
  if (!config.accessToken || !config.phoneNumberId) {
    throw new Error('WhatsApp Cloud API is not configured');
  }

  const response = await fetch(
    `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: {
          preview_url: false,
          body: String(text).slice(0, 4096)
        }
      })
    }
  );

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error('outgoing_message_failed', {
      to: logger.maskPhone(to),
      status: response.status,
      error: body.error?.message || 'Unknown Meta API error'
    });
    throw new Error(body.error?.message || `Meta API request failed (${response.status})`);
  }

  logger.info('outgoing_message_sent', {
    to: logger.maskPhone(to),
    messageId: body.messages?.[0]?.id
  });
  return body;
};

module.exports = { sendTextMessage };
