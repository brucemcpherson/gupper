# Manage Gemini uploads, schemas and prompts

I have thousands of pdf documents to analyze using Gemini – they are currently on  Cloud storage. I’ve been playing around with prompts to get the structured output I’m looking for and I quickly found needed a way to easily upload and manage them to Gemini, and repeatedly fiddle around with the schema, prompts and uploaded files directly from my terminal session.

I also found that quite a number of these documents, despite being named differently had the same content so I needed a way of pruning uploaded documents by content to avoid analyzing the same thing multiple times.

Here’s my solution – I’ve found it super useful. Hope you do too.

‘Gupper’ cli can currently upload to Gemini, generate results and write them to these places
- local files
- Google Cloud Storage
- Google Drive

Clone this repo and see this article - https://ramblings.mcpher.com/manage-gemini-uploads-schemas-and-prompts/ for full write up on how and why to use. 

## Here are some extracts from [the gupper article](https://ramblings.mcpher.com/manage-gemini-uploads-schemas-and-prompts) below


'Gupper' cli can currently upload to Gemini, generate results and write them to these places

- local files
- Google Cloud Storage
- Google Drive

### What gupper can do right from its cli interface

`
Note: all these examples are available in v1.1.0 and above. 
`

I found it a great timesaver when playing around with variants of schemas, prompts and various assortments of files.

- Upload single or lists of files to gemini from the local filesystem, Cloud Storage or Google Drive.
- List, delete, filter and prune duplicates from uploaded files
- Generate results from uploaded files and provided schemas and prompts variants, and write results to the local filesystem, Cloud Storage or Google Drive.

### Authentication and authorization

Perhaps you want to use Google Drive and/or Google Storage in addition to local files as a source for media files or a target for generated result files. For simplicity in these examples, I'm using [Application default credentials](https://cloud.google.com/docs/authentication/client-libraries#node.js) to access Cloud services.

