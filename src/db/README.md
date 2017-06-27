# DB

This package provides a wrapper around the SQLite3 library, with the
specific purpose of running most operations out of a database in memory
(via `/dev/shm`).  Once a day, the library will back up the current
state of the database to disk, thus reducing the wear on any SD cards.
