const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

exports.prepareDownloadFolder = (companyName, day) => {
    const mainFolderPath = path.join(__dirname, '../downloads', `${companyName}_${day}`)
    console.log(`Подготовка папки загрузки: ${mainFolderPath}`)

    if (!fs.existsSync(mainFolderPath)) {
        console.log(`Создание папки загрузки: ${mainFolderPath}`)
        fs.mkdirSync(mainFolderPath, { recursive: true })
    }

    return mainFolderPath
}

exports.createZipArchive = async (mainFolderPath, companyName, day) => {
    console.log(`Создание архива для: ${mainFolderPath}`)
    const zipDir = path.join(__dirname, '../public/downloads')

    if (!fs.existsSync(zipDir)) {
        console.log(`Создание директории для архивов: ${zipDir}`)
        fs.mkdirSync(zipDir, { recursive: true })
    }

    const zipPath = path.join(zipDir, `${companyName}_${day}.zip`)
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    archive.pipe(output)
    archive.directory(mainFolderPath, false)
    await archive.finalize()

    console.log(`Архив успешно создан: ${zipPath}`)
    return `downloads/${path.basename(zipPath)}`
}

exports.streamToBuffer = async (stream) => {
    // console.log('Преобразование потока в буфер...')
    let chunks = []

    for await (let chunk of stream) {
        chunks.push(chunk)
    }

    // console.log('Буфер успешно создан.')
    return chunks // Return an array of buffers (correct fix)
}

exports.ensureDownloadDirExists = (mainFolderPath) => {
    const downloadDir = path.join(__dirname, '..', 'downloads')
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true })
    }

    if (!fs.existsSync(mainFolderPath)) {
        fs.mkdirSync(mainFolderPath, { recursive: true })
    }
}
