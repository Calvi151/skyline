import 'dotenv/config'
import { importSchedulesJob } from '../jobs/import-schedules.job.js'

const routes = process.argv[2] ? process.argv[2].split(',') : undefined
const days = process.argv[3] ? Number(process.argv[3]) : undefined

const t = Date.now()
importSchedulesJob(routes, days)
  .then((r) => {
    console.log(JSON.stringify({ ...r, errors: r.errors.slice(0, 10) }, null, 2))
    console.log(`Durasi: ${((Date.now() - t) / 1000).toFixed(1)}s`)
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
