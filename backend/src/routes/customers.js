const express = require("express");
const db = require("../db");
const { hashPassword, checkPassword, signToken, authRequired } = require("../auth");
const { makeId, nowIso } = require("../util");

const router = express.Router();

// POST /api/customers/register
router.post("/register", (req, res) => {
  const { name, phone, password } = req.body || {};
  if (!name || !phone || !password) {
    return res.status(400).json({ error: "Please fill in every field." });
  }
  const existing = db.prepare("SELECT id FROM customers WHERE phone = ?").get(phone);
  if (existing) {
    return res.status(409).json({ error: "That number is already registered — try logging in." });
  }
  const customer = {
    id: makeId("c"),
    name: name.trim(),
    phone: phone.trim(),
    password_hash: hashPassword(password),
    created_at: nowIso()
  };
  db.prepare(`
    INSERT INTO customers (id, name, phone, password_hash, created_at)
    VALUES (@id, @name, @phone, @password_hash, @created_at)
  `).run(customer);

  const token = signToken({ role: "customer", id: customer.id });
  res.status(201).json({ token, customer: { id: customer.id, name: customer.name, phone: customer.phone } });
});

// POST /api/customers/login
router.post("/login", (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) return res.status(400).json({ error: "Please fill in every field." });

  const customer = db.prepare("SELECT * FROM customers WHERE phone = ?").get(phone);
  if (!customer || !checkPassword(password, customer.password_hash)) {
    return res.status(401).json({ error: "No account with that number and password." });
  }
  const token = signToken({ role: "customer", id: customer.id });
  res.json({ token, customer: { id: customer.id, name: customer.name, phone: customer.phone } });
});

// GET /api/customers/me/bookings
router.get("/me/bookings", authRequired("customer"), (req, res) => {
  const rows = db.prepare(`
    SELECT bookings.*, businesses.name AS business_name, businesses.location AS business_location,
           services.name AS service_name, services.price AS service_price
    FROM bookings
    JOIN businesses ON businesses.id = bookings.business_id
    JOIN services ON services.id = bookings.service_id
    WHERE bookings.customer_id = ?
    ORDER BY bookings.date DESC, bookings.time DESC
  `).all(req.auth.id);
  res.json({ bookings: rows });
});

module.exports = router;
