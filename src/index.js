
import './style.css'

// Data
import axios from 'axios';

// Graph
import {Graph} from 'graphology'
import {subGraph} from 'graphology-utils';
import toUndirected from 'graphology-operators/to-undirected';

// View
import * as THREE from 'three'
import GraphComponent from './GraphComponent';
import AutoCompleteComponent from './AutoCompleteComponent.js'

/***** GLOBALS *****/
// Graph model
var artistgraph; // graphology graph

// Graph View
var graphComponent; // 3D graph component

// UI
var colorModeBtn;
var playButton;
var searchComponent;
var infoBox;

/***** GRAPH *****/
function importantNeighbors(graph, n, importance=1){
	const edges = graph.edges(n);
	const weights = edges.map(e=>graph.getEdgeAttribute(e, 'weight'));
	const weightMin = weights.reduce((current, value)=>value<current ? value:current);
	const weightMax = weights.reduce((current, value)=>value>current ? value:current);
	const weightSum = weights.reduce((current, value)=>value+current, 0);
	const weightAvg = weightSum/edges.length;
	graph.edges(n)
	return graph.neighbors(n).filter(neighbor=>{
		const e = graph.edge(n, neighbor);
		return graph.getEdgeAttribute(e, 'weight')>(weightAvg*1+weightMax*importance)/(1+importance);
	})
}

function loadGraph(){
	const progressBar = document.createElement('progress');
	progressBar.id = 'progressBar';
	document.body.appendChild(progressBar);
	axios.get('/src/data/artists_w3_v2.json', {
		onDownloadProgress: (event)=>{
			const progress = event.loaded/event.total
			progressBar.value = progress;
		}
	}).then(e=>{
		document.body.removeChild(progressBar);

		createGraph(e.data);
		init();

	});
}

loadGraph();

function createGraph(graphData){
	// /* Import graph */
	artistgraph = new Graph()
	artistgraph.import(graphData);

	for(let n of artistgraph.nodes()){
		/* Adjust initial node 2D positions */
		const x = artistgraph.getNodeAttribute(n, 'x');
		const y = artistgraph.getNodeAttribute(n, 'y');
		artistgraph.setNodeAttribute(n, 'x', x*100*2.5-160);
		artistgraph.setNodeAttribute(n, 'y', y*100*2.5-65);

		/* Adjust initial 3D positions */
		let pos3D = new THREE.Vector3().fromArray( artistgraph.getNodeAttribute(n, 'pos3D') )
		let m = new THREE.Matrix4().compose(
			new THREE.Vector3(10,-15,-20),
			new THREE.Quaternion().setFromEuler(new THREE.Euler( -2.8185335772428246, 0.8317149667489626+Math.PI,  0.4149537506579619)),
			new THREE.Vector3(10000,10000,10000));
		pos3D.applyMatrix4(m);
		pos3D.toArray(artistgraph.getNodeAttribute(n, 'pos3D'));

		/* Adjust colors for dark background*/
		let hsl = { h: 0, s: 0, l: 0 };
		new THREE.Color(
			artistgraph.getNodeAttribute(n, 'r')/255,
			artistgraph.getNodeAttribute(n, 'g')/255,
			artistgraph.getNodeAttribute(n, 'b')/255
		).getHSL(hsl);
		
		if(hsl.s<0.5 && hsl.l<0.3){
			const newColor = new THREE.Color().setHSL(hsl.h, hsl.s, 1-hsl.l);

			artistgraph.setNodeAttribute(n, 'r', newColor.r*255);
			artistgraph.setNodeAttribute(n, 'g', newColor.g*255);
			artistgraph.setNodeAttribute(n, 'b', newColor.b*255);
		}
	}

	/* convert to undireted */
	artistgraph = toUndirected(artistgraph);

	/* filter graph to artist neighbors */
	// artistgraph = subGraph(artistgraph, importantNeighbors(artistgraph, "Maurer Dóra", 0.5));
	window.artistgraph = artistgraph;
}

