import * as THREE from 'three'

class Rods extends THREE.Mesh{
	constructor({
		links,
		nodePositionMap, nodeColorMap, nodeSizeMap, nodeFlagsMap, 
		edgeWidthMap, edgeOpacityMap, edgeColorMap, edgeUseNodeColorMap}){
		/* base geometry */
		const baseGeo = new THREE.CylinderBufferGeometry(0.5,0.5, 1, 6, 1, false);
		// const baseGeo = new THREE.PlaneBufferGeometry(1.0, 1.0);
		baseGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2));
		baseGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -0.5));

		/* geometry */
		const geo = new THREE.InstancedBufferGeometry();
		geo.attributes.position = baseGeo.attributes.position;
		geo.attributes.normal = baseGeo.attributes.normal;
		geo.index = baseGeo.index;

		/* edge indices */
		const edgeIndices = Array.from({length: links.length}).map( (_, i)=>i);
		geo.setAttribute('edgeIndex', new THREE.InstancedBufferAttribute(new Float32Array(edgeIndices), 1));

		/* source/target node indices */
		
		geo.setAttribute('sourceNodeIndex', new THREE.InstancedBufferAttribute(new Float32Array(links.map(l=>l.source)), 1));
		geo.setAttribute('targetNodeIndex', new THREE.InstancedBufferAttribute(new Float32Array(links.map(l=>l.target)), 1));
				
		/* material */
		const mat = new THREE.ShaderMaterial({
			// wireframe: true,
			lights: true,
			transparent: true,
			uniforms: {
				anyNodeHighlighted: {value: false},
				nodeConstantScreenSize: {value: true},
				edgeConstantScreenSize: {value: true},
				viewport: {value: window.renderer.getCurrentViewport()},
				gap: {value: 0},
				nodePositionMap:  {value: nodePositionMap},
				nodeSizeMap: {value: nodeSizeMap},
				nodeColorMap: {value: nodeColorMap},
				nodeFlagsMap: {value: nodeFlagsMap},
				nodeColumns: {value: nodePositionMap.image.width},

				edgeWidthMap: {value: edgeWidthMap},
				edgeOpacityMap: {value: edgeOpacityMap},
				edgeColorMap: {value: edgeColorMap},
				edgeUseNodeColorMap: {value: edgeUseNodeColorMap},
				edgeColumns: {value: edgeColorMap.image.width},
				...THREE.UniformsLib[ "lights" ]
			},
			vertexShader: `
			uniform bool anyNodeHighlighted;
			uniform bool edgeConstantScreenSize;
			uniform bool nodeConstantScreenSize;
			uniform vec4 viewport;
			#include <pullvertex> 
			#include <lookAt>
			#include <inverse>
			#include <transpose>
			#include <pixelSizeAt>

			// pull nodes
			uniform float nodeColumns;
			attribute float sourceNodeIndex;
			attribute float targetNodeIndex;
			uniform sampler2D nodePositionMap;
			uniform sampler2D nodeSizeMap;
			uniform sampler2D nodeColorMap;
			uniform sampler2D nodeFlagsMap;

			// pull edges
			uniform float edgeColumns;
			attribute float edgeIndex;
			uniform sampler2D edgeWidthMap;
			uniform sampler2D edgeUseNodeColorMap;
			uniform sampler2D edgeOpacityMap;

			//
			uniform float gap;
			

			// varyings
			varying vec4 vPosition;
			varying vec3 vNormal;
			varying vec3 vColor;
			varying float vOpacity;
			varying float vIsHighlighted;
			varying float vIsHovered;
			
			void main(){
				/* Pull variables */
				float edgeWidth = pullFloat(edgeWidthMap, int(edgeIndex), int(edgeColumns));
				float edgeOpacity = pullFloat(edgeOpacityMap, int(edgeIndex), int(edgeColumns));

				vec3 sourceNodePos = pullVec3(nodePositionMap, int(sourceNodeIndex), int(nodeColumns));
				vec3 targetNodePos = pullVec3(nodePositionMap, int(targetNodeIndex), int(nodeColumns));
				vec3 sourceNodeColor = pullVec3(nodeColorMap, int(sourceNodeIndex), int(nodeColumns));
				vec3 targetNodeColor = pullVec3(nodeColorMap, int(targetNodeIndex), int(nodeColumns));
				float sourceNodeSize = pullFloat(nodeSizeMap, int(sourceNodeIndex), int(nodeColumns));
				float targetNodeSize = pullFloat(nodeSizeMap, int(targetNodeIndex), int(nodeColumns));

				float sourceNodeFlags = pullFloat(nodeFlagsMap, int(sourceNodeIndex), int(nodeColumns));
				float targetNodeFlags = pullFloat(nodeFlagsMap, int(targetNodeIndex), int(nodeColumns));
				
				bool isSourceHovered = mod(sourceNodeFlags, 2.0) > 0.0;
				bool isSourceHighlighted = mod(floor(sourceNodeFlags/2.0), 2.0)>0.0;
				bool isTargetHovered = mod(targetNodeFlags, 2.0) > 0.0;
				bool isTargetHighlighted = mod(floor(targetNodeFlags/2.0), 2.0)>0.0;
				
				bool isHighlighted = isTargetHighlighted && isSourceHighlighted;
				vIsHighlighted = float(isHighlighted);


				if(isHighlighted){
					vColor = mix(sourceNodeColor, targetNodeColor, -position.z);
					vOpacity = edgeOpacity;
				}else{
					if(anyNodeHighlighted){
						vColor = mix(sourceNodeColor, targetNodeColor, -position.z);
						vOpacity = edgeOpacity*0.1;
					}else{
						vColor = mix(sourceNodeColor, targetNodeColor, -position.z);
						vOpacity = edgeOpacity;
					}
				}

				// create scale matrix
				sourceNodeSize*=(1.0+gap);
				targetNodeSize*=(1.0+gap);
				if(nodeConstantScreenSize){
					sourceNodeSize*=pixelSizeAt(sourceNodePos).x;
					targetNodeSize*=pixelSizeAt(targetNodePos).x;
				}
				if(edgeConstantScreenSize){
					edgeWidth*=pixelSizeAt( mix(sourceNodePos, targetNodePos, 0.5) ).x;
				}

				float d = distance(sourceNodePos, targetNodePos);
				mat4 scaleMatrix = mat4(
					edgeWidth,0,0,0,
					0,edgeWidth,0,0,
					0,0, d-(sourceNodeSize+targetNodeSize)/2.0, 0,
					0,0,-sourceNodeSize/2.0,1
				);
				// create lookat matrix
				vec3 up = cameraPosition - mix(sourceNodePos, targetNodePos, -position.z);
				mat4 lookAtMatrix = lookAt(sourceNodePos, targetNodePos,-up);

				mat4 m = modelViewMatrix * lookAtMatrix * scaleMatrix;
				vPosition = m * vec4(position, 1);
				
				vNormal = normalize(mat3(transpose(inverse(m)))*normal);

				vec4 projected = projectionMatrix * vPosition;
				if(isHighlighted){
					projected.z-=1.0;
				}
				gl_Position = projected;
			}`,

			fragmentShader: `
			#include <lighting>
			uniform float opacity;
			
			varying vec4 vPosition;
			varying vec3 vNormal;
			varying vec3 vColor;
			varying float vOpacity;
			varying float vIsHighlighted;
			varying float vIsHovered;
			void main(){
				vec3 color = vColor;
				if(vIsHighlighted>0.0 || vIsHovered>0.0){
					// color*=lighting(vPosition.xyz, vNormal);
				}

				gl_FragColor = vec4(color, vOpacity);
			}`
		});

		// create mesh
		super(geo, mat)
		this.frustumCulled = false;
	}
}

export default Rods;