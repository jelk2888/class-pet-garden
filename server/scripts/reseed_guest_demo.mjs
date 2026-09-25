import { initDb, db } from '../db.js'
import { seedGuestDemoData } from '../services/guestDemoSeed.js'

initDb()
seedGuestDemoData({ forceReassign: true })

const guest = db.prepare('SELECT id FROM users WHERE username = ?').get('guest')
const cls = db.prepare('SELECT id, name FROM classes WHERE user_id = ?').get(guest.id)
const st = db.prepare('SELECT count(*) as c FROM students WHERE class_id = ?').get(cls.id)
console.log('class', cls.name, 'count', st.c)
console.log(db.prepare('SELECT name, pet_type, pet_level, total_points FROM students WHERE class_id = ? ORDER BY student_no LIMIT 8').all(cls.id))
console.log('levels', db.prepare('SELECT pet_level, count(*) as c FROM students WHERE class_id = ? GROUP BY pet_level ORDER BY pet_level').all(cls.id))
console.log('pets sample', db.prepare('SELECT DISTINCT pet_type FROM students WHERE class_id = ? LIMIT 12').all(cls.id).map(r => r.pet_type))
