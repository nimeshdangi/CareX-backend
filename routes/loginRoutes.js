const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {Admin, Doctor, Patient} = require('../models/index');

// const JWT_SECRET = 'awesome_secret'; // Replace with your own secret key
// const JWT_EXPIRATION = '2h'; // Token expiration time

router.post('/', async (req, res) => {
    const { email, password } = req.body;

  try {
    // Check in Admin table
    let user = await Admin.findOne({ where: { email } });
    if (user && await bcrypt.compare(password, user.password)) {
        const adminData = user.get({plain: true});
        const {password: _, ...adminWithoutPassword} = adminData;

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRATION }
        );

        return res.json({
            success: true,
            message: "Admin Login Successful",
            token: token,
            role: 'admin',
            user: adminWithoutPassword
        });
    }

    // Check in Doctor table
    user = await Doctor.findOne({ where: { email } });
    if (user) {
        if (await bcrypt.compare(password, user.password)) {
            const doctorData = user.get({plain: true});
            const {password: _, ...doctorWithoutPassword} = doctorData;

            if (user.status === 'Approved') {     
                // Generate JWT
                const token = jwt.sign(
                    { id: user.id, role: 'doctor' },
                    process.env.JWT_SECRET,
                    { expiresIn: process.env.JWT_EXPIRATION }
                );

                return res.json({
                    success: "true",
                    message: "Doctor Login Successful",
                    token,
                    role: 'doctor',
                    user: doctorWithoutPassword
                });
            } else {
                return res.status(403).json({
                    success: false,
                    message: "Your account is not approved yet. Please wait until approval."
                });
            }
        } else {
            return res.status(400).json({
                success: false,   
                message: 'Password did not match'
            });
        }
    }

    // Check in Patient table
    user = await Patient.findOne({ where: { email } });
    if (user && await bcrypt.compare(password, user.password)) {
        const patientData = user.get({plain: true});
        const {password: _, ...patientWithoutPassword} = patientData;

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, role: 'patient' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRATION }
        );

        return res.json({
            success: "true",
            message: "Patient Login Successful",
            token,
            role: 'patient',
            user: patientWithoutPassword
        });
    }

    // If no match found
    res.status(400).json({
        success: false,
        message: 'Invalid email or password'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;