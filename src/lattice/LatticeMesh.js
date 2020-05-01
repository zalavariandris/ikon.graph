import * as THREE from 'three'

import Points from './node/Points.js'
import Spheres from './node/Spheres.js'
import Lines from './edge/Lines.js'
import Rods from './edge/Rods.js'

const NodeFlags = {
	Hovered: 1,
	Highlighted: 2,
	Selected: 4
};

const includes = {
	lighting: `
		/* Lighting */
		struct PointLight {
		  vec3 color;
		  vec3 position;  // light position, in camera coordinates
		  float distance; // used for attenuation purposes. Since
		                  // we're writing our own shader, it can
		                  // really be anything we want (as long as
		                  // we assign it to our light in its
		                  // "distance" field
		};
		uniform vec3 ambientLightColor;
		uniform PointLight pointLights[NUM_POINT_LIGHTS];

		vec3 lighting(vec3 position, vec3 normal){
			vec3 lighting = vec3(0,0,0);
			for(int l = 0; l < NUM_POINT_LIGHTS; l++) {
				PointLight light = pointLights[l];
				vec3 L = normalize(light.position - position);
				vec3 N = normalize(normal);
				lighting += clamp(dot(L, N), 0.0, 1.0)*light.color;
			}
			lighting+=ambientLightColor;
			return lighting;
		}
	`,

	pixelSizeAt:`
	float pixelWidthRatio = 2. / (viewport.z * projectionMatrix[0][0]);
	float pixelHeightRatio = 2. / (viewport.w * projectionMatrix[1][1]);
	vec2 pixelSizeAt(vec3 worldPosition){
		vec4 projected = vec4(projectionMatrix * modelViewMatrix * vec4(worldPosition, 1));
		return vec2(projected.w * pixelWidthRatio, projected.w * pixelHeightRatio);
	}
	`,
	pullvertex: `
	float pullFloat(sampler2D map, int index, int mapWidth){
		int i = int(index);
		int y = i / mapWidth;
		int x = i-y*mapWidth;
		vec2 texCoord = vec2(float(x)/float(mapWidth),float(y)/float(mapWidth));
		return texture2D(map, texCoord).r;
	}

	vec3 pullVec3(sampler2D map, int index, int mapWidth){
		int i = int(index);
		int y = i / mapWidth;
		int x = i-y*mapWidth;
		vec2 texCoord = vec2(float(x)/float(mapWidth),float(y)/float(mapWidth));
		return texture2D(map, texCoord).xyz;
	}

	vec4 pullVec4(sampler2D map, int index, int mapWidth){
		int i = int(index);
		int y = i / mapWidth;
		int x = i-y*mapWidth;
		vec2 texCoord = vec2(float(x)/float(mapWidth),float(y)/float(mapWidth));
		return texture2D(map, texCoord);
	}`,

	lookAt: `
	mat4 lookAt(vec3 eye, vec3 target, vec3 up){

	  vec3 zaxis = normalize(eye - target);    
	  vec3 xaxis = normalize(cross(normalize(up), zaxis));
	  vec3 yaxis = cross(zaxis, xaxis);

	  mat4 viewMatrix = mat4(
	    xaxis.x, xaxis.y, xaxis.z, 0,
	    yaxis.x, yaxis.y, yaxis.z, 0,
	    zaxis.x, zaxis.y, zaxis.z, 0,
	    eye.x,eye.y,eye.z, 1
	  );

	  return viewMatrix;
	}`,

	inverse: `
	float inverse(float m) {
	  return 1.0 / m;
	}

	mat2 inverse(mat2 m) {
	  return mat2(m[1][1],-m[0][1],
	             -m[1][0], m[0][0]) / (m[0][0]*m[1][1] - m[0][1]*m[1][0]);
	}

	mat3 inverse(mat3 m) {
	  float a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];
	  float a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];
	  float a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];

	  float b01 = a22 * a11 - a12 * a21;
	  float b11 = -a22 * a10 + a12 * a20;
	  float b21 = a21 * a10 - a11 * a20;

	  float det = a00 * b01 + a01 * b11 + a02 * b21;

	  return mat3(b01, (-a22 * a01 + a02 * a21), (a12 * a01 - a02 * a11),
	              b11, (a22 * a00 - a02 * a20), (-a12 * a00 + a02 * a10),
	              b21, (-a21 * a00 + a01 * a20), (a11 * a00 - a01 * a10)) / det;
	}

	mat4 inverse(mat4 m) {
	  float
	      a00 = m[0][0], a01 = m[0][1], a02 = m[0][2], a03 = m[0][3],
	      a10 = m[1][0], a11 = m[1][1], a12 = m[1][2], a13 = m[1][3],
	      a20 = m[2][0], a21 = m[2][1], a22 = m[2][2], a23 = m[2][3],
	      a30 = m[3][0], a31 = m[3][1], a32 = m[3][2], a33 = m[3][3],

	      b00 = a00 * a11 - a01 * a10,
	      b01 = a00 * a12 - a02 * a10,
	      b02 = a00 * a13 - a03 * a10,
	      b03 = a01 * a12 - a02 * a11,
	      b04 = a01 * a13 - a03 * a11,
	      b05 = a02 * a13 - a03 * a12,
	      b06 = a20 * a31 - a21 * a30,
	      b07 = a20 * a32 - a22 * a30,
	      b08 = a20 * a33 - a23 * a30,
	      b09 = a21 * a32 - a22 * a31,
	      b10 = a21 * a33 - a23 * a31,
	      b11 = a22 * a33 - a23 * a32,

	      det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

	  return mat4(
	      a11 * b11 - a12 * b10 + a13 * b09,
	      a02 * b10 - a01 * b11 - a03 * b09,
	      a31 * b05 - a32 * b04 + a33 * b03,
	      a22 * b04 - a21 * b05 - a23 * b03,
	      a12 * b08 - a10 * b11 - a13 * b07,
	      a00 * b11 - a02 * b08 + a03 * b07,
	      a32 * b02 - a30 * b05 - a33 * b01,
	      a20 * b05 - a22 * b02 + a23 * b01,
	      a10 * b10 - a11 * b08 + a13 * b06,
	      a01 * b08 - a00 * b10 - a03 * b06,
	      a30 * b04 - a31 * b02 + a33 * b00,
	      a21 * b02 - a20 * b04 - a23 * b00,
	      a11 * b07 - a10 * b09 - a12 * b06,
	      a00 * b09 - a01 * b07 + a02 * b06,
	      a31 * b01 - a30 * b03 - a32 * b00,
	      a20 * b03 - a21 * b01 + a22 * b00) / det;
	}`,
	
	transpose: `
	float transpose(float m) {
	  return m;
	}

	mat2 transpose(mat2 m) {
	  return mat2(m[0][0], m[1][0],
	              m[0][1], m[1][1]);
	}

	mat3 transpose(mat3 m) {
	  return mat3(m[0][0], m[1][0], m[2][0],
	              m[0][1], m[1][1], m[2][1],
	              m[0][2], m[1][2], m[2][2]);
	}

	mat4 transpose(mat4 m) {
	  return mat4(m[0][0], m[1][0], m[2][0], m[3][0],
	              m[0][1], m[1][1], m[2][1], m[3][1],
	              m[0][2], m[1][2], m[2][2], m[3][2],
	              m[0][3], m[1][3], m[2][3], m[3][3]);
	}`
};

