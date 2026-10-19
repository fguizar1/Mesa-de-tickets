CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('usuario', 'admin'))
);

CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'media'
    CHECK (priority IN ('baja', 'media', 'alta', 'critica')),
  status TEXT NOT NULL DEFAULT 'abierto'
    CHECK (status IN ('abierto', 'en_progreso', 'resuelto', 'cerrado')),
  reporter_id INT NOT NULL REFERENCES users(id),
  assignee_id INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_history (
  id SERIAL PRIMARY KEY,
  ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id INT NOT NULL REFERENCES users(id),
  field TEXT NOT NULL CHECK (field IN ('status', 'assignee_id')),
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO users (name, role) VALUES
  ('Ana', 'usuario'),
  ('Carlos', 'admin'),
  ('Lucía', 'admin');