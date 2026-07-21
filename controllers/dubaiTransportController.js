const DubaiTransportInvoice = require('../models/DubaiTransportInvoice');
const DubaiTransportPayment = require('../models/DubaiTransportPayment');
const { validationResult } = require('express-validator');
const PDFGenerator = require('../utils/pdfGenerator');

const buildInvoiceQuery = (queryParams) => {
  const {
    search = '',
    status = '',
    startDate = '',
    endDate = '',
    minAmount = '',
    maxAmount = '',
    dueDateFrom = '',
    dueDateTo = ''
  } = queryParams;

  const query = {};

  if (search) {
    query.$or = [
      { invoice_number: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { container_number: { $regex: search, $options: 'i' } }
    ];
  }

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.invoice_date = {};
    if (startDate) query.invoice_date.$gte = new Date(startDate);
    if (endDate) query.invoice_date.$lte = new Date(endDate);
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

  return query;
};

const getDubaiTransportInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const query = { ...buildInvoiceQuery(req.query), organizationId: req.organizationId };

    const invoices = await DubaiTransportInvoice.find(query)
      .populate({ path: 'createdBy', select: 'name', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name', match: { organizationId: req.organizationId } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await DubaiTransportInvoice.countDocuments(query);

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
    console.error('Error fetching Dubai transport invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Dubai transport invoices'
    });
  }
};

const createDubaiTransportInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { invoice_number, description, container_number, amount_aed, invoice_date, due_date } = req.body;

    const invoice = new DubaiTransportInvoice({
      organizationId: req.organizationId,
      invoice_number,
      description,
      container_number,
      amount_aed,
      invoice_date,
      due_date,
      createdBy: req.user._id
    });

    await invoice.save();

    res.status(201).json({
      success: true,
      message: 'Dubai transport invoice created successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error creating Dubai transport invoice:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Invoice number already exists' });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create Dubai transport invoice'
    });
  }
};

const getDubaiTransportInvoice = async (req, res) => {
  try {
    const invoice = await DubaiTransportInvoice.findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate({ path: 'createdBy', select: 'name', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name', match: { organizationId: req.organizationId } });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Dubai transport invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error fetching Dubai transport invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Dubai transport invoice'
    });
  }
};

const updateDubaiTransportInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { invoice_number, description, container_number, amount_aed, invoice_date, due_date } = req.body;

    const invoice = await DubaiTransportInvoice.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.organizationId },
      {
        invoice_number,
        description,
        container_number,
        amount_aed,
        invoice_date,
        due_date,
        updatedBy: req.user._id
      },
      { new: true, runValidators: true }
    ).populate({ path: 'createdBy', select: 'name', match: { organizationId: req.organizationId } }).populate({ path: 'updatedBy', select: 'name', match: { organizationId: req.organizationId } });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Dubai transport invoice not found'
      });
    }

    res.json({
      success: true,
      message: 'Dubai transport invoice updated successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error updating Dubai transport invoice:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Invoice number already exists' });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update Dubai transport invoice'
    });
  }
};

const deleteDubaiTransportInvoice = async (req, res) => {
  try {
    const invoice = await DubaiTransportInvoice.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Dubai transport invoice not found'
      });
    }

    await DubaiTransportPayment.deleteMany({ invoiceId: req.params.id, organizationId: req.organizationId });

    res.json({
      success: true,
      message: 'Dubai transport invoice deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting Dubai transport invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete Dubai transport invoice'
    });
  }
};

const addDubaiTransportPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const invoice = await DubaiTransportInvoice.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Dubai transport invoice not found'
      });
    }

    const { amount_aed } = req.body;

    if (amount_aed <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0'
      });
    }

    if (amount_aed > invoice.outstanding_amount_aed) {
      const outstanding = invoice.outstanding_amount_aed;
      return res.status(400).json({
        success: false,
        error: 'Payment amount exceeds outstanding balance',
        message: `Payment amount exceeds the outstanding balance. Maximum payable amount is AED ${outstanding.toFixed(2)}.`,
        outstandingAmountAED: outstanding
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
    console.error('Error adding Dubai transport payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add payment'
    });
  }
};

