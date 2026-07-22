const Organization = require('../models/Organization');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { writeAuditLog } = require('../utils/auditLogger');
const { generateToken } = require('../utils/token');

const ORGANIZATION_FIELDS = [
  'name', 'slug', 'legalName', 'tradingName', 'trn', 'address',
  'phone', 'email', 'website', 'logoUrl', 'branding', 'status',
  'plan', 'seatLimit'
];

const pickOrganizationFields = (body) => ORGANIZATION_FIELDS.reduce((result, field) => {
  if (body[field] !== undefined) result[field] = body[field];
  return result;
}, {});

const toPublicUser = (user) => ({
  id: user._id,
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  position: user.position,
  isActive: user.isActive,
  organizationId: user.organizationId,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

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

    await writeAuditLog({
      req,
      action: 'organization.create',
      resourceType: 'organization',
      resourceId: organization._id,
      organizationId: organization._id,
      metadata: { name: organization.name, adminEmail: firstAdmin.email }
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
    const { page = 1, limit = 20, search = '', status = '', plan = '' } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;
    if (plan) query.plan = plan;

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

    const [users, activeUsers, admins, lastUserLogin] = await Promise.all([
      User.countDocuments({ organizationId: organization._id }),
      User.countDocuments({ organizationId: organization._id, isActive: true }),
      User.countDocuments({ organizationId: organization._id, role: 'admin' }),
      User.findOne({ organizationId: organization._id, lastLogin: { $ne: null } })
        .sort({ lastLogin: -1 })
        .select('lastLogin name email')
    ]);

    res.json({
      success: true,
      data: {
        ...organization.toObject(),
        users,
        activeUsers,
        admins,
        lastActivity: lastUserLogin?.lastLogin || organization.updatedAt,
        lastActiveUser: lastUserLogin
          ? { name: lastUserLogin.name, email: lastUserLogin.email, lastLogin: lastUserLogin.lastLogin }
          : null
      }
    });
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

    await writeAuditLog({
      req,
      action: 'organization.update',
      resourceType: 'organization',
      resourceId: organization._id,
      organizationId: organization._id,
      metadata: pickOrganizationFields(req.body)
    });

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

    await writeAuditLog({
      req,
      action: req.body.status === 'active' ? 'organization.reactivate' : 'organization.suspend',
      resourceType: 'organization',
      resourceId: organization._id,
      organizationId: organization._id,
      metadata: { status: organization.status }
    });

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

    await writeAuditLog({
      req,
      action: 'organization.suspend',
      resourceType: 'organization',
      resourceId: organization._id,
      organizationId: organization._id,
      metadata: { via: 'delete' }
    });

    res.json({ success: true, message: 'Organization deactivated', data: organization });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const [
      totalOrganizations,
      activeOrganizations,
      suspendedOrganizations,
      totalUsers,
      activeUsers,
      superadmins,
      recentOrganizations,
      recentUsers,
      planBreakdown
    ] = await Promise.all([
      Organization.countDocuments(),
      Organization.countDocuments({ status: 'active' }),
      Organization.countDocuments({ status: 'suspended' }),
      User.countDocuments({ role: { $ne: 'superadmin' } }),
      User.countDocuments({ role: { $ne: 'superadmin' }, isActive: true }),
      User.countDocuments({ role: 'superadmin' }),
      Organization.find().sort({ createdAt: -1 }).limit(5).select('name slug status plan createdAt'),
      User.find({ role: { $ne: 'superadmin' } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email role organizationId createdAt isActive')
        .populate('organizationId', 'name slug'),
      Organization.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totals: {
          organizations: totalOrganizations,
          activeOrganizations,
          suspendedOrganizations,
          users: totalUsers,
          activeUsers,
          superadmins
        },
        planBreakdown: planBreakdown.reduce((acc, row) => {
          acc[row._id || 'standard'] = row.count;
          return acc;
        }, {}),
        recentOrganizations,
        recentUsers
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const listOrganizationUsers = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) return res.status(404).json({ error: 'Organization not found' });

    const { page = 1, limit = 20, search = '', role = '', status = '' } = req.query;
    const query = { organizationId: organization._id };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) query.role = role;
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((Math.max(Number(page), 1) - 1) * Math.max(Number(limit), 1))
      .limit(Math.max(Number(limit), 1));
    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users.map(toPublicUser),
      pagination: { page: Number(page), limit: Number(limit), total }
    });
  } catch (error) {
    console.error('List organization users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const createOrganizationUser = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) return res.status(404).json({ error: 'Organization not found' });

    const { name, email, password, department = '', position = '', role = 'admin' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    if (!['admin', 'employee'].includes(role)) {
      return res.status(400).json({ error: 'role must be admin or employee' });
    }

    const seatCount = await User.countDocuments({ organizationId: organization._id, isActive: true });
    if (organization.seatLimit && seatCount >= organization.seatLimit) {
      return res.status(400).json({
        error: 'Seat limit reached',
        message: `This organization is limited to ${organization.seatLimit} active users`
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const user = await User.create({
      organizationId: organization._id,
      name,
      email,
      password,
      department,
      position,
      role,
      isActive: true,
      createdBy: req.user._id
    });

    await writeAuditLog({
      req,
      action: 'user.create',
      resourceType: 'user',
      resourceId: user._id,
      organizationId: organization._id,
      metadata: { email: user.email, role: user.role }
    });

    res.status(201).json({ success: true, data: toPublicUser(user) });
  } catch (error) {
    console.error('Create organization user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateOrganizationUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.userId,
      organizationId: req.params.id,
      role: { $in: ['admin', 'employee'] }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, email, department, position, role, isActive } = req.body;
    if (email && email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) return res.status(400).json({ error: 'Email already exists' });
      user.email = email;
    }
    if (name !== undefined) user.name = name;
    if (department !== undefined) user.department = department;
    if (position !== undefined) user.position = position;
    if (role && ['admin', 'employee'].includes(role)) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    await user.save();

    await writeAuditLog({
      req,
      action: 'user.update',
      resourceType: 'user',
      resourceId: user._id,
      organizationId: user.organizationId,
      metadata: { email: user.email, role: user.role, isActive: user.isActive }
    });

    res.json({ success: true, data: toPublicUser(user) });
  } catch (error) {
    console.error('Update organization user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const setOrganizationUserActive = async (req, res) => {
  try {
    const isActive = Boolean(req.body.isActive);
    const user = await User.findOne({
      _id: req.params.userId,
      organizationId: req.params.id,
      role: { $in: ['admin', 'employee'] }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.isActive = isActive;
    await user.save();

    await writeAuditLog({
      req,
      action: isActive ? 'user.activate' : 'user.deactivate',
      resourceType: 'user',
      resourceId: user._id,
      organizationId: user.organizationId,
      metadata: { email: user.email }
    });

    res.json({ success: true, data: toPublicUser(user) });
  } catch (error) {
    console.error('Set organization user active error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const resetOrganizationUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'newPassword must be at least 6 characters' });
    }

    const user = await User.findOne({
      _id: req.params.userId,
      organizationId: req.params.id,
      role: { $in: ['admin', 'employee'] }
    }).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.password = newPassword;
    await user.save();

    await writeAuditLog({
      req,
      action: 'user.reset_password',
      resourceType: 'user',
      resourceId: user._id,
      organizationId: user.organizationId,
      metadata: { email: user.email }
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset organization user password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const impersonateOrganizationUser = async (req, res) => {
  try {
    const organization = await Organization.findById(req.params.id);
    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    if (organization.status !== 'active') {
      return res.status(400).json({ error: 'Cannot impersonate users in a suspended organization' });
    }

    const user = await User.findOne({
      _id: req.params.userId,
      organizationId: organization._id,
      role: { $in: ['admin', 'employee'] }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.isActive) {
      return res.status(400).json({ error: 'Cannot impersonate an inactive user' });
    }

    const token = generateToken(user._id, { impersonatedBy: req.user._id });
    const appUrl = (process.env.TENANT_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

    await writeAuditLog({
      req,
      action: 'user.impersonate',
      resourceType: 'user',
      resourceId: user._id,
      organizationId: organization._id,
      metadata: { email: user.email, role: user.role }
    });

    res.json({
      success: true,
      token,
      user: toPublicUser(user),
      organization,
      redirectUrl: `${appUrl}/impersonate?token=${encodeURIComponent(token)}`
    });
  } catch (error) {
    console.error('Impersonate organization user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const listSuperadmins = async (req, res) => {
  try {
    const users = await User.find({ role: 'superadmin' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: users.map(toPublicUser) });
  } catch (error) {
    console.error('List superadmins error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const createSuperadmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const user = await User.create({
      name,
      email,
      password,
      role: 'superadmin',
      organizationId: null,
      department: 'Platform',
      position: 'Platform Administrator',
      isActive: true,
      createdBy: req.user._id
    });

    await writeAuditLog({
      req,
      action: 'superadmin.create',
      resourceType: 'superadmin',
      resourceId: user._id,
      metadata: { email: user.email }
    });

    res.status(201).json({ success: true, data: toPublicUser(user) });
  } catch (error) {
    console.error('Create superadmin error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const setSuperadminActive = async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ error: 'You cannot change your own active status' });
    }

    const user = await User.findOne({ _id: req.params.id, role: 'superadmin' });
    if (!user) return res.status(404).json({ error: 'Superadmin not found' });

    const isActive = Boolean(req.body.isActive);
    if (!isActive) {
      const activeCount = await User.countDocuments({ role: 'superadmin', isActive: true });
      if (activeCount <= 1) {
        return res.status(400).json({ error: 'At least one active superadmin is required' });
      }
    }

    user.isActive = isActive;
    await user.save();

    await writeAuditLog({
      req,
      action: isActive ? 'superadmin.activate' : 'superadmin.deactivate',
      resourceType: 'superadmin',
      resourceId: user._id,
      metadata: { email: user.email }
    });

    res.json({ success: true, data: toPublicUser(user) });
  } catch (error) {
    console.error('Set superadmin active error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const listAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      action = '',
      resourceType = '',
      organizationId = '',
      search = ''
    } = req.query;

    const query = {};
    if (action) query.action = action;
    if (resourceType) query.resourceType = resourceType;
    if (organizationId) query.organizationId = organizationId;
    if (search) {
      query.$or = [
        { actorEmail: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { resourceId: { $regex: search, $options: 'i' } }
      ];
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((Math.max(Number(page), 1) - 1) * Math.max(Number(limit), 1))
      .limit(Math.max(Number(limit), 1))
      .populate('organizationId', 'name slug');
    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: { page: Number(page), limit: Number(limit), total }
    });
  } catch (error) {
    console.error('List audit logs error:', error);
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
  pickOrganizationFields,
  getDashboardStats,
  listOrganizationUsers,
  createOrganizationUser,
  updateOrganizationUser,
  setOrganizationUserActive,
  resetOrganizationUserPassword,
  impersonateOrganizationUser,
  listSuperadmins,
  createSuperadmin,
  setSuperadminActive,
  listAuditLogs
};
