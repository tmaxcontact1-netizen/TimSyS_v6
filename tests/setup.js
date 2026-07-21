'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jest-minimum-32-chars';
process.env.CACHE_MAX_SIZE = '100';
process.env.CACHE_DEFAULT_TTL = '60';
process.env.SESSION_TTL = '3600';