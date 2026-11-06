const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Interview = require('../models/Interview');

async function cleanOldInterviews() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const cutoff = new Date('2026-11-06T00:00:00.000Z');

    // 1. Delete all interviews created before today (legacy historical mock data)
    const resultOld = await Interview.deleteMany({ date: { $lt: cutoff } });
    console.log(`Deleted ${resultOld.deletedCount} legacy interviews created before today.`);

    // 2. Delete partial abandoned test interviews with <= 3 turns and no report
    const allToday = await Interview.find({ date: { $gte: cutoff }, report: null });
    let deletedCount = 0;
    for (const inv of allToday) {
      if (!inv.turns || inv.turns.length <= 7) {
        await Interview.findByIdAndDelete(inv._id);
        deletedCount++;
      }
    }
    console.log(`Deleted ${deletedCount} abandoned partial test interviews.`);

    const remaining = await Interview.find({}, 'user role status date report turns').lean();
    console.log(`Remaining interviews in database (${remaining.length}):`);
    remaining.forEach(i => {
      console.log(`- ID: ${i._id} | Role: ${i.role} | Status: ${i.status} | Date: ${i.date} | Turns: ${i.turns?.length || 0} | HasReport: ${!!i.report}`);
    });

    await mongoose.disconnect();
    console.log('Done.');
  } catch (err) {
    console.error('Error cleaning old interviews:', err);
    process.exit(1);
  }
}

cleanOldInterviews();
