
import './style.css'

// THREE
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
window.THREE = THREE;

// GRAPH DATA
import milangraph from './data/artists_w3_v2.json'

// GRAHPOLOGY
import {Graph} from 'graphology'
import {subGraph} from 'graphology-utils';
import toUndirected from 'graphology-operators/to-undirected';

// GRAPH MESH

// annotations
import CanvasLabels from './annotation/CanvasLabels.js'
import HTMLLabels from './annotation/HTMLLabels.js'
import BMLabels from './annotation/BMLabels.js'

// Simulation
import Simulation from './Simulation/Simulation.js'
import CPUSimulation from './Simulation/CPUSimulation.js';
import GPUSimulation from './Simulation/GPUSimulation.js';

// Controls
import LatticeControls from './LatticeControls.js'

// UI Components
import AutoCompleteComponent from './AutoCompleteComponent.js'
// import onChange from 'on-change'
/***** GLOBALS *****/
const PIXEL_RATIO = window.devicePixelRatio;


// graph data
var artistgraph;

// three
var container;
// var scene;
// var camera;
// var renderer;
var cameraControls;
var transformGizmo;

// graph mesh
var latticeMesh;

// simulation
var simulation;
var cpuSimulation;
var gpuSimulation;
var simulationPaused = true;

var simMesh; // used to display texture data in simulation
// annotations
var htmlLabels;
var canvasLabels;


/**/
import watch from './watch.js'

var state = watch({
	colorMode: 'dark',
	isPlaying: false,
	selection:[],
	highlighted: null
});
window.state = state;

/***** GRAPH *****/

import axios from 'axios';

// import data from '../assets/artists_w3_v2.json';
window.axios = axios;

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
		const graphData = e.data;
		document.body.removeChild(progressBar);

		init();
		// animate();

	});
}

loadGraph();

