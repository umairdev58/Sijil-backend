const Sales = require('../models/Sales');
const Payment = require('../models/Payment');
const Counter = require('../models/Counter');
const PDFGenerator = require('../utils/pdfGenerator');
const Customer = require('../models/Customer');
const { createSalesPaymentEntry } = require('./dailyLedgerController');

// @desc    Create new sale
// @route   POST /api/sales
// @access  Private (Admin/Employee)
const createSale = async (req, res) => {
  try {
    const {
      customer,
      containerNo,
      supplier,
      invoiceDate,
      invoiceNumber, // Add this to destructuring
      product,
      marka,
      description,
      quantity,
      rate,
      vatPercentage = 0,
      dueDate
    } = req.body;

    // Enforce TRN for VAT sales
    if (Number(vatPercentage) > 0) {
      const customerDoc = await Customer.findOne({ ename: { $regex: new RegExp(`^${customer}$`, 'i') } });
      if (!customerDoc || !customerDoc.trn || customerDoc.trn.trim() === '') {
        return res.status(400).json({
          error: 'Customer TRN required',
          message: 'This sale includes VAT. Please add TRN to the selected customer before creating the sale.'
        });
      }
    }

    // Handle invoice number - use provided one or auto-generate
    let finalInvoiceNumber;
    if (invoiceNumber && invoiceNumber.trim() !== '') {
      // Use provided invoice number
      finalInvoiceNumber = invoiceNumber.trim();
      
      // Check if the provided invoice number already exists
      const existingSale = await Sales.findOne({ invoiceNumber: finalInvoiceNumber });
      if (existingSale) {
        return res.status(400).json({
          error: 'Invoice number already exists',
          message: 'A sale with this invoice number already exists. Please use a different invoice number.'
        });
      }
    } else {
      // Auto-generate invoice number
      const nextSequence = await Counter.getNextSequence('invoiceNumber');
      finalInvoiceNumber = `INV-${String(nextSequence).padStart(6, '0')}`;
    }

    // Create new sale
    const newSale = new Sales({
      customer,
      containerNo,
      supplier,
      invoiceDate: new Date(invoiceDate),
      invoiceNumber: finalInvoiceNumber,
      product,
      marka,
      description,
      quantity,
      rate,
      vatPercentage,
      dueDate: new Date(dueDate),
      status: 'unpaid',
      createdBy: req.user.id
    });

    await newSale.save();

    // Ensure the ID is properly formatted as a string
    const saleData = newSale.toObject();
    saleData._id = saleData._id.toString();

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: saleData
    });

  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get all sales with filtering and pagination
