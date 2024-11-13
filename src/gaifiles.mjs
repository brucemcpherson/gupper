import { google } from "googleapis";
import { Storage } from '@google-cloud/storage'
import { Chunker, Bulker } from 'chunkosaur'
import { promises as fs } from 'fs';
import { getMimeType } from 'stream-mime-type'
import { GoogleAuth } from 'google-auth-library'
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  FileState,
  GoogleAICacheManager,
  GoogleAIFileManager,
} from '@google/generative-ai/server';

let driveHandle = null
let storageHandle = null
let geminiHandle = null
let geminiClient = null
export const getGeminiClient = () => {
  if (!geminiClient) throw `run initServices first`
  return geminiClient
}
/**
 * 
 * @param {object} p
 * @param {object} rp cli params
 * @param {string[]} uploads list of files we'll be dealing with 
 * @return {Promise <void>}
 */
export const initServices = async ({ rp, list }) => {
  const { resultsFolder } = rp

  // we only need to set up clients if any are any of that type in either the resultsFolder or the list of uploads
  if (isGd(resultsFolder) || list.some(f => isGd(f))) {
    const scopes = isGd(resultsFolder)
      ? ['https://www.googleapis.com/auth/drive']
      : ['https://www.googleapis.com/auth/drive.readonly']
    const keyFile = getKey({ key: 'KEY_FILE' })
    if (!keyFile) {
      console.log('KEY_FILE name missing from env')
    }
    const auth = await getImpersonater({ keyFile, scopes, subject: "bruce@mcpher.com" })
    driveHandle = google.drive({ version: 'v3', auth });
  }

  // will we need a storage handle
  if (isGs(resultsFolder) || list.some(f => isGs(f))) {
    storageHandle = new Storage({
      projectId: "docai-369211"
    });
    /*const scopes = isGs(resultsFolder)
      ? ['https://www.googleapis.com/auth/devstorage.read_write']
      : ['https://www.googleapis.com/auth/devstorage.read_only']
    const keyFile = getKey({ key: 'KEY_FILE' })
    if (!keyFile) {
      console.log('KEY_FILE name missing from env')
    }
    const auth = await getImpersonater({ keyFile, scopes, subject: "bruce@mcpher.com" })
    storageHandle = google.drive({ version: 'v3', auth });
    */
  }

  const getService = async () => {
    // use discovery service to get endpoint
    const apiKey = getKey()
    const url = `https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta&key=${apiKey}`;
    const service = await google.discoverAPI({ url });
    return service
  }
  geminiHandle = await getService()

  geminiClient = new GoogleGenerativeAI(getKey());

}