Object.assign(THREE.ShaderChunk, includes);

/***** points *****/
var _inverseMatrix = new THREE.Matrix4();
var _ray = new THREE.Ray();
var _sphere = new THREE.Sphere();
var _position = new THREE.Vector3();


function unflatten(array, N){
    return array.reduce((A, n, idx)=>{
      if(idx%N==0){
        A.push([n]);
      }else{
        A[A.length-1].push(n);
      }
      return A;
    }, []);
};

class LatticeMesh extends THREE.Group{
	constructor({graph,PROFILE=false})
	{
		super();
		// this.graph = graph;
		this.graph = graph;

		this._indexOfNodeCache = new Map(graph.nodes.map((n, i)=>[n.key, i]));
		this._indexOfEdgeCache = new Map(graph.edges.map((e, i)=>[e.key, i]));
		//
		this.PROFILE = PROFILE;

		// create data texture maps
		this.createSharedMaps()
		
		/* Nodes */
		// this.points = new Points({
		// 	nodes: Array.from({length: this.graph.nodes.length}).map((_, i)=>i),
		// 	nodePositionMap: this.nodePositionMap, 
		// 	nodeColorMap: this.nodeColorMap, 
		// 	nodeSizeMap: this.nodeSizeMap,
		// 	nodeFlagsMap: this.nodeFlagsMap
		// });
		// this.points.material.depthTest=true;
		// this.add(this.points)

		this.spheres = new Spheres({
			nodes: Array.from({length: this.graph.nodes.length}).map((_, i)=>i),
			nodePositionMap: this.nodePositionMap,
			nodeColorMap: this.nodeColorMap,
			nodeSizeMap: this.nodeSizeMap,
			nodeFlagsMap: this.nodeFlagsMap
		});
		
		this.spheres.material.transparent=true;
		// this.spheres.position.z=1;
		this.spheres.name = 'nodes';
		

		// this.createCircles();
		// this.add(this.circles);

		// this.createBillboard();
		// this.add(this.billboard);	
		// this.lines = new Lines({
		// 	links: this.graph.edges,
		// 	nodePositionMap: this.nodePositionMap,
		// 	nodeColorMap: this.nodeColorMap,
		// 	nodeSizeMap: this.nodeSizeMap,
		// 	nodeFlagsMap: this.nodeFlagsMap,
		// 	edgeWidthMap: this.edgeWidthMap,
		// 	edgeOpacityMap: this.edgeOpacityMap,
		// 	edgeColorMap: this.edgeColorMap,
		// 	edgeUseNodeColorMap: this.useNodeColorMap
		// });
		// this.lines.visible=true;
		// this.add(this.lines);

		// this.createStripes();
		// this.add(this.stripes);

		this.rods = new Rods({
			links: this.graph.edges,
			nodePositionMap: this.nodePositionMap,
			nodeColorMap: this.nodeColorMap,
			nodeSizeMap: this.nodeSizeMap,
			nodeFlagsMap: this.nodeFlagsMap,
			edgeWidthMap: this.edgeWidthMap,
			edgeOpacityMap: this.edgeOpacityMap,
			edgeColorMap: this.edgeColorMap,
			edgeUseNodeColorMap: this.useNodeColorMap
		});
		this.rods.material.depthTest = true;
		this.add(this.rods);
		this.rods.name = 'edges';
		this.add(this.spheres);

		/* animate positions */
		const anim = ()=>{
			for(let i=0; i<this.nodePositionMap.image.data.length; i++){
				this.nodePositionMap.image.data[i] += (Math.random()-0.5)*1;
			}
			this.nodePositionMap.needsUpdate = true;
			requestAnimationFrame(anim);
		}
		// anim();
	}

