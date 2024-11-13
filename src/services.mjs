// task sepcific: genai information extraction using gemini

import { Storage } from '@google-cloud/storage'
import { GoogleAuth } from 'google-auth-library'
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from "googleapis";

/**
 * these will populated on demand if required
 */
let storageClient = null
let restService = null
let driveService = null
let geminiClient = null
let driveClient = null


export const getDriveClient = () => {
  if (!driveClient) {
    const auth =  getDriveAuth()
    driveClient =  google.drive({version: 'v3', auth});
  }
  return driveClient
}
export const getGeminiClient = () => {
  if (!geminiClient) {
    geminiClient =  new GoogleGenerativeAI(getKey());
  }
  return geminiClient
}


// This is the gemini key from the gemini ai studio
const getKey = ({ key = "API_KEY" } = {}) => {
  const apiKey = process.env[key]
  if (!apiKey) {
    console.log (`missing api-key - set ${key} value in env with export ${key}=your api key`)
    process.exit(1)
  }
  return apiKey
}

/**
 * generate an auth object from apikey in env
 * @returns {object} auth
 */
export const getAuth = (key) => new GoogleAuth().fromAPIKey(getKey(key))

export const getDriveAuth = () => {
  const scopes = ["https://www.googleapis.com/auth/drive"]
  const auth = new google.auth.GoogleAuth({
    scopes
  })
  return auth
}

/**
 * we'll be using adc credentials so no need for any special auth here
 * @returns {Promise <*>}
 */
export const  getDriveService  = async () => {

  if (!driveService) {
    const auth = getDriveAuth()
    driveService = await auth.getClient();
  }
  return driveService
}

/**
 * we'll be using adc credentials so no need for any special auth here
 * @returns {Storage}
 */
export const getStorageClient = () => {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient
}
/**
 * we can't use the node client filemanager to uploads streams - Doesn't seem to tbe implemented at the time of writing
 * so instead we'll use the discovery service to get a rest api endpoint that can
 * https://ai.google.dev/api/files
 * 
 * @returns {Promise<object>} GenerativeAI REST service
 */
export const getRestService = async () => {
  // use discovery service to get endpoint
  if (!restService) {
    const apiKey = getKey()
    const url = `https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta&key=${apiKey}`;
    restService = await google.discoverAPI({ url });
  }
  return restService
}