I have an entire article on this at [Application Default Credentials with Google Cloud and Workspace APIs](https://ramblings.mcpher.com/application-default-credentials-with-google-cloud-and-workspace-apis/), and the shells to set auth up automatically are in the shells folder in this github repo.

### Gemini Api key

Gemini requires that you provide an api key. You can get that from [aistudio](https://aistudio.google.com/apikey) then simply set it up in your environment with:

````
export GEMINI_API_KEY=your-api-key
````

#### Tip

If you have a shell file  (let's say it's called key.sh) with the export command in it, you can run it to export the value into your active shell with

````
. ./key.sh
````

But remember to not commit this to github or anywhere else. For more secure ways of handling secrets locally see, [Kubernetes secret values as shell environment variables](https://ramblings.mcpher.com/gcp/kubernetes-secret-values-as-shell-environment-variables/) and [Sharing secrets between Doppler, GCP and Kubernetes](https://ramblings.mcpher.com/gcp/secrets-doppler-gcp-kubernetes/).

### The file management cli arguments and examples

Now we have all that authorization stuff out of the way, let's get to some uploading examples. Each of these examples assumes you have cloned the repo and are running the app with node.
````
node gupper.mjs .....options
````
If you install the app globally (or use npx) you can instead use
````
gupper ...options
````  
See the end of the article for how to install globally.

#### A single local file to Gemini

````
node gupper.mjs --upload my.pdf
````

#### From Google Cloud Storage to Gemini

````
node gupper.mjs --upload gs://mybucket/myfolder/mygcs.pdf
````

#### From Google Drive to Gemini

There are 2 ways of specifying drive files

- Using a drive file id

````
node gupper.mjs --upload gd://my-drive-file-id
````

- Using a drive share url

In this case you can just copy the share link that the Drive UI can provide.

````
node gupper.mjs --upload https://drive.google.com/file/d/drive-file-id/...etc
````

#### Upload a list of files (names in a text file) to Gemini

This can be a mix of local files, drive or cloud storage uris as required, each specified as above. 1 filename per line.
````
node gupper.mjs --upload-list listoffiles.txt
````
##### Tip
gupper doesn't support wildcards, but it doesn't actually need to. 

Here's how to to load all the pdf files in the 'samples' local folder, load them to gemini and generate results on each.
````
mktemp | xargs -I {} sh -c 'ls samples/*.pdf > {} ;gupper -g --ul {};rm {}' 
````
And an example from cloud storage
````
mktemp | xargs -I {} sh -c 'gs://my-bucket/fid-callsheets/feeder/e96*.pdf > {} ;gupper -g --ul {};rm {}' 

````
You'll find wild.sh in the shells folder of the repo which you can adapt to automate this approach if you prefer.
### Get rid of duplicates from Gemini by comparing hashes

It's possible that you'll have loaded the same content from different files. To avoid running the same thing twice, you can use the prune parameter to remove files from gemini uploads that have exactly the same content
````
node gupper.mjs --prune
````

### List files on Gemini

````
node gupper.mjs --list
````
you can get a brief list with
````
node gupper.mjs --list --brief
````

### Upload, prune and list all at once

It's possible to execute a number of operations all at once. No matter which order you specify the arguments in, gupper will always execute them in a specific order. In this case upload, then prune, then list. More on this later.

````
node gupper.mjs --upload-list listoffiles.txt --prune --list
````

### Delete a single file on Gemini

This uses the gemini id displayed by gupper's --list command.

````
node gupper.mjs --delete files/1lepenpoojv7
````

### Delete all the files on Gemini

````
node gupper.mjs --delete-all
````

## Results generation

In addition to managing media files uploaded to Gemini, gupper can also run Gemini models, prompts and schemas against uploaded media files and generate the results on local storage, drive or cloud storage.

### Schema

My use case is based on generating structured data, so all my examples require an output schema. You'll find my schema file (schema.json) in the settings folder which you can use as an example, although it's very specific to my project.

You can follow this [guide](https://ai.google.dev/gemini-api/docs/structured-output?lang=node) for how to create a strutured schema file for Gemini to consume.

### Prompts

You'll also find my prompts file, which is specific to my project in the settings folder. Here's an example of prompt file structure:
````
{
 "siVariants": {
   "a":"any gemini system execution instructions",
 },
 "variants": {
   "a": "my first prompt variant",
   "anyvariantnameyouwant": [
     "my second variant",
     "to make it easier for longer prompts in json",
     "this can be an array if you want"
   ],
   ....
 }
}
````

#### Prompt variants

gupper accepts a variant argument, which will allow you to try out various prompts variantions against the same media file till you find the best one. 

````
node gupper.mjs --generate --variant a --si-variant b
````

### Generate results from all uploaded files

Without any arguments, the same schema and selected prompt variant will be applied to every uploaded file using default values for all cli args discussed above

````
node gupper.mjs --generate
````

### Generate results from all uploaded files, filtered on display name or gemini id

To run on specific file(s) you can use the filter parameter which will match the filter text on any file names or display names that contain it.

````
node gupper.mjs --generate --filter ece68e6ad5fd47
````

### Upload and generate 

If you request upload and generate at once, it will only execute those files just uploaded

````
node gupper.mjs --upload my.pdf --generate
````

### Limit number of uploaded files to process

````
node gupper.mjs --generate --max-items=2
````

### Do everything at once - delete all, upload, prune, list, filter and generate

It doesn't matter which order you provide the cli arguments in. It will always execute the provided arguments in this order (skipping the ones you don't mention)

- delete
- upload
- prune
- list
- generate

````
node gupper.mjs --generate --delete-all --upload-list listoffiles.txt --list
````

## Specifying outputs

The results folder (which should exist) will define where gupper puts any results files. These will be called display-name.json. The display name is derived from the originally uploaded file. 

The results folder can be 

- local

````
node gupper.mjs --generate --results-folder results/
````

- a drive folder id

```
node gupper.mjs --generate --results-folder gd://id-of-parent-folder
````

- a drive shared folder id
````
node gupper --generate --results-folder https://drive.google.com/drive/folders/id-of-parent/....etc
````
on cloud storage
````
node gupper.mjs --generate --results-folder gs://mybucket/myfolder/
````

### Skipping generation if output already exists
````
node gupper.mjs --generate --skip-regenerate 
````

## Specifying a prompts and schemas

### Schema file and prompt file locations

````
node gupper.mjs --schema-file ../settings/schema.json --prompt-file ../settings/prompt.json --generate
````

### Choosing a prompt variant

The variant should match the name of a property in the the variants section of the prompts.json file.
````

node gupper.mjs --generate --variant=myvariant
````

### Choosing a system instruction variant

The variant should match the name of a property in the the siVariants section of the prompts.json file.
````
node gupper.mjs --generate --si-variant=mysivariant
````

### No schema file - no problem.

If you don't need structured results you can run without a schema file. You can produce plain text (actually you'll get a markdown file), rather than json if you don't need structured results. Here's an example using a different variant from the same prompts file (which is perhaps asking for a summary of the file rather than structured data).

````
node gupper.mjs --generate --max-items 1 --variant b --si-variant b --schema-file none --response-mime-type text/plain
````

## Supported response mimeTypes

Gemini supports 3 type of output types

- application/json
- text/plain
- text/x.enum

By default gupper will produce application/json. You can change this like this. With text/plain you probably won't have a schema file.
````
node gupper.mjs --generate --schema-file none --response-mime-type text/plain
````
### text/x.enum 

Requires a special kind of schema and is used for 'controlled generation'. This is where you want to limit the responses to match a specific list. For more detail on how this works see this [blog post](https://developers.googleblog.com/en/mastering-controlled-generation-with-gemini-15-schema-adherence/#:~:text=To%20constrain%20the%20model%20output,enum%E2%80%9D.&text=The%20model%20output%20contains%20the,the%20product%20as%20%E2%80%9Cdamaged%E2%80%9D.).

## Result extensions

Gupper will pick an appropriate extension to match the responseMimeType. In fact it uses .md for text/plain since this is what Gemini tends to produce. You can pick your own extension like this

````
node gupper.mjs --generate --schema-file none --response-mime-type text/plain --response-extension .txt
````

## Gemini models

You can specify an alternative Gemini model like this

````
node gupper.mjs --generate --model gemini-1.5-flash 
````

## Cli argument defaults

Gupper has it's own defaults built in, but you can set your own with a gupper.json in your local folder. You can set any default (except --delete and --delete-all). Here's the example you'll find in gupper's repository. 
````
{
  "promptFile": "./settings/prompts.json",
  "schemaFile": "./settings/schema.json",
  "resultsFolder": "./results/",
  "responseMimeType": "application/json",
  "responseExtension": ".json",
  "model": "gemini-1.5-flash-8b",
  "variant": "a",
  "siVariant": "a"
}
````
Modify this as required.

## Help
````
node gupper.mjs --help
````

Here are all the available arguments.
````

Options:
      --help                      Show help                            [boolean]
      --version                   Show version number                  [boolean]
  -g, --generate                  generate from prompts
                                                      [boolean] [default: false]
      --skipRegenerate, --sr      skip generate if results file already exists
                                                      [boolean] [default: false]
      --uploadList, --ul          file name of list of files to upload - can be
                                  gs://, gd:// or local file mixed      [string]
  -u, --upload                    file name to upload - can be gs://, gd:// or
                                  local file                            [string]
  -v, --variant                   prompt variant         [string] [default: "a"]
      --siVariant, --siv          system instruction variant
                                                         [string] [default: "a"]
  -f, --filter                    filter displayname      [string] [default: ""]
  -m, --maxItems                  max Items to process
                                                    [number] [default: Infinity]
  -o, --offset                    start at this offset in the upload list
                                                           [number] [default: 0]
  -c, --chunkSize                 items per page to read from gemini uploads API
                                                          [number] [default: 10]
  -t, --threshold                 threshold at which to start flushing output
                                                           [number] [default: 1]
      --prune, --pr               prune duplicates uploads
                                                      [boolean] [default: false]
  -p, --promptFile                prompt variant file
                                   [string] [default: "./settings/prompts.json"]
  -s, --schemaFile                schema file - use 'none' if no schema required
                                    [string] [default: "./settings/schema.json"]
  -l, --list                      list uploads        [boolean] [default: false]
  -b, --brief                     only show minimal info
                                                      [boolean] [default: false]
  -d, --deleteItem                delete a single item                  [string]
      --deleteAll, --da           delete all uploads                   [boolean]
  -r, --resultsFolder             can be local, gd:// or gs://
                                                         [default: "./results/"]
      --responseMimeType, --rmt   mimetype of generated reponse
   [string] [choices: "application/json", "text/plain", "text/x.enum"] [default:
                                                             "application/json"]
      --responseExtension, --rex  extension for results file - default derived
                                  from reponseMimeType
                                                     [string] [default: ".json"]
      --model, --mod              gemini model to use
                                       [string] [default: "gemini-1.5-flash-8b"]
````
## shortcuts
All of the options have a short alias, as per usual shell convention. You can string some of these together: For example get a brief list of uploads and then generate against 3 uploads starting and the 2nd newest.
````
node gupper.mjs -lb -g -m 3 -o 1
```` 
is the same as
````
node gupper.mjs --list --brief --generate --max-items 3 --offset 1
````
### Combining with other shell commands
Example - get a count of the number of uploaded files
````
node gupper.mjs -lb | wc -l
````

## Chunking and bulking

Since the gemini upload API is paged, gupper uses my [Chunker and Bulker classes Paging large data sets and how to make Apps Script understand generators](https://ramblings.mcpher.com/paging-large-data-sets-and-how-to-make-apps-script-understand-generators/) to throttle input and output. This comes with a number of advanced options that you can set via cli arguments.

````
node gupper.mjs --generate --chunk-size x --max-items y --threshold z --offset o
````
where:
- chunk-size - how many to read in one go from the gemini upload api
- max-items - the maximimum number of items to process
- threshold - at which point to start writing results
- offset - where to start from - default is 0 which means the latest upload

It's unlikely you'll need to use these additional options other than --max-items. In an edge case, for example if you want to postpone any writing of any results until everything has completed successfully, then you could set the threshold to a large number. This would prevent any results files being created until the number of queued results reached the threshold or everything was complete.

## Summary

This is designed specifically for my use case, where i have lots of pdf files to deal with and want to experiment with various schemas and prompts, but it has enough flexibility to be used in most scenarios involving uploading and  trying out various prompts against various media files.

I'd love your help in supporting other scenarios. Please make a PR if you'd like to help extend.


## Installation

You can download the repo and use locally as per the examples above. 

Alternatively you can 
### Install gupper globally

````
npm install gupper -g
````

And check all is good with

````
gupper --version
````

### Use npx

````
npx gupper --version
````

### Setup
  
Whichever method you choose, remember you'll need to follow the instructions given earlier to:

- Export your gemini api key
- Set up application default credentials (if you're using google drive or google storage)
- Create a schema file if you need structured output
- Create a prompt file with your prompts and system instructions
- Optionally create a gupper.json with your favorite defaults


