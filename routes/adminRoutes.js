const express = require('express')
const router = express.Router()
const { createSender } = require('../controllers/adminController')
const authenticateAdmin = require('../middlewares/adminAuth')

// Upload files to Google Drive
router.post('/sender/create', authenticateAdmin, createSender)

module.exports = router