function createGraph(){
	// /* Import graph */
	artistgraph = new Graph()
	artistgraph.import(milangraph);

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

import GraphComponent from './GraphComponent';
/***** VIZ *****/
var graphComponent;
function initViz(){
	/* container */
	container = document.createElement('div');
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
			size: (2+artistgraph.getNodeAttribute(n, 'eigencentrality')*100)*PIXEL_RATIO,
			fontSize: 10+artistgraph.getNodeAttribute(n, 'eigencentrality')*50*PIXEL_RATIO,
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
				width: 1+artistgraph.getEdgeAttribute(e, 'weight')*0.03*PIXEL_RATIO || 1.0,
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
		onNodeClick: function(index){
			if(index){
				let node = this.latticeMesh.graph.nodes[index];
				const indices = importantNeighbors(artistgraph, node.key, 1)
				.map(n=>this.latticeMesh.indexOfNode(n));
				this.setSelection([index, ...indices]);
			}else{
				this.setSelection(null);
			}
		}
	});
	window.graphComponent = graphComponent;

	/* Setup RENDERER */
	// let canvas = document.createElement('canvas');
	// canvas.id='lattice';
	// container.appendChild(canvas);
	// let renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: false, alpha: true });
	// renderer.setSize(renderer.domElement.clientWidth*PIXEL_RATIO, renderer.domElement.clientHeight*PIXEL_RATIO, false);
	// renderer.sortObjects = false;
	
	// window.renderer = renderer;
	// state.watch('colorMode', ()=>{
	// 	if(state.colorMode=='dark'){
	// 		renderer.domElement.style.backgroundColor = 'hsl(0, 0%, 20%)';
	// 	}else{
	// 		renderer.domElement.style.backgroundColor = 'hsl(0, 0%, 80%)';
	// 	}
	// });

	// /* setup SCENE */
	// scene = new THREE.Scene();

	// /* CAMERA */
	// camera = new THREE.PerspectiveCamera( 50, renderer.domElement.clientWidth/renderer.domElement.clientHeight, 0.01, 100000 );
	// camera.position.set(0,0,100);
	// camera.near = 0.1;
	// camera.far = 3000;
	// scene.add(camera);
	// window.camera = camera;

	// /* grid */
	// // scene.add(new THREE.GridHelper(100, 10));

	// /* LIGHTING */
	// let keyLight = new THREE.PointLight('white', 0.7);
	// keyLight.position.set(-1000, 1000, 1000);
	// scene.add(keyLight);

	// let fillLight = new THREE.PointLight('pink', 0.3);
	// fillLight.position.set(1000, 500, 0);
	// scene.add(fillLight);

	// let rimLight = new THREE.PointLight('cyan', 0.1);
	// rimLight.position.set(1000, -500, -1000);
	// scene.add(rimLight);

	// var ambient = new THREE.AmbientLight( 'white', 0.7 ); // soft white light
	// scene.add( ambient );

	/* LATTICE */
	// latticeMesh = new LatticeMesh({
	// 	renderer,
	// 	graph: graph,

	// 	PROFILE: false
	// });
	// latticeMesh.position.set(0,0,0);

	// latticeMesh.frustumCulled = false;
	// scene.add(latticeMesh);
	// window.latticeMesh = latticeMesh;

	// state.watch('selection', (nodes)=>{
	// 	/* clear current highlights */
	// 	for(let i=0; i<latticeMesh.graph.nodes.length; i++){
	// 		latticeMesh.graph.nodes[i].highlighted = false;
	// 	}

	// 	if(nodes && nodes.length>0){
	// 		/* higlight important nodes */
	//     	for( let n of nodes){
	//     		const i = latticeMesh.indexOfNode(n);
	//     		latticeMesh.graph.nodes[i].highlighted = true;
	//     	}
	//     	// fade out nodes not highlighted
	//     	latticeMesh.setAnyHighlighted(true);
	//     	// fade bitmap webgl textcloud
 //    		latticeMesh.bmLabels.material.uniforms.opacity.value = 0.4;
	//     }else{
	//     	//  fade in other nodes
	//     	latticeMesh.setAnyHighlighted(false);
	//     	// fade in bitmap e
	// 		latticeMesh.bmLabels.material.uniforms.opacity.value = 0.8;
	//     }

	// 	/* patch viz */
	// 	latticeMesh.patch(latticeMesh.diff());
	// });

	// state.watch('highlighted', (nodes)=>{
	// 	// clear highlited nodes
	// 	latticeMesh.graph.nodes
	// 	.filter(node=>node.hovered)
	// 	.forEach(node=>node.hovered=false);

 //    	// set graph
 //  		if(nodes){
	//     	for(let n of nodes){
	// 	    	const i = latticeMesh.indexOfNode(n)
	// 	    	latticeMesh.graph.nodes[i].hovered = true;
	// 	    	// latticeMesh.graph.nodes[i].size*=1.1;
	// 	    }
	// 	}
	// 	// patch viz
 //    	latticeMesh.patch(latticeMesh.diff());
 //    	htmlLabels.patch(htmlLabels.diff());
	// });

	// state.watch('colorMode', ()=>{
	// 	if(state.colorMode == "dark"){
	// 		latticeMesh.bmLabels.material.uniforms.canvasBackgroundColor.value = new THREE.Color(0.2, 0.2, 0.2);
	// 		latticeMesh.darkMode();
	// 	}else{
	// 		latticeMesh.bmLabels.material.uniforms.canvasBackgroundColor.value = new THREE.Color(0.9, 0.9, 0.9);
	// 		latticeMesh.lightMode();
	// 	}
	// })

	// let gizmo = new TransformControls(camera, document.body);
	// gizmo.size = 1;
	// gizmo.attach(latticeMesh);
	// gizmo.mode = 'rotate';
	// scene.add(gizmo);

	// /*CanvasLabels*/
	// canvasLabels = new CanvasLabels({
	// 	defaultColor: new THREE.Color(0,0,0),
	// 	labels: artistgraph.nodes().map(n=>{
	// 		return n;
	// 	}),
	// 	position: n=>{
	// 		const i = latticeMesh.indexOfNode(n);

	// 		return new THREE.Vector3(
	// 			latticeMesh.graph.nodes[i].x,
	// 			latticeMesh.graph.nodes[i].y,
	// 			latticeMesh.graph.nodes[i].z
	// 		).applyMatrix4(latticeMesh.matrixWorld);
	// 	},
	// 	visible: (n)=>{
	// 		const i = latticeMesh.indexOfNode(n);
	// 		const HTMLLabelVisible = latticeMesh.graph.nodes[i].hovered ||
	// 				latticeMesh.graph.nodes[i].highlighted ||
	// 				latticeMesh.graph.nodes[i].selected;
	// 		return !HTMLLabelVisible && artistgraph.getNodeAttribute(n, 'eigencentrality')>0.03;
	// 	},
	// 	opacity: n=>{
	// 		const i = latticeMesh.indexOfNode(n);
	// 		const pos = new THREE.Vector3(
	// 			latticeMesh.graph.nodes[i].x,
	// 			latticeMesh.graph.nodes[i].y,
	// 			latticeMesh.graph.nodes[i].z
	// 		)
	// 		const dstSqr = pos.distanceToSquared(camera.position);
	// 		let centrality = artistgraph.getNodeAttribute(n, 'eigencentrality')
	// 		return Math.min(Math.pow(centrality*10, 1)*12000/dstSqr, 0.9);
	// 	},
	// 	color: n=>{
	// 		const backgroundColor = new THREE.Color().setStyle(renderer.domElement.style.backgroundColor);
	// 		backgroundColor.r = 1-backgroundColor.r;
	// 		backgroundColor.g = 1-backgroundColor.g;
	// 		backgroundColor.b = 1-backgroundColor.b;
	// 		let nodeColor =  new THREE.Color(
	// 			artistgraph.getNodeAttribute(n, 'r')/255,
	// 			artistgraph.getNodeAttribute(n, 'g')/255,
	// 			artistgraph.getNodeAttribute(n, 'b')/255
	// 		)

	// 		return nodeColor.lerp(backgroundColor, 0.8);
	// 	},
	// 	fontSize: n=>{
	// 		const s = 10+artistgraph.getNodeAttribute(n, 'eigencentrality')*50*PIXEL_RATIO
	// 		return s;
	// 	}
	// });
	// container.appendChild(canvasLabels.domElement);
	// canvasLabels.domElement.style.opacity = 1.0;
	// canvasLabels.domElement.width = container.clientWidth*PIXEL_RATIO;
	// canvasLabels.domElement.height = container.clientHeight*PIXEL_RATIO;

	// state.watch('selection', (nodes)=>{
	// 	if(nodes && nodes.length>0){
	//     	canvasLabels.domElement.style.opacity = 0.2;
	//     }else{
	//     	canvasLabels.domElement.style.opacity = 1.0;
	//     }
	// });
	// debugger

	// /* HTML LABELS */
	// htmlLabels = new HTMLLabels({
	// 	keys: artistgraph.nodes(),
	// 	text: (n)=>{
	// 		return n;
	// 	},
	// 	position: (n)=>{
	// 		const i = latticeMesh.indexOfNode(n);

	// 		return new THREE.Vector3(
	// 			latticeMesh.graph.nodes[i].x,
	// 			latticeMesh.graph.nodes[i].y,
	// 			latticeMesh.graph.nodes[i].z
	// 		).applyMatrix4(latticeMesh.matrixWorld);
	// 	},
	// 	color: (n)=>{
	// 		return new THREE.Color(
	// 			artistgraph.getNodeAttribute(n, 'r')/255,
	// 			artistgraph.getNodeAttribute(n, 'g')/255,
	// 			artistgraph.getNodeAttribute(n, 'b')/255
	// 		);
	// 	},
	// 	visible: (n)=>{
	// 		const i = latticeMesh.indexOfNode(n);
	// 		return	latticeMesh.graph.nodes[i].hovered ||
	// 				latticeMesh.graph.nodes[i].highlighted ||
	// 				latticeMesh.graph.nodes[i].selected;
	// 	},
	// 	fontSize: n=>{
	// 		const s = 8+artistgraph.getNodeAttribute(n, 'eigencentrality')*40
	// 		return s.toFixed()+'px';
	// 	}
	// });
	// window.htmlLabels = htmlLabels;
	// htmlLabels.domElement.id = 'labels';
	// state.watch('selection', ()=>{
	// 	htmlLabels.patch(htmlLabels.diff());
	// });
	// container.appendChild(htmlLabels.domElement);

	// /* Simulation */
	// simulation = new Simulation({
	// 	graph: {
	// 		nodes: latticeMesh.graph.nodes.map(node=>new Object({
	// 			pos: new THREE.Vector3(node.x, node.y, node.z),
	// 			force: new THREE.Vector3(),
	// 			velocity: new THREE.Vector3(),
	// 			forces: [],
	// 			mass: node.size
	// 		})),
	// 		edges: latticeMesh.graph.edges.map(edge=>new Object({
	// 			source: edge.source,
	// 			target: edge.target,
	// 			weight: edge.width || 1.0
	// 		}))
	// 	},
	// 	attraction: 0.0005,
	// 	repulsion: -0.15,
	// 	gravity: 0.005,
	// 	dampening: 0.9
	// });
	// window.simulation = simulation;

	// cpuSimulation = new CPUSimulation({
	// 	graph: {
	// 		nodes: latticeMesh.graph.nodes.map(node=>new Object({
	// 			pos: new THREE.Vector3(node.x, node.y, node.z),
	// 			force: new THREE.Vector3(),
	// 			velocity: new THREE.Vector3(),
	// 			forces: [],
	// 			mass: node.size
	// 		})),
	// 		edges: latticeMesh.graph.edges.map(edge=>new Object({
	// 			source: edge.source,
	// 			target: edge.target,
	// 			weight: edge.width || 1.0
	// 		}))
	// 	},
	// 	attraction: 0.0005,
	// 	repulsion: -0.15,
	// 	gravity: 0.005,
	// 	dampening: 0.9
	// });
	// window.cpuSimulation = cpuSimulation;

	// gpuSimulation = new GPUSimulation({
	// 	renderer,
	// 	graph: {
	// 		nodes: latticeMesh.graph.nodes.map(node=>new Object({
	// 			key: node.key,
	// 			pos: new THREE.Vector3(node.x, node.y, node.z),
	// 			force: new THREE.Vector3(),
	// 			velocity: new THREE.Vector3(),
	// 			forces: [],
	// 			mass: node.size
	// 		})),
	// 		edges: latticeMesh.graph.edges.map(edge=>new Object({
	// 			source: edge.source,
	// 			target: edge.target,
	// 			weight: edge.width || 1.0
	// 		}))
	// 	},
	// 	attraction: 0.0005,
	// 	repulsion: -0.15,
	// 	gravity: 0.005,
	// 	dampening: 0.9
	// });
	// window.gpuSimulation = gpuSimulation;

	/* CONTROLS */
	/* Camera controls */
	// cameraControls = new OrbitControls(camera, renderer.domElement)
	// cameraControls.autoRotate = false;
	// cameraControls.autoRotateSpeed = -0.3;
	// cameraControls.screenSpacePanning = true;
	// // cameraControls.enableDamping = true;
	// // cameraControls.dampingFactor = 0.1
	// cameraControls.enableZoom = true;
	// cameraControls.mouseButtons = {
	// 	LEFT: THREE.MOUSE.PAN,
	// 	MIDDLE: THREE.MOUSE.DOLLY,
	// 	RIGHT: THREE.MOUSE.ROTATE
	// }
	// window.cameraControls = cameraControls;

    /* LatticeControls */
    // var latticeControls = new LatticeControls(camera, renderer.domElement);
    // latticeControls.attach(latticeMesh);

    // latticeControls.addEventListener('nodeenter', event=>{
    // 	// set cursor
    // 	renderer.domElement.style.cursor = 'pointer';

    // 	// higlight nodes
    // 	const n = latticeMesh.graph.nodes[event.index].key;
    // 	state.highlighted = [n];
    // 	// ACTIONS.higlightNodes([n]);
    // });

    // latticeControls.addEventListener('nodeleave', event=>{
    // 	// set cursor
    // 	renderer.domElement.style.cursor = 'default';

    // 	// unhighlight nodes
    // 	state.highlighted = null
    // 	// ACTIONS.higlightNodes(null);
    // });

    // latticeControls.addEventListener('nodeclick', event=>{
    // 	if(event.index>=0){
    // 		// select neighbors
	   //  	const n = latticeMesh.graph.nodes[event.index].key
	   //  	const neighbors = [n, ...importantNeighbors(artistgraph, n, 1)];
	   //  	state.selection = neighbors
	   //  	// ACTIONS.selectNodes(neighbors);
	   //  }else{
	   //  	// deselact all
	   //  	state.selection = [];
	   //  	// ACTIONS.selectNodes(null);
	   //  }
    // });

    // latticeControls.addEventListener('nodedrag', event=>{
    // 	const n = latticeMesh.graph.nodes[event.index].key;
    // 	console.log(event);
    // });

    /* handle window RESIZE */
  //   window.addEventListener('resize', ()=>{
  //   	/*camera*/
		// camera.aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight;
		// camera.updateProjectionMatrix();

		// // renderer.setSize(renderer.domElement.clientWidth, renderer.domElement.clientHeight, true);
		// renderer.setSize(renderer.domElement.clientWidth*PIXEL_RATIO, renderer.domElement.clientHeight*PIXEL_RATIO, false);
		// canvasLabels.domElement.width = renderer.domElement.clientWidth*PIXEL_RATIO;
		// canvasLabels.domElement.height = renderer.domElement.clientHeight*PIXEL_RATIO

		// /* screensize graph */
		// let viewport = new THREE.Vector4();
		// renderer.getViewport(viewport);
		// latticeMesh.setViewport(viewport);
  //   });
}