	indexOfNode(key){
		return this._indexOfNodeCache.has(key) ? this._indexOfNodeCache.get(key) : -1;;
	}

	indexOfEdge(key){
		return this._indexOfEdgeCache.has(key) ? this._indexOfEdgeCache.get(key) : -1;
	}

	setViewport(viewport){
		for(let child of this.children){
			if(child.material.uniforms.hasOwnProperty('viewport')){
				child.material.uniforms.viewport.value = viewport;
			}
		}
	}

	raycast(raycaster, intersects){
		const constantScreenSize = this.getObjectByName('nodes').material.uniforms.constantScreenSize.value;
		const nodes = this.graph.nodes;
		const data = this.nodePositionMap.image.data;
		for(let i=0; i<nodes.length; i++){
			let node = nodes[i];
			let center = new THREE.Vector3().fromArray( data, i * 3 );
			let size = node.size;

			var hit;
			if(constantScreenSize){
				/* ScreenSize hitTest */
				const A = center.clone().sub(raycaster.ray.origin).normalize();
				const B = raycaster.ray.direction.clone().normalize();
				const angle = A.dot(B);
				hit = angle>(1.0-size*0.00001)
			}else{
				// /* WorldsSize hitTest */
				const hit = raycaster.ray.intersectsSphere(new THREE.Sphere(center, size/2));
			}

			if(hit){
				var distanceSqr = center.distanceToSquared(raycaster.ray.origin);
				if ( distanceSqr < Math.pow(raycaster.near, 2) || distanceSqr > Math.pow(raycaster.far, 2) ) continue;
				intersects.push({
					index: i,
					distance: Math.sqrt(distanceSqr),//distance,
					point: null, //intersectionPoint,
					object: this
				});
			}
		}
	}

