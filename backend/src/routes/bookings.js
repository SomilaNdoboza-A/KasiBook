const express = require("express");
const db = require("../db");
const { authRequired } = require("../auth");
const { makeId, makePaymentRef, nowIso } = require("../util");

const router = express.Router();

// POST /api/bookings  (customer-auth only)
router.post("/", authRequired("customer"), (req, res) => {
  const { business_id, service_id, date, time } = req.body || {};
  if (!business_id || !service_id || !date || !time) {
    return res.status(400).json({ error: "Missing business, service, date or time." });
  }

  const business = db.prepare("SELECT * FROM businesses WHERE id = ?").get(business_id);
  if (!business) return res.status(404).json({ error: "Business not found." });

  const service = db.prepare("SELECT * FROM services WHERE id = ? AND business_id = ?").get(service_id, business_id);
  if (!service) return res.status(404).json({ error: "Service not found for this business." });

  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(req.auth.id);
  if (!customer) return res.status(404).json({ error: "Customer not found." });

  // Slot-conflict check — the frontend does this client-side too, but the server is the source of truth.
  const clash = db.prepare(`
    SELECT id FROM bookings
    WHERE business_id = ? AND date = ? AND time = ?
      AND status NOT IN ('declined', 'cancelled')
  `).get(business_id, date, time);
  if (clash) {
    return res.status(409).json({ error: "That slot has just been taken. Please pick another time." });
  }

  const booking = {
    id: makeId("bk"),
    business_id,
    service_id,
    customer_id: customer.id,
    customer_name: customer.name,
    customer_phone: customer.phone,
    date,
    time,
    status: "confirmed", // mock payment flow — matches current frontend behaviour
    paid: 1,
    amount_paid: service.price,
    payment_ref: makePaymentRef(),
    created_at: nowIso()
  };

  db.prepare(`
    INSERT INTO bookings (id, business_id, service_id, customer_id, customer_name, customer_phone,
                           date, time, status, paid, amount_paid, payment_ref, created_at)
    VALUES (@id, @business_id, @service_id, @customer_id, @customer_name, @customer_phone,
            @date, @time, @status, @paid, @amount_paid, @payment_ref, @created_at)
  `).run(booking);

  res.status(201).json({ booking });
});

// PATCH /api/bookings/:id/cancel  (customer-auth, must own the booking)
router.patch("/:id/cancel", authRequired("customer"), (req, res) => {
  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (booking.customer_id !== req.auth.id) return res.status(403).json({ error: "This isn't your booking." });
  if (!["pending", "confirmed"].includes(booking.status)) {
    return res.status(400).json({ error: "This booking can no longer be cancelled." });
  }

  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(booking.id);
  res.json({ ok: true });
});

// PATCH /api/bookings/:id/accept  (business-auth, must own the booking)
router.patch("/:id/accept", authRequired("business"), (req, res) => {
  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (booking.business_id !== req.auth.id) return res.status(403).json({ error: "This isn't your booking." });
  if (booking.status !== "pending") return res.status(400).json({ error: "Only pending bookings can be accepted." });

  db.prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ?").run(booking.id);
  res.json({ ok: true });
});

// PATCH /api/bookings/:id/decline  (business-auth, must own the booking)
router.patch("/:id/decline", authRequired("business"), (req, res) => {
  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (booking.business_id !== req.auth.id) return res.status(403).json({ error: "This isn't your booking." });
  if (booking.status !== "pending") return res.status(400).json({ error: "Only pending bookings can be declined." });

  db.prepare("UPDATE bookings SET status = 'declined' WHERE id = ?").run(booking.id);
  res.json({ ok: true });
});

module.exports = router;
