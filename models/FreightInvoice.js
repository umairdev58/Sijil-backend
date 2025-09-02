const mongoose = require('mongoose');

const freightInvoiceSchema = new mongoose.Schema({
  invoice_number: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  amount_pkr: {
    type: Number,
    required: [true, 'Amount in PKR is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  conversion_rate: {
    type: Number,
    required: [true, 'Conversion rate is required'],
    min: [0.000001, 'Conversion rate must be greater than 0']
  },
  amount_aed: {
    type: Number,
    default: 0,
    min: [0, 'Amount AED cannot be negative']
  },
  agent: {
    type: String,
    required: [true, 'Agent is required'],
    trim: true,
    maxlength: [100, 'Agent name cannot be more than 100 characters']
  },
  invoice_date: {
    type: Date,
    required: [true, 'Invoice date is required']
  },
  due_date: {
    type: Date,
    required: [true, 'Due date is required']
  },
  paid_amount_pkr: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  paid_amount_aed: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount AED cannot be negative']
  },
  outstanding_amount_pkr: {
    type: Number,
    default: 0,
    min: [0, 'Outstanding amount cannot be negative']
  },
  outstanding_amount_aed: {
    type: Number,
    default: 0,
    min: [0, 'Outstanding amount AED cannot be negative']
  },
  status: {
    type: String,
    enum: ['unpaid', 'partially_paid', 'paid', 'overdue'],
    default: 'unpaid',
    required: true
  },
  last_payment_date: {
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
freightInvoiceSchema.virtual('payments', {
  ref: 'FreightPayment',
  localField: '_id',
  foreignField: 'freightInvoiceId'
});

// Indexes
freightInvoiceSchema.index({ invoice_number: 1 }, { unique: true });
freightInvoiceSchema.index({ invoice_date: -1 });
freightInvoiceSchema.index({ agent: 1 });
freightInvoiceSchema.index({ status: 1 });
freightInvoiceSchema.index({ due_date: 1 });
freightInvoiceSchema.index({ last_payment_date: 1 });

// Pre-save middleware to auto-calculate amounts and status
freightInvoiceSchema.pre('save', function(next) {
  // Calculate AED amount
  if (this.amount_pkr && this.conversion_rate && this.conversion_rate > 0) {
    this.amount_aed = this.amount_pkr / this.conversion_rate;
  }
  
  // Calculate outstanding amounts
  this.outstanding_amount_pkr = this.amount_pkr - this.paid_amount_pkr;
  this.outstanding_amount_aed = this.amount_aed - this.paid_amount_aed;
  
  // Update status based on outstanding amount and due date
  if (this.outstanding_amount_pkr <= 0) {
    this.status = 'paid';
  } else if (this.paid_amount_pkr > 0) {
    this.status = 'partially_paid';
  } else if (new Date() > this.due_date) {
    this.status = 'overdue';
  } else {
    this.status = 'unpaid';
  }
  
  next();
});

// Pre-update middleware to auto-calculate amounts and status
freightInvoiceSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Calculate AED amount
  if (update.amount_pkr && update.conversion_rate && update.conversion_rate > 0) {
    update.amount_aed = update.amount_pkr / update.conversion_rate;
  }
  
  // Calculate outstanding amounts
  if (update.amount_pkr !== undefined || update.paid_amount_pkr !== undefined) {
    const amount_pkr = update.amount_pkr || this.amount_pkr;
    const paid_amount_pkr = update.paid_amount_pkr || this.paid_amount_pkr;
    update.outstanding_amount_pkr = amount_pkr - paid_amount_pkr;
  }
  
  if (update.amount_aed !== undefined || update.paid_amount_aed !== undefined) {
    const amount_aed = update.amount_aed || this.amount_aed;
    const paid_amount_aed = update.paid_amount_aed || this.paid_amount_aed;
    update.outstanding_amount_aed = amount_aed - paid_amount_aed;
  }
  
  // Update status
  if (update.outstanding_amount_pkr !== undefined) {
    if (update.outstanding_amount_pkr <= 0) {
      update.status = 'paid';
    } else if (update.paid_amount_pkr > 0) {
      update.status = 'partially_paid';
    } else if (new Date() > (update.due_date || this.due_date)) {
      update.status = 'overdue';
    } else {
      update.status = 'unpaid';
    }
  }
  
  next();
});

// Instance method to add payment
freightInvoiceSchema.methods.addPayment = async function(paymentData) {
  const FreightPayment = require('./FreightPayment');
  
  // Create new payment record
  const payment = new FreightPayment({
    freightInvoiceId: this._id,
    amount: paymentData.amount,
    receivedBy: paymentData.receivedBy,
    paymentType: paymentData.paymentType,
    paymentMethod: paymentData.paymentMethod || 'cash',
    reference: paymentData.reference,
    notes: paymentData.notes,
    paymentDate: paymentData.paymentDate || new Date()
  });
  
  await payment.save();
  
  // Update freight invoice with new payment
  this.paid_amount_pkr += paymentData.amount;
  this.paid_amount_aed = this.paid_amount_pkr / this.conversion_rate;
  this.outstanding_amount_pkr = this.amount_pkr - this.paid_amount_pkr;
  this.outstanding_amount_aed = this.amount_aed - this.paid_amount_aed;
  this.last_payment_date = payment.paymentDate;
  
  // Update status
  if (this.outstanding_amount_pkr <= 0) {
    this.status = 'paid';
  } else if (this.paid_amount_pkr > 0) {
    this.status = 'partially_paid';
  } else if (new Date() > this.due_date) {
    this.status = 'overdue';
  } else {
    this.status = 'unpaid';
  }
  
  await this.save();
  
  return payment;
};

// Instance method to get payment history
freightInvoiceSchema.methods.getPaymentHistory = async function() {
  const FreightPayment = require('./FreightPayment');
  return await FreightPayment.find({ freightInvoiceId: this._id })
    .populate('receivedBy', 'name email')
    .sort({ paymentDate: -1 });
};

module.exports = mongoose.model('FreightInvoice', freightInvoiceSchema);
