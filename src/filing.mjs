import { promises as fs } from 'fs';
import { createWriteStream } from 'node:fs';
import path from 'path';
import { getStorageClient, getDriveClient, getDriveService } from './services.mjs';
import intoStream from 'into-stream';
import { pipeline } from 'node:stream/promises';
import { getMimeType } from 'stream-mime-type'

/**
 * outs a message then exists process
 * @param {string} [message] message to output
 * @return void
 */
export const messExit = (message = 'it failed') => {
  console.error("detected an error - giving up")
  console.error(message)
  process.exit(1)
}


/**
 * parse a json file
 * @param {string} str json string
 * @param {string} [mess] if present, then display message 
 * @param {boolean} [exitOnFail] if true, fail and exit 
 * @return {object| null} the parsed result 
 */
export const tryToParse = (string, mess, exitOnFail) => {
  try {
    return JSON.parse(string)
  } catch (err) {
    console.error('...failed to parse string')
    console.error(string.slice(0, 80), '...')
    if (exitOnFail) {
      messExit(mess)
    }
    if (mess) {
      console.error(mess)
    }
    return null
  }
}

/**
 * get a json file
 * @param {object} rp cli args
 * @param {string} name file name
 * @param {boolean} [exitOnFail=true] if true, fail and exit 
 * @returns {Promise <object>} the prompt and si
 */
export const getJsonFile = async (name, exitOnFail = true) => {
  const str = await getAFile(name, exitOnFail)
  return (tryToParse(str, `...error was in file ${name}`, exitOnFail))
}

/**
 * get a json file
 * @param {object} rp cli args
 * @param {string} name file name
 * @param {boolean} [exitOnFail=true] if true, fail and exit 
 * @returns {Promise <object | null>} the file constent as a string
 */
export const getAFile = async (name, exitOnFail = true) => {

  const exists = await fileExists(name, exitOnFail)
  if (!exists) return null

  try {
    const content = await fs.readFile(name)
    return content.toString()
  } catch (err) {
    console.debug(err.toString())
    console.debug('failed to get file', name)
    if (exitOnFail) {
      messExit()
    }
    return null
  }
}

/**
 * check if a file exists
 * @param {string } name the name to check
 * @param {boolean} exitOnFail whether to exit 
 * @returns {Promise <null| object>} returns {name}
 */
export const fileExists = async (name, exitOnFail) => {
  const exists = await fs.stat(name).then(() => ({name}), () => null);
  if (!exists && exitOnFail) {
    messExit(`...file ${name} does not exist`)
  }
  return exists
}

/**
 * check if a file exists on gcs
 * @param {object } config an output config
 * @returns {Promise <null| object>} returns {name}
 */
export const gcsExists = async (config) => {
  const { gsFile, fileName} = config
  const file = await getFileFromGcs({
    bucketName: gsFile.bucketName,
    fileName
  })
  const [exists] =await file.exists()
  return exists ? {
    name: fileName
  } : null

}

/**
 * gets files in this folder with slected name - only does 1 page
 * @param {object} p 
 * @param {string} p.fileName the final filename
 * @param {string} p.folderId the parent folder
 * @param {boolean} [p.exitOnFail=false] whether to exit on failure
 * @param {number} [p.pageSize=100] how many to get at once
 * @returns 
 */
const getDrivesInFolder = async ({fileName, folderId, exitOnFail = false, pageSize = 100}) => {
  const drive = getDriveClient()
  const q =`name = '${fileName}' AND '${folderId}' in parents`
  try {
    const list = await drive.files.list ({
      q,
      pageSize
    })
    return list.data.files
  } catch (err) {
    console.error (`...failed to get contents of folder ${folderId} on drive`)
    if (exitOnFail) messExit()
    return []
  }
}

/**
 * check if a file exists on drive
 * has to check the parent folder then do a drive query
 * @param {object } config an output config
 * @returns {Promise <null| object>} returns {name}
 */
