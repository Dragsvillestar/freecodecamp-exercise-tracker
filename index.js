const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose');
require('dotenv').config({ path: './sample.env' });

app.use(cors())
app.use(express.static('public'))

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  exercises: [
    {
      description: { type: String, required: true },
      duration: { type: Number, required: true },
      date: { type: Date, required: true }
    }
  ]
});
const User = mongoose.model('User', userSchema);


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.use(express.urlencoded({ extended: true }));

app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;

    const newUser = new User({ username });
    const savedUser = await newUser.save();

    res.json({ username: savedUser.username, _id: savedUser._id });
  } catch (err) {
    console.error('Error saving user:', err);

    if (err.code === 11000) { // Duplicate key error
      return res.status(400).json({ error: 'Username already exists' });
    }

    res.status(500).json({ error: 'Failed to save user' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users.map(user => ({ username: user.username, _id: user._id })));
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users/:_id/exercises', async (req, res) => {
  const { _id } = req.params; 
  const { description, duration } = req.body;

  let date = req.body.date ? new Date(req.body.date) : new Date();

  if (!description || !duration) {
    return res.status(400).json({ error: 'Description and duration are required' });
  }

  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const exercise = {
      description,
      duration: parseInt(duration), 
      date,
    };
    user.exercises.push(exercise);
    await user.save();

    res.json({
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString(), 
      _id: user._id,
    });
  } catch (err) {
    console.error('Error adding exercise:', err);
    res.status(500).json({ error: 'Failed to add exercise', details: err });
  }
});

app.get('/api/users/:_id/logs', async (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;

  try {
    // Find the user by ID
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build the filter for exercises
    let filters = {};
    if (from) {
      filters.date = { ...filters.date, $gte: new Date(from) };
    }
    if (to) {
      filters.date = { ...filters.date, $lte: new Date(to) };
    }

    // Fetch exercises with optional filters and limit
    let exercises = user.exercises.filter((exercise) => {
      let include = true;
      if (from) include = include && new Date(exercise.date) >= new Date(from);
      if (to) include = include && new Date(exercise.date) <= new Date(to);
      return include;
    });

    if (limit) {
      exercises = exercises.slice(0, parseInt(limit));
    }

    // Construct the response
    res.json({
      username: user.username,
      count: exercises.length,
      _id: user._id,
      log: exercises.map((exercise) => ({
        description: exercise.description,
        duration: exercise.duration,
        date: exercise.date.toDateString(),
      })),
    });
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: 'Failed to fetch logs', details: err });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
