const Sender = require('../../models/senderModel')

exports.validateSenderUpdate = async (req, res, next) => {
    const { id } = req.params

    try {
        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({ message: 'Valid sender ID is required' })
        }

        const sender = await Sender.findByPk(id)
        if (!sender) {
            return res.status(404).json({ message: 'Sender not found' })
        }

        next()
    } catch (error) {
        console.error('Middleware error:', error)
        return res.status(500).json({ message: 'Server error in validation' })
    }
}