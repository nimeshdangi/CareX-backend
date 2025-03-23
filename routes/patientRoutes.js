const express = require('express');
const router = express.Router();
const {Admin, Doctor, Patient} = require('../models/index');

router.post('/registration', async (req, res) => {
    const {name, email, phone_number, address, password} = req.body;

    if (!name || !email || !phone_number || !address || !password) {
        return res.status(400).json({
            success: false,
            message: 'All fields are required'
        });
    }

    const adminExists = await Admin.findOne({ where: { email } });
    if (adminExists) {
        return res.status(400).json({
            success: false,
            message: "Provided email already exists",
        });
    }

    // Check in Doctor schema
    const doctorExists = await Doctor.findOne({ where: { email } });
    if (doctorExists) {
        return res.status(400).json({
            success: false,
            message: "Provided Email already exists",
        });
    }

    try {
        const newPatient = await Patient.create({
            name,
            email,
            phone_number,
            address,
            password
        });

        const patientData = newPatient.get({plain: true});
        const {password: _, ...patientWithoutPassword} = patientData;

        res.status(201).json({
            success: true,
            message: 'Patient registered successfully',
            patient: patientWithoutPassword
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while registering the patient",
            error: err.message
        });
    }
});

module.exports = router