const express = require('express');
const router = express.Router();
const {Admin, Doctor, Patient, Appointment} = require('../models/index');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

const checkIfPatient = async (req, res, next) => {
    try {
        // Get token from the Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.trim();

        // Verify and decode the JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role === 'patient') {
            req.body.patient_id = decoded.id;
            next(); // User is an patient, proceed to the next middleware or route handler
        } else {
            return res.status(403).json({
                success: false,
                message: 'Access forbidden: Patients only'
            });
        }
    } catch (error) {
        console.error("JWT Verification Error: ", error.message);
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
};

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

router.post('/book-appointment', checkIfPatient, async (req, res) => {
    const {appointment_id, patient_id} = req.body;

    if (!appointment_id || !patient_id) {
        return res.status(400).json({
            success: false,
            message: 'Not enough information provided'
        });
    }

    try {
        const updatedAppointment = await Appointment.update({
            patient_id: patient_id,
            status: "Booked"
        }, {
            where: {
                id: appointment_id
            }
        });

        if (updatedAppointment) {
            return res.status(200).json({
                success: true,
                message: 'Appointment booked successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Appointment could not be booked'
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while booking the appointment",
            error: err.message
        });
    }
});

router.get('/my-appointments', checkIfPatient, async (req, res) => {
    const {patient_id} = req.body;
    if (!patient_id) {
        return res.status(401).json({
            success: false,
            message: 'You need to login'
        });
    }

    try {
        const appointments = await Appointment.findAll({
            where: {
                patient_id,
                start_date_time: {
                    [Op.gt]: new Date()
                }
            },
            attributes: {exclude: ['doctor_id']},
            include: [
                {
                    model: Doctor,
                    attributes: {exclude: ['password']}
                }
            ]
        });
        if (appointments) {
            return res.status(200).json({
                success: true,
                message: 'List of your appointments',
                data: appointments
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'No appointments found'
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while fetching your appointments",
            error: err.message
        });
    }
})

router.get('/profile', checkIfPatient, async (req, res) => {
    const {patient_id} = req.body;
    if (!patient_id) {
        return res.status(401).json({
            success: false,
            message: 'You need to login'
        });
    }

    try {
        const patient = await Patient.findOne({
            where: {
                id: patient_id
            },
            attributes: {
                exclude: ['password', 'createdAt', 'updatedAt']
            }
        });
        if (patient) {
            return res.status(200).json({
                success: true,
                message: 'Patient profile',
                data: patient
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'No patient found'
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while fetching your profile",
            error: err.message
        });
    }
})

router.put('/profile', checkIfPatient, async (req, res) => {
    const {patient_id} = req.body;
    if (!patient_id) {
        return res.status(401).json({
            success: false,
            message: 'You need to login'
        });
    }

    try {
        const updatedPatient = await Patient.update({
            name: req.body.name,
            email: req.body.email,
            phone_number: req.body.phone_number,
            address: req.body.address
        }, {
            where: {
                id: patient_id
            }
        });
        if (updatedPatient) {
            return res.status(200).json({
                success: true,
                message: 'Patient profile updated successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Patient profile could not be updated'
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while updating your profile",
            error: err.message
        });
    }
});

router.post('/review', checkIfPatient, async (req, res) => {
    const {patient_id} = req.body;
    if (!patient_id) {
        return res.status(401).json({
            success: false,
            message: 'You need to login'
        });
    }

    try {
        const updatedPatient = await Patient.update({
            rating: req.body.rating,
            comment: req.body.comment,
            doctor_id: req.body.doctor_id
        }, {
            where: {
                id: patient_id
            }
        });
        if (updatedPatient) {
            return res.status(200).json({
                success: true,
                message: 'Patient review updated successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Patient review could not be updated'
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while updating your review",
            error: err.message
        });
    }
})

module.exports = router