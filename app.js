const express = require("express");
const http = require("http");
const https = require('https');
const socketIo = require("socket.io");
const path = require("path");
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const port = 3000;
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const fs = require('fs');
const sanitizeFilename = require('sanitize-filename');
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

app.get("/download", (req, res) => {
    res.render("download");
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

    socket.on("sendUrl", (e) => {
        io.emit('getUlr', e)
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
    const imagesDir = path.join(__dirname, 'downloaded_images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir);
    }
    // Listen for the 'downloadAndSave' event
    socket.on('downloadAndSave', (downloadURL) => {
        const decodedURL = decodeURIComponent(downloadURL);
        const fileName = sanitizeFilename(path.basename(decodedURL.split('?')[0]));
        const filePath = path.join(imagesDir, fileName);

        const protocol = decodedURL.startsWith('https') ? https : http;

        const file = fs.createWriteStream(filePath);
        const request = protocol.get(decodedURL, (response) => {
            if (response.statusCode === 200) {
                const contentType = response.headers['content-type'];
                if (contentType && mime.extension(contentType) === 'png') {
                    response.pipe(file);
                } else {
                    console.error('Not a PNG image');
                    file.close();
                    fs.unlinkSync(filePath); // Remove the file
                }
            } else {
                console.error('Server responded with status code:', response.statusCode);
                file.close();
                fs.unlinkSync(filePath); // Remove the file
            }
        });

        request.on('error', (error) => {
            console.error('Error downloading image:', error);
            file.close();
            fs.unlinkSync(filePath); // Remove the file
        });

        // file.on('finish', () => {
        //     console.log('Image saved:', fileName);
        //     file.close();
        //     const base64Data = fs.readFileSync(filePath, { encoding: 'base64' });
        //     socket.emit('imageSaved', { fileName, base64Data });
        // });

        file.on('finish', () => {
            file.close(() => { // Ensure the file is closed before reading
              console.log('Image saved:', fileName);
              // Only read the file if the download was successful
              if (request.statusCode === 200) {
                try {
                  const base64Data = fs.readFileSync(filePath, { encoding: 'base64' });
                //   socket.emit('imageSaved', { fileName, base64Data });
                } catch (readError) {
                  console.error('Error reading the file:', readError);
                }
              } else {
                console.error(`Download failed with status code: ${request.statusCode}`);
              }
            });
          });
          
          
    });

});

server.listen(port, () => {
    console.log(`Server is running on ${port}`);
});
