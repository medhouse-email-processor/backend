const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // Adjust path as necessary

class UserAuth extends Model {}

UserAuth.init(
    {
        googleUserId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            primaryKey: true, // Set googleUserId as the primary key
        },
        accessToken: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        refreshToken: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        folderId: {
            type: DataTypes.STRING,
            allowNull: true, // Nullable if not always required
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: 'UserAuth',
        tableName: 'UserAuths',
        timestamps: true, // `createdAt` and `updatedAt` fields
    }
);

module.exports = UserAuth;
