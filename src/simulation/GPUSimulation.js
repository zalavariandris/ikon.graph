import * as THREE from 'three'

const createMap = ({values, DataType, itemSize, TextureFormat, TextureType})=>{
	const valueCount = values.length;
	const textureSize = Math.pow(2, Math.ceil(Math.log(Math.sqrt(valueCount/itemSize))/Math.log(2)));
	let data = new DataType(textureSize*textureSize*itemSize);
	const tex = new THREE.DataTexture(
		data, textureSize, textureSize, TextureFormat, TextureType
	)
	for(let i=0;i<valueCount; i++){
		data[i] = values[i];
	}
	tex.minFilter = THREE.NearestFilter;
	tex.magFilter = THREE.NearestFilter;
	tex.generateMipmaps = false;
	tex.needsUpdate = true;
	return tex;
}

class GPUSimulation{
	constructor({renderer, graph, attraction, repulsion, gravity, dampening}){
		this.graph = graph;
		this.attraction = attraction;
		this.repulsion = repulsion;
		this.gravity = gravity;
		this.dampening = dampening;

		this.renderer = renderer;

		// create adjacency matrix
		const count = graph.nodes.length;
		this.forces = new Float32Array(count*3);
		this.adj = Array.from({length:count}).map(v=>Array.from({length:count}));
		
		for(let edge of this.graph.edges){
			let attributes = {weight: Math.max(0, edge.weight)};
			this.adj[edge.source][edge.target] = attributes;
			this.adj[edge.target][edge.source] = attributes;
		}

		// Create computation matrices
		// node matrices
		const nodesCount =	this.graph.nodes.length;
		this.positions =	this.graph.nodes.flatMap(node=>[node.pos.x, node.pos.y, node.pos.z]);
		this.forces =		this.graph.nodes.flatMap(node=>[0,0,0]);
		this.velocities =	this.graph.nodes.flatMap(node=>[0,0,0]);



		// link matrices
		this.weights = Array.from({length: nodesCount**2}).map(d=>0);
		for(let i=0;i<this.adj.length;i++){
			for(let j=0; j<this.adj.length; j++){
				if(i==j) continue;
				const edge = this.adj[i][j];
				this.weights[i*nodesCount+j] = edge!=undefined ? edge.weight : 0.0;
			}
		}

		this.springs = Array.from({length: nodesCount**2*3}).map(d=>0);

		// convert to Texture
		this.positionMap = createMap({
			values: this.positions,
			DataType: Float32Array,
			itemSize: 3,
			TextureFormat: THREE.RGBFormat,
			TextureType: THREE.FloatType
		});

		this.weightMap = createMap({
			values: this.weights,
			DataType: Float32Array,
			itemSize: 1,
			TextureFormat: THREE.LuminanceFormat, 
			TextureType:THREE.FloatType
		});

		// FBO
		const nodeColumns = Math.pow(2, Math.ceil(Math.log(Math.sqrt(nodesCount))/Math.log(2)));

		this.rtScene = new THREE.Scene();
		const size = 1.0;
		this.rtQuad = new THREE.Mesh(
			new THREE.PlaneBufferGeometry(size,size),
			new THREE.MeshBasicMaterial({color: 'red'})
		);
		this.rtScene.add(this.rtQuad);
		this.rtCamera = new THREE.OrthographicCamera(-size/2, size/2, size/2, -size/2, 0, 100);
		
		this.rtCamera.position.set(0,0,1);

		this.currentPositionFbo = new THREE.WebGLRenderTarget(nodeColumns, nodeColumns, {
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBFormat,
			type: THREE.HalfFloatType,
			// depthBuffer: false,
			// stencilBuffer: false
		});

		this.newPositionFbo = new THREE.WebGLRenderTarget(nodeColumns, nodeColumns, {
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBFormat,
			type: THREE.HalfFloatType,
			// depthBuffer: false,
			// stencilBuffer: false
		});

		this.currentVelocityFbo = new THREE.WebGLRenderTarget(nodeColumns, nodeColumns,{
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBFormat,
			type: THREE.HalfFloatType,
			// depthBuffer: false,
			// stencilBuffer: false
		});

		this.newVelocityFbo = new THREE.WebGLRenderTarget(nodeColumns, nodeColumns,{
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBFormat,
			type: THREE.HalfFloatType,
			// depthBuffer: false,
			// stencilBuffer: false
		});

		this.forceFbo = new THREE.WebGLRenderTarget(nodeColumns, nodeColumns,{
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBFormat,
			type: THREE.HalfFloatType,
			// depthBuffer: false,
			// stencilBuffer: false
		});

		// render initial positions to fbo
		// this.rtQuad.material.uniforms.map.value = this.positionMap;
		this.initPositions();
	}

