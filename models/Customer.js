const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  ename: {
    type: String,
    required: [true, 'English name is required'],
    trim: true,
    maxlength: [100, 'English name cannot be more than 100 characters']
  },
  uname: {
    type: String,
    trim: true,
    maxlength: [100, 'Urdu name cannot be more than 100 characters']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    maxlength: [100, 'Email cannot be more than 100 characters']
  },
  trn: {
    type: String,
    trim: true,
    maxlength: [30, 'TRN cannot be more than 30 characters']
  },
  number: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot be more than 20 characters']
  },
  isActive: {
    type: Boolean,
    default: true
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
  timestamps: true
});

// Indexes for better query performance
customerSchema.index({ ename: 1 });
customerSchema.index({ uname: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ trn: 1 });
customerSchema.index({ number: 1 });
customerSchema.index({ isActive: 1 });

// Virtual for full name (English + Urdu)
customerSchema.virtual('fullName').get(function() {
  if (this.uname) {
    return `${this.ename} (${this.uname})`;
  }
  return this.ename;
});

// Instance method to get customer info without sensitive data
customerSchema.methods.toJSON = function() {
  const customerObject = this.toObject();
  return customerObject;
};

// Static method to find customer by name (English or Urdu)
customerSchema.statics.findByName = function(name) {
  return this.find({
    $or: [
      { ename: { $regex: name, $options: 'i' } },
      { uname: { $regex: name, $options: 'i' } }
    ]
  });
};

// Static method to get customer statistics
customerSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        activeCustomers: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        inactiveCustomers: {
          $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0
  };
};

module.exports = mongoose.model('Customer', customerSchema); 