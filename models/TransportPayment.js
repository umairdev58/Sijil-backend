const mongoose = require('mongoose');

const transportPaymentSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: [true, 'Organization ID is required']
  },
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
transportPaymentSchema.index({ organizationId: 1, transportInvoiceId: 1 });
transportPaymentSchema.index({ organizationId: 1, receivedBy: 1 });
transportPaymentSchema.index({ organizationId: 1, paymentDate: 1 });
transportPaymentSchema.index({ organizationId: 1, paymentType: 1 });

// Instance method to get payment details
transportPaymentSchema.methods.toJSON = function() {
  const paymentObject = this.toObject();
  return paymentObject;
};

module.exports = mongoose.model('TransportPayment', transportPaymentSchema);
