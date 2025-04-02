const { Op } = require('sequelize')
const Sender = require('../models/senderModel')

// Create a sender function
exports.createSender = async (req, res) => {
    const { companyName, email, cities,
        cellCoordinates, daichinCoordinates, testmedCoordinates } = req.body

    if (!companyName || !email || !cellCoordinates || !daichinCoordinates || !testmedCoordinates) {
        return res.status(400).json({ message: 'Please provide all required fields' })
    }

    try {
        // Insert the new sender into the database
        const newSender = await Sender.create({
            companyName,
            email,
            cities, // Assuming this comes as an array in the request
            cellCoordinates,
            daichinCoordinates,
            testmedCoordinates
        })

        return res.status(201).json({ message: 'Sender created successfully', sender: newSender })
    } catch (error) {
        console.error('Error creating sender:', error)
        return res.status(500).json({ message: 'Server error while creating sender' })
    }
}

exports.updateSender = async (req, res) => {
    const { id } = req.params
    const {
        companyName,
        email,
        cities,
        cellCoordinates,
        daichinCoordinates,
        testmedCoordinates
    } = req.body

    try {
        // Find the existing sender
        const sender = await Sender.findByPk(id)
        if (!sender) {
            return res.status(404).json({ message: 'Sender not found' })
        }

        // Validate required fields (only if they're provided in the request)
        const updates = {}
        if (companyName !== undefined) {
            if (typeof companyName !== 'string' || companyName.trim() === '') {
                return res.status(400).json({ message: 'Company name must be a non-empty string' })
            }
            updates.companyName = companyName.trim()
        }

        if (email !== undefined) {
            if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ message: 'Invalid email format' })
            }
            // Check if email is already in use by another sender
            const emailExists = await Sender.findOne({
                where: { email, id: { [Op.ne]: id } }
            })
            if (emailExists) {
                return res.status(400).json({ message: 'Email is already in use' })
            }
            updates.email = email.trim()
        }

        if (cities !== undefined) {
            if (typeof cities !== 'string' && typeof cities !== 'object') {
                return res.status(400).json({ message: 'Cities must be a string or object' })
            }
            updates.cities = cities
        }

        if (cellCoordinates !== undefined) {
            if (!Array.isArray(cellCoordinates)) {
                return res.status(400).json({ message: 'cellCoordinates must be an array' })
            }
            updates.cellCoordinates = cellCoordinates
        }

        if (daichinCoordinates !== undefined) {
            if (!isValidSupplierObject(daichinCoordinates)) {
                return res.status(400).json({ message: 'daichinCoordinates must be an object with names and coordinates arrays' })
            }
            updates.daichinCoordinates = daichinCoordinates
        }

        if (testmedCoordinates !== undefined) {
            if (!isValidSupplierObject(testmedCoordinates)) {
                return res.status(400).json({ message: 'testmedCoordinates must be an object with names and coordinates arrays' })
            }
            updates.testmedCoordinates = testmedCoordinates
        }

        // If no valid updates provided, return early
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update' })
        }

        // Update the sender
        await sender.update(updates)

        // Fetch the updated sender to return fresh data
        const updatedSender = await Sender.findByPk(id)

        return res.status(200).json({
            message: 'Sender updated successfully',
            sender: {
                id: updatedSender.id,
                companyName: updatedSender.companyName,
                email: updatedSender.email,
                cities: updatedSender.cities,
                cellCoordinates: updatedSender.cellCoordinates,
                daichinCoordinates: updatedSender.daichinCoordinates,
                testmedCoordinates: updatedSender.testmedCoordinates
            }
        })

    } catch (error) {
        console.error('Error updating sender:', error)
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ message: 'Email must be unique' })
        }
        return res.status(500).json({ message: 'Server error while updating sender' })
    }
}

// Helper function to validate supplier objects
function isValidSupplierObject(obj) {
    return obj &&
        typeof obj === 'object' &&
        Array.isArray(obj.names) &&
        Array.isArray(obj.coordinates) &&
        obj.names.length === obj.coordinates.length
}