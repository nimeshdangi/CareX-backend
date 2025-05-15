const express = require("express");
const router = express.Router();
const { Admin, Doctor, Patient, Appointment } = require("../models/index");
const { Sequelize, Op } = require("sequelize");

router.get("/patient-doctor-count", async (req, res) => {
  try {
    const approvedDoctorCount = await Doctor.count({ where: { status: "approved" } });
    const pendingDoctorCount = await Doctor.count({ where: { status: "pending" } });
    const patientCount = await Patient.count();

    res.status(200).json({
      approvedDoctor: approvedDoctorCount,
      pendingDoctor: pendingDoctorCount,
      patient: patientCount,
    });
  } catch (error) {
    console.error("Error fetching counts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/this-week-appointments", async (req, res) => {
  try {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const appointments = await Appointment.findAll({
      attributes: [
        [Sequelize.fn("DATE", Sequelize.col("start_date_time")), "day"],
        [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
      ],
      where: {
        start_date_time: {
          [Op.between]: [startOfWeek, endOfWeek],
        },
      },
      group: [Sequelize.fn("DATE", Sequelize.col("start_date_time"))],
      order: [[Sequelize.fn("DATE", Sequelize.col("start_date_time")), "ASC"]],
      raw: true,
    });

    // Initialize with 0s for Sunday to Saturday
    const counts = Array(7).fill(0);

    appointments.forEach((entry) => {
      const dayIndex = new Date(entry.day).getDay(); // 0 (Sun) - 6 (Sat)
      counts[dayIndex] = parseInt(entry.count);
    });

    res.status(200).json({ counts });
  } catch (error) {
    console.error("Error fetching weekly appointments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router