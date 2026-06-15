const mongoose = require('mongoose');

const freightInvoiceSchema = new mongoose.Schema({
  invoice_number: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  container_number: {
    type: String,
    trim: true,
    maxlength: [100, 'Container number cannot be more than 100 characters']
  },
  amount_aed: {
    type: Number,
    required: [true, 'Amount in AED is required'],
    min: [0.01, 'Amount must be greater than 0']
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

freightInvoiceSchema.virtual('payments', {
  ref: 'FreightPayment',
  localField: '_id',
  foreignField: 'freightInvoiceId'
});

freightInvoiceSchema.index({ invoice_number: 1 }, { unique: true });
freightInvoiceSchema.index({ invoice_date: -1 });
freightInvoiceSchema.index({ container_number: 1 });
freightInvoiceSchema.index({ status: 1 });
freightInvoiceSchema.index({ due_date: 1 });
freightInvoiceSchema.index({ last_payment_date: 1 });

freightInvoiceSchema.pre('save', function(next) {
  this.outstanding_amount_aed = this.amount_aed - this.paid_amount_aed;

  if (this.outstanding_amount_aed <= 0) {
    this.status = 'paid';
  } else if (this.paid_amount_aed > 0) {
    this.status = 'partially_paid';
  } else if (new Date() > this.due_date) {
    this.status = 'overdue';
  } else {
    this.status = 'unpaid';
  }

  next();
});

freightInvoiceSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();

  if (update.amount_aed !== undefined || update.paid_amount_aed !== undefined) {
    const amount_aed = update.amount_aed !== undefined ? update.amount_aed : this.amount_aed;
    const paid_amount_aed = update.paid_amount_aed !== undefined ? update.paid_amount_aed : this.paid_amount_aed;

    update.outstanding_amount_aed = amount_aed - paid_amount_aed;

    if (update.outstanding_amount_aed <= 0) {
      update.status = 'paid';
    } else if (paid_amount_aed > 0) {
      update.status = 'partially_paid';
    } else if (new Date() > (update.due_date || this.due_date)) {
      update.status = 'overdue';
    } else {
      update.status = 'unpaid';
    }
  }

  next();
});

freightInvoiceSchema.methods.addPayment = async function(paymentData) {
  const FreightPayment = require('./FreightPayment');

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

  this.paid_amount_aed += paymentData.amount;
  this.outstanding_amount_aed = this.amount_aed - this.paid_amount_aed;
  this.last_payment_date = payment.paymentDate;

  if (this.outstanding_amount_aed <= 0) {
    this.status = 'paid';
  } else if (this.paid_amount_aed > 0) {
    this.status = 'partially_paid';
  } else if (new Date() > this.due_date) {
    this.status = 'overdue';
  } else {
    this.status = 'unpaid';
  }

  await this.save();

  return payment;
};

freightInvoiceSchema.methods.getPaymentHistory = async function() {
  const FreightPayment = require('./FreightPayment');
  return await FreightPayment.find({ freightInvoiceId: this._id })
    .populate('receivedBy', 'name email')
    .sort({ paymentDate: -1 });
};

module.exports = mongoose.model('FreightInvoice', freightInvoiceSchema);
