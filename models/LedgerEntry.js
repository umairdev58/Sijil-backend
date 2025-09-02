const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema({
  ledger_date: {
    type: Date,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['receipt', 'payment'],
    index: true
  },
  mode: {
    type: String,
    required: true,
    enum: ['cash', 'bank'],
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  reference_type: {
    type: String,
    enum: ['manual', 'sales_payment', 'purchase_payment'],
    default: 'manual'
  },
  reference_id: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'reference_model'
  },
  reference_model: {
    type: String,
    enum: ['Sales', 'Purchase'],
    required: function() {
      return this.reference_type !== 'manual';
    }
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

// Indexes for efficient queries
ledgerEntrySchema.index({ ledger_date: 1, type: 1 });
ledgerEntrySchema.index({ ledger_date: 1, mode: 1 });
ledgerEntrySchema.index({ reference_type: 1, reference_id: 1 });

// Static method to get entries by date
ledgerEntrySchema.statics.findByDate = function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    ledger_date: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  }).sort({ created_at: 1 });
};

// Static method to get entries by date and type
ledgerEntrySchema.statics.findByDateAndType = function(date, type) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    ledger_date: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    type: type
  }).sort({ created_at: 1 });
};

// Static method to get entries by date and mode
ledgerEntrySchema.statics.findByDateAndMode = function(date, mode) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    ledger_date: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    mode: mode
  }).sort({ created_at: 1 });
};

// Static method to calculate totals by date
ledgerEntrySchema.statics.calculateTotalsByDate = function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.aggregate([
    {
      $match: {
        ledger_date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      }
    },
    {
      $group: {
        _id: {
          type: '$type',
          mode: '$mode'
        },
        total: { $sum: '$amount' }
      }
    }
  ]);
};

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
