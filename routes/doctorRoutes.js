const express = require('express');
const router = express.Router();
const {Admin, Doctor, Patient, Appointment, Review, Notification} = require('../models/index');
const multer = require('multer');
const path = require("path");
const jwt = require("jsonwebtoken");
const { Op, Sequelize, fn, col, literal } = require('sequelize');

// Set up storage for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/doctors/'); // Directory to save the uploaded files
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // File naming convention
    }
});

// Initialize upload
const upload = multer({ storage: storage });

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

const checkIfAdmin = async (req, res, next) => {
    try {
        // Get token from the Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.trim();

        // console.log("Token:", token);
        // const decodedToken = jwt.decode(token);
        // console.log("Decoded Token:", decodedToken);
        // console.log("Secret Key:", process.env.JWT_SECRET);
        // Verify and decode the JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // console.log(decoded);

        // Check if the decoded token contains an admin role
        if (decoded.role === 'admin') {
            next(); // User is an admin, proceed to the next middleware or route handler
        } else {
            return res.status(403).json({ message: 'Access forbidden: Admins only' });
        }
    } catch (error) {
        console.error("JWT Verification Error: ", error.message);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

const checkIfDoctor = async (req, res, next) => {
    try {
        // Get token from the Authorization header
        const authHeader = req.headers.authorization;
        // console.log(authHeader);
        if (!authHeader) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.trim();

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.role === 'doctor') {
            req.body.doctor_id = decoded.id;
            next(); // User is an doctor, proceed to the next middleware or route handler
        } else {
            return res.status(403).json({
                success: false,
                message: 'Access forbidden: Doctors only'
            });
        }
    } catch (error) {
        console.error("JWT Verification Error: ", error.message);
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
}

router.post('/registration', upload.single('documents'), handleMulterError, async (req, res) => {
    const {name, email, phone_no, registrationNumber, specification, qualification, password} = req.body;
    // console.log(req.body);
    const document = req.file;

    // console.log("File:", req.file);

    // Check if any required fields are empty
    if (!name || !email || !phone_no || !registrationNumber || !specification || !qualification || !password) {
        return res.status(400).json({
            success: false,
            message: "All fields are required",
        });
    }

    const adminExists = await Admin.findOne({ where: { email } });
    if (adminExists) {
        return res.status(400).json({
            success: false,
            message: "Provided email already exists",
        });
    }

    // Check in Patient schema
    const patientExists = await Patient.findOne({ where: { email } });
    if (patientExists) {
        return res.status(400).json({
            success: false,
            message: "Provided Email already exists",
        });
    }

    if (!document) {
        return res.status(400).json({
            success: false,
            message: "Please upload a document",
        })
    }

    const fileName = document.filename;

    try {
        const newDoctor = await Doctor.create({
            name,
            email,
            phone_no,
            registrationNumber,
            specification,
            qualification,
            documents: fileName,
            password
        });
        
        const doctorData = newDoctor.get({ plain: true });
        const { password: _, ...doctorWithoutPassword } = doctorData;

        res.status(201).json({
            success: true,
            message: "Doctor registered successfully",
            doctor: doctorWithoutPassword
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while registering the doctor",
            error: err.message
        });
    }
});

router.get("/", async (req, res) => {
    try {
        let keywords = req.query.search || '';
        if (!keywords) {
            keywords = [];
        } else if (typeof keywords === 'string') {
            // Split the string into an array by commas or spaces
            keywords = keywords.split(/[\s,]+/);
        } else if (Array.isArray(keywords)) {
            // If keywords is already an array, do nothing
        } else {
            // Wrap single keyword in an array
            keywords = [keywords];
        }

        // Build the search conditions
        const conditions = {
            status: "Approved"
        };

        if (keywords.length > 0) {
            // Create an array of conditions for each keyword
            const keywordConditions = keywords.map(keyword => ({
                [Op.or]: [
                    {
                        name: {
                            [Op.like]: `%${keyword}%`
                        }
                    },
                    {
                        specification: {
                            [Op.like]: `%${keyword}%`
                        }
                    }
                ]
            }));

            // Combine all keyword conditions using [Op.and] if you want doctors who match all keywords
            // Or use [Op.or] if you want doctors who match any keyword
            conditions[Op.or] = keywordConditions;
        }

        const doctors = await Doctor.findAll({
            where: conditions
        });

        res.status(200).json({
            success: true,
            message: "List of doctors available",
            data: doctors
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            message: err.message
        });
    }
});

router.get("/all", async (req, res) => {
    try {
        const doctors = await Doctor.findAll();
        res.status(200).json({
            success: true,
            message: "List of all doctors",
            data: doctors
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            message: err.message
        });
    }
});

router.put("/approve/:id", checkIfAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const doctor = await Doctor.findOne({ where: { id } });
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }

        const updatedDoctor = await doctor.update({
            status: "Approved"
        });

        res.status(200).json({
            success: true,
            message: "Doctor approved successfully",
            data: updatedDoctor
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.post("/appointment", checkIfDoctor, async (req, res) => {
    console.log(req.body);
    const { doctor_id, start_date_time, end_date_time } = req.body;

    // console.log(req.body);

    if (!doctor_id || !start_date_time || !end_date_time) {
        return res.status(400).json({
            success: false,
            message: "All fields are required"
        });
    }

    // check if start_date_time and end_date_time are not 0000-00-00 00:00:00
    if (start_date_time === "0000-00-00 00:00:00" || end_date_time === "0000-00-00 00:00:00") {
        return res.status(400).json({
            success: false,
            message: "Invalid date format"
        });
    }

    // Check if the appointment time is in the past
    const currentDateTime = new Date();
    if (start_date_time < currentDateTime) {
        return res.status(400).json({
            success: false,
            message: "Appointment time cannot be in the past"
        });
    }

    // check if the time difference between start_date_time and end_date_time is 15, 30, or 60 minutes
    const startDateTime = new Date(start_date_time);
    const endDateTime = new Date(end_date_time);
    const timeDifference = (endDateTime - startDateTime) / (1000 * 60); // in minutes

    if (timeDifference !== 15 && timeDifference !== 30 && timeDifference !== 60) {
        return res.status(400).json({
            success: false,
            message: "Appointment duration must be 15, 30, or 60 minutes"
        });
    }

    try {
        // Check for overlapping appointments with at least a 5-minute gap
        const overlappingAppointment = await Appointment.findOne({
            where: {
                doctor_id,
                [Op.or]: [
                    {
                        start_date_time: {
                            [Op.lt]: new Date(end_date_time).getTime() + 5 * 60 * 1000
                        },
                        end_date_time: {
                            [Op.gt]: new Date(start_date_time).getTime() - 5 * 60 * 1000
                        }
                    }
                ]
            }
        });

        if (overlappingAppointment) {
            return res.status(400).json({
                success: false,
                message: "Appointment time overlaps with an existing appointment. Please allow at least a 5-minute gap."
            });
        }

        const newAppointment = await Appointment.create({
            doctor_id,
            start_date_time,
            end_date_time,
            status: "Not Booked"
        });

        res.status(201).json({
            success: true,
            message: "Appointment created successfully",
            data: newAppointment
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.get("/appointment", checkIfDoctor, async (req, res) => {
    const {doctor_id} = req.body;
    // console.log(doctor_id);
    try {
        const appointments = await Appointment.findAll({
            where: {
                doctor_id: doctor_id
            }
        });
        res.status(200).json({
            success: true,
            message: "List of your appointments",
            data: appointments
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while retrieving appointments",
        });
    }
});

router.get("/appointment/:id", checkIfDoctor, async (req, res) => {
    const id = req.params.id;
    try {
        const appointment = await Appointment.findByPk(id);
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found"
            });
        }
        if (appointment.doctor_id !== req.body.doctor_id) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view this appointment"
            })
        }
        res.status(200).json({
            success: true,
            message: "Appointment details",
            data: appointment
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while retrieving appointment details",
        });
    }
});

router.put("/appointment-status/:id/", checkIfDoctor, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    console.log(status);

    if (!status) {
        return res.status(400).json({
            success: false,
            message: "Status is required"
        });
    }

    try {
        const appointment = await Appointment.findByPk(id);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found"
            });
        }

        if (appointment.doctor_id !== req.body.doctor_id) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update this appointment"
            });
        }

        const updatedAppointment = await appointment.update({ status });

        res.status(200).json({
            success: true,
            message: "Appointment status updated successfully",
            data: updatedAppointment
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.get("/appointments-today", checkIfDoctor, async (req, res) => {
    const {doctor_id} = req.body;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0); // Set to the start of the day
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999); // Set to the end of the day
    // console.log("startOfDay", startOfDay);
    // console.log("endOfDay", endOfDay);
    try {
        const appointments = await Appointment.findAll({
            where: {
                doctor_id: doctor_id,
                start_date_time: {
                    [Op.between]: [startOfDay, endOfDay]
                }
            },
            include: [
                {
                    model: Patient,
                    attributes: ['name']
                }
            ],
            order: [['start_date_time', 'DESC']]
        });
        res.status(200).json({
            success: true,
            message: "List of your appointments today",
            data: appointments
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while retrieving appointments",
        });
    }
});

