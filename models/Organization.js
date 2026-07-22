const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true,
    maxlength: [150, 'Organization name cannot be more than 150 characters']
  },
  legalName: {
    type: String,
    trim: true,
    maxlength: [200, 'Legal name cannot be more than 200 characters'],
    default: ''
  },
  tradingName: {
    type: String,
    trim: true,
    maxlength: [200, 'Trading name cannot be more than 200 characters'],
    default: ''
  },
  slug: {
    type: String,
    required: [true, 'Organization slug is required'],
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Organization slug is invalid'],
    maxlength: [80, 'Organization slug cannot be more than 80 characters']
  },
  trn: {
    type: String,
    trim: true,
    maxlength: [30, 'TRN cannot be more than 30 characters'],
    default: ''
  },
  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address cannot be more than 500 characters'],
    default: ''
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [30, 'Phone cannot be more than 30 characters'],
    default: ''
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    maxlength: [150, 'Email cannot be more than 150 characters'],
    default: ''
  },
  website: {
    type: String,
    trim: true,
    maxlength: [300, 'Website cannot be more than 300 characters'],
    default: ''
  },
  logoUrl: {
    type: String,
    trim: true,
    maxlength: [1000, 'Logo URL cannot be more than 1000 characters'],
    default: ''
  },
  branding: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  plan: {
    type: String,
    enum: ['free', 'standard', 'enterprise'],
    default: 'standard'
  },
  seatLimit: {
    type: Number,
    min: 1,
    max: 10000,
    default: 25
  },
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active'
  }
}, {
  timestamps: true
});

organizationSchema.pre('validate', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ status: 1 });

module.exports = mongoose.model('Organization', organizationSchema);
