import { promises as fs } from 'fs';
import { getGeminiClient } from './services.mjs';
import { listOnGemini } from './lists.mjs';
import { bulkResults } from './outputs.mjs';

/**
 * generate results
 * @param {object} rp cli parameters
 * @param {number} [startedAt] timestamp when this session started
 * @param {string []} [inputs] list of things that were uploaded
 * @returns {object} {null | tokenCount, chunker, bulker } - .stats prop of bulker and chunker can be useful
 */
export const generate = async (rp, startedAt, inputs) => {

  if (!rp.generate) return Promise.resolve(null)

  // get all the files waiting
  const chunker = await listOnGemini({ maxItems: rp.maxItems, limit: rp.limit })

  // get the client with model, schema etc all set up
  const { gemmer, text } = await getGemmer(rp)

  // lets log usage too
  let tokenCount = 0

  // write out results chunks at a time
  const bulker = await bulkResults(rp)

  // apply filters to list of files
  const passedFilter = (file) => {
    // if this is part of an upload request, we only process the just uploaded file(s)
    if (inputs && inputs.length && new Date(file.updateTime).getTime() < startedAt) {
      return false
    }

    // if there's a filter, then apply that too
    return !rp.filter || (file.displayName.match(rp.filter) || file.name.match(rp.filter))
  }

  // work thru all selected files
  for await (const file of chunker.iterator) {
    // can selectively generate 
    if (passedFilter(file)) {

      const result = await gemmer.generateContent([
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        },
        { text }
      ]);
      console.log('...generated result for', file.displayName)
      tokenCount += result.response.usageMetadata.totalTokenCount

      bulker.pusher({
        values: [{
          file,
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
 * 
 * @param {object} rp cli args
 * @param {string} rp.promptFile json file containing prompts
 * @returns {Promise <object>} the prompt and si
 */
export const getPrompts = async ({ promptFile }) => {
  const prompts = await fs.readFile(promptFile)
  return JSON.parse(prompts.toString())
}

/**
 * 
 * @param {object} rp cli args
 * @param {string} rp.schemaFile json file containing schema
 * @returns {Promise <object>} the prompt and si
 */
export const getSchema = async ({ schemaFile }) => {
  const schema = await fs.readFile(schemaFile)
  return JSON.parse(schema.toString())
}

/**
 * get the selected variant
 * @param {object} rp the cli args 
 * @param {string} variant should refer to a key in the variants oblect of the prompts object
 * @param {string} promptFile the file containing the prompt variants
 * @param {object} prompts the promotps object (systemInstruction, variants: {})
 * @param {*} prompts 
 */
export const getVariant = ({ variant, promptFile }, prompts) => {
  // because variant can be suppled as an array we need to clean that up
  const { variants = {} } = prompts
  if (!Reflect.has(variants, variant) || !variants[variant]) {
    const mess = `no variant ${variant} in .variants in ${promptFile} file`
    console.log(mess)
    throw mess
  }
  let text = variants[variant]
  if (Array.isArray(text)) text = text.join("\n")

  return {
    systemInstruction: prompts.systemInstruction,
    text
  }
}
/**
 * make gemini query
 * @param {object} rp cli args
 * @param {string} rp.promptFile json file containing prompts
 * @param {string} rp.schemaFile json file containing schema
 * @param {string} rp.model gemini model to use
 * @param {string} rp.variant prompt variant to use
 * @param {boolean} rp.caching whether to use caching
 * @return {Promise <object> } {gemmer, text}
 */
export const getGemmer = async (rp) => {
  const { model, responseMimeType } = rp
  const [responseSchema, prompts] = await Promise.all([getSchema(rp), getPrompts(rp)])
  const { text } = getVariant(rp, prompts)
  const { systemInstruction } = prompts

  const pack = {
    model,
    generationConfig: {
      responseMimeType,
      responseSchema,
    },
    systemInstruction
  }

  const gemmer =  getGeminiClient().getGenerativeModel(pack);
  return {
    gemmer,
    text
  }
}

