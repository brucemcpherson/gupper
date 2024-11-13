/**
 * manage uploads, caching and generating on gemini
 */
import { runParams } from './getargs.mjs'
import { uploads } from './uploads.mjs'
import { listUploads } from './lists.mjs'
import { pruneUploads } from './prunes.mjs'
import { getInputs } from './inputs.mjs'
import { deleteUploads } from './deletes.mjs'
import pEachSeries from 'p-each-series';
import { generate } from './generate.mjs'

// entry point
const main = async () => {
  
  // get args from cli
  const rp = runParams()

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