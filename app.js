require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const saltRounds = 10;

const app = express();

const port = process.env.PORT || 3000;
const mongooseOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true 
}

mongoose.connect(`mongodb://localhost:${process.env.DB_PORT}/${process.env.DB_NAME}`, mongooseOptions)
    .then(() => console.log(`Successfully connected to database ${process.env.DB_NAME} on port ${process.env.DB_PORT}`))
    .catch(err => console.log(`Database Error: ${err.message}`));

const userSchema = mongoose.Schema({
    email: String,
    password: String
});


const User = new mongoose.model("user", userSchema);
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");

app.listen(port, () => console.log(`Server started at port: ${port}`));

app.get("/", (req, res) => res.render("home"));

app.route("/register")
    .get((req, res) => res.render("register"))
    .post(async (req, res) => {
        const newUser = new User({
            email: req.body.username,
            password: await bcrypt.hashSync(req.body.password, saltRounds)
        });
        try {
            const status = await newUser.save();
            if(status)
                res.render("secrets")
            else
                throw error = new Error("Can't complete the register.")
        } catch (error) {
            console.log(error.message);
        }
    });

app.route("/login")
    .get((req, res) => res.render("login"))
    .post(async (req, res) => {
        const username = req.body.username;
        const password = req.body.password;
// Angela faz assim no curso. Nao sei como lidar com o erro de nao encontrar o usuario usando try catch
        User.findOne({email: username}, async (err, foundUser) => {
            if(err)
                console.log(err)
            else {
                if(await bcrypt.compareSync(password, foundUser.password))
                    res.render("secrets")
                else            
                    res.send("Password incorrect")
            }
        })

        // try {
        //     const foundUser = await User.findOne({email: username});
        //     if(foundUser) {
        //         if(foundUser.password === password)
        //             res.render("secrets")
        //         else
        //             res.send("Password incorrect")
        //     } else throw notFound = "User not found!"
        // } catch (notFound) {
        //     console.log(notFound);
        // }
    
    });