require('dotenv').config();

const mongoose = require('mongoose');

mongoose.set('autoIndex', false);

const BUSINESS_MODEL_NAMES = [
  'Sales',
  'Payment',
  'Product',
  'Category',
  'Customer',
  'Supplier',
  'Purchase',
  'LedgerEntry',
  'DailyLedger',
  'ContainerStatement',
  'TransportInvoice',
  'TransportPayment',
  'FreightInvoice',
  'FreightPayment',
  'DubaiTransportInvoice',
  'DubaiTransportPayment',
  'DubaiClearanceInvoice',
  'DubaiClearancePayment'
];

const UNIQUE_SCOPED_FIELDS = [
  ['Sales', 'invoiceNumber'],
  ['Category', 'name'],
  ['Purchase', 'containerNo'],
  ['DailyLedger', 'date'],
  ['ContainerStatement', 'containerNo'],
  ['TransportInvoice', 'invoice_number'],
  ['FreightInvoice', 'invoice_number'],
  ['DubaiTransportInvoice', 'invoice_number'],
  ['DubaiClearanceInvoice', 'invoice_number']
];

function loadModels() {
  require('../models/Organization');
  require('../models/User');
  require('../models/Counter');
  for (const name of BUSINESS_MODEL_NAMES) {
    require(`../models/${name}`);
  }
}

async function duplicateCount(collection, groupId) {
  const result = await collection.aggregate([
    { $group: { _id: groupId, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'groups' }
  ]).toArray();
  return result[0]?.groups || 0;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sijil';
  const organizationSlug = process.env.KOTIA_ORGANIZATION_SLUG || 'kotia';
  const failures = [];

  await mongoose.connect(mongoUri);
  loadModels();

  const Organization = mongoose.model('Organization');
  const organization = await Organization.collection.findOne({ slug: organizationSlug });
  if (!organization) {
    throw new Error(`Organization "${organizationSlug}" does not exist`);
  }
  if (organization.status !== 'active') {
    failures.push(`Organization: expected active status, received ${organization.status}`);
  }

  for (const name of BUSINESS_MODEL_NAMES) {
    const model = mongoose.model(name);
    const total = await model.collection.countDocuments({});
    const missing = await model.collection.countDocuments({
      $or: [
        { organizationId: { $exists: false } },
        { organizationId: null }
      ]
    });
    const wrongOrganization = await model.collection.countDocuments({
      organizationId: { $ne: organization._id }
    });
    if (missing || wrongOrganization) {
      failures.push(`${name}: ${missing} missing, ${wrongOrganization} outside Kotia`);
    }
    console.log(`${name}: ${total} total, ${missing} missing, ${wrongOrganization} outside Kotia`);

    const indexes = await model.collection.indexes();
    const globalIndexes = indexes.filter(index => (
      index.name !== '_id_' &&
      Object.keys(index.key)[0] !== 'organizationId'
    ));
    if (globalIndexes.length) {
      failures.push(`${name}: non-tenant indexes ${globalIndexes.map(index => index.name).join(', ')}`);
    }
  }

  const User = mongoose.model('User');
  const missingTenantUsers = await User.collection.countDocuments({
    role: { $ne: 'superadmin' },
    $or: [
      { organizationId: { $exists: false } },
      { organizationId: null }
    ]
  });
  const scopedSuperadmins = await User.collection.countDocuments({
    role: 'superadmin',
    organizationId: { $ne: null }
  });
  if (missingTenantUsers) failures.push(`User: ${missingTenantUsers} tenant user(s) lack organizationId`);
  if (scopedSuperadmins) failures.push(`User: ${scopedSuperadmins} superadmin(s) have organizationId`);

  const duplicateEmails = await duplicateCount(User.collection, {
    email: { $toLower: '$email' }
  });
  if (duplicateEmails) failures.push(`User: ${duplicateEmails} duplicate email group(s)`);

  for (const [modelName, field] of UNIQUE_SCOPED_FIELDS) {
    const duplicates = await duplicateCount(mongoose.model(modelName).collection, {
      organizationId: '$organizationId',
      value: `$${field}`
    });
    if (duplicates) failures.push(`${modelName}.${field}: ${duplicates} duplicate tenant group(s)`);
  }

  const Counter = mongoose.model('Counter');
  const malformedCounters = await Counter.collection.countDocuments({
    $or: [
      { organizationId: { $exists: false } },
      { organizationId: null },
      { name: { $exists: false } },
      { name: null },
      { _id: { $type: 'string' } }
    ]
  });
  const duplicateCounters = await duplicateCount(Counter.collection, {
    organizationId: '$organizationId',
    name: '$name'
  });
  if (malformedCounters) failures.push(`Counter: ${malformedCounters} legacy/malformed record(s)`);
  if (duplicateCounters) failures.push(`Counter: ${duplicateCounters} duplicate tenant counter group(s)`);

  const salesTotals = await mongoose.model('Sales').collection.aggregate([
    { $match: { organizationId: organization._id } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        amount: { $sum: '$amount' },
        received: { $sum: '$receivedAmount' },
        outstanding: { $sum: '$outstandingAmount' },
        unpaid: { $sum: { $cond: [{ $eq: ['$status', 'unpaid'] }, 1, 0] } }
      }
    }
  ]).toArray();
  console.log('Kotia sales totals:', salesTotals[0] || {
    count: 0,
    amount: 0,
    received: 0,
    outstanding: 0,
    unpaid: 0
  });

  if (failures.length) {
    throw new Error(`Kotia verification failed:\n- ${failures.join('\n- ')}`);
  }

  console.log(`Kotia verification passed for organization ${organization._id}`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
