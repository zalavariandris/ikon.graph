import * as THREE from 'three'

class LatticeControls extends THREE.Object3D{
	constructor(camera, domElement){
		super()
		this.domElement = domElement;
		this.camera = camera;
		this.raycaster = new THREE.Raycaster();
		this.enabled=true;

		// store current hovered node index
		let currentIdx;

		// track mouse for node enter/leave events
		let onMouseMove = event=>{
			// console.log('Controls=>mousemove');
			if(this.enabled===false) return;

			// find closest intersection with points
			const mouse = {x: ( event.clientX / window.innerWidth  ) * 2 - 1, y: -( event.clientY / window.innerHeight ) * 2 + 1};
			this.raycaster.setFromCamera(mouse, this.camera);
			const intersects = this.raycaster.intersectObject(this.latticemesh, false);
			let closestIdx = intersects.sort(i=>i.distance).map(i=>i.index)[0];


			//
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
		};

		let onMouseDrag = event=>{
			this.dispatchEvent({type: 'mousedrag'});
			// console.log('Controls=>mousedrag');
			if(currentIdx){
				this.dispatchEvent({type: 'nodedrag', index: currentIdx});
			}
		}
		
		let onMouseClick = (event)=>{
			const intersects = this.raycaster.intersectObject(this.latticemesh, false);
			let closestIdx = intersects.sort(i=>i.distance).map(i=>i.index)[0];

			this.dispatchEvent({
				type: 'click',
				index: closestIdx
			});
		}

		document.addEventListener('mousemove', onMouseMove);

		document.addEventListener('mousedown', event=>{
			if(this.enabled===false) return;
			document.addEventListener('click', onMouseClick);
			document.removeEventListener('mousemove', onMouseMove);
			document.addEventListener('mousemove', onMouseDrag);
		});

		document.addEventListener('mouseup', event=>{
			document.removeEventListener('mousemove', onMouseDrag);
			setTimeout(()=>document.addEventListener('mousemove', onMouseMove), 10);
			
		});

		document.addEventListener('mousemove', event=>{
			if(this.enabled===false) return;
			document.removeEventListener('click', onMouseClick);
		});
	}

	attach(latticemesh){
		this.latticemesh = latticemesh;
	}

	detach(latticemesh){
		this.latticemesh = undefined;
	}

	get latticemesh(){
		return this._latticemesh
	}

	set latticemesh(value){
		this._latticemesh = value;
	}
}


export default LatticeControls;