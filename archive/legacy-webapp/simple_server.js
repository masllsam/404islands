const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// Security and middleware
app.use(helmet());
app.use(cors({
  origin: ["https://archipelago.art", "https://uselsess.com", "https://uselsess.info", "http://132.226.223.180"],
  credentials: true
}));
app.use(morgan("combined"));
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    server: "Oracle AMD Ampere A1",
    platform: process.platform,
    nodeVersion: process.version,
    arch: process.arch
  });
});

// Island API endpoints
app.get("/islands/:id", (req, res) => {
  const islandId = parseInt(req.params.id);
  if (islandId >= 1 && islandId <= 404) {
    res.json({
      id: islandId,
      status: "generating",
      permalink: `https://archipelago.art/island/${islandId}`
    });
  } else {
    res.status(404).json({ error: "Island not found in Archipelago" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🏝️ Archipelago Island Server running on port ${PORT}`);
  console.log(`🏗️ Ready to serve 404 islands with zero lag performance`);
  console.log(`🔗 Health check: http://132.226.223.180:${PORT}/health`);
  console.log(`🌐 Island API: http://132.226.223.180:${PORT}/islands/{id}`);
});

module.exports = app;