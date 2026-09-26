CREATE TABLE IF NOT EXISTS muscle_groups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS workouts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  workout_date DATE NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workout_date (workout_date)
);

CREATE TABLE IF NOT EXISTS workout_muscle_groups (
  workout_id INT UNSIGNED NOT NULL,
  muscle_group_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (workout_id, muscle_group_id),
  FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
  FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups(id)
);

INSERT IGNORE INTO muscle_groups (name) VALUES
  ('Chest'), ('Back'), ('Shoulders'), ('Biceps'), ('Triceps'),
  ('Core'), ('Glutes'), ('Quadriceps'), ('Hamstrings'), ('Calves');