// @route   GET /api/sales
// @access  Private (Admin/Employee)
const getSales = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      customer = '',
      supplier = '',
      product = '',
      status = '',
      statuses = '', // Multiple statuses separated by comma
      startDate = '',
      endDate = '',
      dueStartDate = '',
      dueEndDate = '',
      minAmount = '',
      maxAmount = '',
      minOutstanding = '',
      maxOutstanding = '',
      dateFilter = '', // today, yesterday, last7days, last30days, thisMonth, lastMonth
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { customer: { $regex: search, $options: 'i' } },
        { supplier: { $regex: search, $options: 'i' } },
        { product: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { containerNo: { $regex: search, $options: 'i' } },
        { marka: { $regex: search, $options: 'i' } }
      ];
    }

    // Individual field filters
    if (customer) {
      query.customer = { $regex: customer, $options: 'i' };
    }

    if (supplier) {
      query.supplier = { $regex: supplier, $options: 'i' };
    }

    if (product) {
      query.product = { $regex: product, $options: 'i' };
    }

    // Status filtering (single or multiple)
    if (statuses) {
      const statusArray = statuses.split(',').map(s => s.trim());
      query.status = { $in: statusArray };
    } else if (status) {
      query.status = status;
    }

    // Date filtering for invoice date
    if (dateFilter) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateFilter) {
        case 'today':
          query.invoiceDate = {
            $gte: startOfDay,
            $lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
          };
          break;
        case 'yesterday':
          const yesterday = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);
          query.invoiceDate = {
            $gte: yesterday,
            $lt: startOfDay
          };
          break;
        case 'last7days':
          query.invoiceDate = {
            $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          };
          break;
        case 'last30days':
          query.invoiceDate = {
            $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          };
          break;
        case 'thisMonth':
          query.invoiceDate = {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1),
            $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
          };
          break;
        case 'lastMonth':
          query.invoiceDate = {
            $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            $lt: new Date(now.getFullYear(), now.getMonth(), 1)
          };
          break;
      }
    } else {
      // Custom date range for invoice date
      if (startDate || endDate) {
        query.invoiceDate = {};
        if (startDate) {
          query.invoiceDate.$gte = new Date(startDate);
        }
        if (endDate) {
          // Add one day to include the end date
          const endDatePlusOne = new Date(endDate);
          endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
          query.invoiceDate.$lt = endDatePlusOne;
        }
      }
    }

    // Due date filtering
    if (dueStartDate || dueEndDate) {
      query.dueDate = {};
      if (dueStartDate) {
        query.dueDate.$gte = new Date(dueStartDate);
      }
      if (dueEndDate) {
        const dueEndDatePlusOne = new Date(dueEndDate);
        dueEndDatePlusOne.setDate(dueEndDatePlusOne.getDate() + 1);
        query.dueDate.$lt = dueEndDatePlusOne;
      }
    }

    // Amount range filtering
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) {
        query.amount.$gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        query.amount.$lte = parseFloat(maxAmount);
      }
    }

    // Outstanding amount range filtering
    if (minOutstanding || maxOutstanding) {
      query.outstandingAmount = {};
      if (minOutstanding) {
        query.outstandingAmount.$gte = parseFloat(minOutstanding);
      }
      if (maxOutstanding) {
        query.outstandingAmount.$lte = parseFloat(maxOutstanding);
      }
    }

    // Sort options
    const sortOptions = {};
    const validSortFields = ['createdAt', 'invoiceDate', 'dueDate', 'amount', 'outstandingAmount', 'customer', 'supplier', 'status'];
    const validSortOrders = ['asc', 'desc'];
    
    if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder)) {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions.createdAt = -1; // Default sort
    }

    // Execute query with pagination
    const sales = await Sales.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    // Get total count
    const total = await Sales.countDocuments(query);

    // Get statistics for filtered data
    const filteredStats = await Sales.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$amount' },
          totalReceived: { $sum: '$receivedAmount' },
          totalOutstanding: { $sum: '$outstandingAmount' },
          totalCount: { $sum: 1 },
          unpaidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'unpaid'] }, 1, 0] }
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          },
          partiallyPaidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'partially_paid'] }, 1, 0] }
          },
          overdueCount: {
            $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get overall statistics (all sales ever created)
    const overallStats = await Sales.aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$amount' },
          totalReceived: { $sum: '$receivedAmount' },
          totalOutstanding: { $sum: '$outstandingAmount' },
          totalCount: { $sum: 1 },
          unpaidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'unpaid'] }, 1, 0] }
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          },
          partiallyPaidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'partially_paid'] }, 1, 0] }
          },
          overdueCount: {
            $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
          }
        }
      }
    ]);

    const filteredStatsResult = filteredStats[0] || {
      totalSales: 0,
      totalReceived: 0,
      totalOutstanding: 0,
      totalCount: 0,
      unpaidCount: 0,
      paidCount: 0,
      partiallyPaidCount: 0,
      overdueCount: 0
    };

    const overallStatsResult = overallStats[0] || {
      totalSales: 0,
      totalReceived: 0,
      totalOutstanding: 0,
      totalCount: 0,
      unpaidCount: 0,
      paidCount: 0,
      partiallyPaidCount: 0,
      overdueCount: 0
    };

    res.json({
      success: true,
      data: sales,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalSales: total,
        salesPerPage: parseInt(limit)
      },
      statistics: overallStatsResult, // Use overall stats for statistics
      filteredStatistics: filteredStatsResult, // Keep filtered stats for reference
      filters: {
        search,
        customer,
        supplier,
        product,
        status,
        statuses,
        startDate,
        endDate,
        dueStartDate,
        dueEndDate,
        minAmount,
        maxAmount,
        minOutstanding,
        maxOutstanding,
        dateFilter,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get sale by ID with payment history
// @route   GET /api/sales/:id
// @access  Private (Admin/Employee)
const getSaleById = async (req, res) => {
  try {
    console.log('getSaleById called with ID:', req.params.id);
    console.log('ID type:', typeof req.params.id);
    console.log('ID length:', req.params.id.length);
    console.log('ID matches ObjectId pattern:', /^[0-9a-fA-F]{24}$/.test(req.params.id));
    
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('Invalid sale ID format:', req.params.id);
      return res.status(400).json({
        error: 'Invalid sale ID',
        message: 'Sale ID must be a valid 24-character hexadecimal string'
      });
    }

    const sale = await Sales.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate({
        path: 'payments',
        populate: {
          path: 'receivedBy',
          select: 'name email'
        }
      });

    if (!sale) {
      return res.status(404).json({
        error: 'Sale not found',
        message: 'Sale does not exist'
      });
    }

    // Get payment summary
    const paymentSummary = await sale.getPaymentSummary();

    // Ensure the ID is properly formatted as a string
    const saleData = sale.toObject();
    saleData._id = saleData._id.toString();

    res.json({
      success: true,
      sale: saleData,
      paymentSummary
    });

  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Update sale
// @route   PUT /api/sales/:id
// @access  Private (Admin/Employee)
const updateSale = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid sale ID',
        message: 'Sale ID must be a valid 24-character hexadecimal string'
      });
    }

    const {
      customer,
      containerNo,
      supplier,
      invoiceDate,
      invoiceNumber, // Add this to destructuring
      product,
      marka,
      description,
      quantity,
      rate,
      vatPercentage = 0,
      dueDate
    } = req.body;

    // Enforce TRN for VAT sales
    if (Number(vatPercentage) > 0) {
      const customerDoc = await Customer.findOne({ ename: { $regex: new RegExp(`^${customer}$`, 'i') } });
      if (!customerDoc || !customerDoc.trn || customerDoc.trn.trim() === '') {
        return res.status(400).json({
          error: 'Customer TRN required',
          message: 'This sale includes VAT. Please add TRN to the selected customer before updating the sale.'
        });
      }
    }

    const sale = await Sales.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        error: 'Sale not found',
        message: 'Sale does not exist'
      });
    }

    // Check if invoice number is being changed and if it's unique
    if (invoiceNumber && invoiceNumber.trim() !== '' && invoiceNumber !== sale.invoiceNumber) {
      const existingSale = await Sales.findOne({ 
        invoiceNumber: invoiceNumber.trim(),
        _id: { $ne: req.params.id } // Exclude current sale from check
      });
      
      if (existingSale) {
        return res.status(400).json({
          error: 'Invoice number already exists',
          message: 'A sale with this invoice number already exists. Please use a different invoice number.'
        });
      }
    }

    // Update sale
    sale.customer = customer;
    sale.containerNo = containerNo;
    sale.supplier = supplier;
    sale.invoiceDate = new Date(invoiceDate);
    sale.invoiceNumber = invoiceNumber && invoiceNumber.trim() !== '' ? invoiceNumber.trim() : sale.invoiceNumber;
    sale.product = product;
    sale.marka = marka;
    sale.description = description;
    sale.quantity = quantity;
    sale.rate = rate;
    sale.vatPercentage = vatPercentage;
    // Discount is managed via payments now; do not set on sale during updates
    sale.dueDate = new Date(dueDate);
    sale.updatedBy = req.user.id;

    await sale.save();

    // Ensure the ID is properly formatted as a string
    const saleData = sale.toObject();
    saleData._id = saleData._id.toString();

    res.json({
      success: true,
      message: 'Sale updated successfully',
      sale: saleData
    });

  } catch (error) {
    console.error('Update sale error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Add payment to sale
// @route   POST /api/sales/:id/payment
// @access  Private (Admin/Employee)
const addPayment = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid sale ID',
        message: 'Sale ID must be a valid 24-character hexadecimal string'
      });
    }

    const {
      amount,
      paymentType,
      paymentMethod = 'cash',
      reference,
      notes,
      paymentDate,
      discount = 0
    } = req.body;

    const sale = await Sales.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        error: 'Sale not found',
        message: 'Sale does not exist'
      });
    }

    const numericAmount = Number(amount) || 0;
    const numericDiscount = Number(discount) || 0;
    if (numericAmount <= 0 && numericDiscount <= 0) {
      return res.status(400).json({
        error: 'Invalid payment',
        message: 'Either payment amount or discount must be greater than 0'
      });
    }

    // Check if sale is already fully paid
    if (sale.outstandingAmount <= 0) {
      return res.status(400).json({
        error: 'Sale already paid',
        message: 'This invoice is already fully paid. No additional payments can be added.'
      });
    }

    if ((numericAmount + numericDiscount) > sale.outstandingAmount) {
      return res.status(400).json({
        error: 'Overpayment not allowed',
        message: `Amount + Discount (AED ${(numericAmount + numericDiscount).toLocaleString('en-AE', { minimumFractionDigits: 2 })}) cannot exceed the outstanding amount (AED ${sale.outstandingAmount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}).`
      });
    }

    // Add payment to sale
    const payment = await sale.addPayment({
      amount: numericAmount,
      receivedBy: req.user.id,
      paymentType,
      paymentMethod,
      reference,
      notes,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      discount: numericDiscount
    });

    // Create a new payment entry in the daily ledger
    await createSalesPaymentEntry(req.params.id, amount, paymentMethod);

    // Get updated sale with payment history
    const updatedSale = await Sales.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate({
        path: 'payments',
        populate: {
          path: 'receivedBy',
          select: 'name email'
        }
      });

    res.json({
      success: true,
      message: 'Payment added successfully',
      sale: updatedSale,
      payment
    });

  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get payment history for a sale