function init(){
	createGraph();
	initUI();
	initViz();
}

// UI
// Components
var colorModeBtn;
var playButton;
var searchComponent;
var graphInfo;
var depthTestButton;




// window.STATE = STATE;

const ACTIONS = {
	selectNodes: (nodes)=>{
		/* clear current highlights */
		for(let i=0; i<latticeMesh.graph.nodes.length; i++){
			latticeMesh.graph.nodes[i].highlighted = false;
		}

		if(nodes && nodes.length>0){
			/* higlight important nodes */
	    	for( let n of nodes){
	    		const i = latticeMesh.indexOfNode(n);
	    		latticeMesh.graph.nodes[i].highlighted = true;
	    	}
	    	// fade out nodes not highlighted
	    	latticeMesh.setAnyHighlighted(true);
	    	// fade canvas text cloud
	    	canvasLabels.domElement.style.opacity = 0.2;
	    	// fade bitmap webgl textcloud
    		latticeMesh.bmLabels.material.uniforms.opacity.value = 0.4;
	    }else{
	    	//  fade in other nodes
	    	latticeMesh.setAnyHighlighted(false);
	    	// fade in canvas text cloud
	    	canvasLabels.domElement.style.opacity = 1.0;
	    	// fade in bitmap e
			latticeMesh.bmLabels.material.uniforms.opacity.value = 0.8;
	    }

		/* patch viz */
		latticeMesh.patch(latticeMesh.diff());
		htmlLabels.patch(htmlLabels.diff());
	},

	higlightNodes: (nodes)=>{
		// clear highlight
		latticeMesh.graph.nodes
		.filter(node=>node.hovered)
		.forEach(node=>node.hovered=false);


    	// set graph
  		if(nodes){
	    	for(let n of nodes){
		    	const i = latticeMesh.indexOfNode(n)
		    	latticeMesh.graph.nodes[i].hovered = true;
		    	// latticeMesh.graph.nodes[i].size*=1.1;
		    }
		}

		// patch viz
    	latticeMesh.patch(latticeMesh.diff());
    	htmlLabels.patch(htmlLabels.diff());
	},

	//     // higlight edges
 //    	// const n = latticeMesh.graph.nodes[event.index].key;
 //    	// for(let e of artistgraph.edges(n)){
 //    	// 	const i = latticeMesh.indexOfEdge(e);
 //    	// 	if(i>=0){
	//     // 		latticeMesh.graph.edges[i].width*=1.1;
	//     // 	}
 //    	// }

 //    	// patch viz
 //    	latticeMesh.patch(latticeMesh.diff());
 //    	labels.patch(labels.diff());
	// },

	// modeLight: ()=>{
	// 	renderer.domElement.style.backgroundColor = 'hsl(0, 0%, 80%)';
		
	// 	// renderer.setClearColor('hsl(0, 0%, 90%)')
	// 	latticeMesh.lightMode();

	// },

	// modeDark: ()=>{
	// 	renderer.domElement.style.backgroundColor = 'hsl(0, 0%, 20%)';

	// 	// renderer.setClearColor('hsl(0, 0%, 20%)')
	// 	latticeMesh.darkMode();
		
	// },

	// initialLayout2D: ()=>{
	// 	for(let node of latticeMesh.graph.nodes){
	// 		node.x = artistgraph.getNodeAttribute(node.key, 'x');
	// 		node.y = artistgraph.getNodeAttribute(node.key, 'y');
	// 		node.z = Math.random()*0.1;
	// 	}
	// 	latticeMesh.patch(latticeMesh.diff());
	// },

	// initialLayout3D: ()=>{
	// 	for(let node of latticeMesh.graph.nodes){
	// 		node.x = artistgraph.getNodeAttribute(node.key, 'pos3D')[0];
	// 		node.y = artistgraph.getNodeAttribute(node.key, 'pos3D')[1];
	// 		node.z = artistgraph.getNodeAttribute(node.key, 'pos3D')[2];
	// 	}
	// 	latticeMesh.patch(latticeMesh.diff());
	// },

	// setDepthTestFalse: ()=>{
	// 	latticeMesh.getObjectByName('edges').material.uniforms.opacity.value = 0.5;
	// 	latticeMesh.getObjectByName('edges').material.depthTest = false
	// 	latticeMesh.getObjectByName('nodes').material.depthTest = false
	// 	latticeMesh.getObjectByName('edges').material.uniforms.flatShading.value=true;
	// 	latticeMesh.getObjectByName('edges').position.z = -0.01;
	// 	STATE.depthTest = false;
	// },

	// setDepthTestTrue: ()=>{
	// 	latticeMesh.getObjectByName('edges').material.uniforms.opacity.value = 0.66;
	// 	latticeMesh.getObjectByName('edges').material.depthTest = true
	// 	latticeMesh.getObjectByName('nodes').material.depthTest = true;
	// 	latticeMesh.getObjectByName('edges').material.uniforms.flatShading.value=true;
	// 	latticeMesh.getObjectByName('edges').position.z = 0.0;
	// 	STATE.depthTest = true;
	// }
}

