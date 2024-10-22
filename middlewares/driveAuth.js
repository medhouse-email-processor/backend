const fs = require('fs')
const { google } = require('googleapis')

// Token path (to store OAuth2 access token)
exports.TOKEN_PATH = 'config/token.json'

// OAuth2 Client Setup
exports.oAuth2Client = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET,
    process.env.GDRIVE_REDIRECT_URI
)

// Middleware: Check if the user is authenticated
exports.authCheck = async (req, res, next) => {
    try {
        // Use the exported TOKEN_PATH and oAuth2Client directly
        if (fs.existsSync(exports.TOKEN_PATH)) {
            const token = JSON.parse(fs.readFileSync(exports.TOKEN_PATH))
            exports.oAuth2Client.setCredentials(token)

            // Check if the token is still valid
            exports.oAuth2Client.getAccessToken((err, accessToken) => {
                if (err || !accessToken) {
                    // If token is invalid or expired, return auth URL
                    return res.status(401).json({
                        authenticated: false,
                        authUrl: exports.oAuth2Client.generateAuthUrl({
                            access_type: 'offline',
                            scope: ['https://www.googleapis.com/auth/drive.file'],
                        })
                    })
                } else {
                    // Token is valid, proceed to the next middleware/route
                    next()
                }
            })
        } else {
            // No token available, return auth URL
            const authUrl = exports.oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/drive.file'],
            })
            return res.status(401).json({ authenticated: false, authUrl })
        }
    } catch (err) {
        return res.status(500).json({ authenticated: false, error: err.message })
    }
}
