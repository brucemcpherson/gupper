# this is how to simulate wild cards

# $1 the wildcard spec - for example
# sample.pdf/*
# gs://bucketname/foldername/*.pdf

if [ -z "$1" ]; then
  WILD="*.pdf"
else
  WILD="$1"
fi

# $2 how to get a brief list- for example
# ls
# gsutil ls

if [ -z "$2" ]; then
  LS="ls"
else
  LS="$2"
fi 

# $3 gupper command
if [ -z "$3" ];then
  G="gupper -g --ul"
else
  G="$3"
fi

# now execute
mktemp | xargs -I {} sh -c "${LS} ${WILD} > {} ;${G} {} -g;rm {}" 