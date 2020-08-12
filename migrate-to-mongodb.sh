MONGO_HOST=${MONGO_HOST:=localhost}
MONGO_DBNAME=${MONGO_DBNAME:=channelhashbot}

if [ ! -d nedb-to-mongodb ]; then
    git clone https://github.com/AndrewLaneX/nedb-to-mongodb.git
    cd nedb-to-mongodb
    npm install
else
    cd nedb-to-mongodb
fi

for file in ../stores/*; do
    args="--mongodb-host $MONGO_HOST --mongodb-dbname $MONGO_DBNAME --mongodb-collection $(basename ${file%.*}) --nedb-datafile $file --keep-ids false"

    if [ -v MONGO_PORT ]; then
        args="$args --mongodb-port $MONGO_PORT"
    fi

    if [ -v MONGO_USERNAME ]; then
        args="$args --mongodb-username $MONGO_USERNAME"
    fi

    if [ -v MONGO_PASSWORD ]; then
        args="$args --mongodb-password $MONGO_PASSWORD"
    fi

    ./transfer.js $args
        
    exit_code=$?
    if [ $exit_code != 0 ]; then
        exit $exit_code
    fi
done
