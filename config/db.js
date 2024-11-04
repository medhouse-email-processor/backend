const { Sequelize } = require('sequelize');
require('dotenv').config(); // Load environment variables

const sequelize = new Sequelize(
    process.env.DB_NAME,     // Database name
    process.env.DB_USER,     // Username
    process.env.DB_PASS, // Password
    {
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT || 'mysql',
        port: process.env.DB_PORT || 3306,
        logging: false, // Set to true if you want to see SQL queries
    }
);

// Test the database connection
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Sequelize has established the connection successfully.');
        
        // Sync all models
        await sequelize.sync(); // Syncs all models in the models directory
        console.log('All models were synchronized successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
})();


module.exports = sequelize;
