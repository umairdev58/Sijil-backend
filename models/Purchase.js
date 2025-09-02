const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  containerNo: {
    type: String,
    required: [true, 'Container number is required'],
    trim: true,
    maxlength: [50, 'Container number cannot be more than 50 characters'],
    unique: true
  },
  product: {
    type: String,
    required: [true, 'Product is required'],
    trim: true,
    maxlength: [100, 'Product name cannot be more than 100 characters']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  rate: {
    type: Number,
    required: [true, 'Rate is required'], // PKR per unit
    min: [0, 'Rate cannot be negative']
  },
  transport: {
    type: Number,
    default: 0,
    min: [0, 'Transport cannot be negative']
  },
  freight: {
    type: Number,
    default: 0,
    min: [0, 'Freight cannot be negative']
  },
  eForm: {
    type: Number,
    default: 0,
    min: [0, 'E-Form cannot be negative']
  },
  miscellaneous: {
    type: Number,
    default: 0,
    min: [0, 'Miscellaneous cannot be negative']
  },
  transferRate: {
    type: Number,
    required: [true, 'Transfer rate (PKR per AED) is required'],
    min: [0.000001, 'Transfer rate must be greater than 0']
  },
  subtotalPKR: {
    type: Number,
    default: 0,
    min: [0, 'Subtotal cannot be negative']
  },
  totalPKR: {
    type: Number,
    default: 0,
    min: [0, 'Total amount cannot be negative']
  },
  totalAED: {
    type: Number,
    default: 0,
    min: [0, 'Total AED cannot be negative']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot be more than 500 characters']
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

purchaseSchema.index({ product: 1 });
purchaseSchema.index({ createdAt: -1 });
purchaseSchema.index({ containerNo: 1 }, { unique: true });

// Pre-save calculation
purchaseSchema.pre('save', function(next) {
  const subtotal = (this.quantity || 0) * (this.rate || 0);
  this.subtotalPKR = subtotal;
  const totalPKR = subtotal + (this.transport || 0) + (this.freight || 0) + (this.eForm || 0) + (this.miscellaneous || 0);
  this.totalPKR = totalPKR;
  if (this.transferRate && this.transferRate > 0) {
    this.totalAED = totalPKR / this.transferRate;
  } else {
    this.totalAED = 0;
  }
  next();
});

module.exports = mongoose.model('Purchase', purchaseSchema);


