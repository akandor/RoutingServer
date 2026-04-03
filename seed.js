const db = require('./db');

const seedData = [
  { dstUri: 'sip:1001@example.com', dstIPGname: 'IPG_EU' },
  { dstUri: 'sip:1002@example.com', dstIPGname: 'IPG_US' }
];

// Generate ~50 additional test routes
for (let i = 2001; i <= 2050; i++) {
  const groupIdx = ((i - 2001) % 5) + 1; // 1..5
  seedData.push({
    dstUri: `sip:${i}@example.com`,
    dstIPGname: `IPG_TEST_${groupIdx}`
  });
}

const insert = db.prepare('INSERT OR IGNORE INTO routes (dstUri, dstIPGname, days, startTime, endTime) VALUES (?, ?, ?, ?, ?)');

// Add time-sliced samples for 1001
seedData.push({ dstUri: 'sip:1001@example.com', dstIPGname: 'IPG_EU', days: 'mon,tue,wed', startTime: '10:00', endTime: '12:00' });
seedData.push({ dstUri: 'sip:1001@example.com', dstIPGname: 'IPG_US', days: 'thu,fri,sat', startTime: '10:00', endTime: '12:00' });

db.transaction(() => {
  for (const r of seedData) {
    insert.run(r.dstUri, r.dstIPGname, r.days || null, r.startTime || null, r.endTime || null);
  }
})();

console.log('Seed completed');


