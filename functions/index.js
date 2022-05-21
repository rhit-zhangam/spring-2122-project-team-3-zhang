const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({origin: true}));

app.get("/", (req, res) => {
    res.send({GMAP: process.env.GMAP,
        ROSEFIRE: process.env.ROSEFIRE});
});

exports.keys = functions.runWith({secrets: ["GMAP", "ROSEFIRE"]}).https.onRequest(app);
