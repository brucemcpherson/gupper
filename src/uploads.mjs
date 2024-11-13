import { promises as fs } from 'fs';
import { getAuth, getRestService, getDriveService, getStorageClient } from './services.mjs'
import { getMimeType } from 'stream-mime-type'

/**
 * specify drive files list this
 * https://drive.google.com/file/d/11gILGX6efB1MJAaGD7comQY6BCykusO1/view?usp=sharing
 * or like this
 * gd://11gILGX6efB1MJAaGD7comQY6BCykusO1
 */
export const isGd = (fileName) => fileName.match(/^gd:\/\//)
export const isGs = (fileName) => fileName.match(/^gs:\/\//)
export const isGdLink = (fileName) => fileName.match(/https:\/\/drive.google.com\//)
export const getGdFileId = (fileName) => {
  let result = {}
  if (isGd(fileName)) {
    result.fileId = fileName.replace(/gd:\/\/([^\/]*)/, "$1")
    result.isId = result.fileId
  }
  else if (isGdLink(fileName)) {
    const rx = /^https:\/\/drive\.google\.com\/(drive|file)\/(folders|d)\/([\w_-]*).*/
    result.fileId = fileName.replace(rx, "$3")
    result.isFolder = result.fileId && fileName.replace(rx, "$2") === "folders"
    result.isFile = result.fileId && fileName.replace(rx, "$2") === "d"
  } else {
    return result
  }
  if (!result.fileId) {
    console.error('failed to extract id from drive file link', fileName)
    process.exit(1)
  }
  return result


}

/**
 * extract the bucket and filename for storage path
 * @param {string} gsName in format gs://bucket/filename...
 * @returns 
 */
export const splitBucket = (gsName) => {
  if (!isGs(gsName)) {
    throw `storage uri ${gsName} is not in format gs://`
  }

  const bucketName = gsName.replace(/gs:\/\/([^\/]*).*/, "$1")
  const fileName = gsName.replace(/gs:\/\/([^\/]*)\/(.*)/, "$2")
  if (!bucketName || !fileName) {
    throw `Couldnt extract bucket and filename from ${gsName} - only support gs://bucket/file...`
  }
  return {
    bucketName,
    fileName
  }
}

/**
 * 
 * @param {object} p params
 * @param {string} p.bucketName storage bucketdelete
 * @param {string} p.fileName 
 * @returns {Promise <Storage.File>} 
 */
const getFileFromGcs = async function ({ bucketName, fileName }) {
  const storage = getStorageClient()
  return storage
    .bucket(bucketName)
    .file(fileName)
}

/**
 * returns both the meta data and a stram to get the media
 * @param {string} fileId drive file id 
 * @returns {object} {stream, meta} a stream to the data and the file meta data
 */
const getFileFromDrive = async (fileId) => {

  const drive = await getDriveService()

  // get metadata + a stream

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`
  const [metaResponse, streamResponse] = await (Promise.all([
    drive.request({ url }),
    drive.request({ url: `${url}?alt=media`, responseType: 'stream' })
  ]))
  const { data: meta } = metaResponse
  const { data: stream } = streamResponse
  return {
    meta,
    stream
  }

}

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
    const uploads = await fs.readFile(uploadList)
    return uploads.toString().split("\n").filter(f => f)
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

  // avoid duplicating this
  const gdFile = getGdFileId(fileName)

  if (gdFile.fileId) {
    // a drive file
    if (!gdFile.isId && !gdFile.isFile) {
      console.error ('Drive input wasnt a file')
      process.exit(1)
    }
    const { meta, stream } = await getFileFromDrive(gdFile.fileId)
    displayName = displayName || meta.name
    return uploadToGemini({ mimeType: meta.mimeType, stream, displayName })

  } else if (isGs(fileName)) {
    const split = splitBucket(fileName)
    const file = await getFileFromGcs(split)
    const stream = await file.createReadStream()
    const meta = await file.getMetadata()
    const mimeType = meta[0].contentType
    displayName = displayName || file.name
    return uploadToGemini({ mimeType, stream, displayName })
  }
  else {
    // lets do a fs instead
    const fd = await fs.open(fileName, "r")
    const fstream = fd.createReadStream(fileName)
    const { stream, mime: mimeType } = await getMimeType(fstream)
    displayName = displayName || fileName
    return uploadToGemini({ mimeType, stream, displayName })
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

