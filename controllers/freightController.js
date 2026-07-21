const FreightInvoice = require('../models/FreightInvoice');
const FreightPayment = require('../models/FreightPayment');
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

  if (status && status !== 'all') {
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

const createFreightInvoice = async (req, res) => {
  try {
    const data = req.body;

    const freightInvoice = new FreightInvoice({
      organizationId: req.organizationId,
      invoice_number: data.invoice_number,
      description: data.description,
      container_number: data.container_number,
      amount_aed: data.amount_aed,
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
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Duplicate invoice number', message: 'Invoice number already exists' });
    }
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

const getFreightInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const query = { ...buildInvoiceQuery(req.query), organizationId: req.organizationId };

    const freightInvoices = await FreightInvoice.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .populate({ path: 'createdBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name email', match: { organizationId: req.organizationId } });

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

const getFreightInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid freight invoice ID' });
    }

    const freightInvoice = await FreightInvoice.findOne({ _id: id, organizationId: req.organizationId })
      .populate({ path: 'createdBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name email', match: { organizationId: req.organizationId } });

    if (!freightInvoice) {
      return res.status(404).json({ error: 'Freight invoice not found' });
    }

    res.json({ success: true, data: freightInvoice });
  } catch (error) {
    console.error('Get freight invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

const updateFreightInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid freight invoice ID' });
    }

    const data = req.body;
    const freightInvoice = await FreightInvoice.findOne({ _id: id, organizationId: req.organizationId });

    if (!freightInvoice) {
      return res.status(404).json({ error: 'Freight invoice not found' });
    }

    const { organizationId: ignoredOrganizationId, ...safeData } = data;
    Object.assign(freightInvoice, safeData);
    freightInvoice.updatedBy = req.user.id;

    await freightInvoice.save();
    const updated = freightInvoice.toObject();
    updated._id = updated._id.toString();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update freight invoice error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Duplicate invoice number', message: 'Invoice number already exists' });
    }
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

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

    const freightInvoice = await FreightInvoice.findOne({ _id: id, organizationId: req.organizationId });

    if (!freightInvoice) {
      return res.status(404).json({ error: 'Freight invoice not found' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    if (amount > freightInvoice.outstanding_amount_aed) {
      const outstanding = freightInvoice.outstanding_amount_aed;
      return res.status(400).json({
        success: false,
        error: 'Payment amount exceeds outstanding balance',
        message: `Payment amount exceeds the outstanding balance. Maximum payable amount is AED ${outstanding.toFixed(2)}.`,
        outstandingAmountAED: outstanding
      });
    }

    const payment = await freightInvoice.addPayment({
      amount,
      receivedBy: req.user.id,
      paymentType,
      paymentMethod,
      reference,
      notes,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date()
    });

    const updatedFreightInvoice = await FreightInvoice.findOne({ _id: id, organizationId: req.organizationId })
      .populate({ path: 'createdBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({
        path: 'payments',
        match: { organizationId: req.organizationId },
        populate: {
          path: 'receivedBy',
          select: 'name email',
          match: { organizationId: req.organizationId }
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

const getFreightPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid freight invoice ID' });
    }

    const freightInvoice = await FreightInvoice.findOne({ _id: id, organizationId: req.organizationId });

    if (!freightInvoice) {
      return res.status(404).json({ error: 'Freight invoice not found' });
    }

    const paymentHistory = await FreightPayment.find({ freightInvoiceId: id, organizationId: req.organizationId })
      .populate({ path: 'receivedBy', select: 'name email', match: { organizationId: req.organizationId } })
      .sort({ paymentDate: -1 });

    res.json({
      success: true,
      data: paymentHistory
    });
  } catch (error) {
    console.error('Get freight payment history error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

const deleteFreightInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid freight invoice ID' });
    }

    const freightInvoice = await FreightInvoice.findOne({ _id: id, organizationId: req.organizationId });

    if (!freightInvoice) {
      return res.status(404).json({ error: 'Freight invoice not found' });
    }

    await FreightInvoice.findOneAndDelete({ _id: id, organizationId: req.organizationId });

    res.json({ success: true, message: 'Freight invoice deleted successfully' });
  } catch (error) {
    console.error('Delete freight invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

const getFreightInvoiceStats = async (req, res) => {
  try {
    const totalInvoices = await FreightInvoice.countDocuments({ organizationId: req.organizationId });
    const paidInvoices = await FreightInvoice.countDocuments({ organizationId: req.organizationId, status: 'paid' });
    const unpaidInvoices = await FreightInvoice.countDocuments({ organizationId: req.organizationId, status: 'unpaid' });
    const partiallyPaidInvoices = await FreightInvoice.countDocuments({ organizationId: req.organizationId, status: 'partially_paid' });
    const overdueInvoices = await FreightInvoice.countDocuments({ organizationId: req.organizationId, status: 'overdue' });

    const totalAmountAED = await FreightInvoice.aggregate([
      { $match: { organizationId: req.organizationId } },
      { $group: { _id: null, total: { $sum: '$amount_aed' } } }
    ]);

    const receivedAmountAED = await FreightInvoice.aggregate([
      { $match: { organizationId: req.organizationId } },
      { $group: { _id: null, total: { $sum: '$paid_amount_aed' } } }
    ]);

    const outstandingAmountAED = await FreightInvoice.aggregate([
      { $match: { organizationId: req.organizationId } },
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
        totalAmountAED: totalAmountAED[0]?.total || 0,
        receivedAmountAED: receivedAmountAED[0]?.total || 0,
        outstandingAmountAED: outstandingAmountAED[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get freight invoice stats error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

const printFreightInvoice = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid freight invoice ID' });
    }

    const freightInvoice = await FreightInvoice.findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate({ path: 'createdBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name email', match: { organizationId: req.organizationId } });

    if (!freightInvoice) {
      return res.status(404).json({ error: 'Freight invoice not found' });
    }

    const pdf = new PDFGenerator(req.organization);
    pdf.generateFreightInvoice(res, freightInvoice);
  } catch (error) {
    console.error('Print freight invoice error:', error);
    res.status(500).json({ error: 'Server error', message: 'Failed to generate freight invoice PDF' });
  }
};

const generateFreightReportPDF = async (req, res) => {
  try {
    const { groupBy = 'none', includePayments = 'true' } = req.query;
    const query = { ...buildInvoiceQuery(req.query), organizationId: req.organizationId };

    const freightInvoices = await FreightInvoice.find(query)
      .populate({ path: 'createdBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name email', match: { organizationId: req.organizationId } })
      .sort({ createdAt: -1 });

    let paymentHistory = [];
    if (includePayments === 'true') {
      const invoiceIds = freightInvoices.map(invoice => invoice._id);
      paymentHistory = await FreightPayment.find({ freightInvoiceId: { $in: invoiceIds }, organizationId: req.organizationId })
        .populate({ path: 'receivedBy', select: 'name email', match: { organizationId: req.organizationId } })
        .sort({ paymentDate: -1 });
    }

    const pdf = new PDFGenerator(req.organization);
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

const generateFreightReportCSV = async (req, res) => {
  try {
    const { groupBy = 'none', includePayments = 'true' } = req.query;
    const query = { ...buildInvoiceQuery(req.query), organizationId: req.organizationId };

    const freightInvoices = await FreightInvoice.find(query)
      .populate({ path: 'createdBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name email', match: { organizationId: req.organizationId } })
      .sort({ createdAt: -1 });

    let paymentHistory = [];
    if (includePayments === 'true') {
      const invoiceIds = freightInvoices.map(invoice => invoice._id);
      paymentHistory = await FreightPayment.find({ freightInvoiceId: { $in: invoiceIds }, organizationId: req.organizationId })
        .populate({ path: 'receivedBy', select: 'name email', match: { organizationId: req.organizationId } })
        .sort({ paymentDate: -1 });
    }

    const csv = new PDFGenerator(req.organization);
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
