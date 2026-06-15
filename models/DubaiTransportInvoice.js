const mongoose = require('mongoose');

const dubaiTransportInvoiceSchema = new mongoose.Schema({
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

dubaiTransportInvoiceSchema.virtual('payments', {
  ref: 'DubaiTransportPayment',
  localField: '_id',
  foreignField: 'invoiceId'
});

dubaiTransportInvoiceSchema.pre('save', function(next) {
  this.outstanding_amount_aed = this.amount_aed - this.paid_amount_aed;

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

dubaiTransportInvoiceSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();

  if (update.amount_aed !== undefined || update.paid_amount_aed !== undefined) {
    const amount_aed = update.amount_aed !== undefined ? update.amount_aed : this.amount_aed;
    const paid_amount_aed = update.paid_amount_aed !== undefined ? update.paid_amount_aed : this.paid_amount_aed;

    update.outstanding_amount_aed = amount_aed - paid_amount_aed;

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

dubaiTransportInvoiceSchema.methods.addPayment = async function(paymentData) {
  const DubaiTransportPayment = mongoose.model('DubaiTransportPayment');

  const payment = new DubaiTransportPayment({
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

  this.paid_amount_aed += paymentData.amount_aed;
  this.outstanding_amount_aed = this.amount_aed - this.paid_amount_aed;
  this.last_payment_date = paymentData.paymentDate;

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

dubaiTransportInvoiceSchema.methods.getPaymentHistory = async function() {
  const DubaiTransportPayment = mongoose.model('DubaiTransportPayment');
  return await DubaiTransportPayment.find({ invoiceId: this._id }).populate('receivedBy', 'name');
};

dubaiTransportInvoiceSchema.index({ invoice_number: 1 });
dubaiTransportInvoiceSchema.index({ container_number: 1 });
dubaiTransportInvoiceSchema.index({ status: 1 });
dubaiTransportInvoiceSchema.index({ invoice_date: 1 });
dubaiTransportInvoiceSchema.index({ due_date: 1 });
dubaiTransportInvoiceSchema.index({ createdBy: 1 });

module.exports = mongoose.model('DubaiTransportInvoice', dubaiTransportInvoiceSchema);