// @route   GET /api/sales/:id/payments
// @access  Private (Admin/Employee)
const getPaymentHistory = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid sale ID',
        message: 'Sale ID must be a valid 24-character hexadecimal string'
      });
    }

    const sale = await Sales.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        error: 'Sale not found',
        message: 'Sale does not exist'
      });
    }

    const payments = await Payment.find({ saleId: req.params.id })
      .populate('receivedBy', 'name email')
      .sort({ paymentDate: -1 });

    const paymentSummary = await sale.getPaymentSummary();

    res.json({
      success: true,
      payments,
      paymentSummary
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Delete a payment transaction
// @route   DELETE /api/sales/:saleId/payments/:paymentId
// @access  Private (Admin only)
const deletePayment = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only administrators can delete payments'
      });
    }

    // Check if IDs are valid ObjectIds
    if (!req.params.saleId.match(/^[0-9a-fA-F]{24}$/) || !req.params.paymentId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid ID',
        message: 'Sale ID and Payment ID must be valid 24-character hexadecimal strings'
      });
    }

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Password required',
        message: 'Admin password verification is required to delete payments'
      });
    }

    // Verify admin password
    const User = require('../models/User');
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid password',
        message: 'Admin password is incorrect'
      });
    }

    // Find the sale and payment
    const sale = await Sales.findById(req.params.saleId);
    if (!sale) {
      return res.status(404).json({
        error: 'Sale not found',
        message: 'Sale does not exist'
      });
    }

    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'Payment does not exist'
      });
    }

    // Verify payment belongs to this sale
    if (payment.saleId.toString() !== req.params.saleId) {
      return res.status(400).json({
        error: 'Invalid payment',
        message: 'Payment does not belong to this sale'
      });
    }

    // Delete the payment
    await Payment.findByIdAndDelete(req.params.paymentId);

    // Recalculate sale amounts
    const remainingPayments = await Payment.find({ saleId: req.params.saleId });
    const totalReceived = remainingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalDiscount = remainingPayments.reduce((sum, p) => sum + (p.discount || 0), 0);
    
    sale.receivedAmount = totalReceived;
    sale.discountTotal = totalDiscount;
    // Recompute amount/outstanding from base components
    const { ceilToTwoDecimals } = require('../utils/numberFormatter');
    const subtotal = ceilToTwoDecimals(sale.quantity * sale.rate);
    sale.vatAmount = ceilToTwoDecimals((subtotal * sale.vatPercentage) / 100);
    sale.amount = ceilToTwoDecimals(Math.max(0, subtotal + sale.vatAmount - sale.discountTotal));
    sale.outstandingAmount = ceilToTwoDecimals(sale.amount - sale.receivedAmount);
    
    // Update status based on outstanding amount and due date
    if (sale.outstandingAmount <= 0) {
      sale.status = 'paid';
    } else if (sale.receivedAmount > 0) {
      sale.status = 'partially_paid';
    } else if (new Date() > sale.dueDate) {
      sale.status = 'overdue';
    } else {
      sale.status = 'unpaid';
    }

    // Update last payment date
    if (remainingPayments.length > 0) {
      sale.lastPaymentDate = remainingPayments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0].paymentDate;
    } else {
      sale.lastPaymentDate = null;
    }

    await sale.save();

    // Get updated payment history
    const updatedPayments = await Payment.find({ saleId: req.params.saleId })
      .populate('receivedBy', 'name email')
      .sort({ paymentDate: -1 });

    const paymentSummary = await sale.getPaymentSummary();

    res.json({
      success: true,
      message: 'Payment deleted successfully',
      payments: updatedPayments,
      paymentSummary,
      sale: {
        _id: sale._id,
        receivedAmount: sale.receivedAmount,
        outstandingAmount: sale.outstandingAmount,
        status: sale.status,
        lastPaymentDate: sale.lastPaymentDate
      }
    });

  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Delete sale
