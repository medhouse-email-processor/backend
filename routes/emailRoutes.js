const express = require('express')
const router = express.Router()
const { fetchAndDownloadOrders } = require('../controllers/emailController')
const { authCheck } = require('../middlewares/driveAuth')

// Fetch and process emails
router.post('/fetch', authCheck, fetchAndDownloadOrders)

module.exports = router
