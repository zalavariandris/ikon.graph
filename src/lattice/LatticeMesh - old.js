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
	float pixelHeightRatio = 2. / (viewport.z * projectionMatrix[1][1]);
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
	constructor(graph, {
			nodePosition, nodeColor, nodeSize, nodeFlags,
			edgeWidth, useNodeColor, edgeColor, edgeOpacity, 
			PROFILE=false})
	{
		super();
		this.graph = graph;

		this.nodes = this.graph.nodes().map(n=>new Object({
			key: n,
			x: this.graph.getNodeAttribute(n, 'x'),
			y: this.graph.getNodeAttribute(n, 'y'),
			z: this.graph.getNodeAttribute(n, 'z'),
			r: this.graph.getNodeAttribute(n, 'r')/255,
			g: this.graph.getNodeAttribute(n, 'g')/255,
			b: this.graph.getNodeAttribute(n, 'b')/255,
			size: this.graph.getNodeAttribute(n, 'eigencentrality')*75,
			hovered: false,
			highlighted: false,
			selected: false
		}));
		
		/* links */
		this.links = this.graph.edges().map(e=>{
			const source = this.graph.source(e);
			const sourceIdx = this.graph.nodes().indexOf(source);
			const target = this.graph.target(e);
			const targetIdx = this.graph.nodes().indexOf(target);
			return {
				source: sourceIdx, 
				target: targetIdx
			};
		});

		this.PROFILE = PROFILE;

		// mapping functions
		this.nodePosition = nodePosition;
		this.nodeColor = nodeColor;
		this.nodeSize = nodeSize;
		this.nodeFlags = nodeFlags;
		this.edgeWidth = edgeWidth;
		this.useNodeColor = useNodeColor;
		this.edgeColor = edgeColor;
		this.edgeOpacity = edgeOpacity;

		// create data texture maps
		this.createSharedMaps()
		
		/* Nodes */
		this.points = new Points({
			nodes: Array.from({length: this.nodes.length}).map((_, i)=>i),
			nodePositionMap: this.nodePositionMap, 
			nodeColorMap: this.nodeColorMap, 
			nodeSizeMap: this.nodeSizeMap,
			nodeFlagsMap: this.nodeFlagsMap
			// sizes: this.graph.nodes().map(n=>this.nodeSize(n)), 
			// indices: Array.from({length: this.graph.nodes().length}, (_, i)=>i)
		});
		// this.add(this.points)

		this.spheres = new Spheres({
			nodes: Array.from({length: this.nodes.length}).map((_, i)=>i),
			nodePositionMap: this.nodePositionMap,
			nodeColorMap: this.nodeColorMap,
			nodeSizeMap: this.nodeSizeMap,
			nodeFlagsMap: this.nodeFlagsMap
		});
		this.add(this.spheres);

		// this.createCircles();
		// this.add(this.circles);

		// this.createBillboard();
		// this.add(this.billboard);	
		this.lines = new Lines({
			links: this.links,
			nodePositionMap: this.nodePositionMap,
			nodeColorMap: this.nodeColorMap,
			nodeSizeMap: this.nodeSizeMap,
			nodeFlagsMap: this.nodeFlagsMap,
			edgeWidthMap: this.edgeWidthMap,
			edgeOpacityMap: this.edgeOpacityMap,
			edgeColorMap: this.edgeColorMap,
			edgeUseNodeColorMap: this.useNodeColorMap
		});
		this.lines.visible=true;
		// this.add(this.lines);

		// this.createStripes();
		// this.add(this.stripes);

		this.rods = new Rods({
			links: this.links,
			nodePositionMap: this.nodePositionMap,
			nodeColorMap: this.nodeColorMap,
			nodeSizeMap: this.nodeSizeMap,
			nodeFlagsMap: this.nodeFlagsMap,
			edgeWidthMap: this.edgeWidthMap,
			edgeOpacityMap: this.edgeOpacityMap,
			edgeColorMap: this.edgeColorMap,
			edgeUseNodeColorMap: this.useNodeColorMap
		});
		this.add(this.rods);

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

	setViewport(viewport){
		for(let child of this.children){
			if(child.material.uniforms.hasOwnProperty('viewport')){
				child.material.uniforms.viewport.value = viewport;
			}
		}
	}

	// createCircles(){
	// 	/* base geo */
	// 	const baseGeo = new THREE.BufferGeometry();
	// 	baseGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0]), 3));

	// 	/* Instance baseGeo */
	// 	const geo = new THREE.InstancedBufferGeometry();
	// 	// copy base geo attributes
	// 	geo.attributes.position = baseGeo.attributes.position;

	// 	// instance atributes
	// 	const nodeIndices = Array.from({length: this.graph.nodes().length}, (_, i)=>i)
	// 	geo.setAttribute('nodeIndex', new THREE.InstancedBufferAttribute(new Float32Array(nodeIndices), 1));
	// 	geo.setAttribute('nodeSize', new THREE.InstancedBufferAttribute(new Float32Array(this.graph.nodes().map(n=>this.nodeSize(n))), 1));

	// 	// create material
	// 	const mat = new THREE.ShaderMaterial({
	// 		uniforms:{
	// 			nodePositionMap:  {value: this.nodePositionMap},
	// 			nodeColorMap: {value: this.nodeColorMap},
	// 			columns: {value: this.nodePositionMap.image.width},
	// 			strokeWidth: {value: 0.1},
	// 			stroke: {value: new THREE.Color('white')}
	// 		},
	// 		vertexShader: `
	// 		uniform sampler2D nodePositionMap;
	// 		uniform sampler2D nodeColorMap;
	// 		uniform float columns;
	// 		attribute float nodeIndex;
	// 		attribute float nodeSize;
	// 		varying vec3 vColor;
	// 		#include <pullvertex> 

	// 		void main(){
	// 			vec3 nodePos = pullVec3(nodePositionMap, int(nodeIndex), int(columns));
	// 			vec3 nodeColor = pullVec3(nodeColorMap, int(nodeIndex), int(columns));
	// 			vColor = nodeColor;
	// 			vec4 mvPosition = modelViewMatrix * vec4( position+nodePos, 1.0 );
	// 			gl_PointSize = nodeSize * ( 335.0 / -mvPosition.z );
	// 			gl_Position = projectionMatrix * mvPosition;
	// 		}`,
	// 		fragmentShader: `
	// 		varying vec3 vColor;
	// 		uniform vec3 stroke;
	// 		uniform float strokeWidth;

	// 		void main() {
	// 			vec2 pos = gl_PointCoord-vec2(0.5);
	// 			float dist = sqrt(dot(pos, pos));

	// 			if(dist>0.5){
	// 			 discard;
	// 			} else {
	// 			  if (dist>0.5-strokeWidth){
	// 			  	gl_FragColor = vec4(stroke,1);
	// 				}else{
	// 				  gl_FragColor = vec4(vColor, 1);
	// 			  }
	// 			}
	// 		}`
	// 	});

	// 	// create mesh
	// 	this.circles = new THREE.Points(geo, mat);
	// 	this.circles.frustumCulled = false;
	// }

	// createBillboard(){
	// 	// baseGeo
	// 	const baseGeo = new THREE.PlaneBufferGeometry(1, 1);

	// 	// instance baseGeo
	// 	const geo = new THREE.InstancedBufferGeometry();
	// 	geo.attributes.position = baseGeo.attributes.position;
	// 	geo.attributes.normal = baseGeo.attributes.normal;
	// 	geo.index = baseGeo.index;

	// 	const nodeIndices = Array.from({length: this.graph.nodes().length}, (_, i)=>i)
	// 	geo.setAttribute('nodeIndex', new THREE.InstancedBufferAttribute(new Float32Array(nodeIndices), 1));
	// 	geo.setAttribute('nodeSize', new THREE.InstancedBufferAttribute(new Float32Array(this.graph.nodes().map(n=>this.nodeSize(n))), 1));

	// 	// create material
	// 	const mat = new THREE.ShaderMaterial({
	// 		uniforms: {
	// 			nodePositionMap:  {value: this.nodePositionMap},
	// 			nodeColorMap: {value: this.nodeColorMap},
	// 			columns: {value: this.nodePositionMap.image.width}
	// 		},
	// 		vertexShader: `
	// 		uniform sampler2D nodePositionMap;
	// 		uniform sampler2D nodeColorMap;
	// 		uniform float columns;
	// 		attribute float nodeIndex;
	// 		attribute float nodeSize;
	// 		#include <pullvertex> 
	// 		#include <lookAt>
	// 		#include <inverse>
	// 		varying vec3 vPosition;
	// 		varying vec3 vNormal;
	// 		varying vec3 vColor;
			

	// 		void main(){
	// 			vec3 nodePos = pullVec3(nodePositionMap, int(nodeIndex), int(columns));
	// 			vec3 nodeColor = pullVec3(nodeColorMap, int(nodeIndex), int(columns));
	// 			vColor = nodeColor;

	// 			// billboard
	// 			mat4 inverseViewMatrix = inverse(viewMatrix);
	// 			vec3 right = inverseViewMatrix[0].xyz;
	// 			vec3 forward = inverseViewMatrix[2].xyz;
	// 			mat4 lookAtMatrix = lookAt(nodePos, nodePos-forward, right);

	// 			// transform position
	// 			vec3 transformed = (lookAtMatrix*vec4(position*nodeSize, 1)).xyz;
	// 			// vec3 transformed = position*nodeSize+nodePos;
	// 			vPosition = transformed;
	// 			vNormal = normal;
	// 			gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1);
	// 			gl_PointSize = 1.0;
	// 		}`,

	// 		fragmentShader: `
	// 		uniform float opacity;
	// 		varying vec3 vPosition;
	// 		varying vec3 vColor;
	// 		void main(){
	// 			gl_FragColor = vec4(vColor, opacity);
	// 		}`
	// 	});

	// 	// create mesh
	// 	this.billboard = new THREE.Mesh(geo, mat);
	// 	this.billboard.frustumCulled = false;
	// }

	// createStripes(){
	// 	// baseGeo
	// 	const baseGeo = new THREE.PlaneBufferGeometry(1,1);
	// 	baseGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI/2));
	// 	baseGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 0.5));

	// 	// instance baseGeo
	// 	const geo = new THREE.InstancedBufferGeometry();
	// 	geo.attributes.position = baseGeo.attributes.position;
	// 	geo.attributes.normal = baseGeo.attributes.normal;
	// 	geo.index = baseGeo.index;

	// 	const sourceNodeIndices = this.graph.edges().map(e=>{
	// 		let s = this.graph.source(e);
	// 		return this.graph.nodes().indexOf(s);
	// 	});

	// 	geo.setAttribute('sourceNodeIndex', new THREE.InstancedBufferAttribute(new Float32Array(sourceNodeIndices), 1));
	// 	const targetNodeIndices = this.graph.edges().map(e=>{
	// 		let s = this.graph.target(e);
	// 		return this.graph.nodes().indexOf(s);
	// 	});
	// 	geo.setAttribute('targetNodeIndex', new THREE.InstancedBufferAttribute(new Float32Array(targetNodeIndices), 1));
				
	// 	geo.setAttribute('nodeSize', new THREE.InstancedBufferAttribute(new Float32Array(this.graph.nodes().map(n=>{
	// 		return this.graph.getNodeAttribute(n, 'eigencentrality')*50;
	// 	})), 1));

	// 	let widths = this.graph.edges().map(e=>{
	// 		return this.graph.getEdgeAttribute(e, 'weight');
	// 	});

	// 	geo.setAttribute('width', new THREE.InstancedBufferAttribute(new Float32Array(widths), 1));
		

	// 	// create material
	// 	const mat = new THREE.ShaderMaterial({
	// 		transparent: true,
	// 		extensions: {fragDepth: true},
	// 		uniforms: {
	// 			opacity: {value: 0.5},
	// 			nodePositionMap:  {value: this.nodePositionMap},
	// 			nodeColorMap: {value: this.nodeColorMap},
	// 			columns: {value: this.nodePositionMap.image.width}
	// 		},
	// 		vertexShader: `
	// 		#include <pullvertex> 
	// 		#include <lookAt>
	// 		#include <inverse>
	// 		#include <transpose>

	// 		uniform sampler2D nodePositionMap;
	// 		uniform sampler2D nodeColorMap;
	// 		uniform float columns;
	// 		attribute float sourceNodeIndex;
	// 		attribute float targetNodeIndex;
	// 		attribute float nodeSize;
	// 		attribute float width;
	// 		varying vec3 vPosition;
	// 		varying vec3 vNormal;
	// 		varying vec3 vColor;
			
	// 		void main(){
	// 			vec3 sourceNodePos = pullVec3(nodePositionMap, int(sourceNodeIndex), int(columns));
	// 			vec3 targetNodePos = pullVec3(nodePositionMap, int(targetNodeIndex), int(columns));
	// 			vec3 sourceNodeColor = pullVec3(nodeColorMap, int(sourceNodeIndex), int(columns));
	// 			vec3 targetNodeColor = pullVec3(nodeColorMap, int(targetNodeIndex), int(columns));
	// 			vColor = mix(sourceNodeColor, targetNodeColor, position.z);


	// 			// scale
	// 			mat4 scaleMatrix = mat4(
	// 				1,0,0,0,
	// 				0,1,0,0,
	// 				0,0,distance(sourceNodePos, targetNodePos),0,
	// 				0,0,0,1
	// 			);
	// 			// lookat
	// 			vec3 P = mix(sourceNodePos, targetNodePos, position.z);

	// 			// vec3 right = viewMatrix[0].xyz;
	// 			// vec3 forward = viewMatrix[2].xyz;
	// 			mat4 lookAtMatrix = lookAt(P, cameraPosition, sourceNodePos-targetNodePos);
	// 			vec4 transformed = lookAtMatrix * vec4(position.xy*width, 0, 1);
	// 			// project world position to screen
	// 			gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed.xyz, 1);
	// 		}`,

	// 		fragmentShader: `
	// 		uniform float opacity;
	// 		varying vec3 vColor;
	// 		void main(){
	// 			gl_FragColor = vec4(vColor, opacity);
	// 			gl_FragDepthEXT = gl_FragCoord.z;
	// 		}`,
	// 		// wireframe: true
	// 	});

	// 	// create mesh
	// 	this.stripes = new THREE.Mesh(geo, mat);
	// 	this.stripes.frustumCulled = false;
	// }

	raycast(raycaster, intersects){
		const nodes = this.graph.nodes();
		const data = this.nodePositionMap.image.data;
		for(let i=0; i<nodes.length; i++){
			let n = nodes[i];
			let center = new THREE.Vector3().fromArray( data, i * 3 );
			let size = this.nodeSize(n);

			const hasIntersection = raycaster.ray.intersectsSphere(new THREE.Sphere(center, size/2));
			if ( !hasIntersection ) continue;
			let intersectionPoint = new THREE.Vector3()
			raycaster.ray.intersectSphere(new THREE.Sphere(center, size/2), intersectionPoint);
			
			var distance = raycaster.ray.origin.distanceTo( intersectionPoint );

			if ( distance < raycaster.near || distance > raycaster.far ) continue;

			intersects.push({
				index: n,
				distance: distance,
				point: intersectionPoint,
				object: this
			});
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

		const nodes = this.graph.nodes();
		this.nodePositionMap = createMap({
			values: this.nodes.flatMap(node=>[node.x, node.y, node.z]), 
			DataType: Float32Array, 
			itemSize: 3, 
			TextureFormat: THREE.RGBFormat, 
			TextureType: THREE.FloatType
		});

		this.nodeColorMap = createMap({
			values: this.nodes.flatMap(node=>[node.r,node.g,node.b]), 
			DataType: Float32Array, 
			itemSize: 3, 
			TextureFormat: THREE.RGBFormat, 
			TextureType: THREE.FloatType
		});

		this.nodeSizeMap = createMap({
			values: this.nodes.map(node=>node.size), 
			DataType: Float32Array, 
			itemSize: 1, 
			TextureFormat: THREE.LuminanceFormat, 
			TextureType:THREE.FloatType
		});

		this.nodeFlagsMap = createMap({
			values: this.nodes.map(node=>{
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
		const edges = this.graph.edges();
		this.edgeWidthMap = createMap({
			values: edges.flatMap(e=>new THREE.Vector3(this.edgeWidth(e), this.edgeWidth(e), this.edgeWidth(e)).toArray()),
			DataType: Float32Array,
			itemSize: 3,
			TextureFormat: THREE.RGBFormat,
			TextureType: THREE.FloatType
		});

		this.edgeColorMap = createMap({
			values: edges.flatMap(e=>this.edgeColor(e).toArray()),
			DataType: Float32Array,
			itemSize: 3,
			TextureFormat: THREE.RGBFormat,
			TextureType: THREE.FloatType
		});

		this.useNodeColorMap = createMap({
			values: edges.map(e=>this.useNodeColor(e)),
			DataType: Uint8ClampedArray,
			itemSize: 1,
			TextureFormat: THREE.LuminanceFormat,
			TextureType: THREE.UnsignedByteType
		});

		this.edgeOpacityMap = createMap({
			values: edges.map(e=>this.edgeOpacity(e)),
			DataType: Float32Array,
			itemSize: 1,
			TextureFormat: THREE.LuminanceFormat,
			TextureType: THREE.FloatType
		});
	}

	diff(){
		if(this.PROFILE) console.time('diff')

		/* Nodes */
		const nodes = this.graph.nodes();
		const count = nodes.length;
		
		const positions = new Map();
		const colors = new Map();
		const sizes = new Map();
		const nodeFlags = new Map();
		for(let i=0; i<count; i++){
			const n = nodes[i];
			/*position*/
			const positionValue = this.nodePosition(n);
			const x = Math.fround(positionValue.x); 
			const y = Math.fround(positionValue.y); 
			const z = Math.fround(positionValue.z); 
			if( x!=this.nodePositionMap.image.data[i*3+0] ||
				y!=this.nodePositionMap.image.data[i*3+1] ||
				z!=this.nodePositionMap.image.data[i*3+2])
			{
				positions.set(i*3+0, x);
				positions.set(i*3+1, y);
				positions.set(i*3+2, z);
			}

			/*color*/
			const colorValue = this.nodeColor(n);
			const r = Math.fround(colorValue.r*1);
			const g = Math.fround(colorValue.g*1);
			const b = Math.fround(colorValue.b*1);
			if( r!=this.nodeColorMap.image.data[i*3+0] ||
				g!=this.nodeColorMap.image.data[i*3+1] ||
				b!=this.nodeColorMap.image.data[i*3+2])
			{
				colors.set(i*3+0, r);
				colors.set(i*3+1, g);
				colors.set(i*3+2, b);
			}

			/*size*/
			let sizeValue = Math.fround(this.nodeSize(n));
			if(sizeValue != this.nodeSizeMap.image.data[i]){
				sizes.set(i, sizeValue);
			}

			/*nodeFlags*/
			let nodeFlagsValue = this.nodeFlags(n);
			if(nodeFlagsValue != this.nodeFlagsMap.image.data[i]){
				nodeFlags.set(i, nodeFlagsValue);
			}
		}
		/* EDGES */
		const edges = this.graph.edges();
		const edgeCount = edges.length;
		const edgeColors = new Map();
		for(let i=0; i<edgeCount; i++){
			const e = edges[i];
			const edgeColor = this.edgeColor(e);
			const r = Math.round(edgeColor.r*255);
			const g = Math.round(edgeColor.g*255);
			const b = Math.round(edgeColor.b*255);
			if( r!=this.edgeColorMap.image.data[i*3+0] ||
				g!=this.edgeColorMap.image.data[i*3+1] ||
				b!=this.edgeColorMap.image.data[i*3+2]) 
			{
				edgeColors.set(i*4+0, r);
				edgeColors.set(i*4+1, g);
				edgeColors.set(i*4+2, b);
			}
		}

		const edgeOpacities = new Map();
		for(let i=0; i<edgeCount; i++){
			const e = edges[i];
			const edgeOpacity = Math.fround(this.edgeOpacity(e));
			if(edgeOpacity!=this.edgeOpacityMap.image.data[i]){
				edgeOpacities.set(i, edgeOpacity);
			}
		}

		if(this.PROFILE){
			console.timeEnd('diff')
		}
		return {positions, colors, sizes, nodeFlags, edgeColors, edgeOpacities};
	}

	patch({positions, colors, sizes, nodeFlags, edgeColors, edgeOpacities}){
		if(this.PROFILE) console.time('patch');
		/*nodes*/
		if(positions && positions.size>0){
			for(let [key, value] of positions){
				this.nodePositionMap.image.data[key] = value;
			}
			this.nodePositionMap.needsUpdate = true;
		}
		if(colors && colors.size>0){
			for(let [key, value] of colors){
				this.nodeColorMap.image.data[key] = value;
			}
			this.nodeColorMap.needsUpdate = true;
		}
		if(sizes && sizes.size>0){
			for(let [key, value] of sizes){
				this.nodeSizeMap.image.data[key] = value;
			}
			this.nodeSizeMap.needsUpdate = true;
		}
		if(nodeFlags && nodeFlags.size>0){
			for(let [key, value] of nodeFlags){
				this.nodeFlagsMap.image.data[key] = value;
			}
			this.nodeFlagsMap.needsUpdate = true;
			debugger
		}


		/*edges*/
		if(edgeColors && edgeColors.size>0){
			for(let [key, value] of edgeColors){
				this.edgeColorMap.image.data[key] = value;
			}
			this.edgeColorMap.needsUpdate = true;
		}

		if(edgeOpacities && edgeOpacities.size>0){
			for(let [key, value] of edgeOpacities){
				this.edgeOpacityMap.image.data[key] = value;
			}
			this.edgeOpacityMap.needsUpdate = true;
		}

		if(this.PROFILE) console.timeEnd('patch')
	}
}

export {LatticeMesh, NodeFlags}