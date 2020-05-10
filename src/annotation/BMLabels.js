import * as THREE from 'three'

class RibbonGeometry extends THREE.BufferGeometry{
	constructor(){
		const padding = {x: 15.0, y:10.0};
		super()
		let vertices = [
			[1.0, 0.0],
			[1.0, 1.0],
			[0.0, 1.0],
			[0.0, 0.0],

			[1.0+Math.cos(-Math.PI*3/6)*padding.x, 0.0+Math.sin(-Math.PI*3/6)*padding.y], 
			[1.0+Math.cos(-Math.PI*2/6)*padding.x, 0.0+Math.sin(-Math.PI*2/6)*padding.y], 
			[1.0+Math.cos(-Math.PI*1/6)*padding.x, 0.0+Math.sin(-Math.PI*1/6)*padding.y], 
			[1.0+Math.cos(-Math.PI*0  )*padding.x, 0.0+Math.sin(-Math.PI*0  )*padding.y], 

			[1.0+Math.cos(Math.PI*0  )*padding.x, 1.0+Math.sin(Math.PI*0  )*padding.y], 
			[1.0+Math.cos(Math.PI*1/6)*padding.x, 1.0+Math.sin(Math.PI*1/6)*padding.y], 
			[1.0+Math.cos(Math.PI*2/6)*padding.x, 1.0+Math.sin(Math.PI*2/6)*padding.y], 
			[1.0+Math.cos(Math.PI*3/6)*padding.x, 1.0+Math.sin(Math.PI*3/6)*padding.y], 
			
			[0.0+Math.cos(Math.PI*3/6)*padding.x, 1.0+Math.sin(Math.PI*3/6)*padding.y], 
			[0.0+Math.cos(Math.PI*4/6)*padding.x, 1.0+Math.sin(Math.PI*4/6)*padding.y], 
			[0.0+Math.cos(Math.PI*5/6)*padding.x, 1.0+Math.sin(Math.PI*5/6)*padding.y], 
			[0.0+Math.cos(Math.PI*6/6)*padding.x, 1.0+Math.sin(Math.PI*6/6)*padding.y], 

			[0.0+Math.cos(Math.PI*6/6)*padding.x, 0.0+Math.sin(Math.PI*6/6)*padding.y], 
			[0.0+Math.cos(Math.PI*7/6)*padding.x, 0.0+Math.sin(Math.PI*7/6)*padding.y], 
			[0.0+Math.cos(Math.PI*8/6)*padding.x, 0.0+Math.sin(Math.PI*8/6)*padding.y], 
			[0.0+Math.cos(Math.PI*9/6)*padding.x, 0.0+Math.sin(Math.PI*9/6)*padding.y], 

			// [1.0+padding.x, 0.0-padding.y],
			// [1.0+padding.x, 1.0+padding.y],
			// [0.0-padding.x, 1.0+padding.y],
			// [0.0-padding.x, 0.0-padding.y]
		]

		this.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices
			.flatMap(pos=>[pos[0]-0.5, pos[1]-0.5, 0])),
			3, false));

		this.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vertices
			.flatMap(pos=>[pos[0], pos[1]]))
		, 2, false));

		this.index = new THREE.Uint16BufferAttribute([
			//inner corners
			0,1,3,
			1,2,3,
			// fillets
			0,4,5, 0,5,6, 0,6,7, 
			1,8,9, 1,9,10, 1,10, 11,
			2,12,13, 2,13,14, 2,14,15,
			3,16,17, 3,17,18, 3,18,19,
			//sides
			0,7,8, 0,8,1,
			1,11,2, 2,11,12,
			3,2,15, 3,15,16,
			3,19,0, 0,19,4
			// 0,4,5,
			// 0,5,1,
			// 1,5,2,
			// 2,5,6,
			// 2,6,3,
			// 3,6,7,
			// 3,7,0,
			// 0,7,4
			], 
		1, false);

		this.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI));
	}
}