	createSharedMaps(){
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
			tex.needsUpdate = true;
			return tex;
		}

		this.nodePositionMap = createMap({
			values: this.graph.nodes.flatMap(node=>[node.x, node.y, node.z]), 
			DataType: Float32Array, 
			itemSize: 3, 
			TextureFormat: THREE.RGBFormat, 
			TextureType: THREE.FloatType
		});

		this.nodeColorMap = createMap({
			values: this.graph.nodes.flatMap(node=>[node.r,node.g,node.b]), 
			DataType: Float32Array, 
			itemSize: 3, 
			TextureFormat: THREE.RGBFormat, 
			TextureType: THREE.FloatType
		});

		this.nodeSizeMap = createMap({
			values: this.graph.nodes.map(node=>node.size), 
			DataType: Float32Array, 
			itemSize: 1, 
			TextureFormat: THREE.LuminanceFormat, 
			TextureType:THREE.FloatType
		});

		this.nodeFlagsMap = createMap({
			values: this.graph.nodes.map(node=>{
				let mask = 0;
				if(node.hovered)		mask = mask | NodeFlags.Hovered;
				if(node.highlighted)	mask = mask | NodeFlags.Highlighted;
				if(node.selected)		mask = mask | NodeFlags.Selected;
				return mask;
			}), 
			DataType: Float32Array, 
			itemSize: 1, 
			TextureFormat: THREE.LuminanceFormat, 
			TextureType:THREE.FloatType
		});


		/* EDGE*/
		this.edgeWidthMap = createMap({
			values: this.graph.edges.flatMap(edge=>edge.width),
			DataType: Float32Array,
			itemSize: 1,
			TextureFormat: THREE.LuminanceFormat,
			TextureType: THREE.FloatType
		});

		this.edgeColorMap = createMap({
			values: this.graph.edges.flatMap(edge=>[edge.r, edge.g, edge.b]),
			DataType: Float32Array,
			itemSize: 3,
			TextureFormat: THREE.RGBFormat,
			TextureType: THREE.FloatType
		});

		this.useNodeColorMap = createMap({
			values: this.graph.edges.map(edge=>edge.useNodeColor),
			DataType: Uint8ClampedArray,
			itemSize: 1,
			TextureFormat: THREE.LuminanceFormat,
			TextureType: THREE.UnsignedByteType
		});

