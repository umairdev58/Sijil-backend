const DubaiClearanceInvoice = require('../models/DubaiClearanceInvoice');
const DubaiClearancePayment = require('../models/DubaiClearancePayment');
const Counter = require('../models/Counter');
const { validationResult } = require('express-validator');
const PDFGenerator = require('../utils/pdfGenerator');

// Get all Dubai clearance invoices with pagination and filters
const getDubaiClearanceInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      agent = '',
      startDate = '',
      endDate = '',
      minAmount = '',
      maxAmount = '',
      dueDateFrom = '',
      dueDateTo = ''
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { invoice_number: { $regex: search, $options: 'i' } },
        { agent: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Agent filter
    if (agent) {
      query.agent = { $regex: agent, $options: 'i' };
    }

    // Date range filter
    if (startDate || endDate) {
      query.invoice_date = {};
      if (startDate) query.invoice_date.$gte = new Date(startDate);
      if (endDate) query.invoice_date.$lte = new Date(endDate);
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      query.amount_aed = {};
      if (minAmount) query.amount_aed.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount_aed.$lte = parseFloat(maxAmount);
    }

    // Due date range filter
    if (dueDateFrom || dueDateTo) {
      query.due_date = {};
      if (dueDateFrom) query.due_date.$gte = new Date(dueDateFrom);
      if (dueDateTo) query.due_date.$lte = new Date(dueDateTo);
    }

    const invoices = await DubaiClearanceInvoice.find(query)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await DubaiClearanceInvoice.countDocuments(query);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching Dubai clearance invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Dubai clearance invoices'
    });
  }
};

// Create new Dubai clearance invoice
const createDubaiClearanceInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount_pkr, conversion_rate, amount_aed, agent, invoice_date, due_date } = req.body;

    // Generate invoice number
    const sequence = await Counter.getNextSequence('dubai_clearance_invoice');
    const invoice_number = `DC-${sequence.toString().padStart(4, '0')}`;

    const invoice = new DubaiClearanceInvoice({
      invoice_number,
      amount_pkr,
      conversion_rate,
      amount_aed,
      agent,
      invoice_date,
      due_date,
      createdBy: req.user._id
    });

    await invoice.save();

    res.status(201).json({
      success: true,
      message: 'Dubai clearance invoice created successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error creating Dubai clearance invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Dubai clearance invoice'
    });
  }
};

// Get single Dubai clearance invoice
const getDubaiClearanceInvoice = async (req, res) => {
  try {
    const invoice = await DubaiClearanceInvoice.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Dubai clearance invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error fetching Dubai clearance invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Dubai clearance invoice'
    });
  }
};

// Update Dubai clearance invoice
const updateDubaiClearanceInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount_pkr, conversion_rate, amount_aed, agent, invoice_date, due_date } = req.body;

    const invoice = await DubaiClearanceInvoice.findByIdAndUpdate(
      req.params.id,
      {
        amount_pkr,
        conversion_rate,
        amount_aed,
        agent,
        invoice_date,
        due_date,
        updatedBy: req.user._id
      },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name').populate('updatedBy', 'name');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Dubai clearance invoice not found'
      });
    }

    res.json({
      success: true,
      message: 'Dubai clearance invoice updated successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error updating Dubai clearance invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Dubai clearance invoice'
    });
  }
};

// Delete Dubai clearance invoice
const deleteDubaiClearanceInvoice = async (req, res) => {
  try {
    const invoice = await DubaiClearanceInvoice.findByIdAndDelete(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Dubai clearance invoice not found'
      });
    }

    // Delete associated payments
    await DubaiClearancePayment.deleteMany({ invoiceId: req.params.id });

    res.json({
      success: true,
      message: 'Dubai clearance invoice deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting Dubai clearance invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete Dubai clearance invoice'
    });
  }
};

// Add payment to Dubai clearance invoice
const addDubaiClearancePayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const invoice = await DubaiClearanceInvoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Dubai clearance invoice not found'
      });
    }

    const paymentData = {
      ...req.body,
      receivedBy: req.user._id
    };

    const payment = await invoice.addPayment(paymentData);

    res.json({
      success: true,
      message: 'Payment added successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error adding Dubai clearance payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add payment'
    });
  }
};

// Get payment history for Dubai clearance invoice
const getDubaiClearancePaymentHistory = async (req, res) => {
  try {
    const invoice = await DubaiClearanceInvoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Dubai clearance invoice not found'
      });
    }

    const payments = await invoice.getPaymentHistory();

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Error fetching Dubai clearance payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
};

// Get Dubai clearance invoice statistics
const getDubaiClearanceInvoiceStats = async (req, res) => {
  try {
    const totalInvoices = await DubaiClearanceInvoice.countDocuments();
    const totalAmountAED = await DubaiClearanceInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$amount_aed' } } }
    ]);
    const paidAmountAED = await DubaiClearanceInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$paid_amount_aed' } } }
    ]);
    const outstandingAmountAED = await DubaiClearanceInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$outstanding_amount_aed' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalInvoices,
        totalAmountAED: totalAmountAED[0]?.total || 0,
        paidAmountAED: paidAmountAED[0]?.total || 0,
        outstandingAmountAED: outstandingAmountAED[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Error fetching Dubai clearance invoice stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
};

