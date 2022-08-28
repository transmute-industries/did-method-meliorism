

cd ./spec

# Convert markdown to XML and HTML versions
docker run -v `pwd`:/data or13/markdown2rfc spec.md || exit 1

# Delete XML version
rm *.xml

mv *.html ../data/index.html
cp * ../data;
rm ../data/*.md ../data/*.sh

cd ..