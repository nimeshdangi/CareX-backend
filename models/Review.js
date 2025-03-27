const {DataTypes} = require('sequelize');

const Review = (sequelize) => {
    return sequelize.define('review', {
        rating: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        comment: {
            type: DataTypes.STRING,
            allowNull: true
        },
        patient_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        doctor_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'review',
    })
}

module.exports = Review