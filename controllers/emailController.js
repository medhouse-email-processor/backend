const fs = require('fs')
const path = require('path')
const Sender = require('../models/senderModel')
const moment = require('moment')
const pino = require('pino')()
const { sendProgressUpdate } = require('../middlewares/progressTracker')
const { connectToImap, determineCityFolder, ensureEmailFolderExists, moveEmailsToFolder } = require('../utils/emailHelpers')
const { prepareDownloadFolder, createZipArchive, streamToBuffer } = require('../utils/fileHelpers')
require('dotenv').config()

pino.level = 'silent'

// Функция для получения и загрузки заказов из электронной почты
exports.fetchAndDownloadOrders = async (req, res) => {
    console.log('Обнаружен запрос на получение электронной почты...')
    const { senderId, day, saveFolder } = req.body
    const targetDate = moment.utc(day, 'YYYY-MM-DD')

    // Проверка формата даты
    if (!targetDate.isValid()) {
        return res.status(400).json({ success: false, message: 'Неверный формат даты, используйте YYYY-MM-DD.' })
    }

    const { googleUserId } = req.user

    try {
        // Получаем отправителя из базы данных
        const sender = await Sender.findByPk(senderId)
        if (!sender) return res.status(404).json({ success: false, message: 'Отправитель не найден.' })

        // Подключение к IMAP серверу
        sendProgressUpdate(googleUserId, { status: 'Подключаемся к почтовому серверу...' })
        const client = await connectToImap()
        await client.mailboxOpen('INBOX')

        // Поиск писем от данного отправителя на указанную дату
        sendProgressUpdate(googleUserId, { status: 'Поиск сообщений...' })
        const messages = await client.search({ from: sender.email, on: targetDate.toDate() })
        sendProgressUpdate(googleUserId, { status: `Найдено ${messages.length} сообщений.` })

        // Если писем нет, завершаем выполнение
        if (messages.length === 0) {
            await client.logout()
            return res.json({ success: true, messagesNum: 0, message: 'Нет новых сообщений для обработки.' })
        }

        // Подготовка папки загрузки
        const mainFolderPath = prepareDownloadFolder(sender.companyName, day)
        const fetchedFiles = await processEmails(client, messages, sender, mainFolderPath, googleUserId)

        // Проверка и создание папки компании в почтовом ящике
        await ensureEmailFolderExists(client, sender.companyName)

        // Перемещение писем в папку компании
        await moveEmailsToFolder(client, messages, sender.companyName)

        await client.logout()

        // Создание ZIP-архива с загруженными файлами
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

// Обрабатывает список сообщений и загружает вложения
const processEmails = async (client, messages, sender, mainFolderPath, googleUserId) => {
    let fetchedFiles = []
    let processedMessages = 0

    for (let uid of messages) {
        // Получаем информацию о письме
        const message = await client.fetchOne(uid, { envelope: true, bodyStructure: true })
        const attachmentList = await downloadAttachments(client, message.bodyStructure.childNodes, uid, sender, mainFolderPath)

        fetchedFiles.push(...attachmentList)
        processedMessages++

        // Обновление статуса загрузки
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
        // Проверяем, является ли часть письма вложением Excel
        if (part.disposition === 'attachment' && part.dispositionParameters.filename.match(/\.(xlsx|xls)$/)) {
            const attachmentFilename = part.dispositionParameters.filename
            const { content } = await client.download(uid, part.part)
            const bufferChunks = await streamToBuffer(content)
            const buffer = Buffer.concat(bufferChunks)

            // Определяем правильную папку для вложения
            let cityFolderPath = determineCityFolder(buffer, attachmentFilename, sender, mainFolderPath)
            fs.writeFileSync(path.join(cityFolderPath, attachmentFilename), buffer)

            downloadedFiles.push({ filename: attachmentFilename, city: cityFolderPath.split('/').pop() })
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
