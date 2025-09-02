const mongoose = require('mongoose');

const dailyLedgerSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },
  opening_cash: {
    type: Number,
    required: true,
    default: 0
  },
  opening_bank: {
    type: Number,
    required: true,
    default: 0
  },
  receipts_cash: {
    type: Number,
    required: true,
    default: 0
  },
  receipts_bank: {
    type: Number,
    required: true,
    default: 0
  },
  payments_cash: {
    type: Number,
    required: true,
    default: 0
  },
  payments_bank: {
    type: Number,
    required: true,
    default: 0
  },
  auto_sales_inflow: {
    type: Number,
    required: true,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  },
  closing_cash: {
    type: Number,
    required: true,
    default: 0
  },
  closing_bank: {
    type: Number,
    required: true,
    default: 0
  },
  is_closed: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index for efficient date-based queries
dailyLedgerSchema.index({ date: 1 });

// Pre-save middleware to calculate closing balances
dailyLedgerSchema.pre('save', function(next) {
  // Calculate closing balances
  this.closing_cash = this.opening_cash + this.receipts_cash + this.auto_sales_inflow - this.payments_cash;
  this.closing_bank = this.opening_bank + this.receipts_bank - this.payments_bank;
  next();
});

// Static method to get ledger by date
dailyLedgerSchema.statics.findByDate = function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.findOne({
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  });
};

// Static method to create or update daily ledger
dailyLedgerSchema.statics.createOrUpdate = function(date, data) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  return this.findOneAndUpdate(
    { date: startOfDay },
    { ...data, date: startOfDay },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('DailyLedger', dailyLedgerSchema);