class BMLabels extends THREE.Mesh{
	constructor({viewport, nodeIndices, labels, colors, fontSizes, nodePositionMap, nodeSizeMap, nodeColorMap, nodeFlagsMap}){
		var canvas = document.createElement("canvas");

		var ctx = canvas.getContext("2d");
		window.ctx = ctx;
		// document.body.appendChild(canvas);
		canvas.style.position = 'fixed';
		canvas.style.left = '0px';
		canvas.style.right = '0px';
		canvas.style.zIndex = 100;
		canvas.style.pointerEvents = 'none';
		canvas.style.transform = "scale(0.5) translate(-50%, -50%)"


		// let baseLine = 0;
		const uvOffsets = [];
		const uvSizes = [];


		canvas.width = 512;
		canvas.height = 1024;


		// ctx.fillStyle = 'blue';
		// ctx.fillRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

		let baseLines = [];
		let bboxes = [];
		let baseLine=0;
		const MARGIN = 10;
		for(let i=0; i<labels.length; i++){
			// set font style
			const fontSize = fontSizes[i]*devicePixelRatio;
			ctx.fillStyle = 'white';
			ctx.font = `${fontSize}px arial`;

			// calculate
			const metrics = ctx.measureText(labels[i]);
			// baseLine+=MARGIN;
			baseLine+=fontSize;
			// baseLine+=metrics.actualBoundingBoxAscent;
			
			// const bbox = new THREE.Box2(
			// 	new THREE.Vector2(metrics.actualBoundingBoxLeft, baseLine-metrics.actualBoundingBoxAscent-MARGIN), 
			// 	new THREE.Vector2(metrics.actualBoundingBoxRight, baseLine+metrics.actualBoundingBoxDescent+MARGIN)
			// );
			const bbox = new THREE.Box2(
				new THREE.Vector2(metrics.actualBoundingBoxLeft, baseLine-fontSize), 
				new THREE.Vector2(metrics.actualBoundingBoxRight, baseLine+MARGIN)
			);
			baseLines.push(baseLine);
			bboxes.push(bbox);
			// baseLine+=metrics.actualBoundingBoxDescent;
			baseLine+=MARGIN;

		}

		const boundingBox = bboxes.reduce( (a, b)=>a.clone().union(b) );
		canvas.width = Math.ceil(boundingBox.size().x);
		canvas.height = Math.ceil(boundingBox.size().y);



		for(let i=0; i<labels.length; i++){
			const bbox = bboxes[i];
			const baseLine = baseLines[i];
			// draw text
			const fontSize = fontSizes[i]*devicePixelRatio;
			ctx.fillStyle = 'white';
			ctx.font = `${fontSize}px arial`;
			ctx.fillText(labels[i], 0, baseLine);
			// // draw bbox
			// ctx.strokeStyle = 'lightgreen';
			// ctx.strokeRect(bbox.min.x, bbox.min.y, bbox.size().x, bbox.size().y);
			// // draw baseline
			// ctx.strokeStyle = 'cyan';
			// ctx.beginPath();
			// ctx.moveTo(0, baseLine);
			// ctx.lineTo(bbox.max.x, baseLine);
			// ctx.stroke();

			// push cursor
			// baseLine+=metrics.actualBoundingBoxDescent;
			// baseLine+=MARGIN;
		}

		const labelsTexture = new THREE.CanvasTexture(canvas);
		labelsTexture.minFilter=THREE.LinearFilter;
		labelsTexture.magFilter = THREE.LinearFilter;
		labelsTexture.generateMipmaps = false
		// // debugger
		
		labelsTexture.flipY = false;
		
		labelsTexture.needsUpdate = true;
		

		const baseGeo = new RibbonGeometry();

		// instance baseGeo
		const geo = new THREE.InstancedBufferGeometry();
		geo.attributes.position = baseGeo.attributes.position;
		geo.attributes.uv = baseGeo.attributes.uv;
		geo.index = baseGeo.index;

		geo.setAttribute('nodeIndex', new THREE.InstancedBufferAttribute(new Uint16Array(nodeIndices), 1, false));
		// geo.setAttribute('uvOffset', new THREE.InstancedBufferAttribute(new Float32Array(uvOffsets.flat()), 2, false));
		// geo.setAttribute('uvSize', new THREE.InstancedBufferAttribute(new Float32Array(uvSizes.flat()), 2, false));
		geo.setAttribute('baseline', new THREE.InstancedBufferAttribute(new Float32Array(baseLines)), 1, false);
		geo.setAttribute('bbox', new THREE.InstancedBufferAttribute(new Float32Array(bboxes.flatMap(bbox=>[bbox.min.x, bbox.min.y, bbox.max.x, bbox.max.y])), 4, false));
		const mat = new THREE.ShaderMaterial({
			side: THREE.DoubleSide,
			transparent: true,
			uniforms:{
				opacity: {value: 0.9},
				canvasBackgroundColor: {value: new THREE.Color(0.2, 0.2, 0.2)},
				devicePixelRatio: {value: window.devicePixelRatio},
				resolution: {value: [canvas.width, canvas.height]},
				labelsTexture: {value: labelsTexture},
				viewport: {value: viewport},
				constantScreenSize: {value: true},
				nodeSizeMap: {value: nodeSizeMap},
				nodeColorMap: {value: nodeColorMap},
				nodePositionMap:  {value: nodePositionMap},
				nodeFlagsMap: {value: nodeFlagsMap},
				nodeColumns: {value: nodePositionMap.image.width}
			},
			vertexShader: `
			uniform float devicePixelRatio;
			uniform vec2 resolution;
			varying vec2 vUv;
			uniform vec4 viewport;
			attribute float nodeIndex;
			uniform bool constantScreenSize;
			uniform sampler2D nodePositionMap;
			uniform sampler2D nodeSizeMap;
			uniform sampler2D nodeColorMap;
			uniform sampler2D nodeFlagsMap;
			uniform float nodeColumns;

			#include <pullvertex>
			#include <lookAt>
			#include <pixelSizeAt>
			#include <inverse> 

			varying float vNodeIndex;

			attribute float baseline;
			attribute vec4 bbox;
			varying vec3 vNodeColor;

			varying float fog;
			varying float vIsHovered;
			varying float vIsHighlighted;
			varying vec3 vPos;

			void main(){
				vec2 bboxMin  = vec2(bbox.x, bbox.y);
				vec2 bboxMax  = vec2(bbox.z, bbox.w);
				vec2 bboxSize = vec2(bbox.z-bbox.x, bbox.w-bbox.y);
				vUv = mix(bboxMin, bboxMax, vec2(1.0-uv.x, uv.y))/resolution;
				
				// pull node variables
				vec3 nodePos = pullVec3(nodePositionMap, int(nodeIndex), int(nodeColumns));
				float nodeSize = pullFloat(nodeSizeMap, int(nodeIndex), int(nodeColumns));
				float nodeFlags = pullFloat(nodeFlagsMap, int(nodeIndex), int(nodeColumns));
				
				// pass node variables to fragment shader
				vNodeIndex = nodeIndex;
				vNodeColor = pullVec3(nodeColorMap, int(nodeIndex), int(nodeColumns));
				bool isHovered = mod(nodeFlags, 2.0) > 0.0;
				bool isHighlighted = mod(floor(nodeFlags/2.0), 2.0)>0.0;
				vIsHovered = float(isHovered);
				vIsHighlighted = float(isHighlighted);


				// calc positions
				vPos = position;
				vec3 pos = clamp(position, vec3(-0.5,-0.5,-0.5), vec3(0.5,0.5,0.5));

				pos*=vec3(bboxSize, 1);

				if(uv.x<=0.0){
					pos.x+=position.x;
				}
				if(uv.x>=1.0){
					pos.x += position.x;
				}
				if(uv.y<=0.0){
					pos.y += position.y;
				}
				if(uv.y>=1.0){
					pos.y += position.y;
				}

				vec3 dir = nodePos-cameraPosition;
				fog = clamp(600.0*nodeSize/dot(dir,dir), 0.0, 1.0);

				// calc pixel radius
				vec3 forward = inverse(viewMatrix)[2].xyz;
				vec3 up = viewMatrix[1].xyz;
				mat4 lookAtMatrix = lookAt(nodePos, nodePos+forward, vec3(0,1,0));
				mat4 m = modelViewMatrix * lookAtMatrix;

				float pixelSize = 1.0/devicePixelRatio;
				if(constantScreenSize){
					pixelSize *= pixelSizeAt(nodePos).x;
				}

				vec4 vPosition = m * vec4((pos+vec3(0,bboxSize.y,0))*pixelSize+vec3(0, nodeSize*0.9*pixelSize, 0), 1.0);

				// vNormal = transpose(inverse(m))*vec4(normal, 1);

				vec4 projected = projectionMatrix * vPosition;
				projected.z-=1.0;
				gl_Position = projected; 
			}`,
			fragmentShader: `
			uniform float opacity;
			uniform vec3 canvasBackgroundColor;
			uniform sampler2D labelsTexture;
			varying vec2 vUv;
			varying float vNodeIndex;
			varying vec3 vNodeColor;
			varying float fog;
			varying float vIsHovered;
			varying float vIsHighlighted;
			varying vec3 vPos;
			void main(){
				vec4 texel = texture2D(labelsTexture, vUv);
				float alpha = texel.w*fog*opacity;

				vec4 foregroundColor = vec4(vNodeColor,1);
				foregroundColor = mix(foregroundColor, vec4(1.0-canvasBackgroundColor, 1), 0.8);
				// foregroundColor.w*=opacity*fog;
				// vec4 foregroundColor = vec4(mix(vNodeColor, vec3(1,1,1)-canvasBackgroundColor, 0.8), 1.0)*vec4(1,1,1, opacity*fog);
				vec4 backgroundColor = vec4(foregroundColor.rgb,0);

				if(vIsHovered>0.0 || vIsHighlighted>0.0){
					foregroundColor = vec4(0,0,0,0.8);
					backgroundColor = vec4(1,1,1,0.8);
				}else{
					foregroundColor *=opacity*fog;
					backgroundColor *=opacity*fog;
				}

				vec4 color = mix(backgroundColor, foregroundColor, texel.w);

				// draw over bezel
				bool isBezel = vPos.x<-0.5 || vPos.x>0.5 || vPos.y<-0.5 || vPos.y>0.5;
				if(isBezel){
					color = backgroundColor;
				}
				if(fog<0.03){
					discard;
				}
				gl_FragColor = color;				
			}`
		});

		super(geo, mat);
		this.frustumCulled = false;
	}
}

export default BMLabels;