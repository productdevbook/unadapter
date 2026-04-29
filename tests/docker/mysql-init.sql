-- Allow the test user to manage any database whose name starts with `better_auth`,
-- so adapter test suites can isolate themselves in dedicated databases
-- (e.g. `better_auth`, `better_auth_knex`, `better_auth_knex_numid`).
GRANT ALL PRIVILEGES ON `better\_auth%`.* TO 'user'@'%';
FLUSH PRIVILEGES;
