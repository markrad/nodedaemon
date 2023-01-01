if [ $# -ne 1 ]
then
    echo You must pass a new version number
    exit 4
fi

version=$(jq .version ../package.json | tr -d '"')

echo This will update the version from $version to $1 and push a new tag
read -p "Do you wish to continue? [Yy] " response

if [ $response != "Y" ] && [ $response != "y" ]
then
    echo Exiting
    exit 4
fi

sed -i s/$version/$1/ Dockerfile
sed -i s/$version/$1/ ../package.json
git add --verbose Dockerfile ../package.json && \
git commit -m ":bookmark: Bump version to $1" && \
git push && \
git tag v$1 && \
git push origin v$1
