import * as THREE from 'three'

class GraphControls extends THREE.Object3D{
	constructor(camera, domElement){
		super()
		this.domElement = domElement;
		this.camera = camera;
		this.raycaster = new THREE.Raycaster();


		// store current hovered node index
		let currentIdx;

		// track mouse fro node enter/leave events
		domElement.addEventListener('mousemove', event=>{
			let mouse = {
				x: ( event.clientX / window.innerWidth  ) * 2 - 1,
				y: -( event.clientY / window.innerHeight ) * 2 + 1
			};
			this.raycaster.setFromCamera(mouse, this.camera);

			// find intersection with points
			let points = this.graphmesh.getObjectByName('points');
			const intersects = this.raycaster.intersectObject(points);
			let closestIdx = intersects.map(i=>i.index)[0];
			
			if(closestIdx!=currentIdx){
				if(currentIdx)
					this.dispatchEvent( {
						type:'nodeleave',
						index: currentIdx
					} );

				if(closestIdx)
					this.dispatchEvent( {
						type:'nodeenter',
						index: closestIdx
					} );
				currentIdx = closestIdx;
			}
		});

		let onMouseClick = (event)=>{
			let points = this.graphmesh.getObjectByName('points');
			const intersects = this.raycaster.intersectObject(points);
			let closestIdx = intersects.map(i=>i.index)[0];
			this.dispatchEvent({
				type: 'click',
				index: closestIdx
			});
		}
		document.addEventListener('mousedown', event=>{
			document.addEventListener('click', onMouseClick);
		});
		document.addEventListener('mousemove', event=>{
			document.removeEventListener('click', onMouseClick);
		});
	}

	attach(graphmesh){
		this.graphmesh = graphmesh;
	}

	detach(graphmesh){
		this.graphmesh = undefined;
	}

	get graphmesh(){
		return this._graphmesh
	}

	set graphmesh(value){
		console.log('set graphmesh');
		this._graphmesh = value;
	}
}


export default GraphControls;