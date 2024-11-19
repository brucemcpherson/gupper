import { getGeminiClient } from './services.mjs';
import { listOnGemini } from './lists.mjs';
import { bulkResults } from './outputs.mjs';
import { getJsonFile, messExit, tryToParse, doesOutputExist } from './filing.mjs';

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
  const chunker = await listOnGemini(rp)

  // get the client with model, schema etc all set up
  const { gemmer, text } = await getGemmer(rp)

  // lets log usage too
  let tokenCount = 0

  // write out results chunks at a time
  const bulker = await bulkResults(rp)

  // apply filters to list of files
  const passedFilter = (
    file) => {
    // if this is part of an upload request, we only process the just uploaded file(s)
    if (inputs && inputs.length && new Date(file.updateTime).getTime() < startedAt) {
      return false
    }

    // if there's a filter, then apply that too
    return !rp.filter || (file.displayName.match(rp.filter) || file.name.match(rp.filter))
  }
  // whether to skip an already generated file
  const doSkip = async (file, report = true) => {
    if (!rp.skipRegenerate) return Promise.resolve(false)
    const exists = await doesOutputExist ({...rp, name: file.displayName})
    if (report && exists) {
      console.info (`...skipping generation for results file ${exists.name} as it already exists`)
    }
    return exists ? true : false
  }

  // work thru all selected files
  let failed = 0
  let lookedAt = 0

  for await (const file of chunker.iterator) {
    lookedAt ++

    // can selectively generate, handle offsets and skip already generated files
    const skip = await doSkip (file)

    if (!skip && passedFilter(file) && lookedAt > chunker.meta.offset) {
      
      try {
        const result = await gemmer.generateContent([
          {
            fileData: {
              mimeType: file.mimeType,
              fileUri: file.uri,
            },
          },
          { text }
        ]);

        tokenCount += result.response.usageMetadata.totalTokenCount

        // sometimes we don't get proper json back
        let rt = result.response.text()
        if (rp.responseMimeType === "application/json") {
          const t = tryToParse (rt, `...invalid json format hallucination in ${file.displayName}`,false)
          if(t) {
            console.info('...generated json result for', file.displayName)
            rt = JSON.stringify(t, null, 2)
          } else {
            // signal we dont want to output anything
            rt = ""
            failed ++                        
          }
        }
        else {
          console.info('...generated text result for', file.displayName)
        }

        if (rt) {
          bulker.pusher({
            values: [{
              file,
              text: rt
            }]
          })
        }
      } catch (err) {
        failed++
        console.error(err)
        console.error('...failed to generate for', file.displayName)
        console.error('...you could try running it again -may have been a hallucination', file.displayName)
      }
    }
  }

  const stats = await bulker.done()
  if (failed) {
    console.info(`...failed to generate ${failed} media files`)
    console.info('...sometimes just running it again works')
  }
  console.info(`...read ${chunker.stats.items} files`)
  console.info(`...created ${stats.items} results files`)
  console.info(`...used ${tokenCount} tokens`)
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
export const getPrompts = async ({ promptFile }) => getJsonFile(promptFile)


/**
 * 
 * @param {object} rp cli args
 * @param {string} rp.schemaFile json file containing schema
 * @returns {Promise <object>} the prompt and si
 */
export const getSchema = async ({ schemaFile }) => getJsonFile(schemaFile)


/**
 * get the selected variants for si and prompts
 * @param {object} rp the cli args 
 * @param {object} prompts the promotps object (siVariants, variants: {})
 * @return {object} {text, systemInstruction)
 */
export const getPromptText = (rp, prompts) => {
  return {
    text: getVariant(rp, prompts),
    systemInstruction: getVariant(rp, prompts, 'siVariants')
  }
}

/**
 * get the selected variant
 * @param {object} rp the cli args 
 * @param {string} rp.variant should refer to a key in the variants oblect of the prompts object
 * @param {string} rp.promptFile the file containing the prompt variants
 * @param {object} prompts the promotps object (siVariants:{}, variants: {})
 * @param {string} [variantKey='variants'] key in prompts object that contains the variants
 * @returns {string} the variant text
 */
export const getVariant = ({ variant, promptFile }, prompts, variantKey = 'variants') => {
  // because variant can be suppled as an array we need to clean that up

  if (!Reflect.has(prompts, variantKey)) {
    messExit(`no variantKey ${variantKey} in in ${promptFile} file`)
  }

  const variants = prompts[variantKey]
  if (!Reflect.has(variants, variant) || !variants[variant]) {
    messExit(`no variant ${variant} in ${variantKey} in $ ${promptFile} file`)
  }
  let text = variants[variant]
  if (Array.isArray(text)) text = text.join("\n")

  return text
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
  const [responseSchema, prompts] = await Promise.all([
    rp.schemaFile === 'none'
      ? Promise.resolve(null)
      : getSchema(rp),
    getPrompts(rp)
  ])

  const {
    text,
    systemInstruction
  } = getPromptText(rp, prompts)

  const pack = {
    model,
    generationConfig: {
      responseMimeType,
      responseSchema,
    },
    systemInstruction
  }

  const gemmer = getGeminiClient().getGenerativeModel(pack);
  return {
    gemmer,
    text
  }
}