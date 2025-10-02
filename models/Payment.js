const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sales',
    required: [true, 'Sale ID is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Payment amount cannot be negative']
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
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  }
}, {
  timestamps: true
});

// Indexes for better query performance
paymentSchema.index({ saleId: 1 });
paymentSchema.index({ receivedBy: 1 });
paymentSchema.index({ paymentDate: 1 });
paymentSchema.index({ paymentType: 1 });

// Instance method to get payment details
paymentSchema.methods.toJSON = function() {
  const paymentObject = this.toObject();
  return paymentObject;
};

module.exports = mongoose.model('Payment', paymentSchema); 