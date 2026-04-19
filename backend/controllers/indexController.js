const path = require('path');

/**
 * @desc    Serve the frontend home page
 * @route   GET /
 * @access  Public
 */
const getRoot = (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
};


module.exports = { getRoot };
