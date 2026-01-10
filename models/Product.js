const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  sku: {
    type: String,
    trim: true,
    maxlength: [50, 'SKU cannot be more than 50 characters']
  },
  unit: {
    type: String,
    trim: true,
    default: 'piece',
    maxlength: [20, 'Unit cannot be more than 20 characters']
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
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ name: 1, category: 1 });

// Instance method to get product info without sensitive data
productSchema.methods.toJSON = function() {
  const productObject = this.toObject();
  return productObject;
};

// Static method to find product by name
productSchema.statics.findByName = function(name) {
  return this.find({
    name: { $regex: name, $options: 'i' }
  });
};

// Static method to find products by category
productSchema.statics.findByCategory = function(categoryId) {
  return this.find({ category: categoryId });
};

// Static method to get product statistics
productSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        activeProducts: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        inactiveProducts: {
          $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalProducts: 0,
    activeProducts: 0,
    inactiveProducts: 0
  };
};

module.exports = mongoose.model('Product', productSchema);

