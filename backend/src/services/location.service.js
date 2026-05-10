const { UserLocationHistory } = require('../models');

async function recordUserLocation(userId, { lat, lng, accuracy = null, source = null, recordedAt = null }) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error('Invalid coordinates');
  }

  const entry = await UserLocationHistory.create({
    user_id: userId,
    latitude: lat,
    longitude: lng,
    accuracy: accuracy ?? null,
    source: source ?? null,
    recorded_at: recordedAt ? new Date(recordedAt) : new Date(),
  });

  return entry.toJSON();
}

async function getUserLocationHistory(userId, { from = null, to = null, page = 1, limit = 50 } = {}) {
  const { Op } = require('sequelize');

  const where = { user_id: userId };
  if (from || to) {
    where.recorded_at = {};
    if (from) where.recorded_at[Op.gte] = new Date(from);
    if (to) where.recorded_at[Op.lte] = new Date(to);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const { rows, count } = await UserLocationHistory.findAndCountAll({
    where,
    order: [['recorded_at', 'DESC']],
    limit: limitNum,
    offset,
  });

  return {
    locations: rows.map(r => r.toJSON()),
    pagination: {
      total: count,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(count / limitNum) || 1,
      hasMore: offset + rows.length < count,
    },
  };
}

module.exports = { recordUserLocation, getUserLocationHistory };
