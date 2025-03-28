const {DataTypes} = require('sequelize');
const bcrypt = require('bcrypt');

const Patient = (sequelize) => {
    return sequelize.define('patient', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        phone_number: {
            type: DataTypes.STRING,
            allowNull: false
        },
        address: {
            type: DataTypes.STRING,
            allowNull: false
        },
        image: {
            type: DataTypes.STRING,
            allowNull: true
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        tableName: 'patient',
        hooks: {
            beforeCreate: async (patient) => {
                if (patient.password) {
                    patient.password = await bcrypt.hash(patient.password, 10);
                }
            },
            beforeUpdate: async (patient) => {
                if (patient.changed("password")) {
                    patient.password = await bcrypt.hash(patient.password, 10);
                }
            }
        }
    })
};

module.exports = Patient;