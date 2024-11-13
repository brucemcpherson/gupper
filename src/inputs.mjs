import { promises as fs } from 'fs';
/**
 * get list of files that need to be processed
 * @param {object} args the cli arguments
 * @param {string} [args.upload] a single file to upload
 * @param {string} [args.uploadList] the name of file that contains a list of files to upload
 * @return {Promise null | <string>[]} an array of files to upload or null if nothing to do
 */
export const getInputs = async ({ upload, uploadList }) => {
  if (uploadList) {
    const uploads = await fs.readFile(uploadList)
    return uploads.toString().split("\n").filter(f => f)
  } else if (upload) {
    return [upload]
  } else {
    return null
  }
}