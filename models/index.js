const { Sequelize } = require('sequelize');

// Create a new Sequelize instance and connect to the database
const sequelize = new Sequelize('carex', 'root', '', {
  host: 'localhost',
  dialect: 'mysql', // The SQL dialect you are using ('mysql' in this case)
});

const Admin = require("./Admin")(sequelize);
const Doctor = require("./Doctor")(sequelize);
const Patient = require("./Patient")(sequelize);

module.exports = {sequelize, Admin, Doctor, Patient};