export const driveExists = async (config) => {
  const { gdFile, fileName: name} = config
  const {folder} = await getDriveFolder({gdFile, name: gdFile.fileId})
  // first one will do
  const [file] = await getDrivesInFolder ({fileName: name, folderId: folder.data.id, exitOnFail: false, pageSize:1}) 
  return file
}

/**
 * check if an output file already exists
 * @param {*} p 
 * @param {string} p.resultsFolder the output place
 * @param {string} p.name the filename
 * @param {string} p.mimeType the mimetype
 * @param {string} p.responseExtension the required responseExtension
 * @returns {Promise <object | null>} {name} if it exists on the selected platform
 */
export const doesOutputExist = async ({ resultsFolder, name, mimeType, responseExtension }) => {
  const config = await getOutputConfig({ resultsFolder, name, mimeType, responseExtension })
  if (config.gdFile) {
    // to DRIVE
    return driveExists (config)

  } else if (config.gsFile) {
    // storage output
    return gcsExists (config)

  } else {
    // local output
    return fileExists (config.fileName , false) 
  }
  
}
/**
 * get a drive folder
 * @param {object} p
 * @param {object} p.gdFile drive file config
 * @param {string} p.name the name
 * @param {boolean} exitOnFail whether to exit on a failure
 * @param {Promise <object>} {gdFile, folder}
 * @returns 
 */
export const getDriveFolder = async ({ gdFile, name, exitOnFail }) => {
  const folder = await getDriveMeta({ gdFile, name: name || gdFile.fileId, exitOnFail })
  // always exit if its not a folder
  if (folder && folder.data && folder.data.mimeType !== 'application/vnd.google-apps.folder') {
    messExit(`...${folder.data.name}: ${folder.data.id} is not a folder - it's ${folder.data.mimeType}`)
  }
  return {
    gdFile,
    folder
  }
}

/**
 * set up config for generation of output file
 * @param {object} p
 * @param {string} p.resultsFolder the results folder
 * @param {string} p.name the filename
 * @param {string} p.mimeType the mimeType
 * @param {string} p.responseExtenstion the required extension 
 * @returns 
 */
