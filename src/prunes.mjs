import { listOnGemini } from "./lists.mjs"
import { deleteUploads } from "./deletes.mjs"

/**
 * sometimes we have duplicate uploads
 * lets get rid of the ones with the same hash
 * @param {object} args cli args
 * @param {boolean} args.prune whether to prune
 * @returns {Promise<object[]>} removal stats
 */
export const pruneUploads = async ({prune}) => {
  
  // no prune requested
  if (!prune) return null

  // get a chunker to deal with paging
  const chunker = await listOnGemini()

  // this will be the list of files we want to keep
  const keep = new Map()

  // this will be the ones we want to remove
  const remove = []

  // now look at them all
  for await (const item of chunker.iterator) {

    // dedup by file hasg
    if (keep.has(item.sha256Hash)) {
      const current = keep.get(item.sha256Hash)
      
      // keep only the newest version
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
  const bulker = await deleteUploads ({deleteItems: remove.map (f=>f.name)}, false)
  const stats = await bulker.done()
  console.log(`...pruned ${stats.items} duplicates`)
  return stats

}