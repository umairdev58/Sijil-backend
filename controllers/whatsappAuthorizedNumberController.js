const WhatsAppAuthorizedNumber = require('../models/WhatsAppAuthorizedNumber');

const duplicateNumberResponse = (res) => res.status(400).json({
  error: 'Phone number already authorized',
  message: 'This WhatsApp number is already in the allowlist'
});

const getAuthorizedNumbers = async (req, res) => {
  try {
    const numbers = await WhatsAppAuthorizedNumber.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');

    res.json({ success: true, numbers });
  } catch (error) {
    console.error('Get WhatsApp authorized numbers error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

const createAuthorizedNumber = async (req, res) => {
  try {
    const phoneNumber = WhatsAppAuthorizedNumber.normalizePhoneNumber(req.body.phoneNumber);
    const existing = await WhatsAppAuthorizedNumber.findOne({ phoneNumber });

    if (existing) {
      return duplicateNumberResponse(res);
    }

    const number = await WhatsAppAuthorizedNumber.create({
      phoneNumber,
      label: req.body.label || '',
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'WhatsApp number authorized successfully',
      number
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return duplicateNumberResponse(res);
    }
    console.error('Create WhatsApp authorized number error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

const updateAuthorizedNumber = async (req, res) => {
  try {
    const number = await WhatsAppAuthorizedNumber.findById(req.params.id);
    if (!number) {
      return res.status(404).json({
        error: 'Authorized number not found',
        message: 'This WhatsApp number does not exist'
      });
    }

    if (req.body.phoneNumber !== undefined) {
      const normalized = WhatsAppAuthorizedNumber.normalizePhoneNumber(req.body.phoneNumber);
      const duplicate = await WhatsAppAuthorizedNumber.findOne({
        phoneNumber: normalized,
        _id: { $ne: number._id }
      });
      if (duplicate) {
        return duplicateNumberResponse(res);
      }
      number.phoneNumber = normalized;
    }
    if (req.body.label !== undefined) number.label = req.body.label;
    if (typeof req.body.isActive === 'boolean') number.isActive = req.body.isActive;

    await number.save();
    res.json({
      success: true,
      message: 'WhatsApp authorization updated successfully',
      number
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return duplicateNumberResponse(res);
    }
    console.error('Update WhatsApp authorized number error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

const deleteAuthorizedNumber = async (req, res) => {
  try {
    const number = await WhatsAppAuthorizedNumber.findByIdAndDelete(req.params.id);
    if (!number) {
      return res.status(404).json({
        error: 'Authorized number not found',
        message: 'This WhatsApp number does not exist'
      });
    }

    res.json({ success: true, message: 'WhatsApp number removed successfully' });
  } catch (error) {
    console.error('Delete WhatsApp authorized number error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

module.exports = {
  getAuthorizedNumbers,
  createAuthorizedNumber,
  updateAuthorizedNumber,
  deleteAuthorizedNumber
};
