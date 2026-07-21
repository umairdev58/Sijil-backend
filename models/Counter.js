const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: [true, 'Organization ID is required']
  },
  name: {
    type: String,
    required: [true, 'Counter name is required'],
    trim: true
  },
  sequence: {
    type: Number,
    default: 0,
    min: 0
  }
}, { timestamps: true });

counterSchema.index({ organizationId: 1, name: 1 }, { unique: true });

// Counter names are unique only within an organization.
counterSchema.statics.getNextSequence = async function(organizationId, name) {
  if (!organizationId) {
    throw new Error('organizationId is required to increment a counter');
  }

  const counter = await this.findOneAndUpdate(
    { organizationId, name },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return counter.sequence;
};

module.exports = mongoose.model('Counter', counterSchema);
