const fs = require('fs')
const path = require('path')
const Sender = require('../models/senderModel')
const moment = require('moment')
const pino = require('pino')()
const { sendProgressUpdate } = require('../middlewares/progressTracker')
const { connectToImap, determineCityAndSupplier,
    ensureEmailFolderExists, moveEmailsToFolder,
    searchEmails } = require('../utils/emailHelpers')
const { prepareDownloadFolder, createZipArchive,
    streamToBuffer, ensureDownloadDirExists } = require('../utils/fileHelpers')
require('dotenv').config()

pino.level = 'silent'

// Функция для получения и загрузки заказов из электронной почты
exports.fetchAndDownloadOrders = async (req, res) => {
    // console.log('Обнаружен запрос на получение электронной почты...')
    const { senderId, day, saveFolder } = req.body
    const targetDate = moment.utc(day, 'YYYY-MM-DD')

    if (!targetDate.isValid()) {
        return res.status(400).json({ success: false, message: 'Неверный формат даты, используйте YYYY-MM-DD.' })
    }

    const { googleUserId } = req.user

    try {
        // Получаем отправителя из базы данных
        const sender = await Sender.findByPk(senderId)
        if (!sender) return res.status(404).json({ success: false, message: 'Отправитель не найден.' })

        sendProgressUpdate(googleUserId, { status: 'Подключаемся к почтовому серверу...' })
        const client = await connectToImap()
        await client.mailboxOpen('INBOX')

        sendProgressUpdate(googleUserId, { status: 'Поиск сообщений...' })

        const isDomainSearch = sender.email.startsWith('@')
        const emailQuery = isDomainSearch ? `@${sender.email.split('@')[1]}` : sender.email
        const messages = await searchEmails(client, emailQuery, targetDate.toDate()) || []

        sendProgressUpdate(googleUserId, { status: `Найдено ${messages.length} сообщений.` })

        if (messages.length === 0) {
            await client.logout()
            return res.json({
                success: false,
                messagesNum: 0,
                message: 'Не найдено сообщений по заданному отправителю и дате.'
            })
        }

        const mainFolderPath = prepareDownloadFolder(sender.companyName, day)
        ensureDownloadDirExists(mainFolderPath) // ✅ Restore missing function

        const fetchedFiles = await processEmails(client, messages, sender, mainFolderPath, googleUserId)

        await ensureEmailFolderExists(client, sender.companyName)
        await moveEmailsToFolder(client, messages, sender.companyName) // ✅ Restored email moving

        await client.logout()

        const zipPath = await createZipArchive(mainFolderPath, sender.companyName, day)
        if (!saveFolder) fs.rmSync(mainFolderPath, { recursive: true, force: true })

        return res.json({
            success: true,
            messagesNum: messages.length,
            fetchedFiles,
            mainFolderName: path.basename(mainFolderPath),
            downloadUrl: zipPath,
            message: `Вложения для отправителя ${sender.email} на ${day} загружены, скачаны и перемещены в папку ${sender.companyName}.`,
        })

    } catch (err) {
        console.error('Ошибка при получении заказов:', err)
        res.status(500).json({ success: false, message: 'Ошибка при получении заказов.', error: err })
    }
}

const processEmails = async (client, messages, sender, mainFolderPath, googleUserId) => {
    let fetchedFiles = []
    let processedMessages = 0
    let emailList = [] // ✅ Restore missing email metadata

    for (let uid of messages) {
        const message = await client.fetchOne(uid, { envelope: true, bodyStructure: true })

        // console.log(`📩 Обрабатываем сообщение: ${message.envelope.subject} от ${message.envelope.from[0].address}`)

        const attachmentList = await downloadAttachments(
            client,
            message.bodyStructure.childNodes,
            uid,
            sender,
            mainFolderPath
        )

        fetchedFiles.push(...attachmentList)
        processedMessages++

        // ✅ Store email metadata (restored)
        emailList.push({
            emailTitle: message.envelope.subject,
            emailDate: message.envelope.date,
            emailFrom: message.envelope.from[0].address,
            attachments: attachmentList,
        })

        sendProgressUpdate(googleUserId, {
            status: `Обработано ${processedMessages}/${messages.length} сообщений.`,
            progress: Math.floor((processedMessages / messages.length) * 100),
        })
    }
    return fetchedFiles
}

// Загружает вложения из сообщений
const downloadAttachments = async (client, parts, uid, sender, mainFolderPath) => {
    if (!parts) return []
    let downloadedFiles = []

    for (const part of parts) {
        if (part.disposition === 'attachment' && part.dispositionParameters.filename.match(/\.(xlsx|xls)$/)) {
            const attachmentFilename = part.dispositionParameters.filename
            const { content } = await client.download(uid, part.part)
            const bufferChunks = await streamToBuffer(content)
            const buffer = Buffer.concat(bufferChunks)

            // Determine the city and supplier
            const { city, supplier } = determineCityAndSupplier(buffer, attachmentFilename, sender)

            // Create the folder structure: sender_date/supplier/city
            const supplierFolderPath = path.join(mainFolderPath, supplier)
            const cityFolderPath = path.join(supplierFolderPath, city)  // Changed this line

            if (!fs.existsSync(cityFolderPath)) {
                fs.mkdirSync(cityFolderPath, { recursive: true })
            }

            fs.writeFileSync(path.join(cityFolderPath, attachmentFilename), buffer)
            downloadedFiles.push({
                filename: attachmentFilename,
                supplier,
                company: sender.companyName,  // Keep this for the metadata
                city,
            })
        }
    }
    return downloadedFiles
}

// Получает список отправителей из базы данных
exports.getSenders = async (req, res) => {
    try {
        const senders = await Sender.findAll()
        res.json(senders)
    } catch (error) {
        console.error('Ошибка при получении отправителей:', error)
        res.status(500).json({ error: 'Не удалось получить отправителей' })
    }
}
