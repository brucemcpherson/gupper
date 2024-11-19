import { promises as fs } from 'fs';
import { getAuth, getRestService } from './services.mjs'

import { 
  getStreamableFromGcs, 
  getUploadConfig,
  getStreamableFromDrive,
  getStreamableFromFile,
  getAFile
} from './filing.mjs'



/**
 * upload a bunch of files from gcs to gemini
 * list is speficed in cli arg uploads=<list.text>
 * @param {string[]} [list=null] list of files to upload 
 * @return {Promise null || <object>[]} files that were uploaded
 */
export const uploads = async (list) => {

  if (!list) return null

  const files = await Promise.all(
    list.map(fileName => toGemini({ fileName })
      .then(r => {
        const file = r?.data?.file
        if (!file) {
          throw `failed to upload ${fileName} - ${r.statusText}: ${r.status}`
        }
        console.log(`...uploaded ${file.displayName} to ${file.uri}`)
        return file
      })
      .catch(err => {
        console.log(err)
      }))
  )
  console.log(`...${files.length} files uploaded`)
  return files
}

/**
 * get list of files
 */
export const getUploads = async ({ upload, uploadList }) => {
  if (uploadList) {
    const uploads = await getAFile(uploadList)
    return uploads.split("\n").filter(f => f)
  } else {
    return [upload]
  }
}


/**
 * upload file from storage to gemini
 * @param {object} p params
 * @param {string} p.fileName storage filename
 * @param {string} [p.displayName] display name on gemini
 * @returns {Promise <object>} response from gemini upload
 */
export const toGemini = async ({ fileName, displayName }) => {

  // make sense of the filename structure
  const config =  await getUploadConfig ({ fileName })

  // push the stream to gemini
  const commit = ({name, stream, mimeType}) => uploadToGemini({ 
    mimeType, 
    stream, 
    displayName: displayName || name 
  })

  // pick the appropriate platform
  if (config.gdFile) {
    return commit ( await getStreamableFromDrive(config))

  } else if (config.gsFile) {
    return commit ( await getStreamableFromGcs(config))
  }
  else {
    return commit ( await getStreamableFromFile(config))
  }

}


/**
 * upload item to gemini
 * @param {*} p
 * @param {string} p.mimeType mimetype of body
 * @param {Node.stream} p.stream a stream of data
 * @param {string} p.displayName what to call the file on gemini
 * @returns {Promise<object>} gemini upload response
 */
const uploadToGemini = async ({ mimeType, stream, displayName }) => {

  // we'll be using application default credentials
  const auth = getAuth()
  const service = await getRestService()

  // upload the thing
  return service.media.upload({
    auth,
    media: {
      mimeType,
      body: stream
    },
    requestBody: {
      file: {
        displayName
      }
    },
  });

}

