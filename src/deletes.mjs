import { listOnGemini } from "./lists.mjs"
import { getAuth, getRestService } from './services.mjs'

/**
 * delete all or 1 upload
 * @param {object} args cli args
 * @param {string} [args.deleteItem] name(gemini id) of single file to delete
 * @param {boolean} [args.deleteAll] delete them all 
 * @returns {Promise null | <object>[]} removed items 
 */
export const deleteUploads = async ({ deleteItem = null, deleteAll = false } = {}) => {
  if (!deleteItem && !deleteAll) return null

  if (deleteItem && deleteAll) {
    throw `just delete 1 item by name ${deleteItem} or all ${deleteAll}`
  }

  // we'll be using application default credentials
  // plus the rest api as we can stream with the filemanager
  const auth = getAuth()
  const service = await getRestService()

  // get gemini upload api
  if (deleteAll) {
    // get a chunker to depage.
    const chunker = await listOnGemini()

    // make a list of items to delete
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
        return service.files.delete({
          auth,
          name: f.name
        })
      }))

      console.log(`...deleted ${removals.length} items`)
      return removals
    }
  } else {

    // delete a single item
    const removals = await Promise.all([service.files.delete({
      name: deleteItem,
      auth
    })])
    console.log(`...deleted ${removals.length} items - ${deleteItem}`)
    return removals
  }

}
