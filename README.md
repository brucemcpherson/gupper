# Manage Gemini uploads, schemas and prompts

I have thousands of pdf documents to analyze using Gemini – they are currently on  Cloud storage. I’ve been playing around with prompts to get the structured output I’m looking for and I quickly found needed a way to easily upload and manage them to Gemini, and repeatedly fiddle around with the schema, prompts and uploaded files directly from my terminal session.

I also found that quite a number of these documents, despite being named differently had the same content so I needed a way of pruning uploaded documents by content to avoid analyzing the same thing multiple times.

Here’s my solution – I’ve found it super useful. Hope you do too.

‘Gupper’ cli can currently upload to Gemini, generate results and write them to these places
- local files
- Google Cloud Storage
- Google Drive

Clone this repo and see this article - https://ramblings.mcpher.com/manage-gemini-uploads-schemas-and-prompts/ for full write up on how and why to use. 


You can also install globally 
````
npm i -g gupper

eg.
node gupper -- -u my.pdf -g
````


