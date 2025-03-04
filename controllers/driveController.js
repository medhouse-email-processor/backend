const fs = require('fs')
const path = require('path')
const { google } = require('googleapis')
const { oAuth2Client } = require('../middlewares/driveAuth')
require('dotenv').config() // Load environment variables from .env
const { sendProgressUpdate } = require('../middlewares/progressTracker')

// Function to clear files inside a specified Google Drive folder
const clearDriveFolder = async (drive, folderId) => {
    try {
        const files = await drive.files.list({
            q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder'`,
            fields: 'files(id, name)',
        })

        for (const file of files.data.files) {
            await drive.files.delete({ fileId: file.id })
            // console.log(`Deleted file ${file.name} from folder ${folderId}`)
        }
    } catch (error) {
        console.error('Error clearing folder:', error)
        throw error
    }
}

// Recursively retrieves all files with paths in a directory
const getAllFilesWithStructure = (dirPath, basePath = '', arrayOfFiles = []) => {
    const files = fs.readdirSync(dirPath)

    files.forEach((file) => {
        const filePath = path.join(dirPath, file)
        const relativePath = path.join(basePath, file)

        if (fs.statSync(filePath).isDirectory()) {
            arrayOfFiles = getAllFilesWithStructure(filePath, relativePath, arrayOfFiles)
        } else if (file.endsWith('.xlsx') || file.endsWith('.xls')) {
            arrayOfFiles.push({ filePath, relativePath })
        }
    })

    return arrayOfFiles
}

// Main function to upload files to Google Drive, preserving structure
exports.uploadToDrive = async (googleUserId, mainFolderName, folderId = null) => {
    try {
        const drive = google.drive({ version: 'v3', auth: oAuth2Client })

        if (folderId) {
            await clearDriveFolder(drive, folderId)
        }

        const mainFolderPath = path.join(__dirname, '../downloads', mainFolderName)

        if (!fs.existsSync(mainFolderPath) || !fs.statSync(mainFolderPath).isDirectory()) {
            throw new Error(`The folder "${mainFolderName}" does not exist in the "downloads" directory.`)
        }

        const rootFolderId = folderId
        const fileList = getAllFilesWithStructure(mainFolderPath)
        const totalFiles = fileList.length
        let uploadedFiles = 0

        for (const { filePath, relativePath } of fileList) {
            const folderHierarchy = relativePath.split(path.sep)
            let parentFolderId = rootFolderId

            for (const folderName of folderHierarchy.slice(0, -1)) {
                parentFolderId = await ensureDriveFolder(drive, folderName, parentFolderId)
            }

            const fileMetadata = {
                name: path.basename(filePath),
                parents: parentFolderId ? [parentFolderId] : [],
            }

            const media = {
                mimeType: 'application/octet-stream',
                body: fs.createReadStream(filePath),
            }

            const response = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id',
            })

            // console.log(`File ${filePath} uploaded successfully. File ID: ${response.data.id}`)

            fs.unlinkSync(filePath)
            // console.log(`File ${filePath} deleted after upload.`)

            uploadedFiles++
            const progress = Math.floor((uploadedFiles / totalFiles) * 100)
            sendProgressUpdate(googleUserId, {
                status: `Выгрузили ${path.basename(filePath)} в Google Drive.`,
                progress: progress,
            })
        }

        fs.rmSync(mainFolderPath, { recursive: true })
        // console.log(`Folder ${mainFolderPath} deleted successfully.`)
        sendProgressUpdate(googleUserId, { status: 'Выгрузка в Google Drive завершена.', progress: 100 })

    } catch (error) {
        console.error('Error uploading files:', error)
        sendProgressUpdate(googleUserId, { status: 'Ошибка при выгрузке.', progress: 0 })
        throw error
    }
}

// Ensure a folder exists on Google Drive, or create it if it doesn't
const ensureDriveFolder = async (drive, folderName, parentId) => {
    const folderQuery = `'${parentId || 'root'}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder'`
    const folderResponse = await drive.files.list({
        q: folderQuery,
        fields: 'files(id, name)',
    })

    if (folderResponse.data.files.length > 0) {
        return folderResponse.data.files[0].id
    } else {
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : [],
        }

        const folder = await drive.files.create({
            resource: fileMetadata,
            fields: 'id',
        })

        // console.log(`Created folder ${folderName} with ID ${folder.data.id}`)
        return folder.data.id
    }
}
