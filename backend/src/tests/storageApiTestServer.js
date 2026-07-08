const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const express = require("express");
const storageRouter = require("../routes/storage");

const app = express();
const port = 5000;

app.use("/api/storage", storageRouter);

app.get("/", (req, res) => {
  return res.json({
    status: "Storage API Test Server Running",
  });
});

app.listen(port, () => {
  console.log("=====================================");
  console.log("Storage API Test Server Started");
  console.log("http://localhost:5000");
  console.log("=====================================");
});
