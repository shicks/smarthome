# fe

The primary front-end.  This consists of a simple HTTP server
that forwards requests based on subdomain to servers running
on different ports.

The configuration file consists of a JSON mapping from domain
to port.

Usage:
```
$ fe map.json
```
