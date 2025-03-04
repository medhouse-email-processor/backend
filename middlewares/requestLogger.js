const fs = require('fs')
const path = require('path')

const requestLogger = (req, res, next) => {
    // console.log('Вход в middleware')

    if (req.query.logs !== 'true') {
        // console.log('Пропускаем логирование, так как logs=true не установлено')
        return next()
    }

    try {
        console.log('Проверяем существование директории логов...')
        const logsDir = path.join(__dirname, '..', 'logs')
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true })
        }

        const logFilePath = path.join(logsDir, `request_${Date.now()}.log`)
        console.log(`Путь к файлу логов: ${logFilePath}`)

        const logStream = fs.createWriteStream(logFilePath, { flags: 'a' })
        console.log('Поток логов успешно создан')

        const originalLog = console.log
        const originalError = console.error

        console.log = (...args) => {
            try {
                logStream.write(`[ЛОГ] ${new Date().toISOString()} ${args.join(' ')}\n`)
            } catch (err) {
                originalError('Ошибка при записи лога:', err)
            }
            originalLog(...args)
        }

        console.error = (...args) => {
            try {
                logStream.write(`[ОШИБКА] ${new Date().toISOString()} ${args.join(' ')}\n`)
            } catch (err) {
                originalError('Ошибка при записи ошибки:', err)
            }
            originalError(...args)
        }

        res.on('finish', () => {
            console.log = originalLog
            console.error = originalError
            logStream.end()
            console.log('Поток логов успешно закрыт')
        })

        console.log('Настройка middleware завершена, вызываем next()...')
        next()
    } catch (err) {
        console.error('Ошибка в middleware requestLogger:', err)
        next() // Гарантируем продолжение запроса
    }
}

module.exports = requestLogger