export const getOutputConfig = async ({ resultsFolder, name, mimeType, responseExtension }) => {

  const outputBase = path.basename(name) + getExtension({ mimeType, responseExtension })

  // results folder should have a single trailing '/'
  const addSlash = resultsFolder.replace(/\/*$/, '/')

  // see if this something to do with drive
  const gdFile = getGdFileId(resultsFolder)

  // could be
  if (gdFile.fileId) {
    const { folder } = await getDriveFolder({ gdFile })

    return {
      gdFile,
      fileName: outputBase,
      parents: [folder.data.id]
    }

  } else if (isGs(resultsFolder)) {
    // cloud storage ?

    const gsFile = splitBucket(addSlash)

    return {
      gsFile,
      fileName: gsFile.fileName + outputBase
    }

  } else {
    // local
    return {
      fileName: addSlash + outputBase
    }
  }
}

/**
 * returns both the meta data and a stram to get the media
 * @param {object} config file config 
 * @returns {Promise <object>} {stream, meta} a stream to the data and the file meta data
 */
const getFileFromDrive = async (config) => {

  const { gdFile, fileName: name } = config
  const drive = getDriveClient()

  const [metaResponse, streamResponse] = await (Promise.all([
    getDriveMeta({ gdFile, name, exitOnFail: true }),
    getDriveContent({ gdFile, name, exitOnFail: true })
  ]))
  const { data: meta } = metaResponse
  const { data: stream } = streamResponse
  return {
    meta,
    stream
  }

}

export const getUploadConfig = async ({ fileName }) => {

  // see if this something to do with drive
  const gdFile = getGdFileId(fileName)

  // could be drive
  if (gdFile.fileId) {
    return {
      gdFile,
      fileName
    }

  } else if (isGs(fileName)) {
    // cloud storage ?
    const gsFile = splitBucket(fileName)

    return {
      gsFile,
      fileName: gsFile.fileName
    }

  } else {
    // local
    return {
      fileName
    }
  }
}

export const putInDriveFolder = async ({ config, resultsFolder, mimeType, text }) => {
  // drive output
  const meta = await getDriveMeta({ gdFile: config.gdFile, name: resultsFolder })

  return putDriveContent({
    fileName: config.fileName,
    folderId: meta.data.id,
    mimeType,
    text,
    folderName: meta.data.name
  })
}

export const putDriveContent = async ({ fileName, folderId, mimeType, text, folderName }) => {

  const drive = getDriveClient()

  const requestBody = {
    name: fileName,
    parents: [folderId]
  }
  const media = {
    mimeType,
    body: intoStream(text)
  }

  try {
    return drive.files.create({
      requestBody,
      media
    }).then(file => {
      console.log(
        `...created ${file.data.name} - drive ID ${file.data.id} in folder ${folderId} (${folderName})`)
      return file
    })
  } catch (err) {
    console.error(err.toString())
    messExit(`...failed to create file ${fileName} in folder ${folderId} on drive`)
  }

}

/**
 * 
 * @return {Promise <object>} return  { name, mimeType, stream }
 */
export const getStreamableFromGcs = async (config) => {

  const { gsFile, fileName: name } = config
  const file = await getFileFromGcs(gsFile)
  const stream = await file.createReadStream()
  const meta = await file.getMetadata()
  const mimeType = meta[0].contentType
  return {
    name,
    mimeType,
    stream
  }

}

/**
 * 
 * @return {Promise <object>} return  { name, mimeType, stream }
 */
export const getStreamableFromDrive = async (config) => {

  const { gdFile, fileName: name } = config

  // a drive file
  if (!gdFile.isId && !gdFile.isFile) messExit('Drive input wasnt a file')

  const { meta, stream } = await getFileFromDrive(config)
  const { mimeType } = meta

  return {
    name:meta.name,
    mimeType,
    stream
  }

}


/**
 * 
 * @return {Promise <object>} return  { name, mimeType, stream }
 */
export const getStreamableFromFile = async (config) => {

  const { fileName: name } = config

  // check it exists - fail if not
  return fileExists(name, true).then(async () => {
    const fd = await fs.open(name, "r")
    const fstream = fd.createReadStream(name)
    const { stream, mime: mimeType } = await getMimeType(fstream)
    return {
      name,
      mimeType,
      stream
    }

  })
}

export const setStorageFile = ({ config, mimeType }) => {
  const storage = getStorageClient()
  const bucket = storage.bucket(config.gsFile.bucketName)

  const file = bucket.file(config.fileName, {
    metadata: {
      contentType: mimeType,
    }
  })

  return file
}

export const putInLocalFolder = async ({ config, mimeType, text }) => {
  return pipeline(intoStream(text), createWriteStream(config.fileName))
    .then(() => {
      console.info(`...created ${config.fileName}`)
    })
}

export const putInStorageFolder = async ({ config, mimeType, text }) => {
  const file = setStorageFile({ config, mimeType })
  return putStorageContent({ text, file })

}
export const putStorageContent = async ({ text, file }) => {

  return pipeline(intoStream(text), file.createWriteStream()).then(() => {
    console.info(`...created ${file.metadata.id}`)
  })

}

export const getDriveMeta = async ({ gdFile, name, exitOnFail = true }) => {

  // drive output
  const drive = getDriveClient()

  try {
    return drive.files.get({
      fileId: gdFile.fileId
    })

  } catch (err) {
    console.error(err.toString())
    if (exitOnFail) messExit(`...didnt get ${gdFile.fileId} from ${name}  from Drive`)
    return null
  }
}

export const getDriveContent = async ({ gdFile, name, exitOnFail = true }) => {

  // drive output
  const drive = getDriveClient()

  try {
    return drive.files.get({
      fileId: gdFile.fileId,
      alt: 'media'
    }, { responseType: 'stream' })

  } catch (err) {
    console.error(err.toString())
    if (exitOnFail) messExit(`...didnt get ${gdFile.fileId} from ${name}  from Drive`)
    return null
  }
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
 * gemini only does 3 types of output - json, text, and text/x.enum
 * @return {string} the extension to use
 */
export const getExtension = ({ mimeType, responseExtension }) => {
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
