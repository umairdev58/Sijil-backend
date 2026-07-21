const Organization = require('../models/Organization');
const User = require('../models/User');

const ORGANIZATION_FIELDS = [
  'name', 'slug', 'legalName', 'tradingName', 'trn', 'address',
  'phone', 'email', 'website', 'logoUrl', 'branding', 'status'
];

const pickOrganizationFields = (body) => ORGANIZATION_FIELDS.reduce((result, field) => {
  if (body[field] !== undefined) result[field] = body[field];
  return result;
}, {});

const createOrganization = async (req, res) => {
  let organization;
  try {
    const admin = req.body.admin || {
      name: req.body.adminName,
      email: req.body.adminEmail,
      password: req.body.adminPassword
    };
    if (!admin?.name || !admin?.email || !admin?.password) {
      return res.status(400).json({
        error: 'First administrator required',
        message: 'adminName, adminEmail and adminPassword are required'
      });
    }

    const existingUser = await User.findOne({ email: admin.email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    organization = await Organization.create(pickOrganizationFields(req.body));
    const firstAdmin = await User.create({
      organizationId: organization._id,
      name: admin.name,
      email: admin.email,
      password: admin.password,
      department: admin.department || 'Administration',
      position: admin.position || 'Organization Administrator',
      role: 'admin',
      isActive: true,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      organization,
      admin: firstAdmin
    });
  } catch (error) {
    if (organization?._id) {
      await Organization.deleteOne({ _id: organization._id }).catch(() => {});
    }
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Organization or email already exists' });
    }
    console.error('Create organization error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getOrganizations = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '' } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;

    const organizations = await Organization.find(query)
      .sort({ createdAt: -1 })
      .skip((Math.max(Number(page), 1) - 1) * Math.max(Number(limit), 1))
      .limit(Math.max(Number(limit), 1));
    const total = await Organization.countDocuments(query);

    res.json({
      success: true,
      data: organizations,
      pagination: { page: Number(page), limit: Number(limit), total }
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getOrganization = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    const users = await User.countDocuments({ organizationId: organization._id });
    res.json({ success: true, data: { ...organization.toObject(), users } });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateOrganization = async (req, res) => {
  try {
    const organization = await Organization.findByIdAndUpdate(
      req.params.id,
      pickOrganizationFields(req.body),
      { new: true, runValidators: true }
    );
    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    res.json({ success: true, data: organization });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: 'Organization slug already exists' });
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const setOrganizationStatus = async (req, res) => {
  try {
    if (!['active', 'suspended'].includes(req.body.status)) {
      return res.status(400).json({ error: 'status must be active or suspended' });
    }
    const organization = await Organization.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    res.json({ success: true, data: organization });
  } catch (error) {
    console.error('Set organization status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteOrganization = async (req, res) => {
  try {
    const organization = await Organization.findByIdAndUpdate(
      req.params.id,
      { status: 'suspended' },
      { new: true }
    );
    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    res.json({ success: true, message: 'Organization deactivated', data: organization });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createOrganization,
  getOrganizations,
  getOrganization,
  updateOrganization,
  setOrganizationStatus,
  deleteOrganization,
  pickOrganizationFields
};
