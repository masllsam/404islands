--=============================================
-- ARCHIPELAGO DATABASE SETUP
--=============================================
-- Oracle SODA Collections for Island Terrain Data

-- Create user for Archipelago if needed
-- CREATE USER archipelago IDENTIFIED BY "secure_password_404";
-- GRANT CREATE SESSION TO archipelago;
-- GRANT UNLIMITED TABLESPACE TO archipelago;

-- Create SODA collections table (this will be managed by Node.js oracledb)
BEGIN
   DBMS_SODA_ADMIN.CREATE_COLLECTION(
      uri_path => '/archipelago/islands',
      collection_name => 'islands'
   );
END;
/

-- Alternative manual table structure for island data
CREATE TABLE IF NOT EXISTS archipelago_islands (
    island_id NUMBER PRIMARY KEY,
    Terrain BLOB,
    Width NUMBER,
    Height NUMBER,
    Seed NUMBER,
    Generation_Time NUMBER,
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON archipelago_islands TO PUBLIC;

-- Optional: Create index for fast island lookup
CREATE INDEX idx_island_id ON archipelago_islands(island_id);

COMMIT;

--
-- Notes:
-- This script sets up Oracle SODA (Simple Object Database Access)
-- for storing island terrain data as JSON documents.
-- The oracledb driver will handle the actual database operations.
--