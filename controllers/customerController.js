const Customer = require('../models/Customer');

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private (Admin/Employee)
const createCustomer = async (req, res) => {
  try {
    const { ename, uname, email, number, trn } = req.body;

    // Check if customer with same English name already exists
    const existingCustomer = await Customer.findOne({ 
      organizationId: req.organizationId,
      ename: { $regex: new RegExp(`^${ename}$`, 'i') }
    });
    
    if (existingCustomer) {
      return res.status(400).json({
        error: 'Customer already exists',
        message: 'A customer with this English name already exists'
      });
    }

    // Create new customer
    const newCustomer = new Customer({
      organizationId: req.organizationId,
      ename,
      uname,
      email,
      number,
      trn,
      createdBy: req.user.id
    });

    await newCustomer.save();

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: newCustomer
    });

  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get all customers with filtering and pagination
// @route   GET /api/customers
// @access  Private (Admin/Employee)
const getCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      isActive = '',
      all = 'false'
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 10, 1);
    const fetchAll = all === 'true';

    // Build query
    const query = { organizationId: req.organizationId };

    if (search) {
      query.$or = [
        { ename: { $regex: search, $options: 'i' } },
        { uname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { number: { $regex: search, $options: 'i' } }
      ];
    }

    if (isActive !== '') {
      query.isActive = isActive === 'true';
    }

    // Execute query with pagination
    const customerQuery = Customer.find(query).sort({ createdAt: -1 });
    if (!fetchAll) {
      customerQuery.limit(limitNumber).skip((pageNumber - 1) * limitNumber);
    }
    const customers = await customerQuery
      .populate({ path: 'createdBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name email', match: { organizationId: req.organizationId } });

    // Get total count
    const total = await Customer.countDocuments(query);

    // Get statistics
    const stats = await Customer.getStatistics(req.organizationId);

    const currentPage = fetchAll ? 1 : pageNumber;
    const customersPerPage = fetchAll ? total : limitNumber;
    const totalPages = fetchAll
      ? 1
      : Math.max(Math.ceil(total / limitNumber), 1);

    res.json({
      success: true,
      data: customers,
      pagination: {
        currentPage,
        totalPages,
        totalCustomers: total,
        customersPerPage
      },
      statistics: stats
    });

  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get customer by ID
// @route   GET /api/customers/:id
// @access  Private (Admin/Employee)
const getCustomerById = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid customer ID',
        message: 'Customer ID must be a valid 24-character hexadecimal string'
      });
    }

    const customer = await Customer.findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate({ path: 'createdBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name email', match: { organizationId: req.organizationId } });

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found',
        message: 'Customer does not exist'
      });
    }

    res.json({
      success: true,
      data: customer
    });

  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private (Admin/Employee)
const updateCustomer = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid customer ID',
        message: 'Customer ID must be a valid 24-character hexadecimal string'
      });
    }

    const { ename, uname, email, number, trn, isActive } = req.body;

    const customer = await Customer.findOne({ _id: req.params.id, organizationId: req.organizationId });

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found',
        message: 'Customer does not exist'
      });
    }

    // Check if English name is being changed and if it already exists
    if (ename !== customer.ename) {
      const existingCustomer = await Customer.findOne({ 
        ename: { $regex: new RegExp(`^${ename}$`, 'i') },
        _id: { $ne: req.params.id },
        organizationId: req.organizationId
      });
      
      if (existingCustomer) {
        return res.status(400).json({
          error: 'Customer already exists',
          message: 'A customer with this English name already exists'
        });
      }
    }

    // Update customer
    customer.ename = ename;
    customer.uname = uname;
    customer.email = email;
    customer.number = number;
    customer.trn = trn;
    if (typeof isActive === 'boolean') {
      customer.isActive = isActive;
    }
    customer.updatedBy = req.user.id;

    await customer.save();

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: customer
    });

  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Deactivate customer
// @route   DELETE /api/customers/:id
// @access  Private (Admin/Employee)
const deactivateCustomer = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid customer ID',
        message: 'Customer ID must be a valid 24-character hexadecimal string'
      });
    }

    const customer = await Customer.findOne({ _id: req.params.id, organizationId: req.organizationId });

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found',
        message: 'Customer does not exist'
      });
    }

    // Deactivate customer instead of deleting
    customer.isActive = false;
    customer.updatedBy = req.user.id;
    await customer.save();

    res.json({
      success: true,
      message: 'Customer deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate customer error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Activate customer
// @route   POST /api/customers/:id/activate
// @access  Private (Admin/Employee)
const activateCustomer = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid customer ID',
        message: 'Customer ID must be a valid 24-character hexadecimal string'
      });
    }

    const customer = await Customer.findOne({ _id: req.params.id, organizationId: req.organizationId });

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found',
        message: 'Customer does not exist'
      });
    }

    customer.isActive = true;
    customer.updatedBy = req.user.id;
    await customer.save();

    res.json({
      success: true,
      message: 'Customer activated successfully'
    });

  } catch (error) {
    console.error('Activate customer error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Search customers by name
// @route   GET /api/customers/search/:name
// @access  Private (Admin/Employee)
const searchCustomersByName = async (req, res) => {
  try {
    const { name } = req.params;
    const { limit = 10 } = req.query;

    const customers = await Customer.find({ organizationId: req.organizationId, $or: [
      { ename: { $regex: name, $options: 'i' } },
      { uname: { $regex: name, $options: 'i' } }
    ] })
      .limit(parseInt(limit))
      .populate({ path: 'createdBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name email', match: { organizationId: req.organizationId } });

    res.json({
      success: true,
      data: customers,
      searchTerm: name
    });

  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get customer statistics
// @route   GET /api/customers/statistics
// @access  Private (Admin/Employee)
const getCustomerStatistics = async (req, res) => {
  try {
    const stats = await Customer.getStatistics(req.organizationId);

    res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    console.error('Get customer statistics error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deactivateCustomer,
  activateCustomer,
  searchCustomersByName,
  getCustomerStatistics
}; 