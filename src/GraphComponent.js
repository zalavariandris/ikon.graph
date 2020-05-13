import * as THREE from 'three'
import {LatticeMesh, NodeFlags} from './lattice/LatticeMesh.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import CanvasLabels from './annotation/CanvasLabels.js'
import HTMLLabels from './annotation/HTMLLabels.js'
import LatticeControls from './LatticeControls.js'
// Simulation
import Simulation from './Simulation/Simulation.js'
import CPUSimulation from './Simulation/CPUSimulation.js';
import GPUSimulation from './Simulation/GPUSimulation.js';

class GraphComponent extends THREE.EventDispatcher{

	setSelection(nodeIds){
		// clear current selection
		this.graph.nodes.filter(node=>node.highlighted)
		.forEach((node)=>node.highlighted=false);
		if(nodeIds){
			const indices = nodeIds.map(n=>this.latticeMesh.indexOfNode(n));
			// set new selection
			for(let i of indices){
				this.graph.nodes[i].highlighted = true;
			}
			this.latticeMesh.setAnyHighlighted(true);
			this.canvasLabels.domElement.style.opacity = 0.2;
			this.latticeMesh.bmLabels.material.uniforms.opacity.value = 0.4;
		}else{
			this.latticeMesh.setAnyHighlighted(false);
			this.canvasLabels.domElement.style.opacity = 1.0;
			this.latticeMesh.bmLabels.material.uniforms.opacity.value = 0.8;
		}

		// patch viz
		this.latticeMesh.patch(this.latticeMesh.diff());
		this.htmlLabels.patch(this.htmlLabels.diff());
		this.needsRender = true;
	}

	play(){
		this.paused = false;
	}

	pause(){
		this.paused = true;
	}

