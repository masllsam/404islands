const express = require('express');
const router = express.Router();
const { sodaManager } = require('../database/soda-manager');

// GET /islands - Retrieve a list of all islands
router.get('/', async (req, res) => {
  try {
    const islands = await sodaManager.find('islands', {});
    res.json(islands);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /islands/:id - Retrieve the details of a specific island
router.get('/:id', async (req, res) => {
  try {
    const island = await sodaManager.findById('islands', req.params.id);
    if (island) {
      res.json(island);
    } else {
      res.status(404).json({ error: 'Island not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /islands/:id/events - Create a new event for a specific island
router.post('/:id/events', async (req, res) => {
  try {
    const event = {
      ...req.body,
      island_id: req.params.id,
      timestamp: new Date().toISOString(),
    };
    const newEvent = await sodaManager.insertDocument('events', event);
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /islands/:id/controls - Update the controllable parameters of a specific island
router.put('/:id/controls', async (req, res) => {
  try {
    const island = await sodaManager.findById('islands', req.params.id);
    if (island) {
      const updatedIsland = {
        ...island,
        controls: req.body,
      };
      await sodaManager.replaceDocument('islands', req.params.id, updatedIsland);
      res.json(updatedIsland);
    } else {
      res.status(404).json({ error: 'Island not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;