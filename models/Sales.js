const mongoose = require('mongoose');

const salesSchema = new mongoose.Schema({
  customer: {
    type: String,
    required: [true, 'Customer is required'],
    trim: true,
    maxlength: [100, 'Customer name cannot be more than 100 characters']
  },
  containerNo: {
    type: String,
    required: [true, 'Container number is required'],
    trim: true,
    maxlength: [50, 'Container number cannot be more than 50 characters']
  },
  supplier: {
    type: String,
    required: [true, 'Supplier is required'],
    trim: true,
    maxlength: [100, 'Supplier name cannot be more than 100 characters']
  },
  invoiceDate: {
    type: Date,
    required: [true, 'Invoice date is required'],
    default: Date.now
  },
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    trim: true,
    unique: true,
    maxlength: [50, 'Invoice number cannot be more than 50 characters']
  },
  product: {
    type: String,
    required: [true, 'Product is required'],
    trim: true,
    maxlength: [100, 'Product name cannot be more than 100 characters']
  },
  marka: {
    type: String,
    required: [true, 'Marka is required'],
    trim: true,
    maxlength: [50, 'Marka cannot be more than 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  return: {
    type: Number,
    default: 0,
    min: [0, 'Return quantity cannot be negative']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  rate: {
    type: Number,
    required: [true, 'Rate is required'],
    min: [0, 'Rate cannot be negative']
  },
  vatPercentage: {
    type: Number,
    default: 0,
    min: [0, 'VAT percentage cannot be negative'],
    max: [100, 'VAT percentage cannot exceed 100%']
  },
  vatAmount: {
    type: Number,
    default: 0,
    min: [0, 'VAT amount cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  amount: {
    type: Number,
    default: 0,
    min: [0, 'Amount cannot be negative']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  receivedAmount: {
    type: Number,
    default: 0,
    min: [0, 'Received amount cannot be negative']
  },
  outstandingAmount: {
    type: Number,
    default: 0,
    min: [0, 'Outstanding amount cannot be negative']
  },
  status: {
    type: String,
    enum: ['unpaid', 'partially_paid', 'paid', 'overdue'],
    default: 'unpaid',
    required: true
  },
  lastPaymentDate: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for payment history
salesSchema.virtual('payments', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'saleId'
});

// Indexes for better query performance
salesSchema.index({ customer: 1 });
salesSchema.index({ supplier: 1 });
salesSchema.index({ invoiceNumber: 1 });
salesSchema.index({ status: 1 });
salesSchema.index({ invoiceDate: 1 });
salesSchema.index({ dueDate: 1 });
salesSchema.index({ lastPaymentDate: 1 });

// Pre-save middleware to calculate amounts and outstanding amount
salesSchema.pre('save', function(next) {
  // Calculate subtotal
  const subtotal = this.quantity * this.rate;
  
  // Calculate VAT amount based on percentage
  this.vatAmount = (subtotal * this.vatPercentage) / 100;
  
  // Discount is now a unit amount (fixed value), not a percentage
  // this.discount is already set as a unit amount
  
  // Calculate final amount
  this.amount = subtotal + this.vatAmount - this.discount;
  
  // Calculate outstanding amount
  this.outstandingAmount = this.amount - this.receivedAmount;
  
  // Update status based on outstanding amount and due date
  if (this.outstandingAmount <= 0) {
    this.status = 'paid';
  } else if (this.receivedAmount > 0) {
    this.status = 'partially_paid';
  } else if (new Date() > this.dueDate) {
    this.status = 'overdue';
  } else {
    this.status = 'unpaid';
  }
  
  next();
});

// Instance method to add payment
salesSchema.methods.addPayment = async function(paymentData) {
  const Payment = require('./Payment');
  
  // Create new payment record
  const payment = new Payment({
    saleId: this._id,
    amount: paymentData.amount,
    receivedBy: paymentData.receivedBy,
    paymentType: paymentData.paymentType,
    paymentMethod: paymentData.paymentMethod || 'cash',
    reference: paymentData.reference,
    notes: paymentData.notes,
    paymentDate: paymentData.paymentDate || new Date()
  });
  
  await payment.save();
  
  // Update sale with new payment
  this.receivedAmount += paymentData.amount;
  this.outstandingAmount = this.amount - this.receivedAmount;
  this.lastPaymentDate = payment.paymentDate;
  
  // Update status
  if (this.outstandingAmount <= 0) {
    this.status = 'paid';
  } else if (this.receivedAmount > 0) {
    this.status = 'partially_paid';
  } else if (new Date() > this.dueDate) {
    this.status = 'overdue';
  } else {
    this.status = 'unpaid';
  }
  
  await this.save();
  
  return payment;
};

// Instance method to get payment history
salesSchema.methods.getPaymentHistory = async function() {
  const Payment = require('./Payment');
  return await Payment.find({ saleId: this._id })
    .populate('receivedBy', 'name email')
    .sort({ paymentDate: -1 });
};

// Instance method to get payment summary
salesSchema.methods.getPaymentSummary = async function() {
  const Payment = require('./Payment');
  
  const payments = await Payment.find({ saleId: this._id });
  
  const summary = {
    totalPayments: payments.length,
    totalAmount: payments.reduce((sum, payment) => sum + payment.amount, 0),
    partialPayments: payments.filter(p => p.paymentType === 'partial').length,
    fullPayments: payments.filter(p => p.paymentType === 'full').length,
    lastPayment: payments.length > 0 ? payments[payments.length - 1] : null,
    paymentMethods: {}
  };
  
  // Count payment methods
  payments.forEach(payment => {
    summary.paymentMethods[payment.paymentMethod] = 
      (summary.paymentMethods[payment.paymentMethod] || 0) + 1;
  });
  
  return summary;
};

// Static method to get sales statistics
salesSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$amount' },
        totalReceived: { $sum: '$receivedAmount' },
        totalOutstanding: { $sum: '$outstandingAmount' },
        totalCount: { $sum: 1 },
        unpaidCount: {
          $sum: { $cond: [{ $eq: ['$status', 'unpaid'] }, 1, 0] }
        },
        paidCount: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
        },
        partiallyPaidCount: {
          $sum: { $cond: [{ $eq: ['$status', 'partially_paid'] }, 1, 0] }
        },
        overdueCount: {
          $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalSales: 0,
    totalReceived: 0,
    totalOutstanding: 0,
    totalCount: 0,
    unpaidCount: 0,
    paidCount: 0,
    partiallyPaidCount: 0,
    overdueCount: 0
  };
};

module.exports = mongoose.model('Sales', salesSchema); 