	constructor({container, graph, onNodeClick}){
		super();
		this.graph = graph;
		this.adj = Array.from({length:graph.nodes.length}).map(v=>Array.from({length:graph.nodes.length}));
		for(let edge of this.graph.edges){
			let attributes = {};
			this.adj[edge.source][edge.target] = attributes;
			this.adj[edge.target][edge.source] = attributes;
		}
		this._indexOfNodeCache = new Map(graph.nodes.map((n, i)=>[n.key, i]));
		this._indexOfEdgeCache = new Map(graph.edges.map((e, i)=>[e.key, i]));

		//
		this.container = container;
		this.container.classList.add('graph-component');
		this.renderer;
		this.scene;
		this.simulation;

		/* RENDERER */
		this.webglElement = document.createElement('canvas');
		this.webglElement.id='webgl';
		container.appendChild(this.webglElement);

		this.renderer = new THREE.WebGLRenderer({canvas: this.webglElement, antialias: false, alpha: true });
		this.renderer.setSize(this.webglElement.clientWidth*window.devicePixelRatio, this.webglElement.clientHeight*window.devicePixelRatio, false);
		this.renderer.sortObjects = false;

		this.setBackgroundColor('hsl(0, 0%, 20%)');

		/* scene */
		this.scene = new THREE.Scene();

		/* camera */
		this.camera = new THREE.PerspectiveCamera( 50, this.webglElement.clientWidth/this.webglElement.clientHeight, 0.01, 100000 );
		this.camera.position.set(0,0,100);
		this.camera.near = 0.1;
		this.camera.far = 3000;
		this.scene.add(this.camera);

		/* lighting */
		let keyLight = new THREE.PointLight('white', 0.7);
		keyLight.position.set(-1000, 1000, 1000);
		this.scene.add(keyLight);

		let fillLight = new THREE.PointLight('pink', 0.3);
		fillLight.position.set(1000, 500, 0);
		this.scene.add(fillLight);

		let rimLight = new THREE.PointLight('cyan', 0.1);
		rimLight.position.set(1000, -500, -1000);
		this.scene.add(rimLight);

		var ambient = new THREE.AmbientLight( 'white', 0.7 ); // soft white light
		this.scene.add( ambient );

		/* helpers */
		// scene.add(new THREE.GridHelper(100, 10));

		/* lattice */
		this.latticeMesh = new LatticeMesh({
			renderer: this.renderer,
			graph: this.graph,
			PROFILE: false
		});
		this.latticeMesh.frustumCulled = false;
		this.scene.add(this.latticeMesh);

		/* LatticeControls */
	    this.latticeControls = new LatticeControls(this.camera, this.renderer.domElement);
	    this.latticeControls.attach(this.latticeMesh);

	    this.latticeControls.addEventListener('nodeenter', event=>{
	    	// set cursor
	    	this.container.style.cursor = 'pointer';

	    	// higlight nodes
	    	const n = this.latticeMesh.graph.nodes[event.index].key;
	    	this.latticeMesh.graph.nodes[event.index].hovered = true;
	    	this.htmlLabels.patch(this.htmlLabels.diff());
	    	this.latticeMesh.patch(this.latticeMesh.diff());
	    	this.needsRender = true;
	    });

	    this.latticeControls.addEventListener('nodeleave', event=>{
	    	// set cursor
	    	this.container.style.cursor = 'default';
	    	this.latticeMesh.graph.nodes[event.index].hovered = false;

	    	// unhighlight nodes
	    	this.latticeMesh.patch(this.latticeMesh.diff());
	    	this.htmlLabels.patch(this.htmlLabels.diff());
	    	this.needsRender = true;
	    });

	    this.latticeControls.addEventListener('nodeclick', event=>{
	    	if(event.index>=0){
		    	const n = this.graph.nodes[event.index].key;
		    	onNodeClick.bind(this)(n);
		    }else{
		    	onNodeClick.bind(this)(null);
		    }
	    });

	    this.latticeControls.addEventListener('nodedrag', event=>{
	    	const n = this.latticeMesh.graph.nodes[event.index].key;
	    	console.log(event);
	    });

		/* html labels */
		this.htmlLabels = new HTMLLabels({
			keys: this.graph.nodes.map(node=>node.key),
			text: (n)=>{
				return n;
			},
			position: (n)=>{
				const i = this.latticeMesh.indexOfNode(n);

				return new THREE.Vector3(
					this.latticeMesh.graph.nodes[i].x,
					this.latticeMesh.graph.nodes[i].y,
					this.latticeMesh.graph.nodes[i].z
				).applyMatrix4(this.latticeMesh.matrixWorld);
			},
			color: (n)=>{
				return new THREE.Color(
					artistgraph.getNodeAttribute(n, 'r')/255,
					artistgraph.getNodeAttribute(n, 'g')/255,
					artistgraph.getNodeAttribute(n, 'b')/255
				);
			},
			visible: (n)=>{
				const i = this.latticeMesh.indexOfNode(n);
				return	this.latticeMesh.graph.nodes[i].hovered ||
						this.latticeMesh.graph.nodes[i].highlighted ||
						this.latticeMesh.graph.nodes[i].selected;
			},
			fontSize: n=>{
				const s = 8+artistgraph.getNodeAttribute(n, 'eigencentrality')*40
				return s.toFixed()+'px';
			}
		});
		window.htmlLabels = this.htmlLabels;
		this.htmlLabels.domElement.id = 'labels';
		container.appendChild(this.htmlLabels.domElement);

		/* canvas labels */
		this.canvasLabels = new CanvasLabels({
			defaultColor: new THREE.Color(0,0,0),
			labels: artistgraph.nodes().map(n=>{
				return n;
			}),
			position: n=>{
				const i = this.latticeMesh.indexOfNode(n);

				return new THREE.Vector3(
					this.latticeMesh.graph.nodes[i].x,
					this.latticeMesh.graph.nodes[i].y,
					this.latticeMesh.graph.nodes[i].z
				).applyMatrix4(this.latticeMesh.matrixWorld);
			},
			visible: (n)=>{
				const i = this.latticeMesh.indexOfNode(n);
				const HTMLLabelVisible = this.latticeMesh.graph.nodes[i].hovered ||
						this.latticeMesh.graph.nodes[i].highlighted ||
						this.latticeMesh.graph.nodes[i].selected;
				return !HTMLLabelVisible && artistgraph.getNodeAttribute(n, 'eigencentrality')>0.03;
			},
			opacity: n=>{
				const i = this.latticeMesh.indexOfNode(n);
				const pos = new THREE.Vector3(
					this.latticeMesh.graph.nodes[i].x,
					this.latticeMesh.graph.nodes[i].y,
					this.latticeMesh.graph.nodes[i].z
				)
				const dstSqr = pos.distanceToSquared(this.camera.position);
				let centrality = artistgraph.getNodeAttribute(n, 'eigencentrality')
				return Math.min(Math.pow(centrality*10, 1)*12000/dstSqr, 0.9);
			},
			color: n=>{
				let i = this.latticeMesh.indexOfNode(n);
				const backgroundColor = this.getBackgroundColor();
				backgroundColor.r = 1-backgroundColor.r;
				backgroundColor.g = 1-backgroundColor.g;
				backgroundColor.b = 1-backgroundColor.b;
				
				let nodeColor =  new THREE.Color(
					this.graph.nodes[i].r,
					this.graph.nodes[i].g,
					this.graph.nodes[i].b
				)

				return nodeColor.lerp(backgroundColor, 0.8);
			},
			fontSize: n=>{
				const s = 10+artistgraph.getNodeAttribute(n, 'eigencentrality')*50*devicePixelRatio
				return s;
			}
		});
		container.appendChild(this.canvasLabels.domElement);
		this.canvasLabels.domElement.style.opacity = 1.0;
		this.canvasLabels.domElement.width = this.container.clientWidth*devicePixelRatio;
		this.canvasLabels.domElement.height = this.container.clientHeight*devicePixelRatio;

		/* camera controls*/
		this.cameraControls = new OrbitControls(this.camera, this.renderer.domElement)
		this.cameraControls.autoRotate = false;
		this.cameraControls.autoRotateSpeed = -0.3;
		this.cameraControls.screenSpacePanning = true;
		// cameraControls.enableDamping = true;
		// cameraControls.dampingFactor = 0.1
		this.cameraControls.enableZoom = true;
		this.cameraControls.mouseButtons = {
			LEFT: THREE.MOUSE.PAN,
			MIDDLE: THREE.MOUSE.DOLLY,
			RIGHT: THREE.MOUSE.ROTATE
		}
		window.cameraControls = this.cameraControls;
		this.cameraControls.addEventListener('change', ()=>{
			this.needsRender = true;
		});

		/* on reisize */
		window.addEventListener('resize', ()=>{
	    	/* webgl */
			this.renderer.setSize(this.container.clientWidth*devicePixelRatio, this.container.clientHeight*devicePixelRatio, false);
			
			this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
			this.camera.updateProjectionMatrix();

			let viewport = new THREE.Vector4();
			this.renderer.getViewport(viewport);
			this.latticeMesh.setViewport(viewport);
			this.needsRender = true;

			/* canvas labels */
			this.canvasLabels.domElement.width = this.container.clientWidth*devicePixelRatio;
			this.canvasLabels.domElement.height = this.container.clientHeight*devicePixelRatio;
		});

		/* simulation */
		this.simulation = new Simulation({
			graph: {
				nodes: this.graph.nodes.map(node=>new Object({
					pos: new THREE.Vector3(node.x, node.y, node.z),
					force: new THREE.Vector3(),
					velocity: new THREE.Vector3(),
					forces: [],
					mass: node.size
				})),
				edges: this.graph.edges.map(edge=>new Object({
					source: edge.source,
					target: edge.target,
					weight: edge.width || 1.0
				}))
			},
			attraction: 0.0005,
			repulsion: -0.15,
			gravity: 0.005,
			dampening: 0.9
		});

		this.paused = true;
		this.needsRender = true;
		//
		var animate = ()=>{
			if(!this.paused){
				this.stepSimulation();
			}
			if(this.needsRender){
				this.render();
			}
			requestAnimationFrame(animate);
		}
		animate()
	}

