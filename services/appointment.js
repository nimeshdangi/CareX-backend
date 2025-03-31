const {Appointment} = require("../models/index");

const getAppointmentDetails = async (appointmentId) => {
    const appointment = await Appointment.findByPk(appointmentId);
    return appointment;
};

const saveAppointmentData = async (appointmentId, data) => {
    const updatedAppointment = await Appointment.update(data, {
        where: {
            id: appointmentId
        }
    });
    return updatedAppointment;
};

module.exports = {getAppointmentDetails, saveAppointmentData}