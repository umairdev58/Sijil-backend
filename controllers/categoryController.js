const Category = require('../models/Category');

// @desc    Create new category
// @route   POST /api/categories
// @access  Private (Admin/Employee)
const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Check if category with same name already exists
    const existingCategory = await Category.findOne({ 
      organizationId: req.organizationId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    
    if (existingCategory) {
      return res.status(400).json({
        error: 'Category already exists',
        message: 'A category with this name already exists'
      });
    }

    // Create new category
    const newCategory = new Category({
      organizationId: req.organizationId,
      name,
      description,
      createdBy: req.user.id
    });

    await newCategory.save();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: newCategory
    });

  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get all categories with filtering and pagination
// @route   GET /api/categories
// @access  Private (Admin/Employee)
const getCategories = async (req, res) => {
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
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (isActive !== '') {
      query.isActive = isActive === 'true';
    }

    // Execute query with pagination
    const categoryQuery = Category.find(query).sort({ createdAt: -1 });
    if (!fetchAll) {
      categoryQuery.limit(limitNumber).skip((pageNumber - 1) * limitNumber);
    }
    const categories = await categoryQuery
      .populate({ path: 'createdBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name email', match: { organizationId: req.organizationId } });

    // Get total count
    const total = await Category.countDocuments(query);

    // Get statistics
    const stats = await Category.getStatistics(req.organizationId);

    const currentPage = fetchAll ? 1 : pageNumber;
    const categoriesPerPage = fetchAll ? total : limitNumber;
    const totalPages = fetchAll
      ? 1
      : Math.max(Math.ceil(total / limitNumber), 1);

    res.json({
      success: true,
      data: categories,
      pagination: {
        currentPage,
        totalPages,
        totalCategories: total,
        categoriesPerPage
      },
      statistics: stats
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get category by ID
// @route   GET /api/categories/:id
// @access  Private (Admin/Employee)
const getCategoryById = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid category ID',
        message: 'Category ID must be a valid 24-character hexadecimal string'
      });
    }

    const category = await Category.findOne({ _id: req.params.id, organizationId: req.organizationId })
      .populate({ path: 'createdBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name email', match: { organizationId: req.organizationId } });

    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
        message: 'Category does not exist'
      });
    }

    res.json({
      success: true,
      data: category
    });

  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private (Admin/Employee)
const updateCategory = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid category ID',
        message: 'Category ID must be a valid 24-character hexadecimal string'
      });
    }

    const { name, description, isActive } = req.body;

    const category = await Category.findOne({ _id: req.params.id, organizationId: req.organizationId });

    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
        message: 'Category does not exist'
      });
    }

    // Check if name is being changed and if it already exists
    if (name !== category.name) {
      const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: req.params.id },
        organizationId: req.organizationId
      });
      
      if (existingCategory) {
        return res.status(400).json({
          error: 'Category already exists',
          message: 'A category with this name already exists'
        });
      }
    }

    // Update category
    category.name = name;
    if (description !== undefined) {
      category.description = description;
    }
    if (typeof isActive === 'boolean') {
      category.isActive = isActive;
    }
    category.updatedBy = req.user.id;

    await category.save();

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (Admin/Employee)
const deleteCategory = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid category ID',
        message: 'Category ID must be a valid 24-character hexadecimal string'
      });
    }

    const category = await Category.findOne({ _id: req.params.id, organizationId: req.organizationId });

    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
        message: 'Category does not exist'
      });
    }

    // Check if category has products
    const Product = require('../models/Product');
    const productsCount = await Product.countDocuments({ category: req.params.id, organizationId: req.organizationId });
    
    if (productsCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete category',
        message: `This category has ${productsCount} product(s) associated with it. Please remove or reassign products before deleting.`
      });
    }

    // Delete category
    await Category.deleteOne({ _id: req.params.id, organizationId: req.organizationId });

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Activate category
// @route   POST /api/categories/:id/activate
// @access  Private (Admin/Employee)
const activateCategory = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid category ID',
        message: 'Category ID must be a valid 24-character hexadecimal string'
      });
    }

    const category = await Category.findOne({ _id: req.params.id, organizationId: req.organizationId });

    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
        message: 'Category does not exist'
      });
    }

    category.isActive = true;
    category.updatedBy = req.user.id;
    await category.save();

    res.json({
      success: true,
      message: 'Category activated successfully'
    });

  } catch (error) {
    console.error('Activate category error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Search categories by name
// @route   GET /api/categories/search/:name
// @access  Private (Admin/Employee)
const searchCategoriesByName = async (req, res) => {
  try {
    const { name } = req.params;
    const { limit = 10 } = req.query;

    const categories = await Category.find({ organizationId: req.organizationId, name: { $regex: name, $options: 'i' } })
      .limit(parseInt(limit))
      .populate({ path: 'createdBy', select: 'name email', match: { organizationId: req.organizationId } })
      .populate({ path: 'updatedBy', select: 'name email', match: { organizationId: req.organizationId } });

    res.json({
      success: true,
      data: categories,
      searchTerm: name
    });

  } catch (error) {
    console.error('Search categories error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get category statistics
// @route   GET /api/categories/statistics
// @access  Private (Admin/Employee)
const getCategoryStatistics = async (req, res) => {
  try {
    const stats = await Category.getStatistics(req.organizationId);

    res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    console.error('Get category statistics error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  activateCategory,
  searchCategoriesByName,
  getCategoryStatistics
};

