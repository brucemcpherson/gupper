# check tokens have scopes required for DRIVE access
# set below to a fileid on drive you have access to
FILE_ID=11gILGX6efB1MJAaGD7comQY6BCykusO1

# get the access tokens and current project
ADT=$(gcloud auth application-default print-access-token)
UT=$(gcloud auth print-access-token)
P=$(gcloud config get project)
echo "...attempting to access file ${FILE_ID} in project ${P}"

# try them out
echo "...try using user token"
curl -H "Authorization: Bearer ${UT}" https://www.googleapis.com/drive/v3/files/${FILE_ID} \
  -H "Content-Type: application/json; charset=utf-8" 

echo "...try using adc token"
# note - you must add the x-goog-user-project header, otherwise it'll use some nonexistent project
# - see https://cloud.google.com/docs/authentication/rest#set-billing-project
curl -H "Authorization: Bearer ${ADT}" https://www.googleapis.com/drive/v3/files/${FILE_ID} \
  -H "x-goog-user-project: ${P}" \
  -H "Content-Type: application/json; charset=utf-8"

echo "...try using user token for storage"
curl -H "Authorization: Bearer ${UT}" https://www.googleapis.com/storage/v1/b?project=$P \
  -H "Content-Type: application/json; charset=utf-8"

echo "...try using ADC token for storage"
curl -H "Authorization: Bearer ${ADT}" https://www.googleapis.com/storage/v1/b?project=$P \
  -H "Content-Type: application/json; charset=utf-8"

