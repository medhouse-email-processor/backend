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
    const { mainFolderName, folderId: folderIdParam } = req.body
    let folderId = null

    try {
        // Check if folderIdParam is a full URL or just an ID
        if (folderIdParam) {
            folderId = folderIdParam.startsWith('https://drive.google.com/drive/folders/')
                ? folderIdParam.split('/').pop() // Extract the ID from the URL
                : folderIdParam
        }

        // Update folderId in UserAuth if it's a valid ID
        if (folderId) {
            const googleUserId = req.user.googleUserId
            await UserAuth.update({ folderId }, { where: { googleUserId } })
        }

        // Proceed with the upload using the resolved folderId
        await uploadToDrive(mainFolderName, folderId)
        res.json({ success: true, message: 'Files uploaded successfully!' })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error uploading files: ' + err.message })
    }
})

router.get('/auth/check', authCheck, (req, res) => {
    res.json({ authenticated: true })
})

router.get('/folder-id', authCheck, async (req, res) => {
    const googleUserId = req.user.googleUserId

    try {
        // Retrieve the folderId for the authenticated user
        const userAuth = await UserAuth.findOne({
            where: { googleUserId },
            attributes: ['folderId'],
        })

        if (userAuth && userAuth.folderId) {
            res.json({ success: true, folderId: userAuth.folderId })
        } else {
            res.json({ success: true, folderId: null }) // No folderId stored
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error retrieving folder ID: ' + err.message })
    }
})

module.exports = router
