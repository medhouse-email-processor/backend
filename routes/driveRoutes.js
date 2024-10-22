const express = require('express')
const router = express.Router()
const fs = require('fs')
const { uploadToDrive } = require('../controllers/driveController')
const { authCheck, TOKEN_PATH, oAuth2Client } = require('../middlewares/driveAuth')
require('dotenv').config() // Load environment variables

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

        // Redirect back to the frontend's initial page after authentication
        res.redirect(`${process.env.FRONTEND_URL}/?authSuccess=true`)
    })
})

// Route 3: Upload Files to Google Drive (Protected Route with authCheck middleware)
router.post('/upload', authCheck, async (req, res) => {
    const { mainFolderName, folderId } = req.body

    if (!mainFolderName) {
        return res.json({ success: false, message: 'mainFolderName not specified' })
    }

    try {
        // Call the controller function to upload files to Google Drive
        await uploadToDrive(mainFolderName, folderId)

        // Delete the token.json file after successful upload
        if (fs.existsSync(TOKEN_PATH)) {
            fs.unlinkSync(TOKEN_PATH)
            console.log('token.json deleted after upload.')
        }

        // Respond with success
        res.json({ success: true, message: 'Files uploaded successfully and token.json deleted!' })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error uploading files: ' + err.message })
    }
})

// Route 4: Check if the user is authenticated
router.get('/auth/check', (req, res) => {
    try {
        if (fs.existsSync(TOKEN_PATH)) {
            const token = JSON.parse(fs.readFileSync(TOKEN_PATH))
            oAuth2Client.setCredentials(token)

            oAuth2Client.getAccessToken((err, accessToken) => {
                if (err || !accessToken) {
                    res.json({
                        authenticated: false,
                        authUrl: oAuth2Client.generateAuthUrl({
                            access_type: 'offline',
                            scope: ['https://www.googleapis.com/auth/drive.file'],
                        })
                    })
                } else {
                    res.json({ authenticated: true })
                }
            })
        } else {
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
