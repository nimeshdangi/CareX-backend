const { Sequelize } = require('sequelize');
require('dotenv').config(); // Load environment variables from .env files

// Create a new Sequelize instance using environment variables
const sequelize = new Sequelize(
  process.env.DB_NAME,           // Database name
  process.env.DB_USER,           // Username
  process.env.DB_PASSWORD,       // Password
  {
    host: process.env.DB_HOST,   // Hostname
    dialect: process.env.DB_DIALECT,  // Dialect (mysql or postgres)
    port: process.env.DB_PORT || 3306, // Default port for MySQL, change to 5432 for PostgreSQL
    logging: false,                // Disable logging in Sequelize (optional)
    dialectOptions: {
      // ssl: {
      //   require: true,
      //   rejectUnauthorized: false,  // This is sometimes necessary to bypass self-signed certificates
      // }
      ssl: false
    }
  }
);

const Admin = require("./Admin")(sequelize);
const Doctor = require("./Doctor")(sequelize);
const Patient = require("./Patient")(sequelize);
const Appointment = require("./Appointment")(sequelize);
const Review = require("./Review")(sequelize);
const Notification = require("./Notification")(sequelize);
const Payment = require("./Payment")(sequelize);

Appointment.belongsTo(Doctor, { foreignKey: 'doctor_id' });
Doctor.hasMany(Appointment, { foreignKey: 'doctor_id' });

Appointment.belongsTo(Patient, { foreignKey: 'patient_id' });
Patient.hasMany(Appointment, { foreignKey: 'patient_id' });

Review.belongsTo(Patient, { foreignKey: 'patient_id' });
Patient.hasMany(Review, { foreignKey: 'patient_id' });

Review.belongsTo(Doctor, { foreignKey: 'doctor_id' });
Doctor.hasMany(Review, { foreignKey: 'doctor_id' });

Notification.belongsTo(Doctor, { foreignKey: 'doctor_id' });
Doctor.hasMany(Notification, { foreignKey: 'doctor_id' });

Notification.belongsTo(Appointment, { foreignKey: 'appointment_id' });
Appointment.hasMany(Notification, { foreignKey: 'appointment_id' });

Appointment.belongsTo(Payment, { foreignKey: 'appointment_id' });
Payment.hasOne(Appointment, { foreignKey: 'appointment_id' });

module.exports = { sequelize, Admin, Doctor, Patient, Appointment, Review, Notification, Payment };