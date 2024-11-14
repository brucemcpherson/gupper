// all about outputing results
import fs from 'node:fs';
import { Bulker } from 'chunkosaur'
import { getGdFileId, isGs, splitBucket } from './uploads.mjs'
import path from 'path';
import { pipeline } from 'node:stream/promises';
import intoStream from 'into-stream';
import { getStorageClient, getDriveClient } from './services.mjs';
import { messExit } from './getargs.mjs';


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
const outputResult = async ({text, resultsFolder, name, mimeType, responseExtension}) => {

  const outputBase = path.basename(name) + getExtension ({mimeType, responseExtension})
  const gdFile = getGdFileId(resultsFolder)
  if (gdFile.fileId) {
    if (!gdFile.isFolder) {
      console.error(gdFile.fileId,'wasnt a folder id')
      process.exit(1)
    }
    // drive output
    const drive = getDriveClient()

    let folder = null

    try {
      folder = await drive.files.get({
        fileId: gdFile.fileId
      })

    } catch (err) {
      const mess = `folder ${gdFile.fileId} from ${resultsFolder} doesnt exist on Drive`
      console.error(mess)
      throw mess
    }


    const requestBody = {
      name: outputBase,
      parents: [folder.data.id]
    }
    const media = {
      mimeType,
      body: intoStream(text)
    }

    return drive.files.create({
      requestBody,
      media
    }).then(file => {
      console.log(
        `...created ${file.data.name} - drive ID ${file.data.id} in folder ${folder.data.id} (${folder.data.name})`)
      return file
    })

  } else if (isGs(resultsFolder)) {
    // storage output
    const storage = getStorageClient()
    const { bucketName, fileName: folderName } = splitBucket(resultsFolder)
    const outputName = folderName + outputBase
    const bucket = storage.bucket(bucketName)
    const file = bucket.file(outputName, {
      metadata: {
        contentType: mimeType,
      }
    })
    return pipeline(intoStream(text), file.createWriteStream()).then(() => {
      console.log(`...created ${file.metadata.id}`)
    })

  } else {
    // local output
    const localOutputName = resultsFolder + outputBase
    return pipeline(intoStream(text), fs.createWriteStream(localOutputName))
      .then(() => {
        console.log(`...created ${localOutputName}`)
      })

  }
}
/**
 * gemini only does 3 types of output - json, text, and text/x.enum
 * @return {string} the extension to use
 */
const getExtension = ({mimeType, responseExtension}) => {
  if (responseExtension) return responseExtension

  if (mimeType === 'application/json') return ".json"

  // everything else should be text/plain - but we'll make it an md 
  if (mimeType === "text/plain") {
    return ".md"
  } else if (mimeType === "text/x.enum") {
    return ".txt"
  } else {
    messExit("unrecognized mimeType", mimeType)
  }

}
