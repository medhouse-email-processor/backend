const fs = require('fs')
const path = require('path')
const Sender = require('../models/senderModel')
const { ImapFlow } = require('imapflow')
const moment = require('moment')
const pino = require('pino')()
const { checkCellForCity } = require('./helpers')  // Moved the checkCellForCity function to a helper file

require('dotenv').config()
pino.level = 'silent'

exports.fetchAndDownloadOrders = async (req, res) => {
    const { senderId, day } = req.body

    const targetDate = moment(day, 'YYYY-MM-DD')
    if (!targetDate.isValid()) {
        return res.status(400).json({ success: false, message: 'Invalid date format, use YYYY-MM-DD.' })
    }

    try {
        ensureDownloadDirExists()

        const sender = await Sender.findByPk(senderId)
        if (!sender) {
            return res.status(404).json({ success: false, message: 'Sender not found.' })
        }

        const email = process.env.HOST_EMAIL
        const password = process.env.HOST_PASS
        const client = new ImapFlow({
            host: 'imap.mail.ru',
            port: 993,
            secure: true,
            auth: {
                user: email,
                pass: password,
            },
            logger: pino,
        })

        await client.connect()
        await client.mailboxOpen('INBOX')

        const messages = await client.search({
            from: sender.email,
            on: targetDate.toDate(),
        })

        const fetchedFiles = []
        const emailList = []

        const mainFolderName = `${sender.companyName}_${day}`
        const mainFolderPath = path.join(__dirname, '../downloads', mainFolderName)
        if (!fs.existsSync(mainFolderPath)) {
            fs.mkdirSync(mainFolderPath, { recursive: true })
        }

        const cities = sender.cities

        for (let uid of messages) {
            const message = await client.fetchOne(uid, { envelope: true, bodyStructure: true })

            const downloadAttachments = async (parts, uid) => {
                if (!parts) return []

                const downloadedFiles = []
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

                        const checkResult = checkCellForCity(buffer, fileType, 'F4', cities)
                        let cityFolderPath

                        if (checkResult.success) {
                            cityFolderPath = path.join(mainFolderPath, checkResult.city)
                            fetchedFiles.push({
                                filename: attachmentFilename,
                                city: checkResult.city
                            })
                        } else {
                            cityFolderPath = path.join(mainFolderPath, 'city_undefined')
                            fetchedFiles.push({
                                filename: attachmentFilename,
                                city: false
                            })
                        }

                        if (!fs.existsSync(cityFolderPath)) {
                            fs.mkdirSync(cityFolderPath, { recursive: true })
                        }

                        const savePath = path.join(cityFolderPath, attachmentFilename)
                        fs.writeFileSync(savePath, buffer)

                        console.log(`Downloaded attachment: ${attachmentFilename} to folder: ${checkResult.success ? checkResult.city : 'city_undefined'}`)

                        downloadedFiles.push(attachmentFilename)
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
        }
        await client.logout()

        res.json({
            success: true,
            fetchedFiles,
            mainFolderName,
            message: `Fetched and downloaded attachments for sender ${sender.email} on ${day}.`,
        })
    } catch (err) {
        console.error('Error fetching orders:', err)
        res.status(500).json({ success: false, message: 'Error fetching orders.' })
    }
}

const ensureDownloadDirExists = () => {
    const downloadDir = path.join(__dirname, '..', 'downloads')

    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir)
    } else {
        const files = fs.readdirSync(downloadDir)
        for (const file of files) {
            const filePath = path.join(downloadDir, file)

            if (fs.statSync(filePath).isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true })
            } else {
                fs.unlinkSync(filePath)
            }
        }
    }
}
