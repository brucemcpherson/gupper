// Make sure to include these imports:

import {
  toGemini,
  listOnGemini,
  getKey,
  bulkResults,
  pruneUploads,
  listUploads,
  deleteUpload,
  getUploads,
  initServices,
  getGeminiClient
} from './gaifiles.mjs'
import { runParams } from './getargs.mjs'
import { getPrompts } from './generate.mjs'


/**
 * upload a bunch of files from gcs to gemini
 * list is speficed in cli arg uploads=<list.text>
 * @param {object} rp cli params 
 * @return {Promise <object>[]} files that were uploaded
 */
const uploads = async (rp, list) => {

  const files = await Promise.all(
    list.map(fileName => toGemini({ fileName }).then(r => {
      const file = r?.data?.file
      if (!file) {
        throw `failed to upload ${fileName} - ${r.statusText}: ${r.status}`
      }
      console.log(`...uploaded ${file.displayName} to ${file.uri}`)
      return file
    })))
  console.log(`...${files.length} files uploaded`)
  return files
}

/**
 * remove duplicate items (matching hashes)
 * @param {object} rp cli params 
 * @returns {Promise <object>[]} items that were removed
 */
const prune = async (rp) => {
  return pruneUploads(rp)
}

/**
 * generate results
 * this would be very app specific
 * this is mine
 * @param {object} rp cli parameters 
 * @returns {object} {tokenCount, chunker, bulker } - .stats prop of bulker and chunker can be useful
 */
const generate = async (rp) => {

  // get all the files waiting
  const chunker = await listOnGemini({ maxItems: rp.maxItems, limit: rp.limit })

  // get the prompts
  const prompts = getPrompts()

  // get the content for each file

  const model = getGeminiClient().getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: prompts.schema,
    },
    systemInstruction: prompts.systemInstruction
  });

  // lets log usage too
  let tokenCount = 0

  // write out results chunks at a time
  const bulker = await bulkResults({ threshold: 5 })

  for await (const file of chunker.iterator) {
    // can selectively generate 
    if (!rp.filter || file.displayName.match (rp.filter) ) {
      const result = await model.generateContent([
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        },
        { text: prompts.promptVariants[rp.variant] }
      ]);
      console.log('...generated result for', file.displayName)
      tokenCount += result.response.usageMetadata.totalTokenCount
      bulker.pusher({
        values: [{
          name: file.displayName.replace(/.*\/(.*)\.*/, `${rp.resultsFolder}$1`)+ '.json',
          text: result.response.text()
        }]
      })
    }
  }

  const stats = await bulker.done()
  console.log(`...read ${chunker.stats.items} files`)
  console.log(`...created ${stats.items} results files`)
  console.log(`...used ${tokenCount} tokens`)
  return {
    tokenCount,
    chunker,
    bulker
  }
}

/**
 * main - any or all of cli can be run at once
 */
(async () => {
  const rp = runParams()
  // need to get the list of uploads before initializing services to see what scopes we're going to need
  const list = await (rp.uploadList || rp.upload ?  getUploads (rp) : Promise.resolve ([]))
  
  return await initServices ({rp, list})
    .then (()=> rp.deleteAll || rp.deleteItem ? deleteUpload(rp) : Promise.resolve(null))
    .then(() => list.length ? uploads(rp, list) : Promise.resolve(null))
    .then(() => rp.prune ? prune(rp) : Promise.resolve(null))
    .then(() => rp.list ? listUploads(rp) : Promise.resolve(null))
    .then(() => rp.generate ? generate(rp) : Promise.resolve(null))
})()