// @route   DELETE /api/sales/:id
// @access  Private (Admin only)
const deleteSale = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only administrators can delete sales'
      });
    }

    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid sale ID',
        message: 'Sale ID must be a valid 24-character hexadecimal string'
      });
    }

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Password required',
        message: 'Admin password verification is required to delete sales'
      });
    }

    // Verify admin password
    const User = require('../models/User');
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid password',
        message: 'Admin password is incorrect'
      });
    }

    const sale = await Sales.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        error: 'Sale not found',
        message: 'Sale does not exist'
      });
    }

    // Delete associated payments first
    await Payment.deleteMany({ saleId: req.params.id });

    // Delete the sale
    await Sales.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Sale and associated payments deleted successfully'
    });

  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get sales statistics
// @route   GET /api/sales/statistics
// @access  Private (Admin/Employee)
const getSalesStatistics = async (req, res) => {
  try {
    const stats = await Sales.getStatistics();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Generate sales report
// @route   GET /api/sales/report
// @access  Private (Admin/Employee)
const generateSalesReport = async (req, res) => {
  try {
    const {
      startDate = '',
      endDate = '',
      customer = '',
      supplier = '',
      containerNo = '',
      status = '',
      statuses = '',
      format = 'json', // json, csv, pdf
      groupBy = 'none', // none, customer, supplier, status, month, week
      includePayments = 'false'
    } = req.query;

    // Build query
    const query = {};

    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) {
        query.invoiceDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query.invoiceDate.$lt = endDatePlusOne;
      }
    }

    if (customer) {
      query.customer = { $regex: customer, $options: 'i' };
    }

    if (supplier) {
      query.supplier = { $regex: supplier, $options: 'i' };
    }

    if (containerNo) {
      query.containerNo = { $regex: containerNo, $options: 'i' };
    }

    if (statuses) {
      const statusArray = statuses.split(',').map(s => s.trim());
      query.status = { $in: statusArray };
    } else if (status) {
      query.status = status;
    }

    // Get sales data
    const sales = await Sales.find(query)
      .sort({ invoiceDate: -1 })
      .populate('createdBy', 'name email');

    // Get payment data if requested
    let payments = [];
    if (includePayments === 'true') {
      const saleIds = sales.map(sale => sale._id);
      payments = await Payment.find({ saleId: { $in: saleIds } })
        .populate('receivedBy', 'name email')
        .sort({ paymentDate: -1 });
    }

    // Calculate summary statistics
    const summary = {
      totalSales: sales.length,
      totalAmount: sales.reduce((sum, sale) => sum + (sale.amount || 0), 0),
      totalReceived: sales.reduce((sum, sale) => sum + (sale.receivedAmount || 0), 0),
      totalOutstanding: sales.reduce((sum, sale) => sum + (sale.outstandingAmount || 0), 0),
      averageAmount: sales.length > 0 ? sales.reduce((sum, sale) => sum + (sale.amount || 0), 0) / sales.length : 0,
      statusBreakdown: {},
      customerBreakdown: {},
      supplierBreakdown: {},
      containerBreakdown: {},
      monthlyBreakdown: {},
      paymentBreakdown: {}
    };

    // Calculate breakdowns
    sales.forEach(sale => {
      // Status breakdown
      summary.statusBreakdown[sale.status] = (summary.statusBreakdown[sale.status] || 0) + 1;
      
      // Customer breakdown
      summary.customerBreakdown[sale.customer] = (summary.customerBreakdown[sale.customer] || 0) + 1;
      
      // Supplier breakdown
      summary.supplierBreakdown[sale.supplier] = (summary.supplierBreakdown[sale.supplier] || 0) + 1;
      
      // Container breakdown
      summary.containerBreakdown[sale.containerNo] = (summary.containerBreakdown[sale.containerNo] || 0) + 1;
      
      // Monthly breakdown
      const month = new Date(sale.invoiceDate).toISOString().substring(0, 7);
      if (!summary.monthlyBreakdown[month]) {
        summary.monthlyBreakdown[month] = {
          count: 0,
          amount: 0,
          received: 0,
          outstanding: 0
        };
      }
      summary.monthlyBreakdown[month].count++;
      summary.monthlyBreakdown[month].amount += sale.amount || 0;
      summary.monthlyBreakdown[month].received += sale.receivedAmount || 0;
      summary.monthlyBreakdown[month].outstanding += sale.outstandingAmount || 0;
    });

    // Payment breakdown
    payments.forEach(payment => {
      summary.paymentBreakdown[payment.paymentMethod] = (summary.paymentBreakdown[payment.paymentMethod] || 0) + 1;
    });

    // Group data if requested
    let groupedData = null;
    if (groupBy !== 'none') {
      groupedData = {};
      
      sales.forEach(sale => {
        let key;
        switch (groupBy) {
          case 'customer':
            key = sale.customer;
            break;
          case 'supplier':
            key = sale.supplier;
            break;
          case 'status':
            key = sale.status;
            break;
          case 'container':
            key = sale.containerNo;
            break;
          case 'month':
            key = new Date(sale.invoiceDate).toISOString().substring(0, 7);
            break;
          case 'week':
            const date = new Date(sale.invoiceDate);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().substring(0, 10);
            break;
          default:
            key = 'Other';
        }
        
        if (!groupedData[key]) {
          groupedData[key] = {
            sales: [],
            totalAmount: 0,
            totalReceived: 0,
            totalOutstanding: 0,
            count: 0
          };
        }
        
        groupedData[key].sales.push(sale);
        groupedData[key].totalAmount += sale.amount || 0;
        groupedData[key].totalReceived += sale.receivedAmount || 0;
        groupedData[key].totalOutstanding += sale.outstandingAmount || 0;
        groupedData[key].count++;
      });
    }

    const report = {
      generatedAt: new Date(),
      filters: {
        startDate,
        endDate,
        customer,
        supplier,
        containerNo,
        status,
        statuses,
        groupBy,
        includePayments
      },
      summary,
      sales: sales.map(sale => ({
        _id: sale._id,
        invoiceNumber: sale.invoiceNumber,
        customer: sale.customer,
        supplier: sale.supplier,
        containerNo: sale.containerNo,
        product: sale.product,
        rate: sale.rate,
        quantity: sale.quantity,
        invoiceDate: sale.invoiceDate,
        dueDate: sale.dueDate,
        amount: sale.amount,
        receivedAmount: sale.receivedAmount,
        outstandingAmount: sale.outstandingAmount,
        status: sale.status,
        createdBy: sale.createdBy?.name || 'Unknown'
      })),
      payments: includePayments === 'true' ? payments.map(payment => ({
        _id: payment._id,
        saleId: payment.saleId,
        amount: payment.amount,
        paymentType: payment.paymentType,
        paymentMethod: payment.paymentMethod,
        paymentDate: payment.paymentDate,
        reference: payment.reference,
        notes: payment.notes,
        receivedBy: payment.receivedBy?.name || 'Unknown'
      })) : [],
      groupedData
    };

    // Return in requested format
    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = ['Invoice Number', 'Customer', 'Supplier', 'Container No', 'Product', 'Rate', 'Quantity', 'Invoice Date', 'Due Date', 'Amount', 'Received', 'Outstanding'];
      const csvData = sales.map(sale => [
        sale.invoiceNumber,
        sale.customer,
        sale.supplier,
        sale.containerNo,
        sale.product,
        sale.rate || 0,
        sale.quantity || 0,
        new Date(sale.invoiceDate).toLocaleDateString(),
        new Date(sale.dueDate).toLocaleDateString(),
        sale.amount,
        sale.receivedAmount,
        sale.outstandingAmount
      ]);
      
      const csvContent = [csvHeaders, ...csvData]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="sales-report-${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvContent);
    } else if (format === 'pdf') {
      // Use the improved PDF generator
      const pdfGenerator = new PDFGenerator();
      pdfGenerator.generateSalesReport(res, report, {
        startDate,
        endDate,
        customer,
        supplier,
        containerNo,
        status,
        statuses
      });
      return;
    }

    res.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Generate sales report error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to generate sales report'
    });
  }
};

