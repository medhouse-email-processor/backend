const express = require('express')
const router = express.Router()
const fs = require('fs')
const { google } = require('googleapis')
const { uploadToDrive } = require('../controllers/driveController')
require('dotenv').config() // Load environment variables

// OAuth2 Client Setup
const oAuth2Client = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET,
    process.env.GDRIVE_REDIRECT_URI
)

// Token path (to store OAuth2 access token)
const TOKEN_PATH = 'config/token.json'

// Route 1: Start OAuth Authorization
router.get('/auth', (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.file'],
    })
    res.redirect(authUrl) // Redirect user to Google's OAuth2 screen
})

// Route 2: OAuth2 Callback (Handle Redirect after Authorization)
router.get('/oauth2callback', (req, res) => {
    const code = req.query.code
    oAuth2Client.getToken(code, (err, token) => {
        if (err) return res.status(400).send('Error retrieving access token')
        oAuth2Client.setCredentials(token)

        // Save token for later use
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token))
        res.send('Authentication successful! You can now upload files.')
    })
})

// Route 3: Upload Files to Google Drive
router.post('/upload', async (req, res) => {
    const { mainFolderName, folderId } = req.body // Array of file paths and optional folder ID

    if (!mainFolderName)
        return res.json({ success: false, message: 'mainFolderName not specified' })

    try {
        await uploadToDrive(mainFolderName, folderId) // Call the controller function
        res.json({ success: true, message: 'Files uploaded successfully!' })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error uploading files: ' + err.message })
    }
})

// Route 4: Check if the user is authenticated
router.get('/auth/check', (req, res) => {
    try {
        // Check if the token file exists and is valid
        if (fs.existsSync(TOKEN_PATH)) {
            const token = JSON.parse(fs.readFileSync(TOKEN_PATH))
            oAuth2Client.setCredentials(token)

            // Check if the token is still valid
            oAuth2Client.getAccessToken((err, accessToken) => {
                if (err) {
                    res.json({
                        authenticated: false, authUrl: oAuth2Client.generateAuthUrl({
                            access_type: 'offline',
                            scope: ['https://www.googleapis.com/auth/drive.file'],
                        })
                    })
                } else {
                    res.json({ authenticated: true })
                }
            })
        } else {
            // If no token, return the auth URL for login
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/drive.file'],
            })
            res.json({ authenticated: false, authUrl })
        }
    } catch (err) {
        res.status(500).json({ authenticated: false, error: err.message })
    }
})

module.exports = router
