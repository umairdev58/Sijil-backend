const Product = require('../models/Product');
const Category = require('../models/Category');

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Admin/Employee)
const createProduct = async (req, res) => {
  try {
    const { name, description, category, sku, unit } = req.body;

    // Validate category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({
        error: 'Invalid category',
        message: 'Category does not exist'
      });
    }

    // Check if product with same name already exists
    const existingProduct = await Product.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    
    if (existingProduct) {
      return res.status(400).json({
        error: 'Product already exists',
        message: 'A product with this name already exists'
      });
    }

    // Create new product
    const newProduct = new Product({
      name,
      description,
      category,
      sku,
      unit: unit || 'piece',
      createdBy: req.user.id
    });

    await newProduct.save();
    await newProduct.populate('category', 'name');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: newProduct
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get all products with filtering and pagination
// @route   GET /api/products
// @access  Private (Admin/Employee)
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      isActive = '',
      all = 'false'
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 10, 1);
    const fetchAll = all === 'true';

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (isActive !== '') {
      query.isActive = isActive === 'true';
    }

    // Execute query with pagination
    const productQuery = Product.find(query).sort({ createdAt: -1 });
    if (!fetchAll) {
      productQuery.limit(limitNumber).skip((pageNumber - 1) * limitNumber);
    }
    const products = await productQuery
      .populate('category', 'name description')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    // Get total count
    const total = await Product.countDocuments(query);

    // Get statistics
    const stats = await Product.getStatistics();

    const currentPage = fetchAll ? 1 : pageNumber;
    const productsPerPage = fetchAll ? total : limitNumber;
    const totalPages = fetchAll
      ? 1
      : Math.max(Math.ceil(total / limitNumber), 1);

    res.json({
      success: true,
      data: products,
      pagination: {
        currentPage,
        totalPages,
        totalProducts: total,
        productsPerPage
      },
      statistics: stats
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Private (Admin/Employee)
const getProductById = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid product ID',
        message: 'Product ID must be a valid 24-character hexadecimal string'
      });
    }

    const product = await Product.findById(req.params.id)
      .populate('category', 'name description')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'Product does not exist'
      });
    }

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin/Employee)
const updateProduct = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid product ID',
        message: 'Product ID must be a valid 24-character hexadecimal string'
      });
    }

    const { name, description, category, sku, unit, isActive } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'Product does not exist'
      });
    }

    // Validate category if being changed
    if (category && category !== product.category.toString()) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({
          error: 'Invalid category',
          message: 'Category does not exist'
        });
      }
    }

    // Check if name is being changed and if it already exists
    if (name !== product.name) {
      const existingProduct = await Product.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: req.params.id }
      });
      
      if (existingProduct) {
        return res.status(400).json({
          error: 'Product already exists',
          message: 'A product with this name already exists'
        });
      }
    }

    // Update product
    product.name = name;
    if (description !== undefined) {
      product.description = description;
    }
    if (category) {
      product.category = category;
    }
    if (sku !== undefined) {
      product.sku = sku;
    }
    if (unit !== undefined) {
      product.unit = unit;
    }
    if (typeof isActive === 'boolean') {
      product.isActive = isActive;
    }
    product.updatedBy = req.user.id;

    await product.save();
    await product.populate('category', 'name description');

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Admin/Employee)
const deleteProduct = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid product ID',
        message: 'Product ID must be a valid 24-character hexadecimal string'
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'Product does not exist'
      });
    }

    // Deactivate product instead of deleting (soft delete)
    product.isActive = false;
    product.updatedBy = req.user.id;
    await product.save();

    res.json({
      success: true,
      message: 'Product deactivated successfully'
    });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Activate product
// @route   POST /api/products/:id/activate
// @access  Private (Admin/Employee)
const activateProduct = async (req, res) => {
  try {
    // Check if ID is valid ObjectId
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid product ID',
        message: 'Product ID must be a valid 24-character hexadecimal string'
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'Product does not exist'
      });
    }

    product.isActive = true;
    product.updatedBy = req.user.id;
    await product.save();

    res.json({
      success: true,
      message: 'Product activated successfully'
    });

  } catch (error) {
    console.error('Activate product error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Search products by name
// @route   GET /api/products/search/:name
// @access  Private (Admin/Employee)
const searchProductsByName = async (req, res) => {
  try {
    const { name } = req.params;
    const { limit = 10 } = req.query;

    const products = await Product.findByName(name)
      .limit(parseInt(limit))
      .populate('category', 'name')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    res.json({
      success: true,
      data: products,
      searchTerm: name
    });

  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:categoryId
// @access  Private (Admin/Employee)
const getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { isActive = '' } = req.query;

    // Validate category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
        message: 'Category does not exist'
      });
    }

    const query = { category: categoryId };
    if (isActive !== '') {
      query.isActive = isActive === 'true';
    }

    const products = await Product.find(query)
      .populate('category', 'name')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: products
    });

  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get product statistics
// @route   GET /api/products/statistics
// @access  Private (Admin/Employee)
const getProductStatistics = async (req, res) => {
  try {
    const stats = await Product.getStatistics();

    res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    console.error('Get product statistics error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  activateProduct,
  searchProductsByName,
  getProductsByCategory,
  getProductStatistics
};

