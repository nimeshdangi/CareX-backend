const {DataTypes} = require('sequelize');

const Appointment = (sequelize) => {
    return sequelize.define('appointment', {
        doctor_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        patient_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        start_date_time: {
            type: DataTypes.DATE,
            allowNull: false
        },
        end_date_time: {
            type: DataTypes.DATE,
            allowNull: false
        },
        symptoms: {
            type: DataTypes.STRING,
            allowNull: true
        },
        diagnosis: {
            type: DataTypes.STRING,
            allowNull: true
        },
        prescription: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        tableName: 'appointment',
    })
};

module.exports = Appointment;