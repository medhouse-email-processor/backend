const express = require('express')
const router = express.Router()
const { fetchAndDownloadOrders, getSenders } = require('../controllers/emailController')
const { authCheck } = require('../middlewares/driveAuth')

// Fetch and process emails
router.post('/fetch', authCheck, fetchAndDownloadOrders)
router.get('/senders', getSenders)

module.exports = router
