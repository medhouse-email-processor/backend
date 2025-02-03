const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const Sender = require('../models/senderModel')
const { ImapFlow } = require('imapflow')
const moment = require('moment')
const pino = require('pino')()
const { checkCellForCity } = require('./helpers')  // Moved the checkCellForCity function to a helper file
let { sendProgressUpdate } = require('../middlewares/progressTracker')

require('dotenv').config()
pino.level = 'silent'


exports.fetchAndDownloadOrders = async (req, res) => {
    console.log('Email Fetch Request detected...')
    const { senderId, day, saveFolder } = req.body
    const targetDate = moment.utc(day, 'YYYY-MM-DD')

    if (!targetDate.isValid()) {
        return res.status(400).json({ success: false, message: 'Invalid date format, use YYYY-MM-DD.' })
    }

    const { googleUserId } = req.user

    try {
        const sender = await Sender.findByPk(senderId)
        if (!sender) {
            return res.status(404).json({ success: false, message: 'Sender not found.' })
        }

        // Establish connection to the IMAP server
        sendProgressUpdate(googleUserId, { status: 'Подключаемся к серверу почтового ящика...' })

        const client = new ImapFlow({
            host: 'imap.mail.ru',
            port: 993,
            secure: true,
            tls: {
                rejectUnauthorized: false, // Try allowing self-signed certificates
            },
            auth: {
                user: process.env.HOST_EMAIL,
                pass: process.env.HOST_PASS,
            },
            logger: pino,
        })

        await client.connect()
        sendProgressUpdate(googleUserId, { status: 'Подключились. Открываем ящик...' })
        await client.mailboxOpen('INBOX')

        // Search for emails from the sender on the target date
        sendProgressUpdate(googleUserId, { status: 'Ищем сообщения...' })
        const messages = await client.search({ from: sender.email, on: targetDate.toDate() })

        // Process each email message and download attachments
        const fetchedFiles = []
        const emailList = []
        sendProgressUpdate(googleUserId, { status: `Нашли ${messages.length} сообщений.` })
        const totalMessages = messages.length
        let processedMessages = 0

        const progressInterval = () => Math.floor((processedMessages / totalMessages) * 100)

        const mainFolderName = `${sender.companyName}_${day}`
        const mainFolderPath = path.join(__dirname, '../downloads', mainFolderName)
        ensureDownloadDirExists(mainFolderPath)
        const cities = sender.cities
        const cellCoordinates = sender.cellCoordinates

        for (let uid of messages) {
            const message = await client.fetchOne(uid, { envelope: true, bodyStructure: true })

            // Loop through email parts to find and download attachments
            const downloadAttachments = async (parts, uid) => {
                if (!parts) return []
                const downloadedFiles = []
                let attachmentCount = 0
                const totalAttachments = parts.filter(part => part.disposition === 'attachment').length

                for (const part of parts) {
                    const isExcel = part.dispositionParameters?.filename.endsWith('.xlsx') || part.dispositionParameters?.filename.endsWith('.xls')
                    if (part.disposition === 'attachment' && isExcel) {
                        const attachmentFilename = part.dispositionParameters.filename
                        const { content } = await client.download(uid, part.part)

                        const chunks = []
                        for await (let chunk of content) {
                            chunks.push(chunk)
                        }
                        const buffer = Buffer.concat(chunks)
                        const fileType = attachmentFilename.endsWith('.xls') ? 'xls' : 'xlsx'

                        // Iterate through cellCoordinates until a city is found
                        let checkResult = { success: false }
                        for (let cell of cellCoordinates) {
                            checkResult = checkCellForCity(buffer, fileType, cell, cities)
                            if (checkResult.success) break
                        }

                        // Determine the correct folder based on city detection result
                        let cityFolderPath = checkResult.success ? path.join(mainFolderPath, checkResult.city) : path.join(mainFolderPath, 'city_undefined')

                        fetchedFiles.push({ filename: attachmentFilename, city: checkResult.success ? checkResult.city : false })

                        if (!fs.existsSync(cityFolderPath)) {
                            fs.mkdirSync(cityFolderPath, { recursive: true })
                        }

                        // Save the downloaded attachment to the appropriate folder
                        const savePath = path.join(cityFolderPath, attachmentFilename)
                        fs.writeFileSync(savePath, buffer)
                        downloadedFiles.push(attachmentFilename)

                        // Increment and send progress update
                        attachmentCount++
                        const attachmentProgress = Math.floor(((processedMessages + (attachmentCount / totalAttachments)) / totalMessages) * 100)
                        sendProgressUpdate(googleUserId, {
                            status: `Загрузили прикрепление ${attachmentFilename} из сообщения ${uid}.`,
                            progress: attachmentProgress
                        })
                    }
                }
                return downloadedFiles
            }

            const attachmentList = await downloadAttachments(message.bodyStructure.childNodes, uid)
            emailList.push({
                emailTitle: message.envelope.subject,
                emailDate: message.envelope.date,
                emailFrom: message.envelope.from[0].address,
                emailTo: message.envelope.to.map((recipient) => recipient.address).join(', '),
                attachments: attachmentList,
            })
            processedMessages++
            sendProgressUpdate(googleUserId, { status: `Загрузили ${attachmentList.length} прикреплений из сообщения ${uid}.`, progress: progressInterval() })
        }

        await client.logout()

        // Create a ZIP archive of downloaded files
        sendProgressUpdate(googleUserId, { status: 'Процесс завершен.', downloadUrl: `downloads/${mainFolderName}.zip`, progress: progressInterval() })

        const downloadsDir = path.join(__dirname, '../public/downloads')
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true })
        }

        const zipPath = path.join(downloadsDir, `${mainFolderName}.zip`)
        const output = fs.createWriteStream(zipPath)
        const archive = archiver('zip', { zlib: { level: 9 } })

        output.on('close', () => console.log(`Archive created: ${archive.pointer()} bytes`))
        archive.on('error', (err) => console.error('Error creating archive:', err))

        archive.pipe(output)
        archive.directory(mainFolderPath, false)
        await archive.finalize()

        // Clean up downloaded files if saveFolder is not set
        if (!saveFolder) {
            fs.rmSync(mainFolderPath, { recursive: true, force: true })
            console.log(`Deleted folder: ${mainFolderPath}`)
        }

        return res.json({
            success: true,
            messagesNum: messages.length,
            fetchedFiles,
            mainFolderName,
            downloadUrl: `downloads/${mainFolderName}.zip`,
            message: `Fetched and downloaded attachments for sender ${sender.email} on ${day}.`,
        })
    } catch (err) {
        console.error('Error fetching orders:', err)
        let message = 'Error fetching orders.'
        if (err?.code === 'ECONNREFUSED') {
            message = 'mail.ru not responding. Please, try later.'
        }
        res.status(500).json({ success: false, message })
    }
}

const ensureDownloadDirExists = (mainFolderPath) => {
    const downloadDir = path.join(__dirname, '..', 'downloads')
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir)
    }

    // Clear only the specific folder (mainFolderName)
    if (fs.existsSync(mainFolderPath)) {
        const files = fs.readdirSync(mainFolderPath)
        for (const file of files) {
            const filePath = path.join(mainFolderPath, file)
            if (fs.statSync(filePath).isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true })
            } else {
                fs.unlinkSync(filePath)
            }
        }
    } else {
        // If the folder doesn't exist, create it
        fs.mkdirSync(mainFolderPath, { recursive: true })
    }
}

exports.getSenders = async (req, res) => {
    try {
        const senders = await Sender.findAll()
        return res.json(senders)
    } catch (error) {
        console.error('Error fetching senders:', error)
        res.status(500).json({ error: 'Failed to fetch senders' })
    }
}