const ContainerStatement = require('../models/ContainerStatement');
const Sales = require('../models/Sales');
const PDFGenerator = require('../utils/pdfGenerator');

// @desc    Get container statement by container number
// @route   GET /api/container-statements/:containerNo
// @access  Private
const getContainerStatement = async (req, res) => {
  try {
    const { containerNo } = req.params;

    if (!containerNo) {
      return res.status(400).json({
        success: false,
        error: 'Container number is required',
        message: 'Please provide a valid container number'
      });
    }

    // Always build products from latest sales to avoid stale statements
    const salesData = await Sales.find({ containerNo })
      .populate('createdBy', 'name email')
      .sort({ createdAt: 1 });

    if (salesData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Container not found',
        message: `No data found for container number: ${containerNo}`
      });
    }

    const latestProducts = salesData.map((sale, index) => ({
      srNo: index + 1,
      product: sale.product,
      quantity: sale.quantity,
      unitPrice: sale.rate,
      amountWithoutVAT: sale.amount - sale.vatAmount
    }));

    // Fetch existing statement (to preserve expenses), or create a new one
    let statement = await ContainerStatement.getByContainerNo(containerNo);

    if (!statement) {
      statement = new ContainerStatement({
        containerNo,
        products: latestProducts,
        expenses: [],
        createdBy: req.user.id
      });
    } else {
      // Update products with latest sales-derived data
      statement.products = latestProducts;
      statement.updatedBy = req.user.id;
    }

    // Save to trigger pre-save totals recalculation
    await statement.save();

    res.json({
      success: true,
      data: statement,
      message: 'Container statement retrieved successfully'
    });

  } catch (error) {
    console.error('Get container statement error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Create or update container statement
// @route   POST /api/container-statements
// @access  Private
const createContainerStatement = async (req, res) => {
  try {
    const { containerNo, products, expenses } = req.body;

    if (!containerNo) {
      return res.status(400).json({
        success: false,
        error: 'Container number is required',
        message: 'Please provide a valid container number'
      });
    }

    // Check if statement already exists
    const existingStatement = await ContainerStatement.getByContainerNo(containerNo);

    if (existingStatement) {
      return res.status(400).json({
        success: false,
        error: 'Statement already exists',
        message: `Container statement for ${containerNo} already exists. Use update endpoint instead.`
      });
    }

    const statement = new ContainerStatement({
      containerNo,
      products: products || [],
      expenses: expenses || [],
      createdBy: req.user.id
    });

    await statement.save();

    res.status(201).json({
      success: true,
      data: statement,
      message: 'Container statement created successfully'
    });

  } catch (error) {
    console.error('Create container statement error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Update container statement
// @route   PUT /api/container-statements/:id
// @access  Private
const updateContainerStatement = async (req, res) => {
  try {
    const { id } = req.params;
    const { products, expenses } = req.body;

    const statement = await ContainerStatement.findById(id);

    if (!statement) {
      return res.status(404).json({
        success: false,
        error: 'Statement not found',
        message: 'Container statement not found'
      });
    }

    // Update fields
    if (products) statement.products = products;
    if (expenses) statement.expenses = expenses;
    statement.updatedBy = req.user.id;

    await statement.save();

    res.json({
      success: true,
      data: statement,
      message: 'Container statement updated successfully'
    });

  } catch (error) {
    console.error('Update container statement error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Add expense to container statement
// @route   POST /api/container-statements/:id/expenses
// @access  Private
const addExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, amount } = req.body;

    if (!description || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Description and amount are required'
      });
    }

    const statement = await ContainerStatement.findById(id);

    if (!statement) {
      return res.status(404).json({
        success: false,
        error: 'Statement not found',
        message: 'Container statement not found'
      });
    }

    await statement.addExpense({ description, amount });
    statement.updatedBy = req.user.id;
    await statement.save();

    res.json({
      success: true,
      data: statement,
      message: 'Expense added successfully'
    });

  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Remove expense from container statement
// @route   DELETE /api/container-statements/:id/expenses/:expenseId
// @access  Private
const removeExpense = async (req, res) => {
  try {
    const { id, expenseId } = req.params;

    const statement = await ContainerStatement.findById(id);

    if (!statement) {
      return res.status(404).json({
        success: false,
        error: 'Statement not found',
        message: 'Container statement not found'
      });
    }

    await statement.removeExpense(expenseId);
    statement.updatedBy = req.user.id;
    await statement.save();

    res.json({
      success: true,
      data: statement,
      message: 'Expense removed successfully'
    });

  } catch (error) {
    console.error('Remove expense error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get all container statements
// @route   GET /api/container-statements
// @access  Private
const getAllContainerStatements = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;

    const statements = await ContainerStatement.getAllStatements(
      parseInt(page),
      parseInt(limit),
      search
    );

    const total = await ContainerStatement.countDocuments(
      search ? { containerNo: { $regex: search, $options: 'i' } } : {}
    );

    res.json({
      success: true,
      data: statements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      message: 'Container statements retrieved successfully'
    });

  } catch (error) {
    console.error('Get all container statements error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Delete container statement
// @route   DELETE /api/container-statements/:id
// @access  Private (Admin only)
const deleteContainerStatement = async (req, res) => {
  try {
    const { id } = req.params;

    const statement = await ContainerStatement.findById(id);

    if (!statement) {
      return res.status(404).json({
        success: false,
        error: 'Statement not found',
        message: 'Container statement not found'
      });
    }

    await ContainerStatement.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Container statement deleted successfully'
    });

  } catch (error) {
    console.error('Delete container statement error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getContainerStatement,
  createContainerStatement,
  updateContainerStatement,
  addExpense,
  removeExpense,
  getAllContainerStatements,
  deleteContainerStatement,
  downloadStatementPDF: async (req, res) => {
    try {
      const { containerNo } = req.params;
      if (!containerNo) {
        return res.status(400).json({ success: false, message: 'Container number is required' });
      }

      // Reuse existing fetch/generate logic
      let statement = await ContainerStatement.getByContainerNo(containerNo);
      if (!statement) {
        const salesData = await Sales.find({ containerNo }).sort({ createdAt: 1 });
        if (salesData.length === 0) {
          return res.status(404).json({ success: false, message: `No data found for ${containerNo}` });
        }
        const products = salesData.map((sale, index) => ({
          srNo: index + 1,
          product: sale.product,
          quantity: sale.quantity,
          unitPrice: sale.rate,
          amountWithoutVAT: sale.amount - sale.vatAmount,
        }));
        const grossSale = products.reduce((s,p)=> s + p.amountWithoutVAT, 0);
        const totalQuantity = products.reduce((s,p)=> s + p.quantity, 0);
        statement = new ContainerStatement({
          containerNo,
          products,
          expenses: [],
          grossSale,
          totalExpenses: 0,
          netSale: grossSale,
          totalQuantity,
          createdBy: req.user.id
        });
      }

      const pdf = new PDFGenerator();
      pdf.generateContainerStatement(res, statement);
    } catch (error) {
      console.error('Download statement PDF error:', error);
      res.status(500).json({ success: false, message: 'Failed to generate PDF' });
    }
  }
};
