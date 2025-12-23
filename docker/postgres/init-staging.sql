-- Create staging database (runs on container first start)
CREATE DATABASE warehouse_staging;
GRANT ALL PRIVILEGES ON DATABASE warehouse_staging TO wh;
