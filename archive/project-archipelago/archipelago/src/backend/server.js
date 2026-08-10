const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const islandRoutes = require('./api/islands');

app.use('/islands', islandRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to the 404islands API!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});