require('dotenv').config();
const fs = require('fs');
const https = require('https');
const express = require("express");
const cors = require("cors");
const port = 5000;
const path = require("path");
const moment = require("moment");
const {sequelize} = require("./models/index");
const testRoutes = require("./routes/testRoutes");
const loginRoutes = require("./routes/loginRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const patientRoutes = require("./routes/patientRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const {getAppointmentDetails, saveAppointmentData} = require("./services/appointment");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const { Server } = require("socket.io");

const app = express();

// Load SSL certificate files
const options = {
    key: fs.readFileSync("server.key"),
    cert: fs.readFileSync("server.cert")
};

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
app.use("/appointment", appointmentRoutes);
app.use("/test", testRoutes);
app.use("/doctor", doctorRoutes);
app.use("/patient", patientRoutes);

// API for khalti payment
app.post("/khalti-api", async (req, res) => {
    const payload = req.body;
    const khaltiResponse = await axios.post(
      "https://a.khalti.com/api/v2/epayment/initiate/",
      payload,
      {
        headers: {
          Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
        },
      }
    );
  
    if (khaltiResponse) {
      res.json({
        success: true,
        data: khaltiResponse?.data,
      });
    } else {
      res.json({
        success: false,
        message: "something went wrong",
      });
    }
});

const server = https.createServer(options, app);

server.listen(port, () => {
    // console.log("JWT SECRET:", process.env.JWT_SECRET);
    console.log(`Application is running on: https://localhost:${port}`);
})

const io = new Server(server, {
    cors: {
        origin: '*', // Replace with your frontend's URL
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
});

// // Socket.io setup and connection handling
// io.on('connection', (socket) => {
//     console.log('New client connected');

//     socket.on('joinAppointment', async ({ token, appointmentId }) => {
//         try {
//             // Decode the token to get doctorId or patientId
//             // console.log('Token:', token);
//             // console.log("Appointment Id:", appointmentId);
//             const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
//             const doctorId = decodedToken.role === 'doctor' ? decodedToken.id : null;
//             const patientId = decodedToken.role === 'patient' ? decodedToken.id : null;

//             // Fetch appointment details from DB
//             const appointment = await getAppointmentDetails(appointmentId); // Fetch appointment
//             // console.log("Appointment:", appointment);
//             // console.log("Doctor Id from database:", appointment.doctor_id);
//             // console.log("Doctor Id from token:", doctorId);
//             // console.log("Patient Id from database:", appointment.patient_id);
//             // console.log("Patient Id from token:", patientId);

//             // Check if the user is allowed to join based on token and appointment time
//             if (
//                 (doctorId === appointment.doctor_id || patientId === appointment.patient_id)) {

//                 // Join the appointment room
//                 const room = `appointment_${appointmentId}`;
//                 const clients = io.sockets.adapter.rooms.get(room);  // Get the number of clients in the room

//                 if (!clients || clients.size === 0) {
//                     // First peer to join is the caller
//                     socket.join(room);
//                     socket.emit('caller');  // Inform this peer they are the caller
//                     console.log('Caller has joined the room:', `appointment_${appointmentId}`);
//                 } else if (clients.size === 1) {
//                     // Second peer to join is the answerer
//                     socket.join(room);
//                     io.to(room).emit('peerJoined');  // Notify all peers that someone has joined
//                     socket.emit('answerer');  // Inform this peer they are the answerer
//                     console.log('Answerer has joined the room:', `appointment_${appointmentId}`);

//                     socket.emit('updateData', { symptoms: appointment.symptoms, diagnosis: appointment.diagnosis, prescription: appointment.prescription });
//                 } else {
//                     socket.emit('error', { message: 'Room is full. Only doctor and patient are allowed.' });
//                 }
//             } else {
//                 socket.emit('error', { message: 'Access denied or invalid token.' });
//             }
//         } catch (error) {
//             console.error('Error:', error.message);
//             socket.emit('error', { message: 'Authentication failed or invalid token.', error: error.message });
//         }
//     });

//     socket.on('updateData', async (data) => {
//         const { appointmentId, symptoms, diagnosis, prescription } = data;

//         console.log("Data received from client:", data)
//         // Update the database with new data
//         await saveAppointmentData(appointmentId, { symptoms, diagnosis, prescription });

//         // Broadcast the latest data to other clients
//         io.to(`appointment_${appointmentId}`).emit('updateData', { symptoms, diagnosis, prescription });
//     });

//     socket.on('offer', (offer) => {
//         const room = Array.from(socket.rooms)[1];
//         socket.to(room).emit('offer', offer);
//     });

//     socket.on('answer', (answer) => {
//         const room = Array.from(socket.rooms)[1];
//         socket.to(room).emit('answer', answer);
//     });

//     socket.on('iceCandidate', (candidate) => {
//         const room = Array.from(socket.rooms)[1];
//         socket.to(room).emit('iceCandidate', candidate);
//     });

//     socket.on('disconnect', () => {
//         console.log('Client disconnected');
//     });
// });

io.on('connection', (socket) => {
  console.log('a user connected');

  // Handle joining a room
  socket.on('joinAppointment', (roomId, token) => {
    const userId = jwt.verify(token, process.env.JWT_SECRET).id;
    const userRole = jwt.verify(token, process.env.JWT_SECRET).role;
    console.log('Joining room:', roomId, 'for ', userRole,':', userId);
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId);

    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', userId);
    });

    // Handle receiving an SDP offer
    socket.on('offer', (roomId, offer) => {
      socket.to(roomId).emit('offer', offer);
    });

    // Handle receiving an SDP answer
    socket.on('answer', (roomId, answer) => {
      socket.to(roomId).emit('answer', answer);
    });

    // Handle receiving an ICE candidate
    socket.on('ice-candidate', (roomId, candidate) => {
      socket.to(roomId).emit('ice-candidate', candidate);
    });

    socket.on('updateData', async (data) => {
        const { appointmentId, symptoms, diagnosis, prescription } = data;

        console.log("Data received from client:", data)
        // Update the database with new data
        await saveAppointmentData(appointmentId, { symptoms, diagnosis, prescription });

        // Broadcast the latest data to other clients
        io.to(`appointment_${appointmentId}`).emit('updateData', { symptoms, diagnosis, prescription });
    });
  });
});
