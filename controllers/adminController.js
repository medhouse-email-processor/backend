const Sender = require('../models/senderModel')

// Create a sender function
exports.createSender = async (req, res) => {
    const { companyName, email, cities, cellCoordinates } = req.body

    if (!companyName || !email || !cellCoordinates) {
        return res.status(400).json({ message: 'Please provide all required fields' })
    }

    try {
        // Insert the new sender into the database
        const newSender = await Sender.create({
            companyName,
            email,
            cities, // Assuming this comes as an array in the request
            cellCoordinates
        })

        return res.status(201).json({ message: 'Sender created successfully', sender: newSender })
    } catch (error) {
        console.error('Error creating sender:', error)
        return res.status(500).json({ message: 'Server error while creating sender' })
    }
}