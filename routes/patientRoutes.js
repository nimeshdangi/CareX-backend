const express = require('express');
const path = require("path");
const multer = require('multer');
const router = express.Router();
const {Admin, Doctor, Patient, Appointment, Review, Notification, Payment} = require('../models/index');
const jwt = require('jsonwebtoken');
const { Op, where, Sequelize } = require('sequelize');

// Set up storage for multer
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, 'uploads/patients/'); // Directory to save the uploaded files
//     },
//     filename: function (req, file, cb) {
//         cb(null, Date.now() + path.extname(file.originalname)); // File naming convention
//     }
// });
const { storage } = require('../cloudinary');

// Initialize upload
const upload = multer({ storage: storage });

// Wrap multer's single file upload in a promise
const asyncUpload = (req, res) => {
  return new Promise((resolve, reject) => {
    upload.single('image')(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

// Middleware to handle errors from multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: "File upload error" });
    }
    next();
};

const checkIfPatient = async (req, res, next) => {
    try {
        // Get token from the Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized. Please login'
            });
        }

        const token = authHeader.trim();

        // Verify and decode the JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded JWT: ", decoded);

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
            message: 'Invalid token. Please login again'
        });
    }
};

router.post('/registration', async (req, res) => {
    const {name, email, phone_number, address, password} = req.body;

    if (!name || !email || !phone_number || !address || !password) {
        return res.status(400).json({
            success: false,
            message: 'Please fill all the required fields'
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

router.post('/payment-complete', checkIfPatient, async (req, res) => {
    const {appointment_id, payment_data} = req.body;

    if (!appointment_id || !payment_data) {
        return res.status(400).json({
            success: false,
            message: 'Not enough information provided'
        });
    }

    try {
        const payment = await Payment.findOne({
            where: {
                appointment_id
            }
        });

        if (payment) {
            const paymentDetails = JSON.parse(payment.payment_data);
            const parsedDetails = JSON.parse(paymentDetails);

            if(parsedDetails.status === "Completed") {
                return res.status(400).json({
                    success: false,
                    message: 'Payment already completed'
                });
            }
        } else {
            const payment = await Payment.create({
                appointment_id,
                payment_data: JSON.stringify(payment_data)
            });

            if (payment) {
                const updatedAppointment = await Appointment.update({
                    status: "Booked",
                    patient_id: req.body.patient_id
                }, {
                    where: {
                        id: appointment_id
                    }
                });

                const appointment = await Appointment.findByPk(appointment_id);
                const patient = await Patient.findByPk(appointment.patient_id);

                const isNotified = await Notification.findOne({
                    where: {
                        appointment_id: appointment_id,
                    }
                });
                
                if (!isNotified) {
                    await Notification.create({
                        appointment_id: appointment_id,
                        doctor_id: appointment.doctor_id,
                        title: "New Appointment",
                        message: `Patient ${patient.name} has booked an appointment from ${(new Date(appointment.start_date_time)).toLocaleTimeString('en-US', {hour: "numeric", minute: "numeric", hour12: true, timeZone: "Asia/Katmandu"})} to ${(new Date(appointment.end_date_time)).toLocaleTimeString('en-US', {hour: "numeric", minute: "numeric", hour12: true, timeZone: "Asia/Katmandu"})} on ${(new Date(appointment.start_date_time)).toLocaleDateString('en-US', {year: "numeric", month: "long", day: "numeric"})}`,
                    })
                }

                if (updatedAppointment) {
                    return res.status(200).json({
                        success: true,
                        message: 'Booked after Payment completed successfully'
                    });
                }
            }
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while completing the payment",
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
        const appointment = await Appointment.findByPk(appointment_id);
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        const patient = await Patient.findByPk(patient_id);
        const updatedAppointment = await Appointment.update({
            patient_id: patient_id,
            status: "Booked"
        }, {
            where: {
                id: appointment_id
            }
        });

        if (updatedAppointment) {
            await Notification.create({
                appointment_id: appointment_id,
                doctor_id: appointment.doctor_id,
                title: "New Appointment",
                message: `Patient ${patient.name} has booked an appointment from ${(new Date(appointment.start_date_time)).toLocaleTimeString('en-US', {hour: "numeric", minute: "numeric", hour12: true, timeZone: "Asia/Katmandu"})} to ${(new Date(appointment.end_date_time)).toLocaleTimeString('en-US', {hour: "numeric", minute: "numeric", hour12: true, timeZone: "Asia/Katmandu"})} on ${(new Date(appointment.start_date_time)).toLocaleDateString('en-US', {year: "numeric", month: "long", day: "numeric"})}`,
            })
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

router.get("/appointment/:id", checkIfPatient, async(req, res) => {
    const {id} = req.params;

    if (!id) {
        return res.status(400).json({
            success: false,
            message: 'Not enough information provided'
        });
    }

    try {
        const appointment = await Appointment.findByPk(id, {
            include: [
                {
                    model: Doctor,
                    attributes: { exclude: ['password'] }
                }
            ]
        });
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        if (appointment.patient_id !== req.body.patient_id) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to view this appointment'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Appointment found',
            data: appointment
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while fetching the appointment",
            error: err.message
        });
    }
});

router.get("/past-appointments", checkIfPatient, async(req, res) => {
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
                end_date_time: {
                    [Op.lt]: new Date()
                }
            },
            attributes: {exclude: ['doctor_id']},
            include: [
                {
                    model: Doctor,
                    attributes: {exclude: ['password']},
                    include: [
                        {
                            model: Review,
                            where: {
                                patient_id
                            },
                            required: false
                        }
                    ]
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
            message: "An error occurred while fetching past appointments",
            error: err.message
        });
    }
})

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

router.get('/current-appointments', checkIfPatient, async (req, res) => {
    const { patient_id } = req.body;

    if (!patient_id) {
        return res.status(401).json({
            success: false,
            message: 'You need to login'
        });
    }

    try {
        const now = new Date();
        const fifteenMinutesBeforeNow = new Date(now.getTime() - 15 * 60 * 1000);

        // console.log("Current Time:", now);
        // console.log("Fifteen Minutes Before Now:", fifteenMinutesBeforeNow);

        // const appointment = await Appointment.findOne({
        //     where: {
        //         id: "11"
        //     }
        // })
        // console.log("Appointment:", appointment);
        // console.log("Is now inside start point", now < fifteenMinutesBeforeNow);
        // console.log("Is now inside start time", now > appointment.start_date_time);
        // console.log("Is now inside end point", now > appointment.end_date_time);
        // console.log("Is now inside both points", now > fifteenMinutesBeforeNow && now < appointment.end_date_time);
        // console.log("Is now inside time", now > appointment.start_date_time && now < appointment.end_date_time);

        const appointments = await Appointment.findAll({
            where: {
                patient_id,
                [Op.or]: [
                    {
                        start_date_time: {
                            [Op.lte]: now
                        },
                        end_date_time: {
                            [Op.gte]: now
                        }
                    },
                    {
                        start_date_time: {
                            [Op.between]: [now, fifteenMinutesBeforeNow]
                        }
                    }
                ]
                // start_date_time: {
                //     [Op.lte]: fifteenMinutesBeforeNow
                // },
                // end_date_time: {
                //     [Op.gte]: now
                // }
            },
            attributes: { exclude: ['doctor_id'] },
            include: [
                {
                    model: Doctor,
                    attributes: { exclude: ['password'] }
                }
            ]
        });

        if (appointments.length > 0) {
            return res.status(200).json({
                success: true,
                message: 'List of your current appointments',
                data: appointments
            });
        } else {
            return res.status(404).json({
                success: false,
                message: 'No current appointments found'
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while fetching current appointments",
            error: err.message
        });
    }
});

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
        await asyncUpload(req, res);

        const updateData = {
            name: req.body.name,
            email: req.body.email,
            phone_number: req.body.phone_number,
            address: req.body.address
        };

        if (req.file) {
            updateData.image = req.file.path;
        }

        const updatedPatient = await Patient.update(updateData, {
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
        const newReview = await Review.create({
            rating: req.body.rating,
            comment: req.body.comment,
            doctor_id: req.body.doctor_id,
            patient_id: patient_id
        });
        if (newReview) {
            return res.status(200).json({
                success: true,
                message: 'Review added successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Review could not be added'
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while adding your review",
            error: err.message
        });
    }
})

router.post('/upload-image', checkIfPatient, upload.single('image'), async (req, res) => {
    const {patient_id} = req.body;
    if (!patient_id) {
        return res.status(401).json({
            success: false,
            message: 'You need to login'
        });
    }

    try {
        const updatedPatient = await Patient.update({
            image: req.file.path
        }, {
            where: {
                id: patient_id
            }
        });
        if (updatedPatient) {
            return res.status(200).json({
                success: true,
                message: 'Patient image updated successfully'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Patient image could not be updated'
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while updating your image",
            error: err.message
        });
    }
})

module.exports = router