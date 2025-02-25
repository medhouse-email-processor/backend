const { ImapFlow } = require('imapflow')
const fs = require('fs')
const path = require('path')
const pino = require('pino')()
const xlsx = require('xlsx')
const iconv = require('iconv-lite')

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

exports.determineCityFolder = (buffer, filename, sender, mainFolderPath) => {
    console.log(`Определение папки города для файла: ${filename}`)
    let fileType = filename.endsWith('.xls') ? 'xls' : 'xlsx'
    let checkResult = { success: false };
    for (let cell of sender.cellCoordinates) {
        checkResult = checkCellForCity(buffer, fileType, cell, sender.cities);
        if (checkResult.success) break;  // Stop once a match is found
    }

    let city = checkResult.success ? checkResult.city : 'city_undefined';
    let cityFolderPath = path.join(mainFolderPath, city)

    if (!fs.existsSync(cityFolderPath)) {
        console.log(`Создание директории: ${cityFolderPath}`)
        fs.mkdirSync(cityFolderPath, { recursive: true })
    }

    console.log(`Файл будет сохранен в папке: ${cityFolderPath}`)
    return cityFolderPath
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

const checkCellForCity = (fileContent, fileType, cell, cities) => {
    try {
        let worksheet

        if (fileType === 'xls') {
            const decodedData = iconv.decode(fileContent, 'windows-1251')
            const workbook = xlsx.read(decodedData, { type: 'string' })
            const sheetName = workbook.SheetNames[0]
            worksheet = workbook.Sheets[sheetName]
        } else if (fileType === 'xlsx') {
            const workbook = xlsx.read(fileContent, { type: 'buffer' })
            const sheetName = workbook.SheetNames[0]
            worksheet = workbook.Sheets[sheetName]
        } else {
            return { success: false, message: 'Unsupported file format' }
        }

        const cellValue = worksheet[cell] ? worksheet[cell].v : null

        if (!cellValue) {
            return { success: false, message: 'Cell not found or empty', worksheet }
        }

        const foundCity = cities.find(city => cellValue.includes(city))

        if (foundCity) {
            return { success: true, city: foundCity }
        } else {
            return { success: false, message: 'No city found in the cell' }
        }
    } catch (err) {
        console.error(`Error reading cell ${cell}:`, err)
        return { success: false, message: 'Error reading the cell' }
    }
}