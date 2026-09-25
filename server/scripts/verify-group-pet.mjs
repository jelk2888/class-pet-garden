import { initDb, db } from '../db.js'
initDb()
const cols = db.prepare('PRAGMA table_info(student_groups)').all().map(x => x.name)
console.log('student_groups:', cols.join(','))
console.log('group_energy_records:', !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='group_energy_records'").get())
console.log('classes.group_pet_enabled:', db.prepare('PRAGMA table_info(classes)').all().some(c => c.name === 'group_pet_enabled'))
