const express = require('express')
const router = express.Router()
const { fetchAndDownloadOrders } = require('../controllers/emailController')

// Fetch and process emails
router.post('/fetch', fetchAndDownloadOrders)

module.exports = router
