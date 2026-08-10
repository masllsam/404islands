const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('404islands Backend is running!');
});

// Liveness probe. Deliberately does not touch the database so that it stays
// answerable while the database is still starting up.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

module.exports = app;
