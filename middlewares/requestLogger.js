const fs = require('fs')
const path = require('path')

const requestLogger = (req, res, next) => {
    console.log('Middleware entered')
    
    if (req.query.logs !== 'true') {
        console.log('Skipping logging as logs=true is not set')
        return next()
    }

    try {
        console.log('Ensuring logs directory exists...')
        const logsDir = path.join(__dirname, '..', 'logs')
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true })
        }

        const logFilePath = path.join(logsDir, `request_${Date.now()}.log`)
        console.log(`Log file path: ${logFilePath}`)

        const logStream = fs.createWriteStream(logFilePath, { flags: 'a' })
        console.log('Log stream created successfully')

        const originalLog = console.log
        const originalError = console.error

        console.log = (...args) => {
            try {
                logStream.write(`[LOG] ${new Date().toISOString()} ${args.join(' ')}\n`)
            } catch (err) {
                originalError('Logging error:', err)
            }
            originalLog(...args)
        }
        console.error = (...args) => {
            try {
                logStream.write(`[ERROR] ${new Date().toISOString()} ${args.join(' ')}\n`)
            } catch (err) {
                originalError('Logging error:', err)
            }
            originalError(...args)
        }

        res.on('finish', () => {
            console.log = originalLog
            console.error = originalError
            logStream.end()
            console.log('Log stream closed successfully')
        })

        console.log('Middleware setup complete, calling next()...')
        next()
    } catch (err) {
        console.error('Error in requestLogger middleware:', err)
        next() // Ensure request continues
    }
}

module.exports = requestLogger