const isGd = (fileName) => fileName.match(/^gd:\/\//)
const isGs = (fileName) => fileName.match(/^gs:\/\//)

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
 * get a key from apikey in env
 * @returns {string} key
 */
export const getKey = ({ key = "API_KEY" } = {}) => process.env[key]


/**
 * generate an auth object from apikey in env
 * @returns {object} auth
 */
export const getAuth = (key) => new google.auth.GoogleAuth().fromAPIKey(getKey(key))


/**
 * there's not much point in doing bulk with fs
 * so more for demo purposes
 * @returns {Promise <instanceOf Bulker}
 */
export const bulkResults = async ({ threshold = 1 }) => {

  const flusher = ({ values }) => {
    return Promise.all(values.map(value => {
      const { name, text } = value
      return fs.writeFile(name, text)
    }))
  }

  return new Bulker({ threshold, flusher })
}

/**
 * list all the files that have been uploaded to gemini
 * @returns {Promise <instanceof Chunker>} a chunker with an interator that can be used to step through each file
 */
export const listOnGemini = async ({ maxItems = Infinity, chunkSize = 10 } = {}) => {


  // get api key from env
  const auth = getAuth()

  // define a fetcher to handle paging
  const fetcher = async ({ meta, chunker, stats }) => {
    const { eof, auth, pageToken, maxItems, chunkSize } = meta

    // if we're done (reached maxitems or the last one had no nextpagetoken)
    if (eof || stats.items >= meta.maxItems) {
      return { done: true }
    }

    // get a page - make sure we dont get more than the max items
    const pageSize = Math.min(chunkSize, maxItems - stats.items)
    const values = await geminiHandle.files.list({
      auth,
      pageToken,
      pageSize
    })

    // prepare for next fetch
    const { nextPageToken } = values && values.data
    chunker.meta = { ...meta, pageToken: nextPageToken, eof: !nextPageToken }

    // if there's no more there'll be no next Page
    return values ? {
      values: values.data.files
    } : {
      done: true
    }
  }

  // define a chunker to get a generator
  const chunker = new Chunker({
    fetcher,
    meta: {
      auth,
      maxItems,
      chunkSize
    }
  })

  return chunker
}
/**
 * 
 * @param {object} p params
 * @param {string} p.bucketName storage bucket
 * @param {string} p.fileName 
 * @returns {Promise <Storage.File>} 
 */
const getFileFromGcs = async function ({ bucketName, fileName }) {
  const storage = new Storage();
  return storage
    .bucket(bucketName)
    .file(fileName)
}

const splitBucket = (gsName) => {
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
 * get an auth object for sa impersonator
 * @param {object} options
 * @param {object} options.keyFile the name of the serice account JSON file
 * @param {string} options.subject the email address of the account to impersonate
 * @param {string[]} options.scope the scopes required
 * @returns {Promise <GoogleAuth>}
 */
const getImpersonater = async ({ keyFile, scopes, subject }) => {

  const auth = new google.auth.JWT({
    keyFile,
    scopes,
    subject,
  });
  return auth.authorize().then(() => auth);
};


/**
 * returns both the meta data and a stram to get the media
 * @param {return}
 * @returns 
 */
const getFileFromDrive = async (fileId) => {

  const scopes = ["https://www.googleapis.com/auth/drive"]
  const auth = await getImpersonater({ keyFile: 'guppysa.json', scopes, subject: "bruce@mcpher.com" })

  const drive = google.drive({ version: 'v3', auth });

  // get metadata + a stream
  const [meta, stream] = await Promise.all([
    drive.files.get({ fileId }).then(res => res.data),
    drive.files.get({
      fileId,
      alt: 'media',
    }, {
      responseType: 'stream'
    }).then(res => res.data)
  ])

  return {
    meta,
    stream
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

  // if this is a gcs file then we do this
  if (isGs(fileName)) {
    const split = splitBucket(fileName)
    const file = await getFileFromGcs(split)
    const stream = await file.createReadStream()
    const meta = await file.getMetadata()
    const mimeType = meta[0].contentType
    displayName = displayName || file.name
    return uploadToAGemini({ mimeType, body: stream, displayName })
  } else if (isGd(fileName)) {
    // a drive file
    // this gets the file metadata
    const fileId = fileName.replace(/gd:\/\/([^\/]*)/, "$1")
    const { meta, stream } = await getFileFromDrive(fileId)
    displayName = displayName || meta.name
    return uploadToAGemini({ mimeType: meta.mimeType, body: stream, displayName })

  } else {
    // lets do a fs instead
    const fd = await fs.open(fileName, "r")
    const fstream = fd.createReadStream(fileName)
    const { stream, mime: mimeType } = await getMimeType(fstream)
    displayName = displayName || fileName
    return uploadToAGemini({ mimeType, body: stream, displayName })
  }
}

/**
 * delete all or 1 upload
 * @param {object} p params
 * @returns {Promise<object>[]} removed items 
 */
export const deleteUpload = async ({ deleteItem = null, deleteAll = false } = {}) => {
  if (deleteItem && deleteAll) {
    throw `just delete 1 item by name ${deleteItem} or all ${deleteAll}`
  }


  // get gemini upload api
  if (deleteAll) {
    const chunker = await listOnGemini()
    const remove = []
    for await (const item of chunker.iterator) {
      if (item.name === deleteItem || deleteAll) {
        remove.push(item)
      }
    }
    if (!remove.length) {
      console.log("...there were no matching items to delete")
      return remove
    } else {
      const removals = await Promise.all(remove.map(f => {
        return geminiHandle.files.delete({
          name: f.name
        })
      }))

      console.log(`...deleted ${removals.length} items`)
      return removals
    }
  } else {

    const removals = await Promise.all([geminiHandle.files.delete({
      name: deleteItem
    })])
    console.log(`...deleted ${removals.length} items - ${deleteItem}`)
    return removals
  }

}
/**
 * sometimes we have duplicate uploads
 * lets get rid of the ones with the same hash
 * @returns {Promise<object>[]} removed items
 */
export const pruneUploads = async () => {

  const chunker = await listOnGemini()
  const keep = new Map()
  const remove = []
  for await (const item of chunker.iterator) {
    if (keep.has(item.sha256Hash)) {
      const current = keep.get(item.sha256Hash)
      if (new Date(current.createTime).getTime() < new Date(item.createTime).getTime()) {
        remove.push(current)
        keep.set(item.sha256Hash, item)
      } else {
        remove.push(item)
      }
    } else {
      keep.set(item.sha256Hash, item)
    }
  }

  // now just delete these dups
  const removals = await Promise.all(remove.map(f => deleteUpload({ deleteItem: f.name })))
  console.log(`...pruned ${removals.length} duplicates`)
  return removals

}

/**
 * summarize whats on gemini
 * @returns {Promise<object>[]} list of items
 */
export const listUploads = async () => {

  const chunker = await listOnGemini()
  let uri = ""
  const list = []

  for await (const item of chunker.iterator) {
    if (!uri) {
      uri = item.uri.replace(/(.*\/).*/, "$1")
      console.log('...base uri', uri)
    }
    const now = new Date().getTime()
    const expires = Math.round((new Date(item.expirationTime).getTime() - now) / 1000 / 60)
    const output = {
      name: item.name,
      mimeType: item.mimeType,
      displayName: item.displayName,
      minutesTillExpire: expires,
      hash: item.sha256Hash
    }
    list.push(output)
  }
  console.log(JSON.stringify(list, null, 2))

}

/**
 * upload item to gemini
 * @param {*} p
 * @param {string} p.mimeType mimetype of body
 * @param {stream} p.body a stream of data
 * @param {string} p.displayName what to call the file on gemini
 * @returns {Promise<object>} gemini upload response
 */

const uploadToAGemini = async ({ mimeType, body, displayName }) => {

  const auth = getAuth()

  // upload the thing
  return geminiHandle.media.upload({
    media: {
      mimeType,
      body
    },
    requestBody: {
      file: {
        displayName
      }
    },
  });

}

