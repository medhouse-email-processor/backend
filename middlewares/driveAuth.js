// authController.js
const { google } = require('googleapis')
const UserAuth = require('../models/userAuthModel')
require('dotenv').config()

exports.SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.profile'
]

exports.oAuth2Client = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET,
    process.env.GDRIVE_REDIRECT_URI
)

exports.authCheck = async (req, res, next) => {
    const accessToken = req.headers.authorization?.split(' ')[1]

    if (!accessToken) {
        return res.status(401).json({ authenticated: false })
    }

    try {
        exports.oAuth2Client.setCredentials({ access_token: accessToken })

        const tokenInfo = await exports.oAuth2Client.getTokenInfo(accessToken)
        const googleUserId = tokenInfo.sub

        const userAuth = await UserAuth.findOne({ where: { googleUserId } })
        if (!userAuth || userAuth.googleUserId !== googleUserId) {
            return res.status(401).json({ authenticated: false })
        }

        req.user = { googleUserId }

        next()
    } catch (err) {
        return res.status(401).json({ authenticated: false, error: 'Invalid or expired tokens' })
    }
}
