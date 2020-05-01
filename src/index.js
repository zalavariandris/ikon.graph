
import './style.css'

// THREE
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
window.THREE = THREE;

// GRAPH DATA
import artist_graph_3D from './milan-artists-graph_3D.json'
import artist_graph_2D from './milan-artists-graph_2D.json'

// GRAHPOLOGY
import {Graph} from 'graphology'
import {complete, ladder} from 'graphology-generators/classic';
import {caveman} from 'graphology-generators/community';
import {erdosRenyi, girvanNewman} from 'graphology-generators/random';
import {circular, random} from 'graphology-layout';
import {subGraph} from 'graphology-utils';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import toUndirected from 'graphology-operators/to-undirected';
window.Graph = Graph;

// GRAPH MESH
// import GraphMesh from './GraphMesh.js'
import {LatticeMesh, NodeFlags} from './lattice/LatticeMesh.js'
// annotations
import HTMLLabels from './annotation/HTMLLabels.js'
import Simulation from './Simulation.js'

// GUI
import dat from 'dat.gui'

//
import LatticeControls from './LatticeControls.js'

import AutoCompleteComponent from './AutoCompleteComponent.js'

import chroma from "chroma-js";
window.chroma = chroma;

/***** GLOBALS *****/
// graph
var artistgraph;

// three
var scene;
var camera;
var renderer;
var cameraControls;
var transformGizmo;

// simulation
var simulation;

// graph mesh
var latticeMesh;
var labels;


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
	// init graph
	// graph = new Graph();
	// graph.import({
	// 	nodes:[
	// 		{key: 'Mása',   attributes: {x: -50, y:   0, z: 0, color: 'white', sie: 1}},
	// 		{key: 'Judit',  attributes: {x: +50, y: +50, z: 0, color: 'white', sie: 1}},
	// 		{key: 'Andris', attributes: {x: +50, y: -50, z: 0, color: 'white', sie: 1}}
	// 	],
	// 	edges: [
	// 		{source: "Andris", target: "Judit"},
	// 		{source: "Judit", target: "Mása"},
	// 	]
	// });

	// /* Import graph */
	artistgraph = new Graph()
	artistgraph.import(artist_graph_3D);
	for(let n of artistgraph.nodes()){
		const x = artistgraph.getNodeAttribute(n, 'x');
		const y = artistgraph.getNodeAttribute(n, 'y');
		const z = artistgraph.getNodeAttribute(n, 'z') || 0;
		artistgraph.setNodeAttribute(n, 'x', x*100);
		artistgraph.setNodeAttribute(n, 'y', y*100);
		artistgraph.setNodeAttribute(n, 'z', z*100);
	}
	// for(let n of artistgraph.nodes()){

	// 	artistgraph.setNodeAttribute(n, 'x', Math.random()*1000-500);
	// 	artistgraph.setNodeAttribute(n, 'y', Math.random()*1000-500);
	// 	artistgraph.setNodeAttribute(n, 'z', Math.random()*1000-500);
	// }
	// 

	/* Erdos-Renyi graph */
	// artistgraph = erdosRenyi(Graph,  {order: 500, probability: 0.01});
	// artistgraph = girvanNewman(Graph, {zOut: 40})
	// for(let n of artistgraph.nodes()){
	// 	artistgraph.setNodeAttribute(n, 'eigencentrality', Math.random());
	// 	artistgraph.setNodeAttribute(n, 'r', Math.random()*255);
	// 	artistgraph.setNodeAttribute(n, 'g', Math.random()*255);
	// 	artistgraph.setNodeAttribute(n, 'b', Math.random()*255);

	// 	artistgraph.setNodeAttribute(n, 'x', Math.random()*1000-500);
	// 	artistgraph.setNodeAttribute(n, 'y', Math.random()*1000-500);
	// 	artistgraph.setNodeAttribute(n, 'z', Math.random()*1000-500);
	// }

	artistgraph = toUndirected(artistgraph);
	// const n = "Maurer Dóra";
	// artistgraph = subGraph(artistgraph, importantNeighbors(artistgraph, n, 1));
	
	console.log("nodes:", artistgraph.nodes().length, "edges:", artistgraph.edges().length);
	window.artistgraph = artistgraph;
}

