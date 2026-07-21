const mongoose = require('mongoose');

const normalizePhoneNumber = (value) => String(value || '').replace(/\D/g, '');

const whatsappAuthorizedNumberSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    set: normalizePhoneNumber,
    validate: {
      validator: (value) => /^\d{7,15}$/.test(value),
      message: 'Phone number must contain 7 to 15 digits including country code'
    }
  },
  label: {
    type: String,
    trim: true,
    maxlength: [80, 'Label cannot be more than 80 characters'],
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

whatsappAuthorizedNumberSchema.index({ isActive: 1 });

whatsappAuthorizedNumberSchema.statics.normalizePhoneNumber = normalizePhoneNumber;
whatsappAuthorizedNumberSchema.statics.findAuthorized = function(phoneNumber) {
  return this.findOne({
    phoneNumber: normalizePhoneNumber(phoneNumber),
    isActive: true
  });
};

module.exports = mongoose.model('WhatsAppAuthorizedNumber', whatsappAuthorizedNumberSchema);
