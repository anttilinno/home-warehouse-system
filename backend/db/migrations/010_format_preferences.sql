-- migrate:up
ALTER TABLE auth.users
  ADD COLUMN time_format VARCHAR(10) NOT NULL DEFAULT '24h',
  ADD COLUMN thousand_separator VARCHAR(5) NOT NULL DEFAULT ',',
  ADD COLUMN decimal_separator VARCHAR(5) NOT NULL DEFAULT '.';

COMMENT ON COLUMN auth.users.time_format IS
'User''s preferred time format: 12h or 24h';

COMMENT ON COLUMN auth.users.thousand_separator IS
'User''s preferred thousand separator for number display: comma, period, or space';

COMMENT ON COLUMN auth.users.decimal_separator IS
'User''s preferred decimal separator for number display: period or comma';

-- migrate:down
ALTER TABLE auth.users
  DROP COLUMN time_format,
  DROP COLUMN thousand_separator,
  DROP COLUMN decimal_separator;
