import { getAuth, getRestService } from './services.mjs'
import { Chunker } from 'chunkosaur'

/**
 * list all the files that have been uploaded to gemini
 * @returns {Promise <Chunker>} a chunker with an interator that can be used to step through each file
 */
export const listOnGemini = async ({ maxItems = Infinity, chunkSize = 10, offset = 0 } = {}) => {

  // we'll be using application default credentials
  const auth = getAuth()
  const service = await getRestService()

  // define a fetcher to handle paging
  const fetcher = async ({ meta, chunker, stats }) => {
    const { eof, auth, pageToken, maxItems, chunkSize, offset } = meta

    // if we're done (reached maxitems or the last one had no nextpagetoken)
    if (eof || stats.items  >= meta.maxItems + offset) {
      return { done: true }
    }

    // get a page - make sure we dont get more than the max items
    const pageSize = Math.min(chunkSize, maxItems - stats.items + offset)
    const values = await service.files.list({
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
      chunkSize,
      offset
    }
  })

  return chunker
}

/**
 * summarize whats on gemini
 * @param {object} args cli args
 * @param {boolean} args.list whether list is required
 * @returns {Promise<Chunker>} generator for list of items
 */
export const listUploads = async (rp) => {
  const { list, brief } = rp
  if (!list) return Promise.resolve(null)

  const chunker = await listOnGemini(rp)

  const items = []
  let lookedAt = 0
  const now = new Date().getTime()

  for await (const item of chunker.iterator) {

    // we can use the offset if we want to skip some
    lookedAt++
    if (lookedAt > chunker.meta.offset) {
      const expires = Math.round((new Date(item.expirationTime).getTime() - now) / 1000 / 60)
      const output = {
        name: item.name,
        mimeType: item.mimeType,
        displayName: item.displayName,
        minutesTillExpire: expires,
        hash: item.sha256Hash,
        uri: item.uri,
        updatedAt: new Date(item.updateTime).toISOString(),
        createdAt: new Date(item.createTime).toISOString(),
      }

      items.push(output)
    }
  }

  if (brief) {
    console.info(
      items.map(f => ([f.name, f.displayName].join(" "))).join("\n")
    )
  } else {
    console.info(JSON.stringify(items, null, 2))
  }
  return chunker
}