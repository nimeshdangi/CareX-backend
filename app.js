require('dotenv').config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = 5000;
const path = require("path");
const moment = require("moment");
const {sequelize} = require("./models/index");
const testRoutes = require("./routes/testRoutes");
const loginRoutes = require("./routes/loginRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const patientRoutes = require("./routes/patientRoutes");
const {getAppointmentDetails} = require("./services/appointment");
const jwt = require("jsonwebtoken");

const { Server } = require("socket.io");

// Serve the 'uploads' folder as static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS configuration
app.use(cors({
    origin: '*', // Replace with your frontend's URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

sequelize.sync().then(() => {
    console.log("Database connected");
}).catch((err) => {
    console.log(err);
})

app.get("/", (req, res) => {
    res.send("Hello from backend");
})

app.get("/auth", (req, res) => {
    const token = req.headers.authorization;

    if(!token) {
        return res.status(401).json({
            success: false,
            message: "No token provided"
        })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.status(200).json({
            success: true,
            data: decoded
        });
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Token expired"
            })
        }
        res.status(401).json({
            success: false,
            message: "Invalid token"
        })
    }
});

app.use("/login", loginRoutes);
app.use("/test", testRoutes);
app.use("/doctor", doctorRoutes);
app.use("/patient", patientRoutes);

const server = app.listen(port, () => {
    // console.log("JWT SECRET:", process.env.JWT_SECRET);
    console.log(`Application is running on: http://localhost:${port}`);
})

const io = new Server(server, {
    cors: {
        origin: '*', // Replace with your frontend's URL
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
});

// Socket.io setup and connection handling
io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('joinAppointment', async ({ token, appointmentId }) => {
        try {
            // Decode the token to get doctorId or patientId
            // console.log('Token:', token);
            // console.log("Appointment Id:", appointmentId);
            const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
            const doctorId = decodedToken.role === 'doctor' ? decodedToken.doctorId : null;
            const patientId = decodedToken.role === 'patient' ? decodedToken.patientId : null;

            // Fetch appointment details from DB
            const appointment = await getAppointmentDetails(appointmentId); // Fetch appointment
            // console.log("Appointment:", appointment);
            // console.log("Doctor Id:", appointment.doctorId);

            // Check if the user is allowed to join based on token and appointment time
            if (
                (doctorId === appointment.doctorId || patientId === appointment.patientId)) {

                // Join the appointment room
                const room = `appointment_${appointmentId}`;
                const clients = io.sockets.adapter.rooms.get(room);  // Get the number of clients in the room

                if (!clients || clients.size === 0) {
                    // First peer to join is the caller
                    socket.join(room);
                    socket.emit('caller');  // Inform this peer they are the caller
                    console.log('Caller has joined the room');
                } else if (clients.size === 1) {
                    // Second peer to join is the answerer
                    socket.join(room);
                    io.to(room).emit('peerJoined');  // Notify all peers that someone has joined
                    socket.emit('answerer');  // Inform this peer they are the answerer
                    console.log('Answerer has joined the room');
                } else {
                    socket.emit('error', { message: 'Room is full. Only doctor and patient are allowed.' });
                }
            } else {
                socket.emit('error', { message: 'Access denied or invalid token.' });
            }
        } catch (error) {
            console.error('Error:', error.message);
            socket.emit('error', { message: 'Authentication failed or invalid token.', error: error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});