function initUI(){
    /* SEARCH */
	searchComponent = new AutoCompleteComponent(artistgraph.nodes());

	searchComponent.domElement.id = 'search';
	searchComponent.addEventListener('input', (event)=>{
	});

	searchComponent.addEventListener('select', (event)=>{
		const n = event.value;
		const index = graphComponent.latticeMesh.indexOfNode(n);
		if(index){
			let node = graphComponent.latticeMesh.graph.nodes[index];
			const indices = importantNeighbors(artistgraph, node.key, 1)
			.map(n=>graphComponent.latticeMesh.indexOfNode(n));
			graphComponent.setSelection([index, ...indices]);
		}else{
			graphComponent.setSelection(null);
		}
	});
	document.body.appendChild(searchComponent.domElement);

	/* INFO BOX */
	graphInfo = document.createElement('div');
	graphInfo.id = "graphInfo";
	graphInfo.innerText = `nodes: ${artistgraph.order}, edges: ${artistgraph.size}`;
	document.body.appendChild(graphInfo);

	// actionBox
	const actionBox = document.createElement('div');
	actionBox.id = "actionBox";
	document.body.appendChild(actionBox);

	// play button
	const playButton = document.createElement('button');
	state.watch('isPlaying', (value)=>{
		playButton.innerText = value ? "||" : ">"
	});
	playButton.innerText = ">";
	actionBox.append(playButton);
	playButton.addEventListener('click', ()=>{
		state.isPlaying = !state.isPlaying;
		// simulationPaused = !simulationPaused;
		// playButton.innerText = simulationPaused ? ">" : '||'
	});

	// color mode
	let colorModeBtn = document.createElement('button');
	colorModeBtn.innerText = state.colorMode == 'dark' ? 'light' : 'dark';
	colorModeBtn.addEventListener('click', ()=>{
		state.colorMode = state.colorMode == 'dark' ? 'light' : 'dark';
	})
	state.watch('colorMode', ()=>{
		colorModeBtn.innerText = state.colorMode == 'dark' ? 'light' : 'dark';
	});
	actionBox.appendChild(colorModeBtn);

	// depthTest mode
	depthTestButton = document.createElement('button');
	depthTestButton.innerText = 'depthTest';
	depthTestButton.style.opacity = 0.5;
	depthTestButton.addEventListener('click', ()=>{
		depthTest = !depthTest;
		if(depthTest){
			depthTestButton.style.opacity = 1.0;
			setDepthTestTrue();
		}else{
			depthTestButton.style.opacity = 0.5;
			setDepthTestFalse();
		}
	});
	// actionBox.appendChild(depthTestButton);

	//

	const layout2DBtn = document.createElement('button');
	// actionBox.appendChild(layout2DBtn);
	layout2DBtn.innerText = "2D"
	layout2DBtn.addEventListener('click', ACTIONS.initialLayout2D);

	const layout3DBtn = document.createElement('button');
	// actionBox.appendChild(layout3DBtn);
	layout3DBtn.innerText = "3D"
	layout3DBtn.addEventListener('click', ACTIONS.initialLayout3D);
}