const getDubaiTransportPaymentHistory = async (req, res) => {
  try {
    const invoice = await DubaiTransportInvoice.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Dubai transport invoice not found'
      });
    }

    const payments = await DubaiTransportPayment.find({ invoiceId: req.params.id, organizationId: req.organizationId })
      .populate({ path: 'receivedBy', select: 'name email', match: { organizationId: req.organizationId } })
      .sort({ paymentDate: -1 });

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Error fetching Dubai transport payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
};

const getDubaiTransportInvoiceStats = async (req, res) => {
  try {
    const totalInvoices = await DubaiTransportInvoice.countDocuments({ organizationId: req.organizationId });
    const totalAmountAED = await DubaiTransportInvoice.aggregate([
      { $match: { organizationId: req.organizationId } },
      { $group: { _id: null, total: { $sum: '$amount_aed' } } }
    ]);
    const paidAmountAED = await DubaiTransportInvoice.aggregate([
      { $match: { organizationId: req.organizationId } },
      { $group: { _id: null, total: { $sum: '$paid_amount_aed' } } }
    ]);
    const outstandingAmountAED = await DubaiTransportInvoice.aggregate([
      { $match: { organizationId: req.organizationId } },
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
    console.error('Error fetching Dubai transport invoice stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
};

const printDubaiTransportInvoice = async (req, res) => {
  try {
    const invoice = await DubaiTransportInvoice.findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate({ path: 'createdBy', select: 'name', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name', match: { organizationId: req.organizationId } });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Dubai transport invoice not found'
      });
    }

    const pdfGenerator = new PDFGenerator(req.organization);
    pdfGenerator.generateDubaiTransportInvoice(res, invoice);
  } catch (error) {
    console.error('Error printing Dubai transport invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to print invoice'
    });
  }
};

const generateDubaiTransportReportPDF = async (req, res) => {
  try {
    const { groupBy = 'none', includePayments = 'true' } = req.query;
    const query = { ...buildInvoiceQuery(req.query), organizationId: req.organizationId };

    let invoices = await DubaiTransportInvoice.find(query)
      .populate({ path: 'createdBy', select: 'name', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name', match: { organizationId: req.organizationId } })
      .sort({ createdAt: -1 });

    if (includePayments === 'true') {
      for (let invoice of invoices) {
        invoice.payments = await DubaiTransportPayment.find({ invoiceId: invoice._id, organizationId: req.organizationId })
          .populate({ path: 'receivedBy', select: 'name email', match: { organizationId: req.organizationId } })
          .sort({ paymentDate: -1 });
      }
    }

    const options = {
      ...req.query,
      groupBy,
      includePayments: includePayments === 'true'
    };

    const pdfGenerator = new PDFGenerator(req.organization);
    pdfGenerator.generateDubaiTransportReport(res, invoices, options);
  } catch (error) {
    console.error('Error generating Dubai transport report PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report'
    });
  }
};

const generateDubaiTransportReportCSV = async (req, res) => {
  try {
    const { groupBy = 'none', includePayments = 'true' } = req.query;
    const query = { ...buildInvoiceQuery(req.query), organizationId: req.organizationId };

    let invoices = await DubaiTransportInvoice.find(query)
      .populate({ path: 'createdBy', select: 'name', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name', match: { organizationId: req.organizationId } })
      .sort({ createdAt: -1 });

    if (includePayments === 'true') {
      for (let invoice of invoices) {
        invoice.payments = await DubaiTransportPayment.find({ invoiceId: invoice._id, organizationId: req.organizationId })
          .populate({ path: 'receivedBy', select: 'name email', match: { organizationId: req.organizationId } })
          .sort({ paymentDate: -1 });
      }
    }

    const options = {
      ...req.query,
      groupBy,
      includePayments: includePayments === 'true'
    };

    const pdfGenerator = new PDFGenerator(req.organization);
    pdfGenerator.generateDubaiTransportReportCSV(res, invoices, options);
  } catch (error) {
    console.error('Error generating Dubai transport report CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report'
    });
  }
};

module.exports = {
  getDubaiTransportInvoices,
  createDubaiTransportInvoice,
  getDubaiTransportInvoice,
  updateDubaiTransportInvoice,
  deleteDubaiTransportInvoice,
  addDubaiTransportPayment,
  getDubaiTransportPaymentHistory,
  getDubaiTransportInvoiceStats,
  printDubaiTransportInvoice,
  generateDubaiTransportReportPDF,
  generateDubaiTransportReportCSV
};
