if [ $# -eq 0 ]
then
    field=2
elif [ $# -ne 1 ]
then
    echo Invalid parameters
    echo Usage:
    echo "   build.sh [-patch | -minor | -major ] - defaults to -patch"
    exit 4
else
    if [ $1 == "-patch" ]
    then
        field=2
    elif [ $1 == "-minor" ]
    then
        field=1
    elif [ $1 == "-major" ]
    then
        field=0
    else
        echo Invalid parameters
        echo Usage:
        echo "   build.sh [-patch | -minor | -major ] - defaults to -patch"
        exit 4
    fi
fi

version=$(jq .version ../package.json | tr -d '"')
IFS="." read -a parts <<< $version
parts[$field]=$((${parts[$field]}+1))

if [ $field -lt 2 ]
then
    parts[2]='0'
fi
if [ $field -lt 1 ]
then
    parts[1]='0'
fi
newver=$(IFS="." ; echo "${parts[*]}")

echo This will update the version from $version to $newver and push a new tag
read -p "Do you wish to continue? [Yy] " response

if [ $response != "Y" ] && [ $response != "y" ]
then
    echo Exiting
    exit 4
fi

echo Testing npm install
npm install --dry-run || { echo 'npm install failed' ; exit 1; }

echo Updating

sed -i s/$version/$newver/ Dockerfile
sed -i "3,3 s/${version}/${newver}/" ../package.json
git add --verbose Dockerfile ../package.json && \
git commit -m ":bookmark: Bump version to $newver" && \
git push && \
git tag v$newver && \
git push origin v$newver