		this.edgeOpacityMap = createMap({
			values: this.graph.edges.map(edge=>edge.opacity),
			DataType: Float32Array,
			itemSize: 1,
			TextureFormat: THREE.LuminanceFormat,
			TextureType: THREE.FloatType
		});
	}

	diff(){
		const diff = {
			nodes: new Map(),
			edges: new Map()
		};

		for(let i=0; i<this.graph.nodes.length; i++){
			const node = this.graph.nodes[i];
			// position
			if( Math.fround(node.x) != this.nodePositionMap.image.data[i*3+0] ||
				Math.fround(node.y) != this.nodePositionMap.image.data[i*3+1] ||
				Math.fround(node.z) != this.nodePositionMap.image.data[i*3+2]){
				if(!diff.nodes.has(i)){diff.nodes.set(i, {});}
				diff.nodes.get(i).x = node.x;
				diff.nodes.get(i).y = node.y;
				diff.nodes.get(i).z = node.z;
			}

			// color
			if( Math.fround(node.r) != this.nodePositionMap.image.data[i*3+0] ||
				Math.fround(node.g) != this.nodePositionMap.image.data[i*3+1] ||
				Math.fround(node.b) != this.nodePositionMap.image.data[i*3+2]){
				if(!diff.nodes.has(i)){diff.nodes.set(i, {});}
				diff.nodes.get(i).r = node.r;
				diff.nodes.get(i).g = node.g;
				diff.nodes.get(i).b = node.b;
			}

			// size
			if( Math.fround(node.size) != this.nodePositionMap.image.data[i]){
				if(!diff.nodes.has(i)){diff.nodes.set(i, {});}
				diff.nodes.get(i).size = node.size;
			}

			// hovered
			if(node.hovered!=(NodeFlags.Hovered & this.nodeFlagsMap.image.data[i]))
			{
				if(!diff.nodes.has(i)){diff.nodes.set(i, {});}
				diff.nodes.get(i).hovered = node.hovered;
			}

			// highlighted
			if(node.highlighted!=(NodeFlags.Highlighted & this.nodeFlagsMap.image.data[i]))
			{
				if(!diff.nodes.has(i)){diff.nodes.set(i, {});}
				diff.nodes.get(i).highlighted = node.highlighted;
			}
		}

		for(let i=0; i<this.graph.edges.length; i++){
			const edge = this.graph.edges[i];
			// width
			if(Math.fround(edge.width)!=this.edgeWidthMap.image.data[i]){
				if(!diff.edges.has(i)){diff.edges.set(i, {});}
				diff.edges.get(i).width = edge.width;
			}
		}

		return diff;
	}

	setAnyHighlighted(value){
		this.getObjectByName('nodes').material.uniforms.anyHighlighted.value = value;
		this.getObjectByName('edges').material.uniforms.anyNodeHighlighted.value = value;
	}

	patch(diff){
		/* determine if any nodes highlight has changed */
		const currentValue = this.getObjectByName('nodes').material.uniforms.anyHighlighted.value;

		/* NODES */
		for(let [i, changes] of diff.nodes){
			if(changes.hasOwnProperty('hovered')){
				let flags = this.nodeFlagsMap.image.data[i];
				if(changes.hovered){
					flags|= NodeFlags.Hovered;
				}else{
					flags&=~NodeFlags.Hovered;
				}
				this.nodeFlagsMap.image.data[i] = flags;
				this.nodeFlagsMap.needsUpdate = true;
			}

			if(changes.hasOwnProperty('highlighted')){
				let flags = this.nodeFlagsMap.image.data[i];
				if(changes.highlighted){
					flags|= NodeFlags.Highlighted;
				}else{
					flags&=~NodeFlags.Highlighted;
				}
				this.nodeFlagsMap.image.data[i] = flags;
				this.nodeFlagsMap.needsUpdate = true;
			}

			// position
			if( changes.hasOwnProperty('x') ||
				changes.hasOwnProperty('y') ||
				changes.hasOwnProperty('z')){
				this.nodePositionMap.image.data[i*3+0] = changes.x;
				this.nodePositionMap.image.data[i*3+1] = changes.y;
				this.nodePositionMap.image.data[i*3+2] = changes.z;
				this.nodePositionMap.needsUpdate = true;
			}

			// color
			if( changes.hasOwnProperty('r') ||
				changes.hasOwnProperty('g') ||
				changes.hasOwnProperty('b')){
				this.nodeColorMap.image.data[i*3+0] = changes.r;
				this.nodeColorMap.image.data[i*3+1] = changes.g;
				this.nodeColorMap.image.data[i*3+2] = changes.b;
				this.nodeColorMap.needsUpdate = true;
			}

			// size
			if(changes.hasOwnProperty('size')){
				this.nodeSizeMap.image.data[i] = changes.size;
				this.nodeSizeMap.needsUpdate = true;
			}
		}

		/* NODES */
		for(let [i, changes] of diff.edges){
			if(changes.hasOwnProperty('width')){
				this.edgeWidthMap.image.data[i] = changes.width;
				this.edgeWidthMap.needsUpdate = true;
			}
		}
	}
}

export {LatticeMesh, NodeFlags}