	stepSimulation(){
		// step simulation
		this.simulation.step();
		for(let i=0; i<this.simulation.graph.nodes.length; i++){
			this.latticeMesh.graph.nodes[i].x = this.simulation.graph.nodes[i].pos.x;
			this.latticeMesh.graph.nodes[i].y = this.simulation.graph.nodes[i].pos.y;
			this.latticeMesh.graph.nodes[i].z = this.simulation.graph.nodes[i].pos.z;
		}
		this.latticeMesh.patch({
			nodes: new Map(this.simulation.graph.nodes.map((node, i)=>[i, 
			{
				x: this.simulation.graph.nodes[i].pos.x,
				y: this.simulation.graph.nodes[i].pos.y,
				z: this.simulation.graph.nodes[i].pos.z
			}])),
			edges: new Map()
		});

		this.needsRender = true;
	}

	render(){
		console.log('render');
		// sync labels to 3dscene
		if(this.htmlLabels) this.htmlLabels.update(this.camera);
		if(this.canvasLabels) this.canvasLabels.update(this.camera);
		
		// render scene
		this.renderer.setRenderTarget(null);
		this.renderer.render(this.scene, this.camera);

		//
		this.needsRender = false;
	}

	getBackgroundColor(color){
		return new THREE.Color().setStyle(this.container.style.backgroundColor);
	}

	setBackgroundColor(color){
		this.container.style.backgroundColor = new THREE.Color(color).getStyle();
	}
}

export default GraphComponent;
