const {Appointment} = require("../models/index");

const getAppointmentDetails = async (appointmentId) => {
    const appointment = await Appointment.findByPk(appointmentId);
    return appointment;
};

module.exports = {getAppointmentDetails}