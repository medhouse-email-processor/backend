// const bcrypt = require('bcrypt')
const dotenv = require('dotenv')

// Load .env variables
dotenv.config()

const authenticateAdmin = async (req, res, next) => {
    const { password } = req.body

    if (!password) {
        return res.status(401).json({ message: 'Требуется пароль' })
    }

    try {
        // Compare the hash of the provided password with the stored hash in .env
        const adminTokenHash = process.env.ADMIN_ACCESS_TOKEN

        // const isValid = await bcrypt.compare(password, adminTokenHash)
        const isValid = password === adminTokenHash

        if (!isValid) {
            return res.status(403).json({ message: 'Неверный пароль администратора' })
        }

        // If password is correct, proceed to the next middleware or controller
        next()
    } catch (error) {
        console.error('Error during admin authentication:', error)
        return res.status(500).json({ message: 'Серверная ошибка во время аутентификации' })
    }
}

module.exports = authenticateAdmin
