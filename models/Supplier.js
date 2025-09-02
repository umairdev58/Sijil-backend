const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
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
  number: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot be more than 20 characters']
  },
  marka: {
    type: String,
    trim: true,
    maxlength: [100, 'Marka cannot be more than 100 characters'],
    default: ''
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
supplierSchema.index({ ename: 1 });
supplierSchema.index({ uname: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ number: 1 });
supplierSchema.index({ marka: 1 });
supplierSchema.index({ isActive: 1 });

// Virtual for full name (English + Urdu)
supplierSchema.virtual('fullName').get(function() {
  if (this.uname) {
    return `${this.ename} (${this.uname})`;
  }
  return this.ename;
});

// Instance method to get supplier info without sensitive data
supplierSchema.methods.toJSON = function() {
  const supplierObject = this.toObject();
  return supplierObject;
};

// Static method to find supplier by name (English or Urdu)
supplierSchema.statics.findByName = function(name) {
  return this.find({
    $or: [
      { ename: { $regex: name, $options: 'i' } },
      { uname: { $regex: name, $options: 'i' } }
    ]
  });
};

// Static method to get supplier statistics
supplierSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalSuppliers: { $sum: 1 },
        activeSuppliers: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        inactiveSuppliers: {
          $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalSuppliers: 0,
    activeSuppliers: 0,
    inactiveSuppliers: 0
  };
};

module.exports = mongoose.model('Supplier', supplierSchema);

