const router = require("./routes");

const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.port || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.listen(PORT, () => {
  console.log(`Mock API start on port ${PORT}`);
});