/***** VIZ *****/
function initViz(){
	/* Setup REDNERER */
	renderer = new THREE.WebGLRenderer({antialias: false, alpha: false });
	renderer.setClearColor('hsl(0, 0%, 20%)');
	renderer.setSize( window.innerWidth, window.innerHeight);
	document.body.appendChild( renderer.domElement );
	window.renderer = renderer;

	/* setup SCENE */
	scene = new THREE.Scene();

	/* CAMERA */
	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.01, 100000 );
	camera.position.x = 10;
	camera.position.y = 1;
	camera.position.z = 200;
	camera.near = 0.001;
	camera.far = 100000;
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
				x: artistgraph.getNodeAttribute(n, 'x'),
				y: artistgraph.getNodeAttribute(n, 'y'),
				z: artistgraph.getNodeAttribute(n, 'z'),
				r: artistgraph.getNodeAttribute(n, 'r')/255,
				g: artistgraph.getNodeAttribute(n, 'g')/255,
				b: artistgraph.getNodeAttribute(n, 'b')/255,
				size: artistgraph.getNodeAttribute(n, 'eigencentrality')*15,
				hovered: false,
				highlighted: false,
				selected: false
			})),
			edges: artistgraph.edges()
			// .filter(e=>artistgraph.getEdgeAttribute(e, 'weight')>5)
			.map(e=>{
				const source = artistgraph.source(e);
				const sourceIdx = artistgraph.nodes().indexOf(source);
				const target = artistgraph.target(e);
				const targetIdx = artistgraph.nodes().indexOf(target);

				return {
					key: e,
					source: sourceIdx, 
					target: targetIdx,
					width: artistgraph.getEdgeAttribute(e, 'weight') || 1.0,
					useNodeColor: true,
					// opacity: 1.0
					opacity: (()=>{
						const weight = artistgraph.getEdgeAttribute(e, 'weight') || 1.0;
						if(weight<2){
							return 0.1;
						}else if(weight<10){
							return 0.3;
						}else{
							return 1.0;
						}
					})()
				};
			})
		},

		PROFILE: false
	});

	latticeMesh.frustumCulled = false;
	scene.add(latticeMesh);
	window.latticeMesh = latticeMesh;

	/* LABELS */
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
			)
		},
		color: (n)=>{
			return new THREE.Color(
				artistgraph.getNodeAttribute(n, 'r')/255,
				artistgraph.getNodeAttribute(n, 'g')/255,
				artistgraph.getNodeAttribute(n, 'b')/255
			)
		},
		visible: (n)=>{
			const i = latticeMesh.indexOfNode(n);
			return	latticeMesh.graph.nodes[i].hovered ||
					latticeMesh.graph.nodes[i].highlighted ||
					latticeMesh.graph.nodes[i].selected;
		}
	});
	window.labels = labels;
	document.body.appendChild(labels.domElement);

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
		attraction: 0.001,
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
	cameraControls.enableDamping = false;
	cameraControls.dampingFactor = 0.1
	cameraControls.enableZoom = true;

	/* when orbiting, disable lattice controls */
    // cameraControls.addEventListener('change', event=>{
    // 	latticeControls.enabled = false;
    // });

    // cameraControls.addEventListener('end', event=>{
    // 	latticeControls.enabled = true;
    // });

    /* LatticeControls */
    var latticeControls = new LatticeControls(camera, renderer.domElement);
    latticeControls.attach(latticeMesh);

    latticeControls.addEventListener('nodeenter', event=>{
    	// set cursor
    	renderer.domElement.style.cursor = 'pointer';

    	// set graph
    	latticeMesh.graph.nodes[event.index].hovered = true;
    	latticeMesh.graph.nodes[event.index].size*=1.1;

    	const n = latticeMesh.graph.nodes[event.index];
    	for(let e of artistgraph.edges(n.key)){
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

    	// set graph
    	latticeMesh.graph.nodes[event.index].hovered = false;
    	latticeMesh.graph.nodes[event.index].size/=1.1;
    	
    	const n = latticeMesh.graph.nodes[event.index];
    	for(let e of artistgraph.edges(n.key)){
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
    	 // higlight importan neighbors 
    	if(event.index){
    		const n = latticeMesh.graph.nodes[event.index].key;
	    	for( let neighbor of [n, ...importantNeighbors(artistgraph, n)]){
	    		const i = latticeMesh.indexOfNode(neighbor)
	    		latticeMesh.graph.nodes[i].highlighted = true;
	    	}
	    	latticeMesh.setAnyHighlighted(true);
	    }

    	/* patch viz */
		labels.patch(labels.diff());
		latticeMesh.patch(latticeMesh.diff());
    });

    latticeControls.addEventListener('nodedrag', event=>{
    	const n = latticeMesh.graph.nodes[event.index].key;
  	
    	// let dragForce = new THREE.Vector3(10,0,0);
    	// simulation.graph.nodes[event.index].forces.push(dragForce)
    	// console.log('drag node', n)
    });

    /* handle window RESIZE */
    window.addEventListener('resize', ()=>{
    	/*camera*/
		camera.aspect = window.innerWidth/window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);

		/* screensize graph */
		let viewport = new THREE.Vector4();
		renderer.getViewport(viewport);
		latticeMesh.setViewport(viewport);
    });
}