// Print Dubai clearance invoice
const printDubaiClearanceInvoice = async (req, res) => {
  try {
    const invoice = await DubaiClearanceInvoice.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Dubai clearance invoice not found'
      });
    }

    const pdfGenerator = new PDFGenerator();
    pdfGenerator.generateDubaiClearanceInvoice(res, invoice);
  } catch (error) {
    console.error('Error printing Dubai clearance invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to print invoice'
    });
  }
};

// Generate Dubai clearance report PDF
const generateDubaiClearanceReportPDF = async (req, res) => {
  try {
    const {
      startDate = '',
      endDate = '',
      agent = '',
      status = '',
      minAmount = '',
      maxAmount = '',
      dueDateFrom = '',
      dueDateTo = '',
      groupBy = 'none',
      includePayments = 'true'
    } = req.query;

    const query = {};

    // Apply filters
    if (startDate || endDate) {
      query.invoice_date = {};
      if (startDate) query.invoice_date.$gte = new Date(startDate);
      if (endDate) query.invoice_date.$lte = new Date(endDate);
    }

    if (agent) {
      query.agent = { $regex: agent, $options: 'i' };
    }

    if (status) {
      query.status = status;
    }

    if (minAmount || maxAmount) {
      query.amount_aed = {};
      if (minAmount) query.amount_aed.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount_aed.$lte = parseFloat(maxAmount);
    }

    if (dueDateFrom || dueDateTo) {
      query.due_date = {};
      if (dueDateFrom) query.due_date.$gte = new Date(dueDateFrom);
      if (dueDateTo) query.due_date.$lte = new Date(dueDateTo);
    }

    let invoices = await DubaiClearanceInvoice.find(query)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ createdAt: -1 });

    if (includePayments === 'true') {
      for (let invoice of invoices) {
        invoice.payments = await invoice.getPaymentHistory();
      }
    }

    const options = {
      startDate,
      endDate,
      agent,
      status,
      minAmount,
      maxAmount,
      dueDateFrom,
      dueDateTo,
      groupBy,
      includePayments: includePayments === 'true'
    };

    const pdfGenerator = new PDFGenerator();
    pdfGenerator.generateDubaiClearanceReport(res, invoices, options);
  } catch (error) {
    console.error('Error generating Dubai clearance report PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report'
    });
  }
};

// Generate Dubai clearance report CSV
const generateDubaiClearanceReportCSV = async (req, res) => {
  try {
    const {
      startDate = '',
      endDate = '',
      agent = '',
      status = '',
      minAmount = '',
      maxAmount = '',
      dueDateFrom = '',
      dueDateTo = '',
      groupBy = 'none',
      includePayments = 'true'
    } = req.query;

    const query = {};

    // Apply filters
    if (startDate || endDate) {
      query.invoice_date = {};
      if (startDate) query.invoice_date.$gte = new Date(startDate);
      if (endDate) query.invoice_date.$lte = new Date(endDate);
    }

    if (agent) {
      query.agent = { $regex: agent, $options: 'i' };
    }

    if (status) {
      query.status = status;
    }

    if (minAmount || maxAmount) {
      query.amount_aed = {};
      if (minAmount) query.amount_aed.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount_aed.$lte = parseFloat(maxAmount);
    }

    if (dueDateFrom || dueDateTo) {
      query.due_date = {};
      if (dueDateFrom) query.due_date.$gte = new Date(dueDateFrom);
      if (dueDateTo) query.due_date.$lte = new Date(dueDateTo);
    }

    let invoices = await DubaiClearanceInvoice.find(query)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ createdAt: -1 });

    if (includePayments === 'true') {
      for (let invoice of invoices) {
        invoice.payments = await invoice.getPaymentHistory();
      }
    }

    const options = {
      startDate,
      endDate,
      agent,
      status,
      minAmount,
      maxAmount,
      dueDateFrom,
      dueDateTo,
      groupBy,
      includePayments: includePayments === 'true'
    };

    const pdfGenerator = new PDFGenerator();
    pdfGenerator.generateDubaiClearanceReportCSV(res, invoices, options);
  } catch (error) {
    console.error('Error generating Dubai clearance report CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report'
    });
  }
};



module.exports = {
  getDubaiClearanceInvoices,
  createDubaiClearanceInvoice,
  getDubaiClearanceInvoice,
  updateDubaiClearanceInvoice,
  deleteDubaiClearanceInvoice,
  addDubaiClearancePayment,
  getDubaiClearancePaymentHistory,
  getDubaiClearanceInvoiceStats,
  printDubaiClearanceInvoice,
  generateDubaiClearanceReportPDF,
  generateDubaiClearanceReportCSV
};
