/**
 * manage uploads, caching and generating on gemini
 */
import { runParams } from './src/getargs.mjs'
import { uploads } from './src/uploads.mjs'
import { listUploads } from './src/lists.mjs'
import { pruneUploads } from './src/prunes.mjs'
import { getInputs } from './src/inputs.mjs'
import { deleteUploads } from './src/deletes.mjs'
import { generate } from './src/generate.mjs'
import pEachSeries from 'p-each-series';

// entry point
const main = async () => {
  
  // get args from cli
  const rp = await runParams()

  const startedAt = new Date().getTime()

  // get the list of uploads if there are any
  const inputs = await getInputs(rp)

  // now do all these things serially
  // multiple actions can be specified on the cli, but we always do them in this order
  await pEachSeries([
    () => deleteUploads(rp),
    () => uploads(inputs),
    () => pruneUploads(rp),
    () => listUploads(rp),
    () => generate(rp, startedAt, inputs)
  ], action=>action())

}

main()