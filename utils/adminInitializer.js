const User = require('../models/User');

const initializeAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    // Create admin user with environment variables
    const adminData = {
      name: process.env.ADMIN_NAME || 'System Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@company.com',
      password: process.env.ADMIN_PASSWORD || 'admin123456',
      role: 'admin',
      department: 'Administration',
      position: 'System Administrator',
      isActive: true
    };

    const admin = new User(adminData);
    await admin.save();

    console.log('✅ Admin user created successfully');
    console.log(`📧 Email: ${adminData.email}`);
    console.log(`🔑 Password: ${adminData.password}`);
    console.log('⚠️  Please change the admin password after first login!');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    
    // If it's a duplicate key error, admin already exists
    if (error.code === 11000) {
      console.log('Admin user already exists');
    }
  }
};

module.exports = {
  initializeAdmin
}; 