-- Enable PostGIS extension on first database initialization
CREATE EXTENSION IF NOT EXISTS postgis;
-- Optional topology extension
-- CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable uuid-ossp for uuid_generate_v4() used in migrations
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
