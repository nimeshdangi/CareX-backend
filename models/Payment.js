const {DataTypes} = require('sequelize');

const Payment = (sequelize) => {
    return sequelize.define('payment', {
        appointment_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        payment_data: {
            type: DataTypes.JSON,
            allowNull: false
        },
    }, {
        tableName: 'payment',
    })
}
module.exports = Payment;   