const {DataTypes} = require('sequelize');

const Notification = (sequelize) => {
    return sequelize.define('notification', {
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        message: {
            type: DataTypes.STRING,
            allowNull: false
        },
        appointment_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        doctor_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        isRead: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        tableName: 'notification',
    })
}

module.exports = Notification