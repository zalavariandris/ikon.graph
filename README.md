# IKON.graph

Visualizing hungarian artists network (2021)

![screenshot](./docs/screenshot-light.png)

## Navigation
- *click and drag* to **pan**
- *ctrl* to **orbit**
- *scroll* or *middle mouse* to **zoom**
- click on a sphere to **highlight importan neighbors**

## Features
- curved links (with a custom glsl shader)
- multitouch navigation
- search for artists
- 2D/3D
- dark mode
- a custom physics based layout simulation
- experimental GPU based simulation

### deploy to gh-pages
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
