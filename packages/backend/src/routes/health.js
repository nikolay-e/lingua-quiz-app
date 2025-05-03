const express = require('express');

const { healthService } = require('../services');

const router = express.Router();

// GET /health - Health check endpoint
router.get('/', async (req, res, next) => {
  try {
    const healthStatus = await healthService.checkHealth();
    res.status(200).json(healthStatus);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
