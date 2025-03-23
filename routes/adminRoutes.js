const express = require("express");
const router = express.Router();
const { Admin, Doctor, Patient } = require("../models/index");

module.exports = router