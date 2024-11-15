import { createRequire } from "module";
const require = createRequire(import.meta.url);
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers')
const is = require('is');
import { promises as fs } from 'fs';

export const runParams = async () => {
  const defaultArgs = await getDefaultArgs()

  return yargs(hideBin(process.argv))
    .strict(true)
    .check((argv, options) => {
      // check the correct types
      const errors = options.boolean.filter(f => f !== "help" && f !== "version")
        .filter(f => !is.boolean(argv[f]) && !is.undefined(argv[f]))
        .concat(
          options.number.filter(f => !is.number(argv[f])),
          options.string.filter(f => !is.string(argv[f]) && !is.undefined(argv[f]))
        )
      if (errors.length) {
        console.log('...these args were invalid type', errors.join(","))
        throw new Error(`...these args were invalid type ${errors.join(",")}`)
      }
      return !errors.length
    }, true)
    .version("1.0.3")
    .options({
      generate: {
        default: defaultArgs.generate || false,
        description: "generate from prompts",
        alias: "g",
        type: "boolean"
      },
      uploadList: {
        default: defaultArgs.uploadList,
        description: "file name of list of files to upload - can be gs://, gd:// or local file mixed",
        alias: "ul",
        type: "string",
        requiresArg: true,
        conflicts: ["upload"]
      },
      upload: {
        default: defaultArgs.upload,
        description: "file name to upload - can be gs://, gd:// or local file",
        alias: "u",
        type: "string",
        requiresArg: true,
        conflicts: ["uploadList"]
      },
      variant: {
        default: defaultArgs.variant || "a",
        description: "prompt variant ",
        alias: "v",
        type: 'string'
      },
      siVariant: {
        default: defaultArgs.siVariant || "a",
        description: "system instruction variant",
        alias: "siv",
        type: 'string'
      },
      filter: {
        default: defaultArgs.filter || "",
        description: "filter displayname ",
        alias: "f",
        type: 'string',
        requiresArg: true
      },
      maxItems: {
        default: defaultArgs.maxItems || Infinity,
        description: "max Items to process",
        alias: "m",
        type: 'number'
      },
      chunkSize: {
        default: defaultArgs.chunkSize || 10,
        description: "items per page to read from gemini uploads API",
        alias: "c",
        type: 'number'
      },
      threshold: {
        default: defaultArgs.threshold || 1,
        description: "threshold at which to start flushing output",
        alias: "t",
        type: 'number'
      },
      prune: {
        default: defaultArgs.prune || false,
        description: "prune duplicates uploads",
        alias: "pr",
        type: "boolean"
      },
      promptFile: {
        default: defaultArgs.promptFile || "./settings/prompts.json",
        description: "prompt variant file",
        alias: "p",
        type: "string"
      },
      schemaFile: {
        default: defaultArgs.schemaFile || "./settings/schema.json",
        description: "schema file - use 'none' if no schema required",
        alias: "s",
        type: "string"
      },
      list: {
        default: defaultArgs.list || false,
        description: "list uploads",
        alias: "l",
        type: "boolean"
      },
      deleteItem: {
        default: undefined,
        description: "delete a single item",
        alias: "d",
        requiresArg: true,
        type: "string",
        conflicts: ["deleteAll"]
      },
      deleteAll: {
        default: undefined,
        description: "delete all uploads",
        alias: "da",
        type: "boolean",
        conflicts: ["deleteItem"]
      },
      resultsFolder: {
        default: defaultArgs.resultsFolder || "./results/",
        description: "can be local, gd:// or gs://",
        alias: "r",
        requiresArg: true,
      },
      responseMimeType: {
        type: "string",
        description: "mimetype of generated reponse ",
        alias: "rmt",
        requiresArg: true,
        default: defaultArgs.responseMimeType || "application/json",
        choices: ["application/json","text/plain","text/x.enum"]
      },
      responseExtension: {
        type: "string",
        default: defaultArgs.responseExtension || "",
        description: "extension for results file - default derived from reponseMimeType",
        requiresArg: true,
        alias:"rex"
      },
      model: {
        type: "string",
        description: "gemini model to use",
        alias: "mod",
        requiresArg: true,
        default: defaultArgs.model || "gemini-1.5-flash-8b"
      }

    })
    .argv

}

export const messExit = (message='it failed') => {
  console.debug ("detected an error - giving up")
  console.debug (message)
  process.exit(1)
}

const getDefaultArgs = async () => {
  // this sets local defaults for yargs
  const defaultsFile = 'gupper.json'
  const exists = await fs.stat(defaultsFile).then(() => true, () => false);
  if (!exists) {
    console.log (`...no ${defaultsFile} found - using standard defaults`)
    return {}
  } else {
    const defaults = await fs.readFile(defaultsFile)
    try {
      return JSON.parse (defaults.toString())
    } catch (err) {
      messExit (`${defaultsFile} is not valid json`)
    }
  }
  
}