const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: 'Oracle Always Free Tier AMD Ampere A1',
    islands: 404,
    generation: 'Zero-lag mathematical'
  });
});

app.get('/islands/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (id >= 1 && id <= 404) {
    res.json({
      islandId: id,
      status: 'ready',
      seed: id * 404 + id
    });
  } else {
    res.status(404).json({ error: 'Island not found' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log('Archipelago server running on port', PORT);
  console.log('Health check: http://132.226.223.180:' + PORT + '/health');
});