const xlsx = require('xlsx')
const iconv = require('iconv-lite')

exports.checkCellForCity = (fileContent, fileType, cell, cities) => {
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
