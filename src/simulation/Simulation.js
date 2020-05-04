import * as THREE from 'three'

class Simulation{
	constructor({graph, attraction, repulsion, gravity, dampening}){
		this.graph = graph;
		this.attraction = attraction;
		this.repulsion = repulsion;
		this.gravity = gravity;
		this.dampening = dampening;

		// create adjacency matrix

		const count = graph.nodes.length;
		// this.forceLinks = new Float32Array(count**2*3);
		this.forces = new Float32Array(count*3);
		this.adj = Array.from({length:count}).map(v=>Array.from({length:count}));
		for(let edge of this.graph.edges){
			let attributes = {weight: Math.max(0, edge.weight)};
			this.adj[edge.source][edge.target] = attributes;
			this.adj[edge.target][edge.source] = attributes;
		}

		// this.positions = new Float32Array(graph.nodes.flatMap(node=>[node.x, node.y, node.z]));
		// this.forces = []
		// this.velocities = new Float32Array(Array.from({length: graph.nodes.length*3}).map(d=>0));

		// //GPU
		// this.rttScene = new THREE.Scene();
		// this.quad = new THREE.Mesh(
		// 	new THREE.PlaneBufferGeometry(1, 1),
		// 	new THREE.MeshBasicMaterial({
		// 		color: 'green'
		// 	})
		// );
		// this.rttScene.add(this.quad);
		// this.rttCamera = new THREE.OrthographicCamera( -0.5,0.5, 0.5, -0.5, 0, 2 );
		// this.rttCamera.position.set(0,0,1);
		// this.rttTexture = new THREE.WebGLRenderTarget(500, 500, {
		// 	// format: THREE.RGBFormat,
		// 	// depthBuffer: false,
		// 	// stencilBuffer: false,
		// 	minFilter: THREE.LinearFilter, 
		// 	magFilter: THREE.NearestFilter
		// });

		// this.debugGPUMesh = new THREE.Mesh(
		// 	new THREE.BoxBufferGeometry(10, 10, 10),
		// 	new THREE.MeshPhongMaterial({
		// 		color: 'white',
		// 		map: this.rttTexture.texture
		// 	})
		// );
	}

	render(renderer){
		const rt = renderer.getRenderTarget()
		renderer.setRenderTarget(this.rttTexture);
		renderer.render(this.rttScene, this.rttCamera);
		renderer.setRenderTarget(rt);
	}

	step(){
		/* Calculate forces */
		for(let i=0; i<this.graph.nodes.length; i++){
			this.forces[i*3+0] = 0;
			this.forces[i*3+1] = 0;
			this.forces[i*3+2] = 0;
		}

		// apply attraction	
		// for(let i=0; i<this.graph.nodes.length**2; i++){
		// 	let n1 = Math.floor(i/this.graph.nodes.length);
		// 	let n2 = i-n1*this.graph.nodes.length;
		//  if(n1==n2) continue;
		for(let n1=0; n1<this.graph.nodes.length; n1++){
			for(let n2=0; n2<this.graph.nodes.length; n2++){
				if(n1==n2) continue
				/* Apply repulsion between nodes */
				const p1 = this.graph.nodes[n1].pos;
				const p2 = this.graph.nodes[n2].pos;

				const repulsion = new THREE.Vector3()
				.add(p1)
				.sub(p2);

				const distanceSq = repulsion.lengthSq();
				repulsion
				.multiplyScalar(this.repulsion/distanceSq);

				this.forces[n1*3+0]-=repulsion.x;
				this.forces[n1*3+1]-=repulsion.y;
				this.forces[n1*3+2]-=repulsion.z;

				this.forces[n2*3+0]+=repulsion.x;
				this.forces[n2*3+1]+=repulsion.y;
				this.forces[n2*3+2]+=repulsion.z;

				/* Apply attraction along edges */
				let edge = this.adj[n1][n2];
				if(edge!=undefined){
					// const p1 = this.graph.nodes[n1].pos;
					// const p2 = this.graph.nodes[n2].pos;

					const m1 = this.graph.nodes[n1].mass;
					const m2 = this.graph.nodes[n2].mass;

					const attraction = new THREE.Vector3()
					.add(p1)
					.sub(p2)

					// const distance = attraction.length();
					// force.normalize();

					attraction.multiplyScalar(this.attraction* edge.weight);

					this.forces[n1*3+0] -= attraction.x * m2/(m1+m2);
					this.forces[n1*3+1] -= attraction.y * m2/(m1+m2);
					this.forces[n1*3+2] -= attraction.z * m2/(m1+m2);

					this.forces[n2*3+0] += attraction.x * m1/(m1+m2);
					this.forces[n2*3+1] += attraction.y * m1/(m1+m2);
					this.forces[n2*3+2] += attraction.z * m1/(m1+m2);
				}
			}
		}

		// apply gravity
		for(let i=0; i<this.graph.nodes.length; i++){
			const gravity = new THREE.Vector3(0,0,0);
			gravity.sub(this.graph.nodes[i].pos);

			// const distance = gravity.length()

			gravity.multiplyScalar(/*distance*/this.gravity);

			this.forces[i*3+0] += gravity.x;
			this.forces[i*3+1] += gravity.y;
			this.forces[i*3+2] += gravity.z;
		}

		/* Apply forces to velocity */
		for(let i=0; i<this.graph.nodes.length; i++){
			this.graph.nodes[i].velocity.add({
				x: this.forces[i*3+0],
				y: this.forces[i*3+1],
				z: this.forces[i*3+2],
			});
		}

		// apply dampening
		for(let i=0; i<this.graph.nodes.length; i++){
			this.graph.nodes[i].velocity.multiplyScalar(this.dampening);
		}

		// apply velocity to position
		for(let i=0; i<this.graph.nodes.length; i++){
			this.graph.nodes[i].pos.add(this.graph.nodes[i].velocity);
		}
	}
}

export default Simulation;