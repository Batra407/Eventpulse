const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');

// GET / — health check
router.get('/', indexController.getRoot);

module.exports = router;
