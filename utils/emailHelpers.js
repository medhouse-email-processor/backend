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
    // console.log('Подключение к IMAP серверу...')
    const client = new ImapFlow({
        host: 'pkz41.hoster.kz',
        port: 993,
        secure: true,
        tls: { rejectUnauthorized: false },
        auth: { user: process.env.HOST_EMAIL, pass: process.env.HOST_PASS },
        logger: pino,
    })

    await client.connect()
    // console.log('Подключение к IMAP серверу установлено.')
    return client
}

// Function to sanitize folder names (removes bad characters)
const cleanFolderName = (name) => {
    if (!name || typeof name !== 'string') return 'city_undefined'

    return name
        .replace(/[^a-zA-Zа-яА-Я0-9\s_-]/g, '')  // Remove special characters (like `"` and `\n`)
        .trim()  // Remove leading/trailing spaces
}

// Function to determine both city and supplier from the file buffer
exports.determineCityAndSupplier = (buffer, filename, sender) => {
    const fileType = filename.endsWith('.xls') ? 'xls' : 'xlsx'
    let cityResult = { success: false }
    let supplierResult = { success: false }

    console.log(filename)

    // Sort city names by descending length
    const sortedCityKeys = Object.keys(sender.cities).sort((a, b) => b.length - a.length)
    // console.log(sortedCityKeys)
    // Check for city
    for (let cell of sender.cellCoordinates) {
        cityResult = checkCellForCity(buffer, fileType, cell, sender.cities, sortedCityKeys)
        if (cityResult.success) break // Stop if we find a valid city
    }

    // Check for supplier (Testmed first, then Daichin)
    if (sender.testmedCoordinates) {
        const { names, coordinates } = sender.testmedCoordinates
        for (let cell of coordinates) {
            supplierResult = checkCellForSupplier(buffer, fileType, cell, names)
            if (supplierResult.success) {
                supplierResult.supplier = 'Тест-Медикал' // Set the supplier name
                break
            }
        }
    }

    if (!supplierResult.success && sender.daichinCoordinates) {
        const { names, coordinates } = sender.daichinCoordinates
        for (let cell of coordinates) {
            supplierResult = checkCellForSupplier(buffer, fileType, cell, names)
            if (supplierResult.success) {
                supplierResult.supplier = 'Дайчин' // Set the supplier name
                break
            }
        }
    }

    // Clean the folder names before using them
    const city = cityResult.success ? cleanFolderName(cityResult.city) : 'Неизвестный город'
    const supplier = supplierResult.success ? cleanFolderName(supplierResult.supplier) : 'Неизвестный поставщик'

    return { city, supplier }
}

// Проверяет наличие папки с названием компании в почтовом ящике и создает её, если она отсутствует
exports.ensureEmailFolderExists = async (client, folderName) => {
    // console.log(`Проверка наличия папки: ${folderName}`)
    const mailboxes = await client.list()

    // Проверяем, существует ли папка
    const folderExists = mailboxes.some(mailbox => mailbox.path === folderName)
    if (!folderExists) {
        // (`Создание папки: ${folderName}`)
        await client.mailboxCreate(folderName)
    }
}

// Перемещает обработанные письма из INBOX в папку компании
exports.moveEmailsToFolder = async (client, messageUids, folderName) => {
    // console.log(`Перемещение ${messageUids.length} сообщений в папку ${folderName}`)
    await client.messageMove(messageUids, folderName)
}

exports.searchEmails = async (client, emailQuery, targetDate) => {
    // console.log(`Поиск сообщений для запроса: ${emailQuery}`)

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

    // console.log(`Отправляем запрос с критериями: ${JSON.stringify(searchCriteria)}`)

    try {
        const messages = await client.search({ from, on: adjustedDate })
        // console.log(`Найдено сообщений: ${Array.isArray(messages) ? messages.length : 0}`)

        return Array.isArray(messages) ? messages : []
    } catch (error) {
        console.error('Ошибка при поиске сообщений:', error)
        return []
    }
}

const checkCellForCity = (fileContent, fileType, cell, cities, sortedCityKeys) => {
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

        if (!sortedCityKeys.length) {
            console.error("❌ Ошибка: Нет доступных городов.")
            return { success: false, message: 'Список городов пуст' }
        }

        // Convert cellValue to lowercase for case-insensitive comparison
        const cellValueLower = cellValue.toLowerCase()

        // Find all matching cities (case-insensitive)
        const foundCities = sortedCityKeys
            .filter(subCity => cellValueLower.includes(subCity.toLowerCase()))
            .map(subCity => ({ name: subCity, length: subCity.length }))

        if (!foundCities.length) {
            return { success: false, message: 'Город не найден' }
        }

        // Find the maximum length among found cities
        const maxLength = Math.max(...foundCities.map(city => city.length))

        // Get all cities with the maximum length
        const longestCities = foundCities.filter(city => city.length === maxLength)

        // Pick the last city among the longest ones
        const selectedCity = longestCities[longestCities.length - 1].name
        const foundMainCity = cities[selectedCity]

        return { success: true, city: foundMainCity }
    } catch (err) {
        console.error(`Ошибка при чтении ячейки ${cell}:`, err)
        return { success: false, message: 'Ошибка при чтении ячейки' }
    }
}

const checkCellForSupplier = (fileContent, fileType, cell, names) => {
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

        // Check if the cell value matches any of the supplier names
        const foundSupplier = names.find(name => cellValue.includes(name))
        return foundSupplier ? { success: true, supplier: foundSupplier } : { success: false, message: 'Поставщик не найден' }
    } catch (err) {
        console.error(`Ошибка при чтении ячейки ${cell}:`, err)
        return { success: false, message: 'Ошибка при чтении ячейки' }
    }
}