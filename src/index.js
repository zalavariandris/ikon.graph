
import './style.css'

// THREE
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
window.THREE = THREE;

// GRAPH DATA
import milangraph from './artists_w3_v2.json'

// GRAHPOLOGY
import {Graph} from 'graphology'
import {subGraph} from 'graphology-utils';
import toUndirected from 'graphology-operators/to-undirected';

// GRAPH MESH
import {LatticeMesh, NodeFlags} from './lattice/LatticeMesh.js'
// annotations
import CanvasLabels from './annotation/CanvasLabels.js'
import HTMLLabels from './annotation/HTMLLabels.js'

// Simulation
import Simulation from './Simulation.js'

// Controls
import LatticeControls from './LatticeControls.js'

// UI Components
import AutoCompleteComponent from './AutoCompleteComponent.js'

/***** GLOBALS *****/
const PIXEL_RATIO = window.devicePixelRatio;

// graph data
var artistgraph;

// three
var container;
var scene;
var camera;
var renderer;
var cameraControls;
var transformGizmo;

// graph mesh
var latticeMesh;

// simulation
var simulation;

// annotations
var labels;
var canvasLabels;


/***** GRAPH *****/
function importantNeighbors(graph, n, importance=1){
	const edges = graph.edges(n);
	const weights = edges.map(e=>graph.getEdgeAttribute(e, 'weight'));
	const weightMin = weights.reduce((current, value)=>value<current ? value:current);
	const weightMax = weights.reduce((current, value)=>value>current ? value:current);
	const weightSum = weights.reduce((current, value)=>value+current, 0);
	const weightAvg = weightSum/edges.length;
	graph.edges(n)
	return [n, ...graph.neighbors(n).filter(neighbor=>{
		const e = graph.edge(n, neighbor);
		return graph.getEdgeAttribute(e, 'weight')>(weightAvg*1+weightMax*importance)/(1+importance);
	})]
}

function createGraph(){
	// /* Import graph */
	artistgraph = new Graph()
	artistgraph.import(milangraph);
	for(let n of artistgraph.nodes()){
		const x = artistgraph.getNodeAttribute(n, 'x');
		const y = artistgraph.getNodeAttribute(n, 'y');
		// const z = artistgraph.getNodeAttribute(n, 'z') || 0;
		artistgraph.setNodeAttribute(n, 'x', x*100);
		artistgraph.setNodeAttribute(n, 'y', y*100);
		// artistgraph.setNodeAttribute(n, 'z', z*100);
	}

	for(let n of artistgraph.nodes()){
		const color = new THREE.Color(
			artistgraph.getNodeAttribute(n, 'r')/255,
			artistgraph.getNodeAttribute(n, 'g')/255,
			artistgraph.getNodeAttribute(n, 'b')/255
		);
	}

	artistgraph = toUndirected(artistgraph);
	window.artistgraph = artistgraph;
}