router.get("/upcoming-appointments", checkIfDoctor, async (req, res) => {
    const {doctor_id} = req.body;
    console.log("Upcoming Appointments");
    try {
        const appointments = await Appointment.findAll({
            where: {
                doctor_id: doctor_id,
                start_date_time: {
                    [Op.gt]: new Date()
                }
            },
            include: [
                {
                    model: Patient
                }
            ]
        });
        res.status(200).json({
            success: true,
            message: "List of your upcoming appointments",
            data: appointments
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while retrieving appointments",
        });
    }
});

router.get("/past-appointments", checkIfDoctor, async (req, res) => {
    const {doctor_id} = req.body;
    try {
        const appointments = await Appointment.findAll({
            where: {
                doctor_id: doctor_id,
                end_date_time: {
                    [Op.lt]: new Date()
                }
            },
            include: [
                {
                    model: Patient
                }
            ],
            order: [['end_date_time', 'DESC']]
        });
        res.status(200).json({
            success: true,
            message: "List of your past appointments",
            data: appointments
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "An error occurred while retrieving appointments",
        });
    }
});

router.get("/time_slots", async (req, res) => {
    const {doctor_id, date} = req.query;
    
    console.log(date);
    const currentDateTime = new Date();
    const isToday = new Date(date).toDateString() === currentDateTime.toDateString();

    const timeCondition = isToday
        ? {
            end_date_time: {
                [Op.gt]: currentDateTime
            }
        }
        : {};
    
    try {
        const appointments = await Appointment.findAll({
            where: {
                doctor_id: doctor_id,
                start_date_time: {
                    [Op.lte]: new Date(`${date} 23:59:59`),
                },
                end_date_time: {
                    [Op.gte]: new Date(`${date} 00:00:00`)
                },
                status: "Not Booked",
                ...timeCondition
            }
        })

        if(!appointments) {
            return res.status(404).json({
                success: false,
                message: "No appointments on given date"
            });
        }

        return res.status(200).json({
            success: true,
            message: "List of time slots",
            data: appointments
        })
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.get("/profile", checkIfDoctor, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({
            where: {
                id: req.body.doctor_id
            },
            attributes: { exclude: ['password', 'createdAt', 'updatedAt'] }
        });
        res.status(200).json({
            success: true,
            message: "Details of the doctor retrieved successfully",
            data: doctor
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.put("/profile", checkIfDoctor, async (req, res) => {
    const {doctor_id} = req.body;

    if(!doctor_id) {
        return res.status(401).json({
            success: false,
            message: "You need to login"
        });
    }

    try {
        await asyncUpload(req, res);

        const updateData = {
            name: req.body.name,
            email: req.body.email,
            phone_no: req.body.phone_no,
            registrationNumber: req.body.registrationNumber,
            specification: req.body.specification,
            qualification: req.body.qualification,
        };

        if(req.file) {
            updateData.image = req.file.path;
        }

        const updatedDoctor = await Doctor.update(updateData, {
            where: {
                id: doctor_id
            }
        });

        if(!updatedDoctor) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            }); 
        }

        return res.status(200).json({
            success: true,
            message: "Doctor profile updated successfully"
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.get("/appointment-stats", checkIfDoctor, async (req, res) => {
    const { doctor_id } = req.body;
    try {
        const completedAppointmentsCount = await Appointment.count({
            where: {
                doctor_id: doctor_id,
                status: "Completed"
            }
        });

        const uniquePatientsCount = await Appointment.count({
            where: {
                doctor_id: doctor_id,
                status: "Completed"
            },
            distinct: true,
            col: 'patient_id'
        });

        const appointmentsThisMonth = await Appointment.count({
            where: {
                doctor_id: doctor_id,
                start_date_time: {
                    [Op.gte]: new Date(new Date().setDate(1)),
                    [Op.lt]: new Date(new Date().setMonth(new Date().getMonth() + 1, 1))
                }
            }
        });

        const appointmentsThisWeek = await Appointment.count({
            where: {
                doctor_id: doctor_id,
                start_date_time: {
                    [Op.gte]: new Date(new Date().setDate(new Date().getDate() - new Date().getDay())),
                    [Op.lt]: new Date(new Date().setDate(new Date().getDate() + (6 - new Date().getDay())))
                }
            }
        });

        res.status(200).json({
            success: true,
            message: "Appointment statistics retrieved successfully",
            data: {
                completedAppointmentsCount,
                uniquePatientsCount,
                appointmentsThisMonth,
                appointmentsThisWeek
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.get("/review", checkIfDoctor, async (req, res) => {
    const {doctor_id} = req.body;
    try {
        const reviews = await Review.findAll({
            where: {
                doctor_id: doctor_id
            },
            include: [
                {
                    model: Patient,
                    attributes: ['name', 'image']
                }
            ]
        });
        const averageRating = await Review.findOne({
            where: {
                doctor_id: doctor_id
            },
            attributes: [[Sequelize.fn('AVG', Sequelize.col('rating')), 'averageRating']],
        })
        res.status(200).json({
            success: true,
            message: "List of reviews",
            data: reviews,
            averageRating: averageRating
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
})

router.get("/review/:doctor_id", async (req, res) => {
    const {doctor_id} = req.params;
    try {
        const reviews = await Review.findAll({
            where: {
                doctor_id: doctor_id
            },
            include: [
                {
                    model: Patient,
                    attributes: ['name', 'image']
                }
            ]
        });
        const averageRating = await Review.findOne({
            where: {
                doctor_id: doctor_id
            },
            attributes: [[Sequelize.fn('AVG', Sequelize.col('rating')), 'averageRating']],
        })
        res.status(200).json({
            success: true,
            message: "List of reviews",
            data: reviews,
            averageRating: averageRating
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
})

router.get("/notifications", checkIfDoctor, async (req, res) => {
    const {doctor_id} = req.body;
    try {
        const notifications = await Notification.findAll({
            where: {
                doctor_id: doctor_id
            },
            order: [
                ['createdAt', 'DESC']
            ]
        });
        res.status(200).json({
            success: true,
            message: "List of notifications",
            data: notifications
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
})

router.get("/notification/:notification_id", checkIfDoctor, async (req, res) => {
    const {notification_id} = req.params;
    try {
        const notification = await Notification.findOne({
            where: {
                id: notification_id
            }
        });
        res.status(200).json({
            success: true,
            message: "Notification details",
            data: notification
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
})

router.put("/read-notification/:notification_id", checkIfDoctor, async (req, res) => {
    const {notification_id} = req.params;
    try {
        const notification = await Notification.update({
            isRead: true
        }, {
            where: {
                id: notification_id
            }
        });

        if(!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }
        res.status(200).json({
            success: true,
            message: "Notification marked as read"
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
})

router.get("/unread-notifications", checkIfDoctor, async (req, res) => {
    const {doctor_id} = req.body;
    try {
        const count = await Notification.count({
            where: {
                doctor_id: doctor_id,
                isRead: false
            }
        });
        res.status(200).json({
            success: true,
            message: "List of unread notifications",
            data: count
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
})

router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const doctor = await Doctor.findOne({
            where: { id },
            attributes: {
                exclude: ['password'],
                include: [
                    [
                        literal("AVG(reviews.rating)"),
                        // fn("AVG", col("reviews.rating")), // Calculate average rating
                        "averageRating"
                    ]
                ]
            },
            include: [
                {
                    model: Review,
                    as: 'reviews',
                    include: [
                        {
                            model: Patient,
                            attributes: ['name', 'image']
                        }
                    ]
                }
            ],
            group: ['Doctor.id', 'reviews.id', 'reviews->patient.id'],
            limit: 1
        });
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }
        res.status(200).json({
            success: true,
            message: "Doctor retrieved successfully",
            data: doctor
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

module.exports = router;