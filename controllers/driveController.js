const fs = require('fs')
const path = require('path')
const { google } = require('googleapis')
require('dotenv').config() // Load environment variables from .env

// OAuth2 client setup
const oAuth2Client = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET,
    process.env.GDRIVE_REDIRECT_URI
)

// Token path (to store OAuth2 access token)
const TOKEN_PATH = 'config/token.json'

// Authenticate function: Gets the OAuth token
async function authenticate() {
    return new Promise((resolve, reject) => {
        fs.readFile(TOKEN_PATH, (err, token) => {
            if (err) return reject('Error loading token from disk, please authenticate')
            oAuth2Client.setCredentials(JSON.parse(token))
            resolve(oAuth2Client)
        })
    })
}

// Function to clear the provided Google Drive folder before upload
async function clearDriveFolder(drive, folderId) {
    try {
        const files = await drive.files.list({
            q: `'${folderId}' in parents`,
            fields: 'files(id, name)',
        })

        for (const file of files.data.files) {
            await drive.files.delete({ fileId: file.id })
            console.log(`Deleted file ${file.name} from folder ${folderId}`)
        }
    } catch (error) {
        console.error('Error clearing folder:', error)
        throw error
    }
}

// Helper function to recursively get all files and their paths in the directory
function getAllFilesWithStructure(dirPath, basePath = '', arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath)

    files.forEach((file) => {
        const filePath = path.join(dirPath, file)
        const relativePath = path.join(basePath, file)

        if (fs.statSync(filePath).isDirectory()) {
            arrayOfFiles = getAllFilesWithStructure(filePath, relativePath, arrayOfFiles) // Recursively get files in subdirectories
        } else if (file.endsWith('.xlsx') || file.endsWith('.xls')) {
            arrayOfFiles.push({ filePath, relativePath })
        }
    })

    return arrayOfFiles
}

async function uploadToDrive(mainFolderName, folderId = null) {
    try {
        const auth = await authenticate() // Ensure the user is authenticated
        const drive = google.drive({ version: 'v3', auth })

        // Clear the folder on Google Drive if folderId is provided
        if (folderId) {
            await clearDriveFolder(drive, folderId)
        }

        // Get the path of the specified main folder inside "downloads"
        const mainFolderPath = path.join(__dirname, '../downloads', mainFolderName)

        // Check if the main folder exists in the local directory
        if (!fs.existsSync(mainFolderPath) || !fs.statSync(mainFolderPath).isDirectory()) {
            throw new Error(`The folder "${mainFolderName}" does not exist in the "downloads" directory.`)
        }

        // Ensure the main folder exists in Google Drive
        let mainFolderId = await ensureDriveFolder(drive, mainFolderName, folderId)

        // Get all files from the main folder, preserving folder structure
        const fileList = getAllFilesWithStructure(mainFolderPath)

        // Create folders and upload files with structure
        for (const { filePath, relativePath } of fileList) {
            let folderIdForFile = mainFolderId

            // If the file is inside a subfolder, create corresponding subfolders on Drive
            if (relativePath.includes(path.sep)) {
                const subFolderStructure = relativePath.split(path.sep).slice(0, -1) // Get folder structure
                for (const folderName of subFolderStructure) {
                    folderIdForFile = await ensureDriveFolder(drive, folderName, folderIdForFile)
                }
            }

            const fileMetadata = {
                name: path.basename(filePath),
                parents: folderIdForFile ? [folderIdForFile] : [], // Upload to specific folder or root
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

            console.log(`File ${filePath} uploaded successfully. File ID: ${response.data.id}`)

            // Delete the file after successful upload
            fs.unlinkSync(filePath)
            console.log(`File ${filePath} deleted after upload.`)
        }

        // Delete the main folder after all files are uploaded and deleted
        fs.rmdirSync(mainFolderPath, { recursive: true })
        console.log(`Folder ${mainFolderPath} deleted successfully.`)
    } catch (error) {
        console.error('Error uploading files:', error)
        throw error
    }
}

// Helper function to ensure a folder exists in Google Drive, and create it if it doesn't
async function ensureDriveFolder(drive, folderName, parentId) {
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
            parents: parentId ? [parentId] : [], // Create under parentId or root
        }

        const folder = await drive.files.create({
            resource: fileMetadata,
            fields: 'id',
        })

        console.log(`Created folder ${folderName} with ID ${folder.data.id}`)
        return folder.data.id
    }
}

module.exports = { uploadToDrive }
