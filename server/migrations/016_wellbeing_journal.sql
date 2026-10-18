-- Owner/day journal. Independent from products: clearing a supplement inventory
-- must not delete personal wellbeing notes. Account deletion remains a cascade.
CREATE TABLE wellbeing_entries (
 user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 local_day DATE NOT NULL,
 mood TINYINT UNSIGNED NULL,
 sleep TINYINT UNSIGNED NULL,
 energy TINYINT UNSIGNED NULL,
 digestion TINYINT UNSIGNED NULL,
 observations JSON NOT NULL,
 notes VARCHAR(1000) NOT NULL DEFAULT '',
 revision INT UNSIGNED NOT NULL DEFAULT 1,
 timezone VARCHAR(80) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(user_id,local_day),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT wellbeing_ratings CHECK ((mood IS NULL OR mood BETWEEN 1 AND 5) AND (sleep IS NULL OR sleep BETWEEN 1 AND 5) AND (energy IS NULL OR energy BETWEEN 1 AND 5) AND (digestion IS NULL OR digestion BETWEEN 1 AND 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
