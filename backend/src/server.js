require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const customerRoutes = require("./routes/customers");
const businessRoutes = require("./routes/businesses");
const serviceRoutes = require("./routes/services");
const bookingRoutes = require("./routes/bookings");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/customers", customerRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api", serviceRoutes); // exposes /api/businesses/:id/services and /api/services/:id
app.use("/api/bookings", bookingRoutes);

// Consistent error shape for anything that throws (e.g. multer file-size errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Something went wrong." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`KasiBook backend running on http://localhost:${PORT}`);
});
