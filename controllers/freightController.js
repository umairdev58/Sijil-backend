const FreightInvoice = require('../models/FreightInvoice');
const FreightPayment = require('../models/FreightPayment');
const Counter = require('../models/Counter');
const PDFGenerator = require('../utils/pdfGenerator');

// Generate invoice number
const generateInvoiceNumber = async () => {
  const sequence = await Counter.getNextSequence('freight_invoice');
  return `FR-${sequence.toString().padStart(4, '0')}`;
};

// Create freight invoice
const createFreightInvoice = async (req, res) => {
  try {
    const data = req.body;

    // Generate invoice number
    const invoice_number = await generateInvoiceNumber();

    const freightInvoice = new FreightInvoice({
      invoice_number,
      amount_pkr: data.amount_pkr,
      conversion_rate: data.conversion_rate,
      agent: data.agent,
      invoice_date: data.invoice_date,
      due_date: data.due_date,
      createdBy: req.user.id
    });

    await freightInvoice.save();
    const saved = freightInvoice.toObject();
    saved._id = saved._id.toString();
    
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error('Create freight invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Get freight invoices with pagination and enhanced filters
const getFreightInvoices = async (req, res) => {
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

    const freightInvoices = await FreightInvoice.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    const total = await FreightInvoice.countDocuments(query);
    
    res.json({
      success: true,
      data: freightInvoices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalInvoices: total,
        perPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get freight invoices error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Get single freight invoice
const getFreightInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid freight invoice ID' });
    }
    
    const freightInvoice = await FreightInvoice.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
      
    if (!freightInvoice) {
      return res.status(404).json({ error: 'Freight invoice not found' });
    }
    
    res.json({ success: true, data: freightInvoice });
  } catch (error) {
    console.error('Get freight invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Update freight invoice
const updateFreightInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid freight invoice ID' });
    }
    
    const data = req.body;
    const freightInvoice = await FreightInvoice.findById(id);
    
    if (!freightInvoice) {
      return res.status(404).json({ error: 'Freight invoice not found' });
    }

    // Update fields
    Object.assign(freightInvoice, data);
    freightInvoice.updatedBy = req.user.id;
    
    await freightInvoice.save();
    const updated = freightInvoice.toObject();
    updated._id = updated._id.toString();
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update freight invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Add payment to freight invoice
const addFreightPayment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid freight invoice ID' });
    }
    
    const {
      amount,
      paymentType,
      paymentMethod = 'cash',
      reference,
      notes,
      paymentDate
    } = req.body;

    const freightInvoice = await FreightInvoice.findById(id);
    
    if (!freightInvoice) {
      return res.status(404).json({ error: 'Freight invoice not found' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    if (amount > freightInvoice.outstanding_amount_pkr) {
      return res.status(400).json({ error: 'Payment amount cannot be greater than outstanding amount' });
    }

    // Add payment to freight invoice
    const payment = await freightInvoice.addPayment({
      amount,
      receivedBy: req.user.id,
      paymentType,
      paymentMethod,
      reference,
      notes,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date()
    });

    // Get updated freight invoice with payment history
    const updatedFreightInvoice = await FreightInvoice.findById(id)
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
      data: updatedFreightInvoice,
      payment: payment
    });
  } catch (error) {
    console.error('Add freight payment error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Get freight invoice payment history
const getFreightPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid freight invoice ID' });
    }
    
    const freightInvoice = await FreightInvoice.findById(id);
    
    if (!freightInvoice) {
      return res.status(404).json({ error: 'Freight invoice not found' });
    }

    const paymentHistory = await freightInvoice.getPaymentHistory();
    
    res.json({
      success: true,
      data: paymentHistory
    });
  } catch (error) {
    console.error('Get freight payment history error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Delete freight invoice
const deleteFreightInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid freight invoice ID' });
    }
    
    const freightInvoice = await FreightInvoice.findById(id);
    
    if (!freightInvoice) {
      return res.status(404).json({ error: 'Freight invoice not found' });
    }

    await FreightInvoice.findByIdAndDelete(id);
    
    res.json({ success: true, message: 'Freight invoice deleted successfully' });
  } catch (error) {
    console.error('Delete freight invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Get freight invoice statistics
const getFreightInvoiceStats = async (req, res) => {
  try {
    const totalInvoices = await FreightInvoice.countDocuments();
    const paidInvoices = await FreightInvoice.countDocuments({ status: 'paid' });
    const unpaidInvoices = await FreightInvoice.countDocuments({ status: 'unpaid' });
    const partiallyPaidInvoices = await FreightInvoice.countDocuments({ status: 'partially_paid' });
    const overdueInvoices = await FreightInvoice.countDocuments({ status: 'overdue' });
    
    const totalAmountPKR = await FreightInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$amount_pkr' } } }
    ]);
    
    const totalAmountAED = await FreightInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$amount_aed' } } }
    ]);
    
    const receivedAmountPKR = await FreightInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$received_amount_pkr' } } }
    ]);
    
    const receivedAmountAED = await FreightInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$received_amount_aed' } } }
    ]);
    
    const outstandingAmountPKR = await FreightInvoice.aggregate([
      { $group: { _id: null, total: { $sum: '$outstanding_amount_pkr' } } }
    ]);
    
    const outstandingAmountAED = await FreightInvoice.aggregate([
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
        receivedAmountPKR: receivedAmountPKR[0]?.total || 0,
        receivedAmountAED: receivedAmountAED[0]?.total || 0,
        outstandingAmountPKR: outstandingAmountPKR[0]?.total || 0,
        outstandingAmountAED: outstandingAmountAED[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get freight invoice stats error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Print freight invoice PDF
const printFreightInvoice = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid freight invoice ID' });
    }
    
    const freightInvoice = await FreightInvoice.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
      
    if (!freightInvoice) {
      return res.status(404).json({ error: 'Freight invoice not found' });
    }

    const pdf = new PDFGenerator();
    pdf.generateFreightInvoice(res, freightInvoice);
  } catch (error) {
    console.error('Print freight invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to generate freight invoice PDF' });
  }
};

