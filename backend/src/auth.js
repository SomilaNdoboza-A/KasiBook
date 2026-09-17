const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function checkPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function signToken(payload) {
  // payload: { role: 'customer' | 'business', id: '...' }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

function authRequired(role) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing auth token." });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (role && decoded.role !== role) {
        return res.status(403).json({ error: "Wrong account type for this action." });
      }
      req.auth = decoded; // { role, id }
      next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
  };
}

module.exports = { hashPassword, checkPassword, signToken, authRequired };
