module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('Senders', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            companyName: {
                type: Sequelize.STRING,
                allowNull: false
            },
            email: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            cities: {
                type: Sequelize.TEXT, // Stores the cities array as JSON or comma-separated
                allowNull: true
            },
            cellCoordinates: {
                type: Sequelize.STRING, // e.g., "B2"
                allowNull: false
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        })
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('Senders')
    }
}
