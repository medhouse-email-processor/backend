const { ImapFlow } = require('imapflow')
const fs = require('fs')
const path = require('path')
const pino = require('pino')()
const xlsx = require('xlsx')
const iconv = require('iconv-lite')
// Выполняет поиск писем от конкретного email или всех адресов определенного домена
const moment = require('moment')

require('dotenv').config()
pino.level = 'silent'

exports.connectToImap = async () => {
    console.log('Подключение к IMAP серверу...')
    const client = new ImapFlow({
        host: 'pkz41.hoster.kz',
        port: 993,
        secure: true,
        tls: { rejectUnauthorized: false },
        auth: { user: process.env.HOST_EMAIL, pass: process.env.HOST_PASS },
        logger: pino,
    })

    await client.connect()
    console.log('Подключение к IMAP серверу установлено.')
    return client
}

// Function to sanitize folder names (removes bad characters)
const cleanFolderName = (name) => {
    if (!name || typeof name !== 'string') return 'city_undefined'
    
    return name
        .replace(/[^a-zA-Zа-яА-Я0-9\s_-]/g, '')  // Remove special characters (like `"` and `\n`)
        .trim()  // Remove leading/trailing spaces
}

// Функция для определения папки города
exports.determineCityFolder = (buffer, filename, sender, mainFolderPath) => {
    let fileType = filename.endsWith('.xls') ? 'xls' : 'xlsx'
    let checkResult = { success: false }

    // Ensure sender.cities is an array before use
    let cityList = Array.isArray(sender.cities) ? sender.cities : Object.values(sender.cities)

    for (let cell of sender.cellCoordinates) {
        checkResult = checkCellForCity(buffer, fileType, cell, cityList)
        if (checkResult.success) break // Stop if we find a valid city
    }

    let city = checkResult.success ? checkResult.city : 'city_undefined'

    // Clean the folder name before using it
    city = cleanFolderName(city)

    let cityFolderPath = path.join(mainFolderPath, city)
    if (!fs.existsSync(cityFolderPath)) {
        fs.mkdirSync(cityFolderPath, { recursive: true })
    }

    return city
}

// Проверяет наличие папки с названием компании в почтовом ящике и создает её, если она отсутствует
exports.ensureEmailFolderExists = async (client, folderName) => {
    console.log(`Проверка наличия папки: ${folderName}`)
    const mailboxes = await client.list()

    // Проверяем, существует ли папка
    const folderExists = mailboxes.some(mailbox => mailbox.path === folderName)
    if (!folderExists) {
        console.log(`Создание папки: ${folderName}`)
        await client.mailboxCreate(folderName)
    }
}

// Перемещает обработанные письма из INBOX в папку компании
exports.moveEmailsToFolder = async (client, messageUids, folderName) => {
    console.log(`Перемещение ${messageUids.length} сообщений в папку ${folderName}`)
    await client.messageMove(messageUids, folderName)
}

exports.searchEmails = async (client, emailQuery, targetDate) => {
    console.log(`Поиск сообщений для запроса: ${emailQuery}`)

    // 🔥 Fix 1: Convert `targetDate` to IMAP required format "DD-MMM-YYYY"
    const adjustedDate = moment(targetDate).format('YYYY-MM-DD') // Example: "18-Feb-2025"

    let searchCriteria = []
    let from

    if (emailQuery.startsWith('@')) {
        // 🔥 Fix 2: Ensure emailQuery has "@" and is lowercase
        const domain = emailQuery.substring(1).toLowerCase().trim()
        from = `@${domain}`
    } else {
        from = emailQuery.toLowerCase().trim()
    }

    console.log(`Отправляем запрос с критериями: ${JSON.stringify(searchCriteria)}`)

    try {
        const messages = await client.search({ from, on: adjustedDate })
        console.log(`Найдено сообщений: ${Array.isArray(messages) ? messages.length : 0}`)

        return Array.isArray(messages) ? messages : []
    } catch (error) {
        console.error('Ошибка при поиске сообщений:', error)
        return []
    }
}

const checkCellForCity = (fileContent, fileType, cell, cities) => {
    try {
        let worksheet
        if (fileType === 'xls') {
            const decodedData = iconv.decode(fileContent, 'windows-1251')
            const workbook = xlsx.read(decodedData, { type: 'string' })
            worksheet = workbook.Sheets[workbook.SheetNames[0]]
        } else {
            const workbook = xlsx.read(fileContent, { type: 'buffer' })
            worksheet = workbook.Sheets[workbook.SheetNames[0]]
        }

        const cellValue = worksheet[cell] ? worksheet[cell].v : null
        if (!cellValue) return { success: false, message: 'Ячейка не найдена или пуста' }

        // 🔥 FIX: Convert cities object to an array properly
        const cityList = Array.isArray(cities) ? cities : Object.values(cities)
        if (!cityList.length) {
            console.error("❌ Ошибка: Нет доступных городов в cityList.")
            return { success: false, message: 'Список городов пуст' }
        }

        const foundCity = cityList.find(city => cellValue.includes(city))
        return foundCity ? { success: true, city: foundCity } : { success: false, message: 'Город не найден' }
    } catch (err) {
        console.error(`Ошибка при чтении ячейки ${cell}:`, err)
        return { success: false, message: 'Ошибка при чтении ячейки' }
    }
}
