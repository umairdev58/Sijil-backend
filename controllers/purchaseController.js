const Purchase = require('../models/Purchase');
const PDFGenerator = require('../utils/pdfGenerator');

// Create purchase
const createPurchase = async (req, res) => {
  try {
    const data = req.body;

    // Check unique container number
    const existing = await Purchase.findOne({ containerNo: data.containerNo });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Duplicate container', message: 'Container number already exists' });
    }

    const purchase = new Purchase({
      containerNo: data.containerNo,
      product: data.product,
      quantity: data.quantity,
      rate: data.rate,
      transport: data.transport || 0,
      freight: data.freight || 0,
      eForm: data.eForm || 0,
      miscellaneous: data.miscellaneous || 0,
      transferRate: data.transferRate,
      notes: data.notes || '',
      createdBy: req.user.id
    });
    await purchase.save();
    const saved = purchase.toObject();
    saved._id = saved._id.toString();
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error('Create purchase error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Get purchases with pagination
const getPurchases = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const query = {};
    if (search) {
      query.containerNo = { $regex: search, $options: 'i' };
    }
    const purchases = await Purchase.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    const total = await Purchase.countDocuments(query);
    res.json({
      success: true,
      data: purchases,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalPurchases: total,
        perPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Get single purchase
const getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid purchase ID' });
    }
    const purchase = await Purchase.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    res.json({ success: true, data: purchase });
  } catch (error) {
    console.error('Get purchase error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Update purchase
const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid purchase ID' });
    }
    const data = req.body;
    const purchase = await Purchase.findById(id);
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    // Check unique container number on update (exclude current doc)
    if (data.containerNo) {
      const duplicate = await Purchase.findOne({ containerNo: data.containerNo, _id: { $ne: id } });
      if (duplicate) {
        return res.status(400).json({ success: false, error: 'Duplicate container', message: 'Container number already exists' });
      }
    }
    purchase.containerNo = data.containerNo;
    purchase.product = data.product;
    purchase.quantity = data.quantity;
    purchase.rate = data.rate;
    purchase.transport = data.transport || 0;
    purchase.freight = data.freight || 0;
    purchase.eForm = data.eForm || 0;
    purchase.miscellaneous = data.miscellaneous || 0;
    purchase.transferRate = data.transferRate;
    purchase.notes = data.notes || '';
    purchase.updatedBy = req.user.id;
    await purchase.save();
    const saved = purchase.toObject();
    saved._id = saved._id.toString();
    res.json({ success: true, data: saved });
  } catch (error) {
    console.error('Update purchase error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Delete purchase
const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid purchase ID' });
    }
    await Purchase.findByIdAndDelete(id);
    res.json({ success: true, message: 'Purchase deleted successfully' });
  } catch (error) {
    console.error('Delete purchase error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// Generate purchase report
const generatePurchaseReport = async (req, res) => {
  try {
    const {
      startDate = '',
      endDate = '',
      containerNo = '',
      product = '',
      format = 'json', // json, csv, pdf
      groupBy = 'none' // none, product, month, week
    } = req.query;

    // Build query
    const query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query.createdAt.$lt = endDatePlusOne;
      }
    }

    if (containerNo) {
      query.containerNo = { $regex: containerNo, $options: 'i' };
    }

    if (product) {
      query.product = { $regex: product, $options: 'i' };
    }

    // Get purchase data
    const purchases = await Purchase.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    // Calculate summary statistics
    const summary = {
      totalPurchases: purchases.length,
      totalPKR: purchases.reduce((sum, purchase) => sum + (purchase.totalPKR || 0), 0),
      totalAED: purchases.reduce((sum, purchase) => sum + (purchase.totalAED || 0), 0),
      averageCost: purchases.length > 0 ? purchases.reduce((sum, purchase) => sum + (purchase.totalAED || 0), 0) / purchases.length : 0,
      totalTransport: purchases.reduce((sum, purchase) => sum + (purchase.transport || 0), 0),
      totalFreight: purchases.reduce((sum, purchase) => sum + (purchase.freight || 0), 0),
      totalEForm: purchases.reduce((sum, purchase) => sum + (purchase.eForm || 0), 0),
      totalMiscellaneous: purchases.reduce((sum, purchase) => sum + (purchase.miscellaneous || 0), 0),
      productBreakdown: {},
      monthlyBreakdown: {}
    };

    // Calculate breakdowns
    purchases.forEach(purchase => {
      // Product breakdown
      summary.productBreakdown[purchase.product] = (summary.productBreakdown[purchase.product] || 0) + 1;
      
      // Monthly breakdown
      const month = new Date(purchase.createdAt).toISOString().substring(0, 7);
      if (!summary.monthlyBreakdown[month]) {
        summary.monthlyBreakdown[month] = {
          count: 0,
          totalPKR: 0,
          totalAED: 0
        };
      }
      summary.monthlyBreakdown[month].count++;
      summary.monthlyBreakdown[month].totalPKR += purchase.totalPKR || 0;
      summary.monthlyBreakdown[month].totalAED += purchase.totalAED || 0;
    });

    // Group data if requested
    let groupedData = null;
    if (groupBy !== 'none') {
      groupedData = {};
      
      purchases.forEach(purchase => {
        let key;
        switch (groupBy) {
          case 'product':
            key = purchase.product;
            break;
          case 'month':
            key = new Date(purchase.createdAt).toISOString().substring(0, 7);
            break;
          case 'week':
            const date = new Date(purchase.createdAt);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().substring(0, 10);
            break;
          default:
            key = 'Other';
        }
        
        if (!groupedData[key]) {
          groupedData[key] = {
            purchases: [],
            totalPKR: 0,
            totalAED: 0,
            count: 0
          };
        }
        
        groupedData[key].purchases.push(purchase);
        groupedData[key].totalPKR += purchase.totalPKR || 0;
        groupedData[key].totalAED += purchase.totalAED || 0;
        groupedData[key].count++;
      });
    }

    const report = {
      generatedAt: new Date(),
      filters: {
        startDate,
        endDate,
        containerNo,
        product,
        groupBy
      },
      summary,
      purchases: purchases.map(purchase => ({
        _id: purchase._id,
        containerNo: purchase.containerNo,
        product: purchase.product,
        quantity: purchase.quantity,
        rate: purchase.rate,
        transport: purchase.transport,
        freight: purchase.freight,
        eForm: purchase.eForm,
        miscellaneous: purchase.miscellaneous,
        transferRate: purchase.transferRate,
        subtotalPKR: purchase.subtotalPKR,
        totalPKR: purchase.totalPKR,
        totalAED: purchase.totalAED,
        notes: purchase.notes,
        createdAt: purchase.createdAt,
        createdBy: purchase.createdBy?.name || 'Unknown'
      })),
      groupedData
    };

    // Return in requested format
    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = ['Container No', 'Product', 'Quantity', 'Rate (PKR)', 'Transport', 'Freight', 'E-Form', 'Miscellaneous', 'Total PKR', 'Total AED', 'Created Date'];
      const csvData = purchases.map(purchase => [
        purchase.containerNo,
        purchase.product,
        purchase.quantity,
        purchase.rate,
        purchase.transport,
        purchase.freight,
        purchase.eForm,
        purchase.miscellaneous,
        purchase.totalPKR,
        purchase.totalAED,
        new Date(purchase.createdAt).toLocaleDateString()
      ]);
      
      const csvContent = [csvHeaders, ...csvData]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="purchase-report-${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvContent);
    } else if (format === 'pdf') {
      // Use the improved PDF generator
      const pdfGenerator = new PDFGenerator();
      pdfGenerator.generatePurchaseReport(res, report, {
        startDate,
        endDate,
        containerNo,
        product
      });
      return;
    }

    res.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Generate purchase report error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to generate purchase report'
    });
  }
};

module.exports = {
  createPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchase,
  deletePurchase,
  generatePurchaseReport
};


