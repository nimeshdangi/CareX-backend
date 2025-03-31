const express = require("express");
const { getAppointmentDetails } = require("../services/appointment");
const router = express.Router();

router.get("/:id", async (req, res) => {
    const id = req.params.id;
    // console.log("Appointment ID:", id);
    const appointmentDetails = await getAppointmentDetails(id);
    // console.log("Appointment Details:", appointmentDetails);
    res.status(200).json({
        success: true,
        data: appointmentDetails
    })    
})

module.exports = router;