/***** VIZ *****/
function initViz(){
	container = document.createElement('div');
	container.id = 'container';
	container.classList.add('container');
	document.body.appendChild(container);

	/* Setup RENDERER */
	let canvas = document.createElement('canvas');

	canvas.id='graphCanvas';
	container.appendChild(canvas);
	renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: false, alpha: true });
	renderer.setSize(renderer.domElement.clientWidth*PIXEL_RATIO, renderer.domElement.clientHeight*PIXEL_RATIO, false);
	window.renderer = renderer;

	/* setup SCENE */
	scene = new THREE.Scene();

	/* CAMERA */
	camera = new THREE.PerspectiveCamera( 50, renderer.domElement.clientWidth/renderer.domElement.clientHeight, 0.01, 100000 );
	camera.position.set(0,0,100);
	camera.near = 0.3;
	camera.far = 3000;
	scene.add(camera);
	window.camera = camera;

	/* grid */
	// scene.add(new THREE.GridHelper(100, 10));

	/* LIGHTING */
	let keyLight = new THREE.PointLight('white', 0.7);
	keyLight.position.set(-1000, 1000, 1000);
	scene.add(keyLight);

	let fillLight = new THREE.PointLight('pink', 0.3);
	fillLight.position.set(1000, 500, 0);
	scene.add(fillLight);

	let rimLight = new THREE.PointLight('cyan', 0.1);
	rimLight.position.set(1000, -500, -1000);
	scene.add(rimLight);

	var ambient = new THREE.AmbientLight( 'white', 0.7 ); // soft white light
	scene.add( ambient );

	/* LATTICE */
	latticeMesh = new LatticeMesh({
		graph: {
			nodes: artistgraph.nodes().map(n=>new Object({
				key: n,
				// x: artistgraph.getNodeAttribute(n, 'pos3D')[0]*10000,
				// y: artistgraph.getNodeAttribute(n, 'pos3D')[1]*10000,
				// z: artistgraph.getNodeAttribute(n, 'pos3D')[2]*10000,
				x: artistgraph.getNodeAttribute(n, 'x')*2.5-160,
				y: artistgraph.getNodeAttribute(n, 'y')*2.5-65,
				z: Math.random()*0.1,
				r: artistgraph.getNodeAttribute(n, 'r')/255,
				g: artistgraph.getNodeAttribute(n, 'g')/255,
				b: artistgraph.getNodeAttribute(n, 'b')/255,
				size: (2+artistgraph.getNodeAttribute(n, 'eigencentrality')*100)*PIXEL_RATIO,
				hovered: false,
				highlighted: false,
				selected: false
			})),
			edges: artistgraph.edges().map(e=>{
				const source = artistgraph.source(e);
				const sourceIdx = artistgraph.nodes().indexOf(source);
				const target = artistgraph.target(e);
				const targetIdx = artistgraph.nodes().indexOf(target);

				return new Object({
					key: e,
					source: sourceIdx, 
					target: targetIdx,
					width: (1+Math.log(artistgraph.getEdgeAttribute(e, 'weight')*0.1))*PIXEL_RATIO || 1.0,
					useNodeColor: true,
					// opacity: 1.0
					opacity: (()=>{
						const weight = artistgraph.getEdgeAttribute(e, 'weight') || 1.0;
						if(weight<4){
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
		},

		PROFILE: false
	});
	latticeMesh.position.set(0,0,0);

	latticeMesh.frustumCulled = false;
	scene.add(latticeMesh);
	window.latticeMesh = latticeMesh;

	/*CanvasLabels*/
	canvasLabels = new CanvasLabels({
		defaultColor: new THREE.Color(0,0,0),
		labels: artistgraph.nodes().map(n=>{
			return n;
		}),
		position: n=>{
			const i = latticeMesh.indexOfNode(n);

			return new THREE.Vector3(
				latticeMesh.graph.nodes[i].x,
				latticeMesh.graph.nodes[i].y,
				latticeMesh.graph.nodes[i].z
			).applyMatrix4(latticeMesh.matrixWorld);
		},
		visible: (n)=>{
			const i = latticeMesh.indexOfNode(n);
			const HTMLLabelVisible = latticeMesh.graph.nodes[i].hovered ||
					latticeMesh.graph.nodes[i].highlighted ||
					latticeMesh.graph.nodes[i].selected;
			return !HTMLLabelVisible && artistgraph.getNodeAttribute(n, 'eigencentrality')>0.03;
		},

		opacity: n=>{
			const i = latticeMesh.indexOfNode(n);
			const pos = new THREE.Vector3(
				latticeMesh.graph.nodes[i].x,
				latticeMesh.graph.nodes[i].y,
				latticeMesh.graph.nodes[i].z
			)
			const dstSqr = pos.distanceToSquared(camera.position);
			let centrality = artistgraph.getNodeAttribute(n, 'eigencentrality')
			return Math.min(Math.pow(centrality*10, 1)*9000/dstSqr, 0.9);
		},

		color: n=>{
			const backgroundColor = new THREE.Color().setStyle(renderer.domElement.style.backgroundColor);
			backgroundColor.r = 1-backgroundColor.r;
			backgroundColor.g = 1-backgroundColor.g;
			backgroundColor.b = 1-backgroundColor.b;
			let nodeColor =  new THREE.Color(
				artistgraph.getNodeAttribute(n, 'r')/255,
				artistgraph.getNodeAttribute(n, 'g')/255,
				artistgraph.getNodeAttribute(n, 'b')/255
			)

			return nodeColor.lerp(backgroundColor, 0.7);
		},

		fontSize: n=>{
			const s = 10+artistgraph.getNodeAttribute(n, 'eigencentrality')*50*PIXEL_RATIO
			return s.toFixed()+'px';
		}
	});
	container.appendChild(canvasLabels.domElement);
	canvasLabels.domElement.style.opacity = 0.8;
	canvasLabels.domElement.width = container.clientWidth*PIXEL_RATIO;
	canvasLabels.domElement.height = container.clientHeight*PIXEL_RATIO;
	// debugger

	/* HTML LABELS */
	labels = new HTMLLabels({
		keys: artistgraph.nodes(),
		text: (n)=>{
			return n;
		},
		position: (n)=>{
			const i = latticeMesh.indexOfNode(n);

			return new THREE.Vector3(
				latticeMesh.graph.nodes[i].x,
				latticeMesh.graph.nodes[i].y,
				latticeMesh.graph.nodes[i].z
			).applyMatrix4(latticeMesh.matrixWorld);
		},
		color: (n)=>{
			return new THREE.Color(
				artistgraph.getNodeAttribute(n, 'r')/255,
				artistgraph.getNodeAttribute(n, 'g')/255,
				artistgraph.getNodeAttribute(n, 'b')/255
			);
		},
		visible: (n)=>{
			const i = latticeMesh.indexOfNode(n);
			return	latticeMesh.graph.nodes[i].hovered ||
					latticeMesh.graph.nodes[i].highlighted ||
					latticeMesh.graph.nodes[i].selected;
		},
		fontSize: n=>{
			const s = 8+artistgraph.getNodeAttribute(n, 'eigencentrality')*40
			return s.toFixed()+'px';
		}
	});
	window.labels = labels;
	labels.domElement.id = 'labels';
	container.appendChild(labels.domElement);

	/* Simulation */
	simulation = new Simulation({
		graph: {
			nodes: latticeMesh.graph.nodes.map(node=>new Object({
				pos: new THREE.Vector3(node.x, node.y, node.z),
				force: new THREE.Vector3(),
				velocity: new THREE.Vector3(),
				forces: [],
				mass: node.size
			})),
			edges: latticeMesh.graph.edges.map(edge=>new Object({
				source: edge.source,
				target: edge.target,
				weight: edge.width || 1.0
			}))
		},
		attraction: 0.0003,
		repulsion: -0.2,
		gravity: 0.005,
		dampening: 0.9
	});
	window.simulation = simulation;

	/* CONTROLS */
	/* Camera controls */
	cameraControls = new OrbitControls(camera, renderer.domElement)
	cameraControls.autoRotate = false;
	cameraControls.autoRotateSpeed = -0.3;
	cameraControls.screenSpacePanning = true;
	cameraControls.enableDamping = true;
	cameraControls.dampingFactor = 0.1
	cameraControls.enableZoom = true;
	cameraControls.mouseButtons = {
		LEFT: THREE.MOUSE.PAN,
		MIDDLE: THREE.MOUSE.DOLLY,
		RIGHT: THREE.MOUSE.ROTATE
	}

    /* LatticeControls */
    var latticeControls = new LatticeControls(camera, renderer.domElement);
    latticeControls.attach(latticeMesh);

    latticeControls.addEventListener('nodeenter', event=>{
    	// set cursor
    	renderer.domElement.style.cursor = 'pointer';

    	// set graph
    	latticeMesh.graph.nodes[event.index].hovered = true;
    	latticeMesh.graph.nodes[event.index].size*=1.1;

    	const n = latticeMesh.graph.nodes[event.index].key;
    	for(let e of artistgraph.edges(n)){
    		const i = latticeMesh.indexOfEdge(e);
    		if(i>=0){
	    		latticeMesh.graph.edges[i].width*=1.1;
	    	}
    	}

    	// // patch viz
    	latticeMesh.patch(latticeMesh.diff());
    	labels.patch(labels.diff());
    });

    latticeControls.addEventListener('nodeleave', event=>{
    	// set cursor
    	renderer.domElement.style.cursor = 'default';

    	const n = latticeMesh.graph.nodes[event.index].key

    	// set graph
    	latticeMesh.graph.nodes[event.index].hovered = false;
    	latticeMesh.graph.nodes[event.index].size/=1.1;

    	for(let e of artistgraph.edges(n)){
    		const i = latticeMesh.indexOfEdge(e);
    		if(i>=0){
	    		latticeMesh.graph.edges[i].width/=1.1;
	    	}
    	}

    	// // patch viz
    	latticeMesh.patch(latticeMesh.diff());
    	labels.patch(labels.diff());
    });

    latticeControls.addEventListener('click', event=>{
    	/* clear higlights */
    	for(let i=0; i<latticeMesh.graph.nodes.length; i++){
    		latticeMesh.graph.nodes[i].highlighted = false;
    	}
		latticeMesh.setAnyHighlighted(false);
		canvasLabels.domElement.style.opacity = 0.8;
    	 // higlight importan neighbors 
    	if(event.index){
    		const n = latticeMesh.graph.nodes[event.index].key;
	    	for( let neighbor of [n, ...importantNeighbors(artistgraph, n, 1)]){
	    		const i = latticeMesh.indexOfNode(neighbor)
	    		latticeMesh.graph.nodes[i].highlighted = true;
	    	}
	    	latticeMesh.setAnyHighlighted(true);
	    	canvasLabels.domElement.style.opacity = 0.2;
	    }

    	/* patch viz */
		labels.patch(labels.diff());
		latticeMesh.patch(latticeMesh.diff());
    });

    latticeControls.addEventListener('nodedrag', event=>{
    	const n = latticeMesh.graph.nodes[event.index].key;
    });

    /* handle window RESIZE */
    window.addEventListener('resize', ()=>{
    	/*camera*/
		camera.aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight;
		camera.updateProjectionMatrix();

		// renderer.setSize(renderer.domElement.clientWidth, renderer.domElement.clientHeight, true);
		renderer.setSize(renderer.domElement.clientWidth*PIXEL_RATIO, renderer.domElement.clientHeight*PIXEL_RATIO, false);
		

		canvasLabels.domElement.width = renderer.domElement.clientWidth*PIXEL_RATIO;
		canvasLabels.domElement.height = renderer.domElement.clientHeight*PIXEL_RATIO
		/* screensize graph */
		let viewport = new THREE.Vector4();
		renderer.getViewport(viewport);
		latticeMesh.setViewport(viewport);
    });

    /* SEARCH */
	let searchComponent = new AutoCompleteComponent(artistgraph.nodes());

	searchComponent.domElement.id = 'search';
	searchComponent.addEventListener('input', (event)=>{
		/* clear current highlights */
		for(let i=0; i<latticeMesh.graph.nodes.length; i++){
			latticeMesh.graph.nodes[i].highlighted = false;
		}
		/* higlight suggested nodes */
		for(let n of event.target.suggestions){
			const i = latticeMesh.indexOfNode(n);
			if(i>=0){
				latticeMesh.graph.nodes[i].highlighted = true;
			}
		}

		/* patch viz */
		latticeMesh.patch(latticeMesh.diff());
		labels.patch(labels.diff());
	});

	searchComponent.addEventListener('select', (event)=>{
		console.log("SELECT", event.value);
		if(event.value){
			/* clear current highlights */
			for(let i=0; i<latticeMesh.graph.nodes.length; i++){
				latticeMesh.graph.nodes[i].highlighted = false;
			}

			/* higlight important nodes */
			const i = latticeMesh.indexOfNode(event.value);
			if(i>=0){
		    	for( let n of [event.value, ...importantNeighbors(artistgraph, event.value)]){
		    		const i = latticeMesh.indexOfNode(n);
		    		latticeMesh.graph.nodes[i].highlighted = true;
		    	}
			}

			/* patch viz */
			latticeMesh.patch(latticeMesh.diff());
			latticeMesh.setAnyHighlighted(true);
			labels.patch(labels.diff());
		}
	});
	container.appendChild(searchComponent.domElement);

	/* INFO BOX */
	const graphInfo = document.createElement('div');
	graphInfo.id = "graphInfo";
	graphInfo.innerText = `nodes: ${latticeMesh.graph.nodes.length}, edges: ${latticeMesh.graph.edges.length}`;
	container.appendChild(graphInfo);

	// play button
	const playButton = document.createElement('button');
	
	playButton.innerText = '>';
	graphInfo.append(playButton);
	playButton.addEventListener('click', ()=>{
		console.log('click')
		// mode3D();
		// modeDark();
		simulation.paused = !simulation.paused;
		playButton.innerText = simulation.paused ? '>' : '||'
	});

	// color mode
	colorModeBtn = document.createElement('button');
	colorModeBtn.innerText = colorMode;
	
	colorModeBtn.addEventListener('click', ()=>{
		if(colorMode=="dark"){
			modeLight();
			colorModeBtn.innerText = colorMode
		}else{
			modeDark();
			colorModeBtn.innerText = colorMode
		}
	})
	graphInfo.appendChild(colorModeBtn);

	// dim mode
	depthTestButton = document.createElement('input');
	depthTestButton.type='checkbox';
	depthTestButton.addEventListener('click', ()=>{
		if(depthTestButton.checked){
			mode3D();
		}else{
			mode2D();
		}
	});
	graphInfo.appendChild(depthTestButton);
}

function init(){
	createGraph();
	initViz();
}


/* START */
init();

// UI
var colorModeBtn;
var depthTestButton;
var colorMode = "light";
function modeLight(){
	renderer.domElement.style.backgroundColor = 'hsl(0, 0%, 90%)';

	// renderer.setClearColor('hsl(0, 0%, 90%)')
	latticeMesh.lightMode();
	colorMode = "light";
	colorModeBtn.innerText = colorMode;
	canvasLabels.defaultColor = new THREE.Color(0,0,0);
}

function modeDark(){
	renderer.domElement.style.backgroundColor = 'hsl(0, 0%, 20%)';
	// renderer.setClearColor('hsl(0, 0%, 20%)')
	latticeMesh.darkMode();
	colorMode = "dark";
	colorModeBtn.innerText = colorMode;
	canvasLabels.defaultColor = new THREE.Color(1,1,1);
}
var dimensionMode;

function mode2D(){
	latticeMesh.getObjectByName('edges').material.uniforms.opacity.value = 0.5;
	latticeMesh.getObjectByName('edges').material.depthTest = false
	latticeMesh.getObjectByName('nodes').material.depthTest = false
	latticeMesh.getObjectByName('edges').material.uniforms.flatShading.value=true;
	latticeMesh.getObjectByName('edges').position.z = -0.01;
	dimensionMode = "2D";
}

function mode3D(){
	latticeMesh.getObjectByName('edges').material.uniforms.opacity.value = 0.9;
	latticeMesh.getObjectByName('edges').material.depthTest = true
	latticeMesh.getObjectByName('nodes').material.depthTest = true;
	latticeMesh.getObjectByName('edges').material.uniforms.flatShading.value=true;
	latticeMesh.getObjectByName('edges').position.z = 0.0;
	dimensionMode = "3D";
}

if(colorMode=="light"){
	modeLight();
}else{
	modeDark();
}
mode2D();

function animate() {
	// copy sim positions to lattice
	for(let i=0; i<simulation.graph.nodes.length; i++){
		latticeMesh.graph.nodes[i].x = simulation.graph.nodes[i].pos.x;
		latticeMesh.graph.nodes[i].y = simulation.graph.nodes[i].pos.y;
		latticeMesh.graph.nodes[i].z = simulation.graph.nodes[i].pos.z;
	}

	// patch viz position coords
	latticeMesh.patch({
		nodes: new Map(simulation.graph.nodes.map((node, i)=>[i, 
		{
			x: node.pos.x,
			y: node.pos.y,
			z: node.pos.z
		}])),
		edges: new Map()
	});

	// render
	cameraControls.update();
	labels.update(camera);
	canvasLabels.update(camera);
	renderer.render( scene, camera );
	requestAnimationFrame( animate );
}

animate();