
class CanvasLabels{
	constructor({labels, position, fontSize, visible}){
		this.labels = labels;
		this.position = position;
		this.fontSize = fontSize;
		this.visible;

		this.domElement = document.createElement('canvas');
		this.domElement.classList.add('CanvasLabels-component');
		this.domElement.style.pointerEvents = 'none';
		this.ctx = this.domElement.getContext('2d');
	}

	update(camera){
		const ctx = this.ctx;
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

		
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld();
		camera.updateWorldMatrix();
		camera.updateMatrix();
		let projection = camera.projectionMatrix.clone();
		let view = camera.matrixWorldInverse.clone();
		let m = projection.multiply(view);

		for(let n of this.labels){
			if(this.visible(n)){
				let pos = this.position(n);
				const screenPos = pos.clone().project(camera);
				if(screenPos.z<1){
					const x = (+screenPos.x+1)/2*this.domElement.clientWidth;
					const y = (-screenPos.y+1)/2*this.domElement.clientHeight;
					ctx.font = this.fontSize(n)+" Helvetica";
					console.log(ctx.font);
					ctx.fillText(n, x, y);
				}
			}
		}

		// let arr = Array.from(this.elements.entries())
		// .filter( ([key, elem])=>elem.parentElement)
		// .map( ([key, elem])=>{
		// 	const pos = this.position(key);
		// 	const screenPos = pos.clone().project(camera);
		// 	return [key, elem, screenPos];
		// })


		// arr.forEach( ([key, elem, screenPos])=>{
		// 	elem.style.visibility = screenPos.z<1 ? 'visible': 'hidden';
		// })

		// arr.filter( ([key, elem, screenPos])=>elem.style.visibility == 'visible' )
		// arr = arr.sort( (a, b)=>(b[2].z-a[2].z))
		// arr.forEach( ([key, elem, screenPos], i )=>{
		// 	elem.style.left = (+screenPos.x+1)/2*this.domElement.clientWidth  + 'px';
		// 	elem.style.top  = (-screenPos.y+1)/2*this.domElement.clientHeight + 'px';
		// 	elem.style.zIndex = i;
		// 	// elem.children[0].innerText = key+'\n'+elem.style.left+'\n#'+i;
		// });
	}
}


export default CanvasLabels