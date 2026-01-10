const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Category name cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
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
categorySchema.index({ name: 1 });
categorySchema.index({ isActive: 1 });

// Instance method to get category info without sensitive data
categorySchema.methods.toJSON = function() {
  const categoryObject = this.toObject();
  return categoryObject;
};

// Static method to find category by name
categorySchema.statics.findByName = function(name) {
  return this.find({
    name: { $regex: name, $options: 'i' }
  });
};

// Static method to get category statistics
categorySchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalCategories: { $sum: 1 },
        activeCategories: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        inactiveCategories: {
          $sum: { $cond: [{ $eq: ['isActive', false] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalCategories: 0,
    activeCategories: 0,
    inactiveCategories: 0
  };
};

module.exports = mongoose.model('Category', categorySchema);

