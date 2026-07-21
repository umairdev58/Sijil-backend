const User = require('../models/User');
const Organization = require('../models/Organization');

const TENANT_MODELS = [
  'Sales', 'Payment', 'Customer', 'Supplier', 'Purchase', 'Category', 'Product',
  'DailyLedger', 'LedgerEntry', 'FreightInvoice', 'FreightPayment',
  'TransportInvoice', 'TransportPayment', 'DubaiTransportInvoice',
  'DubaiTransportPayment', 'DubaiClearanceInvoice', 'DubaiClearancePayment',
  'ContainerStatement', 'Counter'
];

const initializeAdmin = async () => {
  try {
    const organizationName = process.env.KOTIA_ORGANIZATION_NAME
      || 'Kotia Fruits and Vegetables Trading LLC';
    const defaultOrganization = await Organization.findOneAndUpdate(
      { slug: process.env.KOTIA_ORGANIZATION_SLUG || 'kotia' },
      {
        $setOnInsert: {
          name: organizationName,
          legalName: organizationName,
          trn: process.env.COMPANY_TRN || '',
          status: 'active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const migration = await User.updateMany(
      {
        role: { $ne: 'superadmin' },
        $or: [
          { organizationId: null },
          { organizationId: { $exists: false } }
        ]
      },
      { $set: { organizationId: defaultOrganization._id } }
    );
    if (migration.modifiedCount > 0) {
      console.log(`Assigned ${migration.modifiedCount} legacy user(s) to the default organization`);
    }

    for (const modelName of TENANT_MODELS) {
      const Model = require(`../models/${modelName}`);
      const result = await Model.updateMany(
        {
          $or: [
            { organizationId: null },
            { organizationId: { $exists: false } }
          ]
        },
        { $set: { organizationId: defaultOrganization._id } }
      );
      if (result.modifiedCount > 0) {
        console.log(`Assigned ${result.modifiedCount} legacy ${modelName} record(s) to the default organization`);
      }
    }

    const { SUPERADMIN_NAME, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD } = process.env;
    if (!SUPERADMIN_NAME || !SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
      console.log('Superadmin initialization skipped: credentials are not fully configured');
      return;
    }

    const existingAdmin = await User.findOne({
      $or: [
        { role: 'superadmin' },
        { email: SUPERADMIN_EMAIL.toLowerCase() }
      ]
    });
    
    if (existingAdmin) {
      console.log('Superadmin user already exists');
      return;
    }

    const adminData = {
      name: SUPERADMIN_NAME,
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
      role: 'superadmin',
      organizationId: null,
      department: 'Platform',
      position: 'Platform Administrator',
      isActive: true
    };

    const admin = new User(adminData);
    await admin.save();

    console.log('✅ Superadmin user created successfully');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    
    // If it's a duplicate key error, admin already exists
    if (error.code === 11000) {
      console.log('Superadmin user already exists');
    }
  }
};

module.exports = {
  initializeAdmin
}; 