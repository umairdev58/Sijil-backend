const mongoose = require('mongoose');

const transportPaymentSchema = new mongoose.Schema({
  transportInvoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransportInvoice',
    required: [true, 'Transport Invoice ID is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0.01, 'Payment amount must be greater than 0']
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Received by is required']
  },
  paymentType: {
    type: String,
    enum: ['partial', 'full'],
    required: [true, 'Payment type is required']
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'check', 'card', 'other'],
    default: 'cash'
  },
  reference: {
    type: String,
    trim: true,
    maxlength: [100, 'Reference cannot be more than 100 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot be more than 500 characters']
  },
  paymentDate: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
transportPaymentSchema.index({ transportInvoiceId: 1 });
transportPaymentSchema.index({ receivedBy: 1 });
transportPaymentSchema.index({ paymentDate: 1 });
transportPaymentSchema.index({ paymentType: 1 });

// Instance method to get payment details
transportPaymentSchema.methods.toJSON = function() {
  const paymentObject = this.toObject();
  return paymentObject;
};

module.exports = mongoose.model('TransportPayment', transportPaymentSchema);
