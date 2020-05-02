npm run build
git add -f dist
git commit -m "dist subtree commit2"
git push origin --delete gh-pages
git subtree push --prefix dist origin gh-pages
git rm -r dist --cached