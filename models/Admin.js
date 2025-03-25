const {DataTypes} = require('sequelize');
const bcrypt = require('bcrypt');

const Admin = (sequelize) => {
    return sequelize.define('admin', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        tableName: 'admin',
        hooks: {
            beforeCreate: async (admin) => {
                if (admin.password) {
                    admin.password = await bcrypt.hash(admin.password, 10);
                }
            },
            beforeUpdate: async (admin) => {
                if (admin.changed("password")) {
                    admin.password = await bcrypt.hash(admin.password, 10);
                }
            }
        }
    })
};

module.exports = Admin;