const mongoose = require('mongoose');

const containerStatementSchema = new mongoose.Schema({
  containerNo: {
    type: String,
    required: [true, 'Container number is required'],
    trim: true,
    maxlength: [50, 'Container number cannot be more than 50 characters'],
    unique: true
  },
  products: [{
    srNo: {
      type: Number,
      required: true
    },
    product: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [100, 'Product name cannot be more than 100 characters']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative']
    },
    amountWithoutVAT: {
      type: Number,
      required: [true, 'Amount without VAT is required'],
      min: [0, 'Amount cannot be negative']
    }
  }],
  expenses: [{
    description: {
      type: String,
      required: [true, 'Expense description is required'],
      trim: true,
      maxlength: [200, 'Description cannot be more than 200 characters']
    },
    amount: {
      type: Number,
      required: [true, 'Expense amount is required'],
      min: [0, 'Amount cannot be negative']
    }
  }],
  grossSale: {
    type: Number,
    default: 0,
    min: [0, 'Gross sale cannot be negative']
  },
  totalExpenses: {
    type: Number,
    default: 0,
    min: [0, 'Total expenses cannot be negative']
  },
  netSale: {
    type: Number,
    default: 0,
    min: [0, 'Net sale cannot be negative']
  },
  totalQuantity: {
    type: Number,
    default: 0,
    min: [0, 'Total quantity cannot be negative']
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

// Index for better query performance
containerStatementSchema.index({ containerNo: 1 });
containerStatementSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate totals
containerStatementSchema.pre('save', function(next) {
  // Calculate total quantity
  this.totalQuantity = this.products.reduce((sum, product) => sum + product.quantity, 0);
  
  // Calculate gross sale
  this.grossSale = this.products.reduce((sum, product) => sum + product.amountWithoutVAT, 0);
  
  // Calculate total expenses
  this.totalExpenses = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  // Calculate net sale
  this.netSale = this.grossSale - this.totalExpenses;
  
  next();
});

// Static method to get statement by container number
containerStatementSchema.statics.getByContainerNo = function(containerNo) {
  return this.findOne({ containerNo }).populate('createdBy', 'name email');
};

// Static method to get all statements with pagination
containerStatementSchema.statics.getAllStatements = function(page = 1, limit = 10, search = '') {
  const query = {};
  
  if (search) {
    query.containerNo = { $regex: search, $options: 'i' };
  }
  
  return this.find(query)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Instance method to add expense
containerStatementSchema.methods.addExpense = function(expenseData) {
  this.expenses.push(expenseData);
  return this.save();
};

// Instance method to remove expense
containerStatementSchema.methods.removeExpense = function(expenseId) {
  this.expenses = this.expenses.filter(expense => expense._id.toString() !== expenseId);
  return this.save();
};

// Instance method to update expense
containerStatementSchema.methods.updateExpense = function(expenseId, updateData) {
  const expense = this.expenses.id(expenseId);
  if (expense) {
    Object.assign(expense, updateData);
    return this.save();
  }
  throw new Error('Expense not found');
};

module.exports = mongoose.model('ContainerStatement', containerStatementSchema);