// @desc    Get monthly sales statistics
// @route   GET /api/sales/statistics/monthly
// @access  Private (Admin/Employee)
const getMonthlyStatistics = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    // Default to current month if not specified
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth(); // Month is 0-indexed
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    
    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    const monthlyStats = await Sales.aggregate([
      {
        $match: {
          invoiceDate: {
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$amount' },
          totalReceived: { $sum: '$receivedAmount' },
          totalOutstanding: { $sum: '$outstandingAmount' },
          totalCount: { $sum: 1 },
          unpaidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'unpaid'] }, 1, 0] }
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          },
          partiallyPaidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'partially_paid'] }, 1, 0] }
          },
          overdueCount: {
            $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = monthlyStats[0] || {
      totalSales: 0,
      totalReceived: 0,
      totalOutstanding: 0,
      totalCount: 0,
      unpaidCount: 0,
      paidCount: 0,
      partiallyPaidCount: 0,
      overdueCount: 0
    };

    res.json({
      success: true,
      data: stats,
      period: {
        month: targetMonth + 1,
        year: targetYear,
        startDate: startOfMonth,
        endDate: endOfMonth
      }
    });

  } catch (error) {
    console.error('Get monthly statistics error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get monthly statistics'
    });
  }
};

// @desc    Print single invoice (A4 half size)
// @route   GET /api/sales/:id/print
// @access  Private (Admin/Employee)
const printInvoice = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid sale ID' });
    }
    const sale = await Sales.findById(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    // Resolve customer TRN if VAT present
    const vatPct = Number(sale.vatPercentage || 0);
    let customerTRN = '';
    if (vatPct > 0) {
      const customer = await Customer.findOne({ ename: { $regex: new RegExp(`^${sale.customer}$`, 'i') } });
      customerTRN = customer?.trn || '';
    }

    const pdf = new PDFGenerator();
    const saleData = sale.toObject();
    saleData.customerTRN = customerTRN;

    // Prefer logged-in user's TRN if provided in headers (frontend can pass), fallback to env
    const companyTRN = req.user?.trn || process.env.COMPANY_TRN || '';
    pdf.generateInvoiceA5(res, saleData, { companyTRN });
  } catch (error) {
    console.error('Print invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to generate invoice PDF' });
  }
};

