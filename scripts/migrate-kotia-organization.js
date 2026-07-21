require('dotenv').config();

const mongoose = require('mongoose');

mongoose.set('autoIndex', false);

const MODEL_NAMES = [
  'User',
  'Counter',
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

const BUSINESS_MODEL_NAMES = MODEL_NAMES.filter(
  name => name !== 'User' && name !== 'Counter'
);

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
  for (const name of MODEL_NAMES) {
    require(`../models/${name}`);
  }
}

async function findDuplicates(collection, groupId) {
  return collection.aggregate([
    { $group: { _id: groupId, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 5 }
  ]).toArray();
}

async function migrateCounters(Counter, organizationId) {
  const collection = Counter.collection;

  await collection.updateMany(
    {
      name: { $exists: true },
      $or: [{ organizationId: { $exists: false } }, { organizationId: null }]
    },
    { $set: { organizationId } }
  );

  const legacyCounters = await collection.find({
    $or: [
      { name: { $exists: false } },
      { _id: { $type: 'string' } }
    ]
  }).toArray();

  for (const legacy of legacyCounters) {
    const name = legacy.name || String(legacy._id);
    const sequence = Number.isFinite(legacy.sequence) ? legacy.sequence : 0;

    await collection.updateOne(
      { organizationId, name, _id: { $type: 'objectId' } },
      {
        $setOnInsert: {
          organizationId,
          name,
          createdAt: legacy.createdAt || new Date()
        },
        $set: { updatedAt: new Date() },
        $max: { sequence }
      },
      { upsert: true }
    );
    await collection.deleteOne({ _id: legacy._id });
  }
}

async function assertUniqueData(models) {
  const duplicateEmails = await findDuplicates(models.User.collection, {
    email: { $toLower: '$email' }
  });
  if (duplicateEmails.length) {
    throw new Error(`Duplicate user emails prevent the global unique index: ${JSON.stringify(duplicateEmails)}`);
  }

  for (const [modelName, field] of UNIQUE_SCOPED_FIELDS) {
    const duplicates = await findDuplicates(models[modelName].collection, {
      organizationId: '$organizationId',
      value: `$${field}`
    });
    if (duplicates.length) {
      throw new Error(
        `Duplicate ${modelName}.${field} values prevent the tenant unique index: ${JSON.stringify(duplicates)}`
      );
    }
  }

  const duplicateCounters = await findDuplicates(models.Counter.collection, {
    organizationId: '$organizationId',
    name: '$name'
  });
  if (duplicateCounters.length) {
    throw new Error(`Duplicate tenant counters remain: ${JSON.stringify(duplicateCounters)}`);
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sijil';
  const organizationName = process.env.KOTIA_ORGANIZATION_NAME
    || 'Kotia Fruits and Vegetables Trading LLC';
  const organizationSlug = process.env.KOTIA_ORGANIZATION_SLUG || 'kotia';

  await mongoose.connect(mongoUri);
  loadModels();

  const Organization = mongoose.model('Organization');
  const now = new Date();
  const organizationResult = await Organization.collection.findOneAndUpdate(
    { slug: organizationSlug },
    {
      $setOnInsert: {
        name: organizationName,
        legalName: organizationName,
        slug: organizationSlug,
        trn: process.env.COMPANY_TRN || '',
        status: 'active',
        createdAt: now
      },
      $set: { updatedAt: now }
    },
    { upsert: true, returnDocument: 'after' }
  );
  const organization = organizationResult.value || organizationResult;
  const organizationId = organization._id;

  const models = Object.fromEntries(
    MODEL_NAMES.map(name => [name, mongoose.model(name)])
  );

  for (const name of BUSINESS_MODEL_NAMES) {
    const beforeCount = await models[name].collection.countDocuments({});
    const result = await models[name].collection.updateMany(
      {
        $or: [
          { organizationId: { $exists: false } },
          { organizationId: null }
        ]
      },
      { $set: { organizationId } }
    );
    const afterCount = await models[name].collection.countDocuments({});
    if (beforeCount !== afterCount) {
      throw new Error(`${name}: document count changed from ${beforeCount} to ${afterCount}`);
    }
    console.log(`${name}: ${afterCount} total, assigned ${result.modifiedCount} record(s)`);
  }

  const tenantUsers = await models.User.collection.updateMany(
    {
      role: { $ne: 'superadmin' },
      $or: [
        { organizationId: { $exists: false } },
        { organizationId: null }
      ]
    },
    { $set: { organizationId } }
  );
  const superadmins = await models.User.collection.updateMany(
    { role: 'superadmin', organizationId: { $ne: null } },
    { $unset: { organizationId: '' } }
  );
  console.log(`User: assigned ${tenantUsers.modifiedCount}, cleared ${superadmins.modifiedCount} superadmin record(s)`);

  await migrateCounters(models.Counter, organizationId);
  await assertUniqueData(models);

  // Build/drop indexes only after every record is backfilled and uniqueness is verified.
  await Organization.syncIndexes();
  for (const name of MODEL_NAMES) {
    await models[name].syncIndexes();
  }

  console.log(`Kotia migration complete: ${organizationId}`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