	initPositions(){
		this.rtQuad.material = new THREE.ShaderMaterial({
			uniforms:{
				positionMap: {value: this.positionMap},
			},
			vertexShader: `
    		varying vec2 vUv;
			void main(){
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}`,
			fragmentShader: `
			varying vec2 vUv;
			uniform sampler2D positionMap;
			void main(){
				vec4 color = texture2D(positionMap, vUv);
				gl_FragColor = vec4(color.rgb,1);
			}`
		});
		this.renderer.setRenderTarget(this.currentPositionFbo);
		this.renderer.render(this.rtScene, this.rtCamera);
	}

	compute(){
		/*  Compute forces
		 *  dependencies: [currentPosition]
		 */
		if(this.ComputeForcesShader==undefined){
			this.ComputeForcesShader = new THREE.ShaderMaterial({
				uniforms:{
					attraction: {value: 0.0005},
					repulsion: {value: -0.15},
					gravity: {value: 0.005},
					currentPositionMap: {value: this.currentPositionFbo.texture},
					weightMap:{value: this.weightMap},
					nodeColumns:{value: this.currentPositionFbo.width},
					edgeColumns:{value: this.weightMap.image.width}
				},
				vertexShader: `
				// attribute vec2 uv;
	    		varying vec2 vUv;
				void main(){
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}`,

				fragmentShader: `
				uniform float gravity;
				uniform float repulsion;
				uniform float attraction;
				uniform sampler2D currentPositionMap;
				uniform sampler2D weightMap;
				uniform int nodeColumns;
				uniform int edgeColumns;
				varying vec2 vUv;
				void main(){
					
					vec3 pos = texture2D(currentPositionMap, vUv).xyz;
					vec3 force = vec3(0,0,0);

					vec3 center = vec3(0,0,0);
					force += (center-pos)*gravity;


					// get self index
					int y = int(vUv.y*float(nodeColumns));
					int x = int(vUv.x*float(nodeColumns));
					int n1 = y*nodeColumns+x;

					if(n1>=440){
						gl_FragColor = vec4(0,0,0, 0);
					}else{
						for(int n2=0; n2<440; n2++){
							
							if(n1==n2){
								continue;
							}

							if(n1==59){
								gl_FragColor+=vec4(1,0,0,1);
							}

							// pull P2
							float y = float(n2 / nodeColumns);
							float x = float(n2-int(y)*nodeColumns);
							vec2 ref = vec2(x+0.5, y+0.5) / vec2(nodeColumns, nodeColumns);
							vec3 P2 = texture2D(currentPositionMap, ref).xyz;

							/* Apply repulsion */
							vec3 vector = P2-pos;
							float distSq = dot(vector, vector);
							if(distSq<0.0001){
								continue;
							}
							force+=1.0/distSq*vector*repulsion;

							/* Apply attraction */
							// pull edge weight
							int edgeIndex = n1*440+n2;
							float edgeY = float(edgeIndex/edgeColumns);
							float edgeX = float(edgeIndex-int(edgeY)*edgeColumns);
							vec2 edgeRef = vec2(edgeX, edgeY) / vec2(edgeColumns, edgeColumns);
							float weight = texture2D(weightMap, edgeRef).r;

							if(n2==59 && weight>1.0){
								gl_FragColor += vec4(0,0,1, 1);
							}

							force+=vector*attraction*clamp(weight, 0.0, 1.0);
						}
					}
					gl_FragColor = vec4(force, 1);
				}`
			});
		}

		this.rtQuad.material = this.ComputeForcesShader;
		this.renderer.setRenderTarget(this.forceFbo);
		this.renderer.render(this.rtScene, this.rtCamera);

		/*  Apply force to velocity
		 *  dependencies: [force, currentVelocity]
		 */

		 if(this.ApplyForceToVelocityShader==undefined){
			this.ApplyForceToVelocityShader = new THREE.ShaderMaterial({
				uniforms: {
					forceMap: {value: this.forceFbo.texture},
					currentVelocityMap: {value: this.currentVelocityFbo.texture},
				},
				vertexShader: `
				// attribute vec2 uv;
	    		varying vec2 vUv;
				void main(){
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}`,
				fragmentShader: `
				varying vec2 vUv;
				uniform sampler2D forceMap;
				uniform sampler2D currentVelocityMap;
				void main(){
					vec3 velocity = texture2D(currentVelocityMap, vUv).xyz;

					// apply force
					vec3 force = texture2D(forceMap, vUv).xyz;
					gl_FragColor = vec4(velocity+force, 1);
				}	`
			});
		}

		this.rtQuad.material = this.ApplyForceToVelocityShader;
		this.renderer.setRenderTarget(this.newVelocityFbo);
		this.renderer.render(this.rtScene, this.rtCamera);

		/*  Copy newVelocity to currentVelocity
		 * 
		 */
		 const passThrough = (input, output, fadeTo=1.0)=>{
		 	this.rtQuad.material = new THREE.ShaderMaterial({
		 		uniforms:{
		 			fadeTo: {value: fadeTo},
		 			inputMap: {value: input}
		 		},
				vertexShader: `
				varying vec2 vUv;
				void main(){
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}`,
				fragmentShader:`
				varying vec2 vUv;
				uniform sampler2D inputMap;
				uniform float fadeTo;
				void main(){
					gl_FragColor = vec4(texture2D(inputMap, vUv).xyz*fadeTo, 1.0);
				}
				`
		 	})


		 	this.renderer.setRenderTarget(output);
		 	this.renderer.render(this.rtScene, this.rtCamera);
		 }
		 passThrough(this.newVelocityFbo.texture, this.currentVelocityFbo, 0.9);

		 /* Apply velocity to new Positions
		  *
		 */

		if(this.ApplyVelocityToPositionShader==undefined){
			this.ApplyVelocityToPositionShader = new THREE.ShaderMaterial({
			  	uniforms: {
			  		currentPositionMap: {value: this.currentPositionFbo.texture},
			  		currentVelocityMap: {value: this.currentVelocityFbo.texture}
			  	},
			  	vertexShader: `
				// attribute vec2 uv;
	    		varying vec2 vUv;
				void main(){
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}`,
				fragmentShader: `
				varying vec2 vUv;
				uniform sampler2D currentPositionMap;
				uniform sampler2D currentVelocityMap;
				void main(){
					vec3 pos = texture2D(currentPositionMap, vUv).xyz;
					vec3 vel = texture2D(currentVelocityMap, vUv).xyz;
					gl_FragColor = vec4(pos+vel, 1.0);
				}
				`
			});
		}
		this.rtQuad.material = this.ApplyVelocityToPositionShader;
		this.renderer.setRenderTarget(this.newPositionFbo);
		this.renderer.render(this.rtScene, this.rtCamera);

		/* Copy new positions map to current positions
		*/
		passThrough(this.newPositionFbo.texture, this.currentPositionFbo);
	}
}

export default GPUSimulation;