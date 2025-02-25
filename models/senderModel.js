const { Model, DataTypes } = require('sequelize')
const sequelize = require('../config/db')

class Sender extends Model {
    /**
     * Parses the 'cities' field and ensures it's returned as a valid object.
     */
    getCityRelations() {
        try {
            const rawCities = this.getDataValue('cities')
            if (!rawCities) return {} // Prevents returning NULL
    
            let parsedCities = typeof rawCities === 'string' ? JSON.parse(rawCities) : rawCities
            const formattedCities = {}
    
            // ✅ Ensure each sub-city is mapped to its main city
            Object.entries(parsedCities).forEach(([mainCity, subCities]) => {
                if (!Array.isArray(subCities)) {
                    formattedCities[subCities] = mainCity // Handle single city case
                } else {
                    subCities.forEach(subCity => {
                        formattedCities[subCity] = mainCity // Correctly maps each sub-city
                    })
                }
            })
    
            return formattedCities
        } catch (error) {
            console.error("❌ Ошибка при разборе JSON в cities:", error)
            return {}
        }
    }    

    /**
     * Returns the stored cities object without modification.
     */
    getFormattedCities() {
        return this.getCityRelations() // ✅ No re-stringifying
    }

    /**
     * Creates a mapping of sub-cities to their main city.
     */
    getSubCityToMainCityMap() {
        const cityRelations = this.getCityRelations()
        const subCityMap = {}
    
        Object.entries(cityRelations).forEach(([mainCity, subCities]) => {
            if (!Array.isArray(subCities)) {
                // If the value is not an array, assume it's a single city and map it
                subCityMap[subCities] = mainCity
            } else {
                // Properly map each sub-city to the main city
                subCities.forEach(subCity => {
                    subCityMap[subCity] = mainCity
                })
            }
        })
    
        return subCityMap
    }     
}

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
            type: DataTypes.TEXT,
            allowNull: true,
            get() {
                return this.getFormattedCities() // ✅ Correctly returns parsed object
            },
            set(citiesStr) {
                this.setDataValue('cities', citiesStr) // ✅ Keeps storage format unchanged
            },
        },
        cellCoordinates: {
            type: DataTypes.TEXT,
            allowNull: false,
            get() {
                const rawCoordinates = this.getDataValue('cellCoordinates')
                return rawCoordinates ? rawCoordinates.split(',').map(cell => cell.trim()) : []
            },
            set(coordinatesArray) {
                if (Array.isArray(coordinatesArray)) {
                    this.setDataValue('cellCoordinates', coordinatesArray.join(','))
                } else {
                    console.error("❌ Ошибка: cellCoordinates должен быть массивом строк.")
                }
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
