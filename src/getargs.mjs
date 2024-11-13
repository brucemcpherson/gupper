import { createRequire } from "module";
const require = createRequire(import.meta.url);
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers')
const is = require('./is');

export const runParams = () => {
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
    .version("1.0.0")
    .options({
      generate: {
        default: false,
        description: "generate from prompts",
        alias: "g",
        type: "boolean"
      },
      uploadList: {
        default: undefined,
        description: "file name of list of files to upload - can be gs:// or local file mixed",
        alias: "ul",
        type: "string",
        requiresArg: true,
        conflicts: ["upload"]
      },
      upload: {
        default: undefined,
        description: "file name to upload - can be gs:// or local file",
        alias: "u",
        type: "string",
        requiresArg: true,
        conflicts: ["uploadList"]
      },
      variant: {
        default: "a",
        description: "prompt variant ",
        alias: "v",
        type: 'string'
      },
      filter: {
        default: "",
        description: "filter displayname ",
        alias: "f",
        type: 'string',
        requiresArg: true
      },
      maxItems: {
        default: Infinity,
        description: "max Items to process",
        alias: "m",
        type: 'number'
      },
      chunkSize: {
        default: 10,
        description: "items per page",
        alias: "c",
        type: 'number'
      },
      threshold: {
        default: 4,
        description: "threshold at which to start flushing output",
        alias: "t",
        type: 'number'
      },
      prune: {
        default: false,
        description: "prune duplicates uploads",
        alias: "pr",
        type: "boolean"
      },
      promptFile: {
        default: "prompts.json",
        description: "prompt variant file",
        alias: "p",
        type: "string"
      },
      schemaFile: {
        default: "schema.json",
        description: "schema file",
        alias: "s",
        type: "string"
      },
      list: {
        default: false,
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
        default: "results/",
        description: "put results here",
        alias: "r",
        requiresArg: true,
      },
      responseMimeType: {
        type: "string",
        description: "mimetype of generated reponse",
        alias: "rmt",
        requiresArg: true,
        default: "application/json"
      },
      model: {
        type: "string",
        description: "gemini model to use",
        alias: "mod",
        requiresArg: true,
        default: "gemini-1.5-flash-8b"
      }

    })
    .argv

}