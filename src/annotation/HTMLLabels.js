class HTMLLabels{
	constructor({keys, text, position, color, visible}){
		this.keys = keys;
		this.text = text;
		this.position = position;
		this.color = color;
		this.visible = visible;

		// root element
		this.domElement = document.createElement('div');
		this.domElement.style.position = 'fixed';
		this.domElement.style.left = "0px";
		this.domElement.style.top = "0px";
		this.domElement.style.width = "100vw";
		this.domElement.style.height = "100vh";
		this.domElement.style.zIndex = 1;
		this.domElement.style.pointerEvents = 'none';

		this.elements = new Map(this.keys.map(key=>[key, this.renderItem(key)]))
	}

	renderItem(key){
		// create position node
		let elem = document.createElement('div');
		elem.classList.add('label');
		elem.style.position = "absolute";
		elem.style.pointerEvents = 'none';
		elem.style.visibility = 'hidden';

		// create label box
		// elem.style.color = this.color(key).getStyle();
		const span = document.createElement('span');
		span.innerText = this.text(key);
		elem.appendChild(span);

		// pointer triangle
		const triangle = document.createElement('div');
		triangle.classList.add('triangle-down');
		elem.appendChild(triangle);

		if(this.visible(key)){
			this.domElement.appendChild(elem);
		}

		return elem;
	}

	diff(){
		let text = new Map();
		let position = new Map();
		let color = new Map();
		let visible = new Map();
		for(let key of this.keys){
			const elem = this.elements.get(key);
			const newValue = this.visible(key);
			if(newValue!=(elem.parentElement ? true : false)){
				visible.set(key, newValue);
			}
		}

		return {visible};
	}

	patch(change){
		for(let [key, value] of change.visible){
			const elem = this.elements.get(key);
			if(value){
				this.domElement.appendChild(elem)
			}else{
				this.domElement.removeChild(elem);
			}
		}
	}

	update(camera){
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld();
		camera.updateWorldMatrix();
		camera.updateMatrix();
		let projection = camera.projectionMatrix.clone();
		let view = camera.matrixWorldInverse.clone();
		let m = projection.multiply(view);

		let arr = Array.from(this.elements.entries())
		.filter( ([key, elem])=>elem.parentElement)
		.map( ([key, elem])=>{
			const pos = this.position(key);
			const screenPos = pos.clone().project(camera);
			return [key, elem, screenPos];
		})


		arr.forEach( ([key, elem, screenPos])=>{
			elem.style.visibility = screenPos.z<1 ? 'visible': 'hidden';
		})

		arr.filter( ([key, elem, screenPos])=>elem.style.visibility == 'visible' )
		arr = arr.sort( (a, b)=>(b[2].z-a[2].z))
		arr.forEach( ([key, elem, screenPos], i )=>{
			elem.style.left = (+screenPos.x+1)/2*this.domElement.clientWidth  + 'px';
			elem.style.top  = (-screenPos.y+1)/2*this.domElement.clientHeight + 'px';
			elem.style.zIndex = i;
			// elem.children[0].innerText = key+'\n'+elem.style.left+'\n#'+i;
		});
		
		// for(let [key, elem] of this.elements){
		// 	if(!elem.parentElement) continue

		// 	// find screen position
		// 	const pos = this.position(key);
		// 	const screenPos = pos.clone().applyMatrix4(m);

		// 	// hide labels behind the camera
		// 	elem.style.visibility = screenPos.z<1 ? 'visible' : 'hidden';

		// 	if(screenPos.z>=1) continue;
		// 	elem.style.left = (+screenPos.x+1)/2*window.innerWidth  + 'px';
		// 	elem.style.top  = (-screenPos.y+1)/2*window.innerHeight + 'px';
		// }
	}
};

export default HTMLLabels