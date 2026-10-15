CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE challenges (
  id              SERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  target_per_week INT  NOT NULL CHECK (target_per_week BETWEEN 1 AND 7),
  stake           INT  NOT NULL CHECK (stake BETWEEN 1 AND 1000),
  start_date      DATE NOT NULL,
  weeks           INT  NOT NULL CHECK (weeks BETWEEN 1 AND 12),
  invite_code     TEXT NOT NULL UNIQUE,
  owner_id        INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  challenge_id INT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_on    DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (challenge_id, user_id)
);
CREATE INDEX memberships_user_idx ON memberships(user_id);

CREATE TABLE check_ins (
  id           SERIAL PRIMARY KEY,
  challenge_id INT  NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id      INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day          DATE NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  photo        BYTEA,
  photo_type   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, day)
);
CREATE INDEX check_ins_challenge_idx ON check_ins(challenge_id, created_at DESC);

CREATE TABLE votes (
  check_in_id INT     NOT NULL REFERENCES check_ins(id) ON DELETE CASCADE,
  voter_id    INT     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approve     BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (check_in_id, voter_id)
);
