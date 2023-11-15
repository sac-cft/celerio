const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;
const mongoose = require("mongoose");
const bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.set("view engine", "ejs");
app.set("views", "views");

const mongo_URI =
    "mongodb+srv://SAC:G8BO4x3rWEDFSYqk@cluster0.btu1pyt.mongodb.net/comicon";
mongoose
    .connect(mongo_URI)
    .then((result) => {
        console.log("Connected to the MongoDB database");
    })
    .catch((error) => {
        console.error("Error connecting to the MongoDB database:", error);
    });
const userSchema = new mongoose.Schema({
    code: {
        type: String,
        required: false,
    },
    contact: {
        type: String,
        required: false,
    },
    email: {
        type: String,
        required: false,
    },
    name: {
        type: String,
        required: false,
    },
});
const User = mongoose.model("User", userSchema);

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/reg", (req, res) => {
    res.render("registartion");
});

app.get("/form", (req, res) => {
    res.render("form");
});

// Function to generate a 4-digit code
function generateCode() {
    const min = 1000;
    const max = 9999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to check if the generated code already exists in the database
async function isCodeUnique(code) {
    const existingUser = await User.findOne({ code: code });
    return !existingUser; // If existingUser is null, the code is unique
}

// Function to save user data
async function saveUserData(clientData) {
    let generatedCode;

    // Loop until a unique code is generated
    do {
        generatedCode = generateCode().toString();
    } while (!(await isCodeUnique(generatedCode)));

    // Create a new user instance with the received data and the generated code
    const newUser = new User({
        code: generatedCode,
        contact: clientData.contact,
        email: clientData.email,
        name: clientData.name,
    });

    try {
        // Save the user instance to the database
        const savedUser = await newUser.save();
        console.log('User saved successfully:', savedUser);
        io.emit("userSaved", savedUser.code);
        return savedUser;
    } catch (error) {
        console.error('Error saving user:', error.message);
        throw error;
    }
}

io.on("connection", (socket) => {
    console.log("connected");
    //User save data
    socket.on('saveUser', (e) => {
        saveUserData(e);
    })

    socket.on("startCapture", () => {
        io.emit('capture')
    })

    socket.on("sendUrl" ,(e) => {
        io.emit('getUlr',e)
    })

    socket.on("getCode", async (e) => {
        console.log(e);
        try {
          const existingUser = await User.findOne({ code: e.code });
    
          if (existingUser) {
            console.log("found");
            io.emit("userFound", e.code);
          } else {
            console.log("not - found");
            io.emit("userNotFound");
          }
        } catch (error) {
          console.error('Error checking user:', error.message);
          // Handle the error as needed
        }
      });
});

server.listen(port, () => {
    console.log(`Server is running on ${port}`);
});