function update(){
	if(state.isPlaying){
		gpuSimulation.compute();
		// console.time("CPU step");
		// cpuSimulation.step();
		// console.timeEnd("CPU step");

		// // copy sim positions to lattice
		// for(let i=0; i<simulation.graph.nodes.length; i++){
		// 	latticeMesh.graph.nodes[i].x = cpuSimulation.graph.nodes[i].pos.x;
		// 	latticeMesh.graph.nodes[i].y = cpuSimulation.graph.nodes[i].pos.y;
		// 	latticeMesh.graph.nodes[i].z = cpuSimulation.graph.nodes[i].pos.z;
		// }

		// // patch viz position coords
		// latticeMesh.patch({
		// 	nodes: new Map(cpuSimulation.graph.nodes.map((node, i)=>[i, 
		// 	{
		// 		x: node.pos.x,
		// 		y: node.pos.y,
		// 		z: node.pos.z
		// 	}])),
		// 	edges: new Map()
		// });

		// latticeMesh.getObjectByName('nodes').material.uniforms.nodeColorMap.value = gpuSimulation.forceFbo.texture;
		/* assign GPU position to lattice */
		latticeMesh.getObjectByName('nodes').material.uniforms.nodePositionMap.value = gpuSimulation.currentPositionFbo.texture;
		latticeMesh.getObjectByName('edges').material.uniforms.nodePositionMap.value = gpuSimulation.currentPositionFbo.texture;
		latticeMesh.bmLabels.material.uniforms.nodePositionMap.value = gpuSimulation.currentPositionFbo.texture;
		
		latticeMesh.pickMesh.material.uniforms.nodePositionMap.value = gpuSimulation.currentPositionFbo.texture;

		// const positions = new Float32Array(gpuSimulation.currentPositionFbo.width * gpuSimulation.currentPositionFbo.height*3);
		// renderer.readRenderTargetPixels(
		// 	gpuSimulation.currentPositionFbo, 
		// 	0,0, 
		// 	gpuSimulation.currentPositionFbo.width, gpuSimulation.currentPositionFbo.height,
		// 	positions);

		// console.log(positions);
	}
}

// function render(){
// 	graphComponent.render();
// 	// console.log('render');
// 	// renderer.setRenderTarget(null);
// 	// renderer.render( scene, camera );
// }

// function animate() {
// 	update();
// 	render();
// 	requestAnimationFrame( animate );
// }

// animate();