/***** VIZ *****/
function init(){
	/* container */
	const container = document.createElement('div');
	container.id = 'container';
	container.classList.add('container');
	document.body.appendChild(container);

	/* graph */
	const graph = {
		nodes: artistgraph.nodes().map(n=>new Object({
			key: n,
			// x: artistgraph.getNodeAttribute(n, 'pos3D')[0]*10000,
			// y: artistgraph.getNodeAttribute(n, 'pos3D')[1]*10000,
			// z: artistgraph.getNodeAttribute(n, 'pos3D')[2]*10000,
			x: artistgraph.getNodeAttribute(n, 'x'),
			y: artistgraph.getNodeAttribute(n, 'y'),
			z: Math.random()*0.1,
			r: artistgraph.getNodeAttribute(n, 'r')/255,
			g: artistgraph.getNodeAttribute(n, 'g')/255,
			b: artistgraph.getNodeAttribute(n, 'b')/255,
			size: (2+artistgraph.getNodeAttribute(n, 'eigencentrality')*100)*devicePixelRatio,
			fontSize: 10+artistgraph.getNodeAttribute(n, 'eigencentrality')*50*devicePixelRatio,
			hovered: false,
			highlighted: false,
			selected: false
		})),
		edges: artistgraph.edges().map(e=>{
			const sourceIdx = artistgraph.nodes().indexOf(artistgraph.source(e));
			const targetIdx = artistgraph.nodes().indexOf(artistgraph.target(e));

			return new Object({
				key: e,
				source: sourceIdx, 
				target: targetIdx,
				width: 1+artistgraph.getEdgeAttribute(e, 'weight')*0.03*devicePixelRatio || 1.0,
				useNodeColor: true,
				// opacity: 1.0
				opacity: (()=>{
					const weight = artistgraph.getEdgeAttribute(e, 'weight') || 1.0;
					if(weight<6){
						return 0.1;
					}else if(weight<10){
						return 0.3;
					}else{
						return 1.0;
					}
				})(),
				curve: [Math.random(), Math.random(), Math.random()]
			});
		})
	};

	/* graph component */
	graphComponent = new GraphComponent({
		container: container,
		graph: graph,
		onNodeClick: function(n){
			if(n){
				const neighbors = importantNeighbors(artistgraph, n, 1);
				this.setSelection([n, ...neighbors]);
			}else{
				this.setSelection(null);
			}
		}
	});
	window.graphComponent = graphComponent;

	/* UI COMPONENTS */
    /* Search */
	searchComponent = new AutoCompleteComponent(artistgraph.nodes());

	searchComponent.domElement.id = 'searchBox';
	searchComponent.addEventListener('input', (event)=>{
	});

	searchComponent.addEventListener('select', (event)=>{
		const n = event.value;
		if(n){
			graphComponent.setSelection([n, ...importantNeighbors(artistgraph, n)]);
		}else{
			graphComponent.setSelection(null);
		}
	});
	document.body.appendChild(searchComponent.domElement);

	/* Info Box */
	infoBox = document.createElement('div');
	infoBox.id = "infoBox";
	infoBox.innerText = `nodes: ${artistgraph.order}, edges: ${artistgraph.size}`;
	document.body.appendChild(infoBox);

	/* Action Box */
	const actionBox = document.createElement('div');
	actionBox.id = "actionBox";
	document.body.appendChild(actionBox);

	// play button
	const playButton = document.createElement('button');
	playButton.innerText = graphComponent.paused ? ">" : "||";
	actionBox.append(playButton);
	playButton.addEventListener('click', ()=>{
		if(graphComponent.paused){
			graphComponent.play();
			playButton.innerText = graphComponent.paused ? ">" : "||";
		}else{
			graphComponent.pause();
			playButton.innerText = graphComponent.paused ? ">" : "||";
		}
	});

	// color mode
	let colorModeBtn = document.createElement('button');
	var colorModeState = "dark";
	colorModeBtn.innerText = colorModeState == 'dark' ? 'light' : 'dark';
	colorModeBtn.addEventListener('click', ()=>{
		if(colorModeState=="dark"){
			// graphComponent.renderer.domElement.style.backgroundColor = 'hsl(0, 0%, 80%)';
			graphComponent.latticeMesh.lightMode();
			graphComponent.needsRender = true;
			graphComponent.setBackgroundColor('hsl(0, 0%, 80%)');
			colorModeState = "light";
			colorModeBtn.innerText = colorModeState == 'dark' ? 'light' : 'dark';
		}else{
			// graphComponent.renderer.domElement.style.backgroundColor = 'hsl(0, 0%, 20%)';
			graphComponent.latticeMesh.darkMode();
			graphComponent.needsRender = true;
			graphComponent.setBackgroundColor('hsl(0, 0%, 20%)');
			colorModeState = "dark";
			colorModeBtn.innerText = colorModeState == 'dark' ? 'light' : 'dark';
		}
	});

	actionBox.appendChild(colorModeBtn);
}