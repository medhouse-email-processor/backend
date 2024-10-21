// models/senderModel.js
const { Model, DataTypes } = require('sequelize')
const sequelize = require('../config/db') // Make sure this path is correct and sequelize is properly exported

class Sender extends Model { }

Sender.init(
    {
        companyName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        cities: {
            type: DataTypes.TEXT, // Store as a JSON string or comma-separated values
            allowNull: true,
            get() {
                const rawCities = this.getDataValue('cities')
                return rawCities ? rawCities.split(',') : []
            },
            set(citiesArray) {
                this.setDataValue('cities', citiesArray.join(',')) // Store as comma-separated
            },
        },
        cellCoordinates: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    },
    {
        sequelize, // Ensure this is the correct sequelize instance
        modelName: 'Sender',
        tableName: 'Senders',
        timestamps: true, // Automatically handles `createdAt` and `updatedAt`
    }
)

module.exports = Sender
