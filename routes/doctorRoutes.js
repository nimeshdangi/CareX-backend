const express = require('express');
const router = express.Router();
const {Doctor} = require('../models/index');
const multer = require('multer');
const path = require("path");

// Set up storage for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/doctors/documents/'); // Directory to save the uploaded files
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // File naming convention
    }
});

// Initialize upload
const upload = multer({ storage: storage });

// Middleware to handle errors from multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: "File upload error" });
    }
    next();
};

router.post('/registration', upload.single('documents'), handleMulterError, async (req, res) => {
    const {name, email, phone_no, registrationNumber, specification, qualification, password} = req.body;
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

module.exports = router;