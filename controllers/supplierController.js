const Supplier = require('../models/Supplier');

// @desc    Create new supplier
// @route   POST /api/suppliers
// @access  Private (Admin/Employee)
const createSupplier = async (req, res) => {
  try {
    const { ename, uname, email, number, marka } = req.body;

    // Check if supplier with same English name already exists
    const existing = await Supplier.findOne({
      ename: { $regex: new RegExp(`^${ename}$`, 'i') }
    });
    if (existing) {
      return res.status(400).json({
        error: 'Supplier already exists',
        message: 'A supplier with this English name already exists'
      });
    }

    const supplier = new Supplier({
      ename, uname, email, number, marka,
      createdBy: req.user.id
    });
    await supplier.save();
    res.status(201).json({ success: true, message: 'Supplier created successfully', supplier });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// @desc    Get suppliers (with paging/search/status)
// @route   GET /api/suppliers
// @access  Private
const getSuppliers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', isActive = '' } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { ename: { $regex: search, $options: 'i' } },
        { uname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { number: { $regex: search, $options: 'i' } },
        { marka: { $regex: search, $options: 'i' } },
      ];
    }
    if (isActive !== '') query.isActive = isActive === 'true';

    const suppliers = await Supplier.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    const total = await Supplier.countDocuments(query);
    const stats = await Supplier.getStatistics();
    res.json({
      success: true,
      data: suppliers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalSuppliers: total,
        suppliersPerPage: parseInt(limit)
      },
      statistics: stats
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// @desc    Get supplier by id
const getSupplierById = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid supplier ID', message: 'Invalid id' });
    }
    const supplier = await Supplier.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ success: true, supplier });
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// @desc    Update supplier
const updateSupplier = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid supplier ID', message: 'Invalid id' });
    }
    const { ename, uname, email, number, isActive, marka } = req.body;
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    if (ename !== supplier.ename) {
      const existing = await Supplier.findOne({ ename: { $regex: new RegExp(`^${ename}$`, 'i') }, _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ error: 'Supplier already exists' });
    }

    supplier.ename = ename;
    supplier.uname = uname;
    supplier.email = email;
    supplier.number = number;
    supplier.marka = marka;
    if (typeof isActive === 'boolean') supplier.isActive = isActive;
    supplier.updatedBy = req.user.id;
    await supplier.save();
    res.json({ success: true, message: 'Supplier updated successfully', supplier });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// @desc    Deactivate supplier
const deactivateSupplier = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid supplier ID' });
    }
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    supplier.isActive = false;
    supplier.updatedBy = req.user.id;
    await supplier.save();
    res.json({ success: true, message: 'Supplier deactivated successfully' });
  } catch (error) {
    console.error('Deactivate supplier error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// @desc    Activate supplier
const activateSupplier = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid supplier ID' });
    }
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    supplier.isActive = true;
    supplier.updatedBy = req.user.id;
    await supplier.save();
    res.json({ success: true, message: 'Supplier activated successfully' });
  } catch (error) {
    console.error('Activate supplier error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// @desc    Search suppliers by name
const searchSuppliersByName = async (req, res) => {
  try {
    const { name } = req.params;
    const { limit = 10 } = req.query;
    const suppliers = await Supplier.findByName(name)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    res.json({ success: true, suppliers, searchTerm: name });
  } catch (error) {
    console.error('Search suppliers error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

// @desc    Get supplier statistics
const getSupplierStatistics = async (req, res) => {
  try {
    const stats = await Supplier.getStatistics();
    res.json({ success: true, statistics: stats });
  } catch (error) {
    console.error('Get supplier statistics error:', error);
    res.status(500).json({ error: 'Server error', message: 'Internal server error' });
  }
};

module.exports = {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deactivateSupplier,
  activateSupplier,
  searchSuppliersByName,
  getSupplierStatistics,
};

