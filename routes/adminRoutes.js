const express = require('express')
const router = express.Router()
const { createSender, updateSender } = require('../controllers/adminController')
const { validateSenderUpdate } = require('../middlewares/validation/senderValidation')
const authenticateAdmin = require('../middlewares/adminAuth')

// Upload files to Google Drive
router.post('/sender/create', authenticateAdmin, createSender)
router.put('/sender/update/:id', authenticateAdmin, validateSenderUpdate, updateSender)

module.exports = router
