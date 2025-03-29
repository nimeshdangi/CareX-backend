const express = require('express');
const router = express.Router();
const {Admin, Doctor, Patient, Appointment, Review} = require('../models/index');
const multer = require('multer');
const path = require("path");
const jwt = require("jsonwebtoken");
const { where, Op, Sequelize } = require('sequelize');

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
        const decodedToken = jwt.decode(token);
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
        const doctors = await Doctor.findAll({
            where: {
                status: "Approved"
            }
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

    try {
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

router.get("/time_slots", async (req, res) => {
    const {doctor_id, date} = req.query;
    console.log(date);
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
                status: "Not Booked"
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
            }
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
            message: "Doctor profile updated successfully",
            data: updatedDoctor
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

router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const doctor = await Doctor.findOne({ where: { id } });
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