// Generate freight report PDF
const generateFreightReportPDF = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      agent, 
      status, 
      minAmount, 
      maxAmount, 
      dueDateFrom, 
      dueDateTo,
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
    
    if (status && status !== 'all') {
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

    const freightInvoices = await FreightInvoice.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 });

    // Get payment history if requested
    let paymentHistory = [];
    if (includePayments === 'true') {
      const invoiceIds = freightInvoices.map(invoice => invoice._id);
      paymentHistory = await FreightPayment.find({ freightInvoiceId: { $in: invoiceIds } })
        .populate('receivedBy', 'name email')
        .sort({ paymentDate: -1 });
    }

    const pdf = new PDFGenerator();
    pdf.generateFreightReport(res, {
      invoices: freightInvoices,
      payments: paymentHistory,
      filters: req.query,
      groupBy,
      includePayments: includePayments === 'true'
    });
  } catch (error) {
    console.error('Generate freight report PDF error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to generate freight report PDF' });
  }
};

// Generate freight report CSV
const generateFreightReportCSV = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      agent, 
      status, 
      minAmount, 
      maxAmount, 
      dueDateFrom, 
      dueDateTo,
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
    
    if (status && status !== 'all') {
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

    const freightInvoices = await FreightInvoice.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 });

    // Get payment history if requested
    let paymentHistory = [];
    if (includePayments === 'true') {
      const invoiceIds = freightInvoices.map(invoice => invoice._id);
      paymentHistory = await FreightPayment.find({ freightInvoiceId: { $in: invoiceIds } })
        .populate('receivedBy', 'name email')
        .sort({ paymentDate: -1 });
    }

    // Generate CSV
    const csv = new PDFGenerator();
    csv.generateFreightReportCSV(res, {
      invoices: freightInvoices,
      payments: paymentHistory,
      filters: req.query,
      groupBy,
      includePayments: includePayments === 'true'
    });
  } catch (error) {
    console.error('Generate freight report CSV error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to generate freight report CSV' });
  }
};

module.exports = {
  createFreightInvoice,
  getFreightInvoices,
  getFreightInvoiceById,
  updateFreightInvoice,
  addFreightPayment,
  getFreightPaymentHistory,
  deleteFreightInvoice,
  getFreightInvoiceStats,
  printFreightInvoice,
  generateFreightReportPDF,
  generateFreightReportCSV
};
