import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';
import { validateWorkout } from './validation.js';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'workout',
  password: process.env.DB_PASSWORD || 'local-workout-password',
  database: process.env.DB_NAME || 'workout_app',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
});
app.get('/api/muscle-groups', async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM muscle_groups ORDER BY id');
  res.json(rows);
});
app.get('/api/workouts', async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT w.id, w.name, w.workout_date AS date, w.duration_minutes AS durationMinutes,
           w.notes, mg.id AS muscleGroupId, mg.name AS muscleGroupName
    FROM workouts w
    LEFT JOIN workout_muscle_groups wmg ON wmg.workout_id = w.id
    LEFT JOIN muscle_groups mg ON mg.id = wmg.muscle_group_id
    ORDER BY w.workout_date DESC, w.id DESC, mg.id
  `);
  const workouts = new Map();
  for (const { muscleGroupId, muscleGroupName, ...workout } of rows) {
    if (!workouts.has(workout.id)) workouts.set(workout.id, { ...workout, muscleGroups: [] });
    if (muscleGroupId) workouts.get(workout.id).muscleGroups.push({ id: muscleGroupId, name: muscleGroupName });
  }
  res.json([...workouts.values()]);
});
app.post('/api/workouts', async (req, res) => {
  const error = validateWorkout(req.body);
  if (error) return res.status(400).json({ error });
  const { name, date, durationMinutes, notes = '', muscleGroupIds } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [groups] = await connection.query('SELECT id FROM muscle_groups WHERE id IN (?)', [muscleGroupIds]);
    if (groups.length !== muscleGroupIds.length) {
      await connection.rollback();
      return res.status(400).json({ error: 'One or more muscle groups do not exist.' });
    }
    const [result] = await connection.execute(
      'INSERT INTO workouts (name, workout_date, duration_minutes, notes) VALUES (?, ?, ?, ?)',
      [name.trim(), date, durationMinutes, notes.trim()],
    );
    await connection.query('INSERT INTO workout_muscle_groups (workout_id, muscle_group_id) VALUES ?',
      [muscleGroupIds.map(id => [result.insertId, id])]);
    await connection.commit();
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
app.delete('/api/workouts/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid workout ID.' });
  const [result] = await pool.execute('DELETE FROM workouts WHERE id = ?', [id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Workout not found.' });
  res.sendStatus(204);
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use(express.static(fileURLToPath(new URL('../../client/dist', import.meta.url))));
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  console.error(error);
  res.status(500).json({ error: 'The request failed. Check that MySQL is running and the schema is installed.' });
});
const server = app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => {
  console.log(`Workout API listening on http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3001}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => pool.end().then(() => process.exit(0))));
}
