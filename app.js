require('dotenv').config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = 5000;
const path = require("path");
const {sequelize} = require("./models/index");
const testRoutes = require("./routes/testRoutes");
const loginRoutes = require("./routes/loginRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const patientRoutes = require("./routes/patientRoutes");

// Serve the 'uploads' folder as static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS configuration
app.use(cors({
    origin: '*', // Replace with your frontend's URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

sequelize.sync({ alter: true }).then(() => {
    console.log("Database connected");
}).catch((err) => {
    console.log(err);
})

app.get("/", (req, res) => {
    res.send("Hello from backend");
})

app.use("/login", loginRoutes);
app.use("/test", testRoutes);
app.use("/doctor", doctorRoutes);
app.use("/patient", patientRoutes);

app.listen(port, () => {
    console.log("JWT SECRET:", process.env.JWT_SECRET);
    console.log(`Application is running on: http://localhost:${port}`);
})