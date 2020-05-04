import * as THREE from 'three'

class Simulation{
	constructor({graph, attraction, repulsion, gravity, dampening}){
		this.graph = graph;
		this.attraction = attraction;
		this.repulsion = repulsion;
		this.gravity = gravity;
		this.dampening = dampening;
		this.paused = true;

		this.play();
	}

	play(){
		if(!this.paused){
			this.step()
		}
		requestAnimationFrame(()=>this.play())
	}

	step(){
		/* Calculate forces */
		// reset forces
		for(let i=0; i<this.graph.nodes.length; i++){
			this.graph.nodes[i].force = new THREE.Vector3(0,0,0);
		}

		// apply gravity
		for(let i=0; i<this.graph.nodes.length; i++){
			const gravity = new THREE.Vector3(0,0,0);
			gravity.sub(this.graph.nodes[i].pos);

			const distance = gravity.length()

			gravity.multiplyScalar(/*distance*/this.gravity);

			this.graph.nodes[i].force.add(gravity);
		}

		// apply attraction	
		for(let edge of this.graph.edges){
			const n1 = edge.source;
			const n2 = edge.target;

			const p1 = this.graph.nodes[n1].pos;
			const p2 = this.graph.nodes[n2].pos;

			const m1 = this.graph.nodes[n1].mass;
			const m2 = this.graph.nodes[n2].mass;

			const force = new THREE.Vector3()
			.add(p1)
			.sub(p2)

			const distance = force.length();
			// force.normalize();

			force.multiplyScalar(this.attraction*Math.max(0, edge.weight));

			let f1 = force.clone().multiplyScalar(m2/(m1+m2));
			let f2 = force.clone().multiplyScalar(m1/(m1+m2));
			this.graph.nodes[n1].force.sub(f1);
			this.graph.nodes[n2].force.add(f2);
		}

		// apply repulsion
		for(let s=0; s<this.graph.nodes.length; s++){
			for(let t=s+1; t<this.graph.nodes.length; t++){
				const force = new THREE.Vector3()
				.add(this.graph.nodes[s].pos)
				.sub(this.graph.nodes[t].pos);

				const distance = force.length();

				force
				.normalize()
				.multiplyScalar(this.repulsion/distance/2);

				this.graph.nodes[s].force.sub(force);
				this.graph.nodes[t].force.add(force);
			}
		}

		// // apply other forces
		// for(let node of this.graph.nodes){
		// 	for(let force of node.forces){
		// 		node.force.add(force);
		// 	}
		// 	node.forces = [];
		// }


		/* Apply forces to velocity */
		for(let i=0; i<this.graph.nodes.length; i++){
			this.graph.nodes[i].velocity.add(this.graph.nodes[i].force);
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