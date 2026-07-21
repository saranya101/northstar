import 'dotenv/config'
import { runOpportunitySyncCli } from './cli'

process.exitCode = await runOpportunitySyncCli()
