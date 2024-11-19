import { listOnGemini } from "./lists.mjs"
import { getAuth, getRestService } from './services.mjs'
import { Bulker } from 'chunkosaur'
import { messExit } from "./filing.mjs"

/**
 * delete chunks of files
 * @param {object} [p={}]
 * @param {number} [p.threshold = 10] chunksize to delete
 * @return {Bulker}
 */
const bulkDelete = ({ threshold = 10 } = {}) => {

  const flusher = async ({ values }) => {

    // we'll be using application default credentials
    // plus the rest api as we can stream with the filemanager
    const auth = getAuth()
    const service = await getRestService()

    return Promise.all(values.map(name => {
      return service.files.delete({
        auth,
        name
      })
        .catch(err => {
          console.error(err.toString())
          messExit(`...failed to delete ${name}`)
        })
    }))
  }

  return new Bulker({ threshold, flusher })

}

/**
 * delete all or 1 upload
 * @param {object} args cli args
 * @param {string} [args.deleteItem] name(gemini id) of single file to delete
 * @param {boolean} [args.deleteAll] delete them all 
 * @param {boolean} report whether to report how many were deleted
 * @returns {Promise null | <Bulker>[]} bulker to removed items 
 */
export const deleteUploads = async ({ deleteItem = null, deleteAll = false, deleteItems = null } = {}, report = true) => {
  if (!deleteItem && !deleteAll && !deleteItems) return null

  if (deleteItem && deleteAll) {
    messExit`just delete 1 item by name ${deleteItem} or all ${deleteAll}`
  }

  // get a bulker for staggered deletions
  const bulker = bulkDelete()

  // get gemini upload api
  if (deleteAll || deleteItems) {
    // get a chunker to depage.
    const chunker = await listOnGemini()

    // make a list of items to delete
    const remove = []
    for await (const item of chunker.iterator) {
      if (deleteAll || (deleteItems && deleteItems.indexOf(item.name) !== -1)) {
        bulker.pusher({
          values: [item.name]
        })
      }
    }
  } else {
    bulker.pusher({
      values: [deleteItem]
    })
  }
  if (report) {
    const stats = await bulker.done()
    console.info(`...${stats.items} deleted`)
  }
  return bulker

}
