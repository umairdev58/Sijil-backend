/**
 * Required environment variables:
 * MONGODB_URI, SUPERADMIN_NAME, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 */
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');

const requiredVariables = [
  'MONGODB_URI',
  'SUPERADMIN_NAME',
  'SUPERADMIN_EMAIL',
  'SUPERADMIN_PASSWORD'
];

async function seedSuperadmin() {
  const missingVariables = requiredVariables.filter((name) => !process.env[name]);

  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const email = process.env.SUPERADMIN_EMAIL.trim().toLowerCase();
  const existingUser = await User.findOne({
    $or: [{ role: 'superadmin' }, { email }]
  });

  if (existingUser) {
    console.log(
      existingUser.role === 'superadmin'
        ? `Superadmin already exists: ${existingUser.email}`
        : `Cannot create superadmin: ${email} belongs to an existing user`
    );
    return;
  }

  const superadmin = await User.create({
    name: process.env.SUPERADMIN_NAME.trim(),
    email,
    password: process.env.SUPERADMIN_PASSWORD,
    role: 'superadmin',
    organizationId: null,
    department: 'Platform',
    position: 'Platform Administrator',
    isActive: true
  });

  console.log(`Superadmin created: ${superadmin.email}`);
}

seedSuperadmin()
  .catch((error) => {
    console.error(`Superadmin seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