// @desc    Get customer outstanding amounts
// @route   GET /api/sales/customer-outstanding
// @access  Private (Admin/Employee)
const getCustomerOutstanding = async (req, res) => {
  try {
    const { search = '', minAmount = '', maxAmount = '', status = '', groupBy = 'customer', product = '' } = req.query;

    // Build aggregation pipeline
    const pipeline = [
      // Match sales with outstanding amounts
      {
        $match: {
          outstandingAmount: { $gt: 0 }
        }
      },
    ];

    // Add product filter if specified
    if (product) {
      pipeline.push({
        $match: {
          product: { $regex: product, $options: 'i' }
        }
      });
    }

    // Determine grouping strategy
    if (groupBy === 'product') {
      // Group by product first, then by customer within each product
      pipeline.push(
        {
          $group: {
            _id: {
              product: '$product',
              customer: '$customer'
            },
            productName: { $first: '$product' },
            customerName: { $first: '$customer' },
            totalOutstanding: { $sum: '$outstandingAmount' },
            totalAmount: { $sum: '$amount' },
            totalReceived: { $sum: '$receivedAmount' },
            invoiceCount: { $sum: 1 },
            unpaidInvoices: {
              $sum: { $cond: [{ $eq: ['$status', 'unpaid'] }, 1, 0] }
            },
            partiallyPaidInvoices: {
              $sum: { $cond: [{ $eq: ['$status', 'partially_paid'] }, 1, 0] }
            },
            overdueInvoices: {
              $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
            },
            lastPaymentDate: { $max: '$lastPaymentDate' },
            oldestDueDate: { $min: '$dueDate' }
          }
        },
        {
          $group: {
            _id: '$productName',
            productName: { $first: '$productName' },
            customers: {
              $push: {
                customerName: '$customerName',
                totalOutstanding: '$totalOutstanding',
                totalAmount: '$totalAmount',
                totalReceived: '$totalReceived',
                invoiceCount: '$invoiceCount',
                unpaidInvoices: '$unpaidInvoices',
                partiallyPaidInvoices: '$partiallyPaidInvoices',
                overdueInvoices: '$overdueInvoices',
                lastPaymentDate: '$lastPaymentDate',
                oldestDueDate: '$oldestDueDate'
              }
            },
            totalOutstanding: { $sum: '$totalOutstanding' },
            totalAmount: { $sum: '$totalAmount' },
            totalReceived: { $sum: '$totalReceived' },
            totalInvoices: { $sum: '$invoiceCount' },
            totalCustomers: { $sum: 1 }
          }
        }
      );
    } else {
      // Default: Group by customer
      pipeline.push({
        $group: {
          _id: '$customer',
          customerName: { $first: '$customer' },
          totalOutstanding: { $sum: '$outstandingAmount' },
          totalAmount: { $sum: '$amount' },
          totalReceived: { $sum: '$receivedAmount' },
          invoiceCount: { $sum: 1 },
          unpaidInvoices: {
            $sum: { $cond: [{ $eq: ['$status', 'unpaid'] }, 1, 0] }
          },
          partiallyPaidInvoices: {
            $sum: { $cond: [{ $eq: ['$status', 'partially_paid'] }, 1, 0] }
          },
          overdueInvoices: {
            $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
          },
          lastPaymentDate: { $max: '$lastPaymentDate' },
          oldestDueDate: { $min: '$dueDate' }
        }
      });
    }
    // Add computed fields based on grouping type
    if (groupBy === 'product') {
      pipeline.push({
        $addFields: {
          customers: {
            $map: {
              input: '$customers',
              as: 'customer',
              in: {
                $mergeObjects: [
                  '$$customer',
                  {
                    status: {
                      $cond: [
                        { $gt: ['$$customer.overdueInvoices', 0] },
                        'overdue',
                        {
                          $cond: [
                            { $gt: ['$$customer.partiallyPaidInvoices', 0] },
                            'partially_paid',
                            'unpaid'
                          ]
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      });
    } else {
      pipeline.push({
        $addFields: {
          status: {
            $cond: [
              { $gt: ['$overdueInvoices', 0] },
              'overdue',
              {
                $cond: [
                  { $gt: ['$partiallyPaidInvoices', 0] },
                  'partially_paid',
                  'unpaid'
                ]
              }
            ]
          }
        }
      });
    }

    // Sort by outstanding amount (highest first)
    pipeline.push({
      $sort: { totalOutstanding: -1 }
    });

    // Add search filter
    if (search) {
      if (groupBy === 'product') {
        pipeline.unshift({
          $match: {
            $or: [
              { customer: { $regex: search, $options: 'i' } },
              { product: { $regex: search, $options: 'i' } }
            ]
          }
        });
      } else {
        pipeline.unshift({
          $match: {
            customer: { $regex: search, $options: 'i' }
          }
        });
      }
    }

    // Add amount range filters
    if (minAmount || maxAmount) {
      const amountFilter = {};
      if (minAmount) amountFilter.$gte = parseFloat(minAmount);
      if (maxAmount) amountFilter.$lte = parseFloat(maxAmount);
      
      pipeline.splice(1, 0, {
        $match: {
          outstandingAmount: amountFilter
        }
      });
    }

    // Add status filter
    if (status) {
      const statusFilter = {};
      if (status === 'overdue') {
        statusFilter.status = 'overdue';
      } else if (status === 'partially_paid') {
        statusFilter.status = 'partially_paid';
      } else if (status === 'unpaid') {
        statusFilter.status = 'unpaid';
      }
      
      if (Object.keys(statusFilter).length > 0) {
        pipeline.splice(1, 0, {
          $match: statusFilter
        });
      }
    }

    // Get total count for pagination
    const totalPipeline = [...pipeline];
    const totalResult = await Sales.aggregate([
      ...totalPipeline,
      { $count: 'total' }
    ]);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    pipeline.push(
      { $skip: skip },
      { $limit: limit }
    );

    const customerOutstanding = await Sales.aggregate(pipeline);

    // Calculate summary statistics
    const summary = {
      totalOutstanding: customerOutstanding.reduce((sum, customer) => sum + customer.totalOutstanding, 0),
      totalCustomers: total,
      overdueCustomers: customerOutstanding.filter(c => c.status === 'overdue').length,
      partiallyPaidCustomers: customerOutstanding.filter(c => c.status === 'partially_paid').length,
      unpaidCustomers: customerOutstanding.filter(c => c.status === 'unpaid').length,
    };

    res.json({
      success: true,
      data: customerOutstanding,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      summary
    });

  } catch (error) {
    console.error('Get customer outstanding error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get customer outstanding amounts'
    });
  }
};

// @desc    Generate customer outstanding PDF report
// @route   GET /api/sales/customer-outstanding/pdf
// @access  Private (Admin/Employee)
const generateCustomerOutstandingPDF = async (req, res) => {
  try {
    const { search = '', minAmount = '', maxAmount = '', status = '' } = req.query;

    // Build aggregation pipeline (same as getCustomerOutstanding)
    const pipeline = [
      {
        $match: {
          outstandingAmount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$customer',
          customerName: { $first: '$customer' },
          totalOutstanding: { $sum: '$outstandingAmount' },
          totalAmount: { $sum: '$amount' },
          totalReceived: { $sum: '$receivedAmount' },
          invoiceCount: { $sum: 1 },
          unpaidInvoices: {
            $sum: { $cond: [{ $eq: ['$status', 'unpaid'] }, 1, 0] }
          },
          partiallyPaidInvoices: {
            $sum: { $cond: [{ $eq: ['$status', 'partially_paid'] }, 1, 0] }
          },
          overdueInvoices: {
            $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
          },
          lastPaymentDate: { $max: '$lastPaymentDate' },
          oldestDueDate: { $min: '$dueDate' }
        }
      },
      {
        $addFields: {
          status: {
            $cond: [
              { $gt: ['$overdueInvoices', 0] },
              'overdue',
              {
                $cond: [
                  { $gt: ['$partiallyPaidInvoices', 0] },
                  'partially_paid',
                  'unpaid'
                ]
              }
            ]
          }
        }
      },
      {
        $sort: { totalOutstanding: -1 }
      }
    ];

    // Add filters
    if (search) {
      pipeline.unshift({
        $match: {
          customer: { $regex: search, $options: 'i' }
        }
      });
    }

    if (minAmount || maxAmount) {
      const amountFilter = {};
      if (minAmount) amountFilter.$gte = parseFloat(minAmount);
      if (maxAmount) amountFilter.$lte = parseFloat(maxAmount);
      
      pipeline.splice(1, 0, {
        $match: {
          outstandingAmount: amountFilter
        }
      });
    }

    if (status) {
      const statusFilter = {};
      if (status === 'overdue') {
        statusFilter.overdueInvoices = { $gt: 0 };
      } else if (status === 'partially_paid') {
        statusFilter.partiallyPaidInvoices = { $gt: 0 };
        statusFilter.overdueInvoices = 0;
      } else if (status === 'unpaid') {
        statusFilter.unpaidInvoices = { $gt: 0 };
        statusFilter.partiallyPaidInvoices = 0;
        statusFilter.overdueInvoices = 0;
      }
      
      if (Object.keys(statusFilter).length > 0) {
        pipeline.splice(1, 0, {
          $match: statusFilter
        });
      }
    }

    const customerOutstanding = await Sales.aggregate(pipeline);

    const pdf = new PDFGenerator();
    pdf.generateCustomerOutstandingReport(res, customerOutstanding);

  } catch (error) {
    console.error('Generate customer outstanding PDF error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to generate customer outstanding PDF'
    });
  }
};

// @desc    Get unique products for filtering
// @route   GET /api/sales/products
// @access  Private (Admin/Employee)
const getUniqueProducts = async (req, res) => {
  try {
    const products = await Sales.distinct('product', { 
      outstandingAmount: { $gt: 0 },
      product: { $exists: true, $ne: null, $ne: '' }
    });
    
    res.json({
      success: true,
      data: products.sort()
    });
  } catch (error) {
    console.error('Get unique products error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to fetch unique products'
    });
  }
};

// Get autocomplete suggestions for sales form fields
const getAutocompleteSuggestions = async (req, res) => {
  try {
    const { field } = req.params;
    
    // Define which fields are allowed for autocomplete
    const allowedFields = ['product', 'containerNo', 'marka', 'description'];
    
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid field for autocomplete'
      });
    }

    // Get unique values for the specified field
    const suggestions = await Sales.distinct(field, {
      [field]: { $exists: true, $ne: null, $ne: '' }
    });

    // Sort suggestions alphabetically and limit to 20 most recent/used
    const sortedSuggestions = suggestions
      .filter(suggestion => suggestion && suggestion.trim() !== '')
      .sort()
      .slice(0, 20);

    res.json({
      success: true,
      suggestions: sortedSuggestions
    });
  } catch (error) {
    console.error('Error fetching autocomplete suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching autocomplete suggestions',
      error: error.message
    });
  }
};

// @desc    Get recent payments
// @route   GET /api/payments/recent
// @access  Private
const getRecentPayments = async (req, res) => {
  try {
    const { limit = 10, days = 7 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const payments = await Payment.find({
      paymentDate: { $gte: startDate }
    })
    .populate('saleId', 'invoiceNumber customer amount')
    .populate('receivedBy', 'name email')
    .sort({ paymentDate: -1 })
    .limit(parseInt(limit));

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Error fetching recent payments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  createSale,
  getSales,
  getSaleById,
  updateSale,
  addPayment,
  getPaymentHistory,
  deletePayment,
  deleteSale,
  getSalesStatistics,
  generateSalesReport,
  getMonthlyStatistics,
  printInvoice,
  getCustomerOutstanding,
  generateCustomerOutstandingPDF,
  getUniqueProducts,
  getAutocompleteSuggestions,
  getRecentPayments
}; 