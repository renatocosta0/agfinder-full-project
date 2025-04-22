const { UserWarning, User } = require('../models');
const logger = require('../utils/logger');
const warningService = require('../services/warning.service');

// Get current user warnings
const getMyWarnings = async (req, res) => {
  try {
    const { id: userId } = req.user;
    
    // Get user warnings with options
    const options = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 10,
      includeRead: req.query.includeRead === 'true',
    };
    
    const result = await warningService.getUserWarnings(userId, options);
    
    // Get user warning count
    const user = await User.findByPk(userId, {
      attributes: ['warning_count']
    });
    
    return res.status(200).json({
      status: 'success',
      data: {
        ...result,
        total_count: user.warning_count,
        unread_count: result.warnings.filter(w => !w.read).length
      }
    });
  } catch (error) {
    logger.error('Get user warnings error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching user warnings'
    });
  }
};

// Mark a warning as read
const markWarningAsRead = async (req, res) => {
  try {
    const { id: warningId } = req.params;
    const { id: userId } = req.user;
    
    // Mark warning as read (also sets is_used=true and used_at)
    await warningService.markWarningAsRead(warningId, userId);
    
    return res.status(200).json({
      status: 'success',
      message: 'Warning marked as read'
    });
  } catch (error) {
    logger.error('Mark warning as read error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error marking warning as read'
    });
  }
};

// Mark all warnings as read
const markAllWarningsAsRead = async (req, res) => {
  try {
    const { id: userId } = req.user;
    
    // Mark all warnings as read (also sets is_used=true and used_at)
    const count = await warningService.markAllWarningsAsRead(userId);
    
    return res.status(200).json({
      status: 'success',
      message: `${count} warnings marked as read`
    });
  } catch (error) {
    logger.error('Mark all warnings as read error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error marking all warnings as read'
    });
  }
};

module.exports = {
  getMyWarnings,
  markWarningAsRead,
  markAllWarningsAsRead
}; 