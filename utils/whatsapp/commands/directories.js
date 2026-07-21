const Customer = require('../../../models/Customer');
const Supplier = require('../../../models/Supplier');
const Product = require('../../../models/Product');
const Category = require('../../../models/Category');
const { heading, limitedList } = require('../formatter');
const { escapeRegex, cleanSearchQuery } = require('./helpers');

const partyQuery = (value) => ({
  $or: [
    { ename: { $regex: escapeRegex(value), $options: 'i' } },
    { uname: { $regex: escapeRegex(value), $options: 'i' } },
    { number: { $regex: escapeRegex(value), $options: 'i' } }
  ]
});

const formatParty = (party) => (
  `• *${party.ename}*${party.uname ? ` (${party.uname})` : ''}\n` +
  `  ${party.number || 'No phone'}${party.email ? ` | ${party.email}` : ''} | ${party.isActive ? 'Active' : 'Inactive'}`
);

const parties = async ({ entities, intent }, type) => {
  const isCustomer = type === 'customer';
  const Model = isCustomer ? Customer : Supplier;
  const nameEntity = isCustomer ? entities.customerName : entities.supplierName;
  const rawQuery = nameEntity || entities.query || '';
  const queryValue = cleanSearchQuery(rawQuery, [
    'customer', 'customers', 'supplier', 'suppliers', 'named', 'name'
  ]);

  if (intent.endsWith('.stats')) {
    const stats = await Model.getStatistics();
    return [
      heading(`${isCustomer ? 'Customer' : 'Supplier'} statistics`),
      `Total: ${stats[isCustomer ? 'totalCustomers' : 'totalSuppliers']}`,
      `Active: ${stats[isCustomer ? 'activeCustomers' : 'activeSuppliers']}`,
      `Inactive: ${stats[isCustomer ? 'inactiveCustomers' : 'inactiveSuppliers']}`
    ].join('\n');
  }

  if (!queryValue) {
    return `Please include the ${type} name or phone number.`;
  }
  const matches = await Model.find(partyQuery(queryValue)).sort({ ename: 1 }).limit(10).lean();
  if (!matches.length) return `No ${type} matching *${queryValue}* was found.`;
  const lead = matches.length > 1
    ? `${matches.length} matches found. Please use the full name if you need one record.`
    : `${isCustomer ? 'Customer' : 'Supplier'} details`;
  return `${heading(lead)}\n${limitedList(matches, formatParty)}`;
};

const products = async ({ entities, intent }) => {
  if (intent === 'products.stats') {
    const stats = await Product.getStatistics();
    return [
      heading('Product statistics'),
      `Total: ${stats.totalProducts}`,
      `Active: ${stats.activeProducts}`,
      `Inactive: ${stats.inactiveProducts}`
    ].join('\n');
  }

  const query = {};
  if (intent === 'products.by_category') {
    const categories = await Category.find({
      name: { $regex: escapeRegex(entities.category), $options: 'i' }
    }).limit(5);
    if (!categories.length) return `No category matching *${entities.category}* was found.`;
    if (categories.length > 1) {
      return `${heading('Multiple categories found')}\n${categories.map((item) => `• ${item.name}`).join('\n')}`;
    }
    query.category = categories[0]._id;
  } else if (intent === 'products.search') {
    const value = cleanSearchQuery(entities.query || entities.rawText, [
      'search', 'find', 'lookup', 'product', 'products', 'for'
    ]);
    if (!value) return 'Please include a product name or SKU.';
    query.$or = [
      { name: { $regex: escapeRegex(value), $options: 'i' } },
      { sku: { $regex: escapeRegex(value), $options: 'i' } }
    ];
  }

  const total = await Product.countDocuments(query);
  const rows = await Product.find(query).populate('category', 'name').sort({ name: 1 }).limit(entities.limit).lean();
  return `${heading('Products')}\n${limitedList(rows, (product) => (
    `• *${product.name}*${product.sku ? ` — ${product.sku}` : ''}\n` +
    `  ${product.category?.name || 'No category'} | ${product.unit} | ${product.isActive ? 'Active' : 'Inactive'}`
  ), total, entities.limit)}`;
};

const categories = async ({ entities, intent }) => {
  if (intent === 'categories.stats') {
    const [totalCategories, activeCategories, inactiveCategories] = await Promise.all([
      Category.countDocuments(),
      Category.countDocuments({ isActive: true }),
      Category.countDocuments({ isActive: false })
    ]);
    return [
      heading('Category statistics'),
      `Total: ${totalCategories}`,
      `Active: ${activeCategories}`,
      `Inactive: ${inactiveCategories}`
    ].join('\n');
  }

  const query = {};
  if (intent === 'categories.search') {
    const value = cleanSearchQuery(entities.query || entities.rawText, [
      'search', 'find', 'category', 'categories', 'for'
    ]);
    if (!value) return 'Please include a category name.';
    query.name = { $regex: escapeRegex(value), $options: 'i' };
  }
  const total = await Category.countDocuments(query);
  const rows = await Category.find(query).sort({ name: 1 }).limit(entities.limit).lean();
  return `${heading('Categories')}\n${limitedList(rows, (category) => (
    `• *${category.name}* — ${category.isActive ? 'Active' : 'Inactive'}`
  ), total, entities.limit)}`;
};

module.exports = {
  customers: (context) => parties(context, 'customer'),
  suppliers: (context) => parties(context, 'supplier'),
  products,
  categories
};
