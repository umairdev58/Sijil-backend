const mongoose = require('mongoose');

const dubaiClearanceInvoiceSchema = new mongoose.Schema({
  invoice_number: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  amount_aed: {
    type: Number,
    required: [true, 'Amount in AED is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  conversion_rate: {
    type: Number,
    required: [true, 'Conversion rate is required'],
    min: [0.01, 'Conversion rate must be greater than 0']
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
  paid_amount_aed: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  outstanding_amount_aed: {
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
dubaiClearanceInvoiceSchema.virtual('payments', {
  ref: 'DubaiClearancePayment',
  localField: '_id',
  foreignField: 'invoiceId'
});

// Virtual for PKR amounts (calculated on-the-fly)
dubaiClearanceInvoiceSchema.virtual('amount_pkr').get(function() {
  if (!this.amount_aed || !this.conversion_rate) return 0;
  return Math.round(this.amount_aed * this.conversion_rate);
});

dubaiClearanceInvoiceSchema.virtual('paid_amount_pkr').get(function() {
  if (!this.paid_amount_aed || !this.conversion_rate) return 0;
  return Math.round(this.paid_amount_aed * this.conversion_rate);
});

dubaiClearanceInvoiceSchema.virtual('outstanding_amount_pkr').get(function() {
  if (!this.outstanding_amount_aed || !this.conversion_rate) return 0;
  return Math.round(this.outstanding_amount_aed * this.conversion_rate);
});

// Pre-save middleware to calculate outstanding amount and status
dubaiClearanceInvoiceSchema.pre('save', function(next) {
  // Calculate outstanding amount
  this.outstanding_amount_aed = this.amount_aed - this.paid_amount_aed;
  
  // Determine status
  if (this.outstanding_amount_aed <= 0) {
    this.status = 'paid';
  } else if (this.paid_amount_aed > 0) {
    this.status = 'partially_paid';
  } else if (this.due_date < new Date()) {
    this.status = 'overdue';
  } else {
    this.status = 'unpaid';
  }
  
  next();
});

// Pre-findOneAndUpdate middleware
dubaiClearanceInvoiceSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Calculate outstanding amounts if amounts or payments change
  if (update.amount_aed !== undefined || update.paid_amount_aed !== undefined) {
    const amount_aed = update.amount_aed !== undefined ? update.amount_aed : this.amount_aed;
    const paid_amount_aed = update.paid_amount_aed !== undefined ? update.paid_amount_aed : this.paid_amount_aed;
    
    update.outstanding_amount_aed = amount_aed - paid_amount_aed;
    
    // Determine status
    if (update.outstanding_amount_aed <= 0) {
      update.status = 'paid';
    } else if (paid_amount_aed > 0) {
      update.status = 'partially_paid';
    } else if (update.due_date && update.due_date < new Date()) {
      update.status = 'overdue';
    } else {
      update.status = 'unpaid';
    }
  }
  
  next();
});

// Instance method to add payment
dubaiClearanceInvoiceSchema.methods.addPayment = async function(paymentData) {
  const DubaiClearancePayment = mongoose.model('DubaiClearancePayment');
  
  const payment = new DubaiClearancePayment({
    invoiceId: this._id,
    amount: paymentData.amount_aed,
    paymentType: paymentData.paymentType,
    paymentMethod: paymentData.paymentMethod,
    reference: paymentData.reference,
    notes: paymentData.notes,
    paymentDate: paymentData.paymentDate,
    receivedBy: paymentData.receivedBy
  });
  
  await payment.save();
  
  // Update invoice payment amounts
  this.paid_amount_aed += paymentData.amount_aed;
  this.outstanding_amount_aed = this.amount_aed - this.paid_amount_aed;
  this.last_payment_date = paymentData.paymentDate;
  
  // Update status
  if (this.outstanding_amount_aed <= 0) {
    this.status = 'paid';
  } else if (this.paid_amount_aed > 0) {
    this.status = 'partially_paid';
  } else if (this.due_date < new Date()) {
    this.status = 'overdue';
  } else {
    this.status = 'unpaid';
  }
  
  await this.save();
  return payment;
};

// Instance method to get payment history
dubaiClearanceInvoiceSchema.methods.getPaymentHistory = async function() {
  const DubaiClearancePayment = mongoose.model('DubaiClearancePayment');
  return await DubaiClearancePayment.find({ invoiceId: this._id }).populate('receivedBy', 'name');
};

// Indexes for better query performance
dubaiClearanceInvoiceSchema.index({ invoice_number: 1 });
dubaiClearanceInvoiceSchema.index({ agent: 1 });
dubaiClearanceInvoiceSchema.index({ status: 1 });
dubaiClearanceInvoiceSchema.index({ invoice_date: 1 });
dubaiClearanceInvoiceSchema.index({ due_date: 1 });
dubaiClearanceInvoiceSchema.index({ createdBy: 1 });

module.exports = mongoose.model('DubaiClearanceInvoice', dubaiClearanceInvoiceSchema);
