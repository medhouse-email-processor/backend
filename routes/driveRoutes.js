const express = require('express')
const router = express.Router()
const { uploadToDrive } = require('../controllers/driveController')
const { authCheck, oAuth2Client, SCOPES } = require('../middlewares/driveAuth')
const UserAuth = require('../models/userAuthModel')
const { google } = require('googleapis')
require('dotenv').config()

router.get('/auth', (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    })
    res.json({ authUrl })
})

router.get('/oauth2callback', async (req, res) => {
    const code = req.query.code

    oAuth2Client.getToken(code, async (err, token) => {
        if (err) {
            return res.status(400).send('Error retrieving access token')
        }

        oAuth2Client.setCredentials(token)
        const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client })
        try {
            const { data: userInfo } = await oauth2.userinfo.get()
            const googleUserId = userInfo.id
            const expiresAt = new Date(token.expiry_date)

            await UserAuth.upsert({
                googleUserId,
                accessToken: token.access_token,
                refreshToken: token.refresh_token,
                expiresAt,
            })

            res.redirect(`${process.env.FRONTEND_URL}/?authSuccess=true&accessToken=${token.access_token}&refreshToken=${token.refresh_token}`)
        } catch (userInfoError) {
            res.status(500).send('Error retrieving user info')
        }
    })
})

router.post('/upload', authCheck, async (req, res) => {
    const { mainFolderName, folderId } = req.body

    try {
        await uploadToDrive(mainFolderName, folderId)
        res.json({ success: true, message: 'Files uploaded successfully!' })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error uploading files: ' + err.message })
    }
})

router.get('/auth/check', authCheck, (req, res) => {
    res.json({ authenticated: true })
})

module.exports = router
