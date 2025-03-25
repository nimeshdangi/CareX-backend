const {DataTypes} = require('sequelize');
const bcrypt = require('bcrypt');

const Doctor = (sequelize) => {
    return sequelize.define('doctor', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        phone_no: {
            type: DataTypes.STRING,
            allowNull: false
        },
        registrationNumber: {
            type: DataTypes.STRING,
            allowNull: false  
        },
        specification: {
            type: DataTypes.STRING,
            allowNull: false
        },
        qualification: {
            type: DataTypes.STRING,
            allowNull: false
        },
        documents: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM("Approved", "Not Approved"),
            // values: [],
            allowNull: false,
            defaultValue: "Not Approved"
        }
    }, {
        tableName: 'doctor',
        hooks: {
            beforeCreate: async (doctor) => {
                if (doctor.password) {
                    doctor.password = await bcrypt.hash(doctor.password, 10);
                }
            },
            beforeUpdate: async (doctor) => {
                if (doctor.changed("password")) {
                    doctor.password = await bcrypt.hash(doctor.password, 10);
                }
            }
        }
    })
};

module.exports = Doctor;