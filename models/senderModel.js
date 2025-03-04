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

    convertJsonToCityString() {
        const cityRelations = this.getCityRelations()
        const mainToSubCities = {}

        // Reverse mapping: reconstruct main city to sub-city lists
        Object.entries(cityRelations).forEach(([subCity, mainCity]) => {
            if (!mainToSubCities[mainCity]) {
                mainToSubCities[mainCity] = [mainCity] // Include the main city itself
            }
            if (subCity !== mainCity) {
                mainToSubCities[mainCity].push(subCity)
            }
        })

        // Format as a string
        return Object.entries(mainToSubCities)
            .map(([mainCity, subCities]) =>
                subCities.length > 1 ? `${mainCity} [${subCities.slice(1).join(', ')}]` : mainCity
            )
            .join(',\n')
    }

    /**
    * Parses a supplier field (daichinCoordinates or testmedCoordinates).
    */
    parseSupplier(fieldName) {
        const rawValue = this.getDataValue(fieldName);
        if (!rawValue) return { names: [], coordinates: [] };

        try {
            return JSON.parse(rawValue);
        } catch (error) {
            console.error(`❌ Ошибка при разборе JSON в ${fieldName}:`, error);
            return { names: [], coordinates: [] };
        }
    }

    /**
     * Converts a supplier object into a JSON string for storage.
     */
    stringifySupplier(names, coordinates) {
        return JSON.stringify({ names, coordinates });
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
                return this.getCityRelations() // ✅ Correctly returns parsed object
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
        daichinCoordinates: {
            type: DataTypes.TEXT,
            allowNull: true,
            get() {
                return this.parseSupplier('daichinCoordinates');
            },
            set(value) {
                if (value && typeof value === 'object' && value.names && value.coordinates) {
                    this.setDataValue('daichinCoordinates', this.stringifySupplier(value.names, value.coordinates));
                } else {
                    console.error("❌ Ошибка: daichinCoordinates должен быть объектом с ключами 'names' и 'coordinates'.");
                }
            },
        },
        testmedCoordinates: {
            type: DataTypes.TEXT,
            allowNull: false,
            get() {
                return this.parseSupplier('testmedCoordinates');
            },
            set(value) {
                if (value && typeof value === 'object' && value.names && value.coordinates) {
                    this.setDataValue('testmedCoordinates', this.stringifySupplier(value.names, value.coordinates));
                } else {
                    console.error("❌ Ошибка: testmedCoordinates должен быть объектом с ключами 'names' и 'coordinates'.");
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
