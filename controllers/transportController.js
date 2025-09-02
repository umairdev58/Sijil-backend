const TransportInvoice = require('../models/TransportInvoice');
const TransportPayment = require('../models/TransportPayment');
const Counter = require('../models/Counter');
const PDFGenerator = require('../utils/pdfGenerator');

// Generate invoice number
const generateInvoiceNumber = async () => {
  const sequence = await Counter.getNextSequence('transport_invoice');
  return `TR-${sequence.toString().padStart(4, '0')}`;
};

// Create transport invoice
const createTransportInvoice = async (req, res) => {
  try {
    const data = req.body;

    // Generate invoice number
    const invoice_number = await generateInvoiceNumber();

    const transportInvoice = new TransportInvoice({
      invoice_number,
      amount_pkr: data.amount_pkr,
      conversion_rate: data.conversion_rate,
      agent: data.agent,
      invoice_date: data.invoice_date,
      due_date: data.due_date,
      createdBy: req.user.id
    });

    await transportInvoice.save();
    const saved = transportInvoice.toObject();
    saved._id = saved._id.toString();
    
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error('Create transport invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Get transport invoices with pagination and enhanced filters
const getTransportInvoices = async (req, res) => {
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
    
    const query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { invoice_number: { $regex: search, $options: 'i' } },
        { agent: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Agent filter
    if (agent) {
      query.agent = { $regex: agent, $options: 'i' };
    }
    
    // Date range filters
    if (startDate || endDate) {
      query.invoice_date = {};
      if (startDate) query.invoice_date.$gte = new Date(startDate);
      if (endDate) query.invoice_date.$lte = new Date(endDate);
    }
    
    // Amount range filters
    if (minAmount || maxAmount) {
      query.amount_pkr = {};
      if (minAmount) query.amount_pkr.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount_pkr.$lte = parseFloat(maxAmount);
    }
    
    // Due date range filters
    if (dueDateFrom || dueDateTo) {
      query.due_date = {};
      if (dueDateFrom) query.due_date.$gte = new Date(dueDateFrom);
      if (dueDateTo) query.due_date.$lte = new Date(dueDateTo);
    }

    const transportInvoices = await TransportInvoice.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    const total = await TransportInvoice.countDocuments(query);
    
    res.json({
      success: true,
      data: transportInvoices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalInvoices: total,
        perPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get transport invoices error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Get single transport invoice
const getTransportInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid transport invoice ID' });
    }
    
    const transportInvoice = await TransportInvoice.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
      
    if (!transportInvoice) {
      return res.status(404).json({ error: 'Transport invoice not found' });
    }
    
    res.json({ success: true, data: transportInvoice });
  } catch (error) {
    console.error('Get transport invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Update transport invoice
const updateTransportInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid transport invoice ID' });
    }
    
    const data = req.body;
    const transportInvoice = await TransportInvoice.findById(id);
    
    if (!transportInvoice) {
      return res.status(404).json({ error: 'Transport invoice not found' });
    }

    // Update fields
    Object.assign(transportInvoice, data);
    transportInvoice.updatedBy = req.user.id;
    
    await transportInvoice.save();
    const updated = transportInvoice.toObject();
    updated._id = updated._id.toString();
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update transport invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Add payment to transport invoice
const addTransportPayment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid transport invoice ID' });
    }
    
    const {
      amount,
      paymentType,
      paymentMethod = 'cash',
      reference,
      notes,
      paymentDate
    } = req.body;

    const transportInvoice = await TransportInvoice.findById(id);
    
    if (!transportInvoice) {
      return res.status(404).json({ error: 'Transport invoice not found' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    if (amount > transportInvoice.outstanding_amount_pkr) {
      return res.status(400).json({ error: 'Payment amount cannot be greater than outstanding amount' });
    }

    // Add payment to transport invoice
    const payment = await transportInvoice.addPayment({
      amount,
      receivedBy: req.user.id,
      paymentType,
      paymentMethod,
      reference,
      notes,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date()
    });

    // Get updated transport invoice with payment history
    const updatedTransportInvoice = await TransportInvoice.findById(id)
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
      data: updatedTransportInvoice,
      payment: payment
    });
  } catch (error) {
    console.error('Add transport payment error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Get transport invoice payment history
const getTransportPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid transport invoice ID' });
    }
    
    const transportInvoice = await TransportInvoice.findById(id);
    
    if (!transportInvoice) {
      return res.status(404).json({ error: 'Transport invoice not found' });
    }

    const paymentHistory = await transportInvoice.getPaymentHistory();
    
    res.json({
      success: true,
      data: paymentHistory
    });
  } catch (error) {
    console.error('Get transport payment history error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Delete transport invoice
const deleteTransportInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid transport invoice ID' });
    }
    
    const transportInvoice = await TransportInvoice.findById(id);
    
    if (!transportInvoice) {
      return res.status(404).json({ error: 'Transport invoice not found' });
    }

    await TransportInvoice.findByIdAndDelete(id);
    
    res.json({ success: true, message: 'Transport invoice deleted successfully' });
  } catch (error) {
    console.error('Delete transport invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Get transport invoice statistics
const getTransportInvoiceStats = async (req, res) => {
  try {
    const totalInvoices = await TransportInvoice.countDocuments();
    const paidInvoices = await TransportInvoice.countDocuments({ status: 'paid' });
    const unpaidInvoices = await TransportInvoice.countDocuments({ status: 'unpaid' });
    const partiallyPaidInvoices = await TransportInvoice.countDocuments({ status: 'partially_paid' });
    const overdueInvoices = await TransportInvoice.countDocuments({ status: 'overdue' });
    
    const totalAmountPKR = await TransportInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$amount_pkr' } } }
    ]);
    
    const totalAmountAED = await TransportInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$amount_aed' } } }
    ]);
    
    const paidAmountPKR = await TransportInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$paid_amount_pkr' } } }
    ]);
    
    const paidAmountAED = await TransportInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$paid_amount_aed' } } }
    ]);
    
    const outstandingAmountPKR = await TransportInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$outstanding_amount_pkr' } } }
    ]);
    
    const outstandingAmountAED = await TransportInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$outstanding_amount_aed' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalInvoices,
        paidInvoices,
        unpaidInvoices,
        partiallyPaidInvoices,
        overdueInvoices,
        totalAmountPKR: totalAmountPKR[0]?.total || 0,
        totalAmountAED: totalAmountAED[0]?.total || 0,
        paidAmountPKR: paidAmountPKR[0]?.total || 0,
        paidAmountAED: paidAmountAED[0]?.total || 0,
        outstandingAmountPKR: outstandingAmountPKR[0]?.total || 0,
        outstandingAmountAED: outstandingAmountAED[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get transport invoice stats error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Print transport invoice PDF
const printTransportInvoice = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid transport invoice ID' });
    }
    
    const transportInvoice = await TransportInvoice.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
      
    if (!transportInvoice) {
      return res.status(404).json({ error: 'Transport invoice not found' });
    }

    const pdf = new PDFGenerator();
    pdf.generateTransportInvoice(res, transportInvoice);
  } catch (error) {
    console.error('Print transport invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to generate transport invoice PDF' });
  }
};

