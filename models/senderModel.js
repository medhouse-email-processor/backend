const { Model, DataTypes } = require('sequelize')
const sequelize = require('../config/db')

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
                return rawCities ? rawCities.split(',').map(city => city.trim()) : []
            },
            set(citiesArray) {
                this.setDataValue('cities', citiesArray.join(',')) // Store as comma-separated
            },
        },
        cellCoordinates: {
            type: DataTypes.TEXT, // Store as a JSON string or comma-separated values
            allowNull: false,
            get() {
                const rawCoordinates = this.getDataValue('cellCoordinates')
                return rawCoordinates ? rawCoordinates.split(',').map(cell => cell.trim()) : []
            },
            set(coordinatesArray) {
                this.setDataValue('cellCoordinates', coordinatesArray.join(','))
            },
        },
    },
    {
        sequelize,
        modelName: 'Sender',
        tableName: 'Senders',
        timestamps: true,
    }
)

module.exports = Sender