// all about outputing results

import { Bulker } from 'chunkosaur'
import {
  getOutputConfig,
  putInDriveFolder,
  putInStorageFolder,
  putInLocalFolder
} from './filing.mjs';


/**
 * there's not much point in doing bulk with fs
 * so this more for demo purposes with threshold set to 1
 * this means output will be done immediately
 * it could be useful if you wanted to wait till all analysis had completed successfully befire emitting anything
 * @returns {Promise <instanceOf Bulker}
 */
export const bulkResults = async ({ threshold = 1, resultsFolder, responseMimeType, responseExtension }) => {

  const flusher = ({ values }) => Promise.all(values.map(({ file, text }) => {
    return outputResult({
      name: file.displayName,
      mimeType: responseMimeType,
      text,
      resultsFolder,
      responseExtension
    })
  }))

  return new Bulker({ threshold, flusher })
}



/**
 * generate name from file + results folder
 */
const outputResult = async ({ text, resultsFolder, name, mimeType, responseExtension }) => {

  const config = await getOutputConfig({ resultsFolder, name, mimeType, responseExtension })

  if (config.gdFile) {
    // to DRIVE
    return putInDriveFolder({ config, resultsFolder, mimeType, text })

  } else if (config.gsFile) {
    // storage output
    return putInStorageFolder({ config, mimeType, text })

  } else {
    // local output
    return putInLocalFolder({ config, text })
  }
}