function initGui(){
	var gui = new dat.GUI();
	const layoutFolder = gui.addFolder('layout');
	layoutFolder.add(window.layout, 'start');
	layoutFolder.add(window.layout, 'stop');
	let actions = {
		randomLayout
	}

	layoutFolder.add(actions, 'randomLayout');
	layoutFolder.add(window.layout.settings, 'linLogMode');
	layoutFolder.add(window.layout.settings, 'outboundAttractionDistribution');
	layoutFolder.add(window.layout.settings, 'adjustSizes');
	layoutFolder.add(window.layout.settings, 'scalingRatio', 0, 10);
	layoutFolder.add(window.layout.settings, 'strongGravityMode');
	layoutFolder.add(window.layout.settings, 'gravity');
	layoutFolder.add(window.layout.settings, 'slowDown');
	layoutFolder.add(window.layout.settings, 'barnesHutOptimize');
	layoutFolder.add(window.layout.settings, 'barnesHutTheta');
	layoutFolder.open()
}

function init(){
	createGraph();

	/* SEARCH */
	let searchComponent = new AutoCompleteComponent(artistgraph.nodes());
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
	document.body.append(searchComponent.domElement);

	/* graph viz */
	initViz();

	/* INFO BOX */
	const graphInfo = document.createElement('div');
	graphInfo.id = "graphInfo";
	graphInfo.innerText = `nodes: ${latticeMesh.graph.nodes.length}, edges: ${latticeMesh.graph.edges.length}`;
	document.body.appendChild(graphInfo);

	const playButton = document.createElement('button');
	playButton.style.marginLeft='1em';
	playButton.innerText = '>';
	graphInfo.append(playButton);
	playButton.addEventListener('click', ()=>{
		console.log('click')
		simulation.paused = !simulation.paused;
		playButton.innerText = simulation.paused ? '>' : '||'
	});
	// initMesh();
	// initControls();
	
	// initGui();
}

/***** Render *****/


/* START */
init();

function animate() {
	// copy sim positions to lattice
	for(let i=0; i<simulation.graph.nodes.length; i++){
		latticeMesh.graph.nodes[i].x = simulation.graph.nodes[i].pos.x;
		latticeMesh.graph.nodes[i].y = simulation.graph.nodes[i].pos.y;
		latticeMesh.graph.nodes[i].z = simulation.graph.nodes[i].pos.z;
	}

	// patch viz
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
	renderer.render( scene, camera );
	requestAnimationFrame( animate );
}

animate();