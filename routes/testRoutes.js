const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const {Admin} = require('../models/index');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');

router.post('/admin/registration', async (req, res) => {
    const {name, email, password} = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    try {
        // Check if the admin already exists
        const existingAdmin = await Admin.findOne({ where: { email } });
        // const existingAdmin = await Admin.findOne({ where: { email } });
        if (existingAdmin) {
            return res.status(400).json({ message: 'Admin with this email already exists' });
        }

        // Create a new admin
        const newAdmin = await Admin.create({
            name,
            email,
            password,
        });

        // Send response
        res.status(201).json({
            message: 'Admin registered successfully',
            admin: {
                name: newAdmin.name,
                email: newAdmin.email,
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;