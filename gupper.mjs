#!/usr/bin/env node
/**
 * manage uploads, caching and generating on gemini
 */
import { runParams } from './src/getargs.mjs'
import  { work } from './src/work.mjs'

// entry point
const main = async () => {
  
  // get args from cli
  const rp = await runParams()

  // do the work
  return work (rp)
}

main()