# Changelog

## 1.0.0

### BREAKING CHANGES

- Upgrade to Node 24. 

### Bug fixes

- Reuse the database pool instead of creating a new one on each request.

### Other changes

- Bump graphile-worker to 0.15.1.

## 0.2.0

- Bump rds-iam-pg to obtain latest SSL/TLS certificates for RDS.

## 0.1.3

- Fix a crash on startup.

## 0.1.2

- Fix an issue where the config won't validate.

## 0.1.1

- Fix an issue where Ajv throws an error on startup.

## 0.1.0

Initial release.
