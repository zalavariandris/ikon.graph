# IKON.graph

visualizing hungarian artists network

## Deploy to gh-pages
https://medium.com/@Roli_Dori/deploy-vue-cli-3-project-to-github-pages-ebeda0705fbd
- add remote from github
```
npm run build
git add -f dist
git commit -m "dist subtree commit2"
//git push origin --delete gh-pages
git subtree push --prefix dist origin gh-pages
git rm -r dist --cached
```
