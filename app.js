const express = require('express')
const dotenv = require('dotenv')
const emailRoutes = require('./routes/emailRoutes')
const driveRoutes = require('./routes/driveRoutes')
const adminRoutes = require('./routes/adminRoutes')
const db = require('./config/db') // MySQL connection
const fs = require('fs')
const path = require('path')

dotenv.config()

const app = express()

// Middleware to parse JSON and URL-encoded data
// i.e. saves in req.body data of request body*
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept")
    next()
})

// Route handlers
app.use('/api/email', emailRoutes)
app.use('/api/drive', driveRoutes)
app.use('/api/admin', adminRoutes)

app.get('/', (req, res) => {
    res.send('<h1>Welcome to the Email Processor server!</h1>')
})

// Start the server
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
