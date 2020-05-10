import * as THREE from 'three'

class CPUSimulation{
	constructor({graph, attraction, repulsion, gravity, dampening}){
		this.graph = graph;
		this.attraction = attraction;
		this.repulsion = repulsion;
		this.gravity = gravity;
		this.dampening = dampening;


		
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
				this.weights[i*nodesCount+j] = edge!=undefined ? edge.weight : 0;
			}
		}

		this.springs = Array.from({length: nodesCount**2*3}).map(d=>0);

		// convert to Float32
		this.positions = new Float32Array(this.positions);
		this.forces = new Float32Array(this.forces);
		this.velocities = new Float32Array(this.velocities)
		this.springs = new Float32Array(this.springs);

		const nodeColumns = Math.pow(2, Math.ceil(Math.log(Math.sqrt(this.positions.length/3))/Math.log(2)));
		this.positionsMap = new THREE.DataTexture(this.positions, nodeColumns, nodeColumns, THREE.RGBFormat, THREE.FloatType);
	}

	step(){
		/* calculate spring vectors */
		const nodesCount = this.positions.length/3;
		const springCount = nodesCount**2;
		for(let i=0; i<springCount; i++){
			const n1 = Math.floor(i/nodesCount);
			const n2 = i-n1*nodesCount;
			if(n1==n2) continue;

			const p1 = new THREE.Vector3().fromArray(this.positions, n1*3);
			const p2 = new THREE.Vector3().fromArray(this.positions, n2*3);
			
			const distanceSq = p1.distanceToSquared(p2);
			const weight = this.weights[i];
			
			let repulsion =  p2.clone().sub(p1).multiplyScalar(this.repulsion/distanceSq);
			let attraction = p2.clone().sub(p1).multiplyScalar(weight*this.attraction);

			let force = new THREE.Vector3(0,0,0)
			.add(attraction)
			.add(repulsion);

			force.toArray(this.springs, i*3);
		}

		/* reset forces */
		for(let i=0; i<nodesCount; i++){
			this.forces.set([0,0,0], i*3);
		}

		/* apply spring to forces */
		for(let i=0; i<nodesCount; i++){
			for(let j=0; j<nodesCount; j++){
				if(i==j) continue;
				const offset = (i*nodesCount+j)*3;
				this.forces[i*3+0]+=this.springs[offset+0];
				this.forces[i*3+1]+=this.springs[offset+1];
				this.forces[i*3+2]+=this.springs[offset+2];
			}
		}

		/* apply gravity to forces */
		for(let i=0; i<nodesCount; i++){
			const pos = new THREE.Vector3(this.positions[i*3+0], this.positions[i*3+1], this.positions[i*3+2]);
			this.forces[i*3+0] += -pos.x*this.gravity;
			this.forces[i*3+1] += -pos.y*this.gravity;
			this.forces[i*3+2] += -pos.z*this.gravity;
		}


		/* apply forces to velocity */
		for(let i=0; i<nodesCount; i++){
			this.velocities[i*3+0]+=this.forces[i*3+0];
			this.velocities[i*3+1]+=this.forces[i*3+1];
			this.velocities[i*3+2]+=this.forces[i*3+2];
		}
		
		// apply dampening to velocity
		for(let i=0; i<nodesCount; i++){
			this.velocities[i*3+0]*=this.dampening;
			this.velocities[i*3+1]*=this.dampening;
			this.velocities[i*3+2]*=this.dampening;
		}

		// apply velocity to position
		for(let i=0; i<nodesCount; i++){
			this.positions[i*3+0]+=this.velocities[i*3+0];
			this.positions[i*3+1]+=this.velocities[i*3+1];
			this.positions[i*3+2]+=this.velocities[i*3+2];
		}

		/* Copy positions to graph */
		for(let i=0; i<nodesCount; i++){
			this.graph.nodes[i].pos.x = this.positions[i*3+0];
			this.graph.nodes[i].pos.y = this.positions[i*3+1];
			this.graph.nodes[i].pos.z = this.positions[i*3+2];
		}
	}
}

export default CPUSimulation;