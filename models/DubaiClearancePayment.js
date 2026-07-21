const mongoose = require('mongoose');

const dubaiClearancePaymentSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: [true, 'Organization ID is required']
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DubaiClearanceInvoice',
    required: [true, 'Invoice ID is required']
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
dubaiClearancePaymentSchema.index({ organizationId: 1, invoiceId: 1 });
dubaiClearancePaymentSchema.index({ organizationId: 1, receivedBy: 1 });
dubaiClearancePaymentSchema.index({ organizationId: 1, paymentDate: 1 });
dubaiClearancePaymentSchema.index({ organizationId: 1, paymentMethod: 1 });

module.exports = mongoose.model('DubaiClearancePayment', dubaiClearancePaymentSchema);
