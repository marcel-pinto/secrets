require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require("passport-facebook");
const findOrCreate = require('mongoose-findorcreate');

const app = express();

const port = process.env.PORT || 3000;
const mongooseOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true 
}
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");

app.use(session({
    secret : "Our litte secret.",
    resave: false,
    saveUninitialized: true
}))

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(`mongodb://localhost:${process.env.DB_PORT}/${process.env.DB_NAME}`, mongooseOptions)
    .then(() => console.log(`Successfully connected to database ${process.env.DB_NAME} on port ${process.env.DB_PORT}`))
    .catch(err => console.log(`Database Error: ${err.message}`));

mongoose.set("useCreateIndex", true);

const userSchema = mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret: String
});

// Esse plugin ja vai cuidar de fazer o hash e o salt das senhas no banco de dados.
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("user", userSchema);

passport.use(User.createStrategy());
 
passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `http://localhost:3000/auth/google/secrets`
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.listen(port, () => console.log(`Server started at port: ${port}`));

app.get("/", (req, res) => res.render("home"));

app.get("/auth/google", (req,res) => {
   passport.authenticate("google", {scope : ["profile"]})(req, res , () => console.log("Authenticated by google"));
});

app.get("/auth/google/secrets", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  });

  app.get("/auth/facebook", (req,res) => {
    passport.authenticate("facebook")(req, res , () => console.log("Authenticated by facebook"));
 });
 
 app.get("/auth/facebook/secrets", 
   passport.authenticate("facebook", { 
      failureRedirect: "/login",
      successRedirect: "/secrets" }),
  );
 
app.get("/secrets", async (req,res) => {
    try {
        const foundUsers = await User.find({"secret" : {$ne: null}});
        if(foundUsers) {
            res.render("secrets", {usersWithSecrets: foundUsers});
        };
    } catch (error) {
        console.log(error);
    }
    
});

app.get("/logout", (req,res) => {
    req.logout();
    res.redirect("/");
});
app.route("/register")
    .get((req, res) => res.render("register"))
    .post(async (req, res) => {
        try {
            await User.register({username: req.body.username}, req.body.password);
            passport.authenticate("local")(req, res, () => res.redirect("/secrets"));
        } catch (registrationError) {
            console.log(registrationError);
            res.redirect("/register");
        }
    });

app.route("/login")
    .get((req, res) => res.render("login"))
    .post(async (req, res) => {
        const user = new User({
            username: req.body.username,
            password: req.body.password
        });
        req.login(user, (err) => {
            if(err) {
                console.log(err);
            } else {
                passport.authenticate("local")(req, res, () => res.redirect("/secrets"))
            }
        });    
    })

app.route("/submit")
    .get((req, res) =>{
        if(req.isAuthenticated()) {
            res.render("submit");
        }
        else {
            res.redirect("/login");
        }
    })
    .post(async (req, res) => {
        try {
            const foundUser = await User.findById(req.user.id);
            try {
                const submitedSecret = req.body.secret;
                foundUser.secret = submitedSecret;
                await foundUser.save();
                res.redirect("/secrets");
            } catch (saveError) {
               console.log(saveError)
            }
        } catch (searchError) {
            console.log(searchError);
        }
    })