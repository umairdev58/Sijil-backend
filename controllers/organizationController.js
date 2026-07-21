const Organization = require('../models/Organization');
const { pickOrganizationFields } = require('./platformController');

const getOwnOrganization = async (req, res) => {
  try {
    const organization = await Organization.findById(req.organizationId);
    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    res.json({ success: true, data: organization });
  } catch (error) {
    console.error('Get own organization error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateOwnOrganization = async (req, res) => {
  try {
    const updates = pickOrganizationFields(req.body);
    delete updates.slug;
    delete updates.status;
    delete updates.status;
    const organization = await Organization.findOneAndUpdate(
      { _id: req.organizationId, status: 'active' },
      updates,
      { new: true, runValidators: true }
    );
    if (!organization) return res.status(404).json({ error: 'Organization not found' });
    req.organization = organization;
    res.json({ success: true, data: organization });
  } catch (error) {
    console.error('Update own organization error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getOwnOrganization, updateOwnOrganization };