// Generate transport report PDF
const generateTransportReportPDF = async (req, res) => {
  try {
    const { 
      startDate, endDate, agent, status, minAmount, maxAmount, 
      dueDateFrom, dueDateTo, groupBy, includePayments 
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
      query.amount_pkr = {};
      if (minAmount) query.amount_pkr.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount_pkr.$lte = parseFloat(maxAmount);
    }
    
    if (dueDateFrom || dueDateTo) {
      query.due_date = {};
      if (dueDateFrom) query.due_date.$gte = new Date(dueDateFrom);
      if (dueDateTo) query.due_date.$lte = new Date(dueDateTo);
    }

    const transportInvoices = await TransportInvoice.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ invoice_date: -1 });

    const pdf = new PDFGenerator();
    pdf.generateTransportReport(res, transportInvoices, {
      startDate, endDate, agent, status, minAmount, maxAmount, 
      dueDateFrom, dueDateTo, groupBy, includePayments: includePayments === 'true'
    });
  } catch (error) {
    console.error('Generate transport report PDF error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to generate transport report PDF' });
  }
};

// Generate transport report CSV
const generateTransportReportCSV = async (req, res) => {
  try {
    const { 
      startDate, endDate, agent, status, minAmount, maxAmount, 
      dueDateFrom, dueDateTo, groupBy, includePayments 
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
      query.amount_pkr = {};
      if (minAmount) query.amount_pkr.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount_pkr.$lte = parseFloat(maxAmount);
    }
    
    if (dueDateFrom || dueDateTo) {
      query.due_date = {};
      if (dueDateFrom) query.due_date.$gte = new Date(dueDateFrom);
      if (dueDateTo) query.due_date.$lte = new Date(dueDateTo);
    }

    const transportInvoices = await TransportInvoice.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ invoice_date: -1 });

    const pdf = new PDFGenerator();
    pdf.generateTransportReportCSV(res, transportInvoices, {
      startDate, endDate, agent, status, minAmount, maxAmount, 
      dueDateFrom, dueDateTo, groupBy, includePayments: includePayments === 'true'
    });
  } catch (error) {
    console.error('Generate transport report CSV error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to generate transport report CSV' });
  }
};

module.exports = {
  createTransportInvoice,
  getTransportInvoices,
  getTransportInvoiceById,
  updateTransportInvoice,
  addTransportPayment,
  getTransportPaymentHistory,
  deleteTransportInvoice,
  getTransportInvoiceStats,
  printTransportInvoice,
  generateTransportReportPDF,
  generateTransportReportCSV
};
