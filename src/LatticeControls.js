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
			const mouse = {x: ( event.clientX / this.domElement.clientWidth  ) * 2 - 1, y: -( event.clientY / this.domElement.clientHeight ) * 2 + 1};
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
			const mouse = {x: ( event.clientX / this.domElement.clientWidth  ) * 2 - 1, y: -( event.clientY / this.domElement.clientHeight ) * 2 + 1};
			this.raycaster.setFromCamera(mouse, this.camera);
			const intersects = this.raycaster.intersectObject(this.latticemesh, false);
			let closestIdx = intersects.sort(i=>i.distance).map(i=>i.index)[0];

			this.dispatchEvent({
				type: 'click',
				index: closestIdx
			});
		}

		this.domElement.addEventListener('mousemove', onMouseMove);

		this.domElement.addEventListener('mousedown', event=>{
			if(this.enabled===false) return;
			this.domElement.addEventListener('click', onMouseClick);
			this.domElement.removeEventListener('mousemove', onMouseMove);
			this.domElement.addEventListener('mousemove', onMouseDrag);
		});

		this.domElement.addEventListener('mouseup', event=>{
			this.domElement.removeEventListener('mousemove', onMouseDrag);
			setTimeout(()=>this.domElement.addEventListener('mousemove', onMouseMove), 10);
			
		});

		this.domElement.addEventListener('mousemove', event=>{
			if(this.enabled===false) return;
			this.domElement.removeEventListener('click', onMouseClick);
		});

		// handle touch as click of not moving
		let touchIsDragging = false

		let onTouchStart = e=>{
			this.domElement.removeEventListener('touchstart', onTouchStart);
			this.domElement.addEventListener('touchmove', onTouchMove);
			this.domElement.addEventListener('touchend', onTouchTap);
			const touch = {x: ( event.changedTouches[0].clientX / this.domElement.clientWidth  ) * 2 - 1, y: -( event.changedTouches[0].clientY / this.domElement.clientHeight ) * 2 + 1};
			// console.log('touchstart', touch);
		}
		let onTouchMove = e=>{
			this.domElement.removeEventListener('touchmove', onTouchMove);
			this.domElement.removeEventListener('touchend', onTouchTap);
			this.domElement.addEventListener('touchstart', onTouchStart);
			console.log('touchmove');
			touchIsDragging = true;
		}

		let onTouchTap = e=>{
			const touch = {
				x: ( e.changedTouches[0].clientX / this.domElement.clientWidth  ) * 2 - 1, 
				y: -( e.changedTouches[0].clientY / this.domElement.clientHeight ) * 2 + 1
			};
			this.raycaster.setFromCamera(touch, this.camera);
			const intersects = this.raycaster.intersectObject(this.latticemesh, false);
			let closestIdx = intersects.sort(i=>i.distance).map(i=>i.index)[0];


			this.dispatchEvent({
				type: 'click',
				index: closestIdx
			});
		}
		
		this.domElement.addEventListener("touchstart", onTouchStart, false);
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