const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '..', '.env');
const text = fs.readFileSync(envPath, 'utf8');
const match = text.match(/^BENCH_BOOKING_TOKEN=(.*)$/m);
const token = match ? match[1].trim() : '';

if (!token) {
  console.log('BENCH_BOOKING_TOKEN is missing from .env');
  process.exit(1);
}

process.env.BENCH_TARGET_URL = 'http://10.10.26.159:5002/api/v1/booking';
process.env.BENCH_BEARER = token;
require('./ask.js');
