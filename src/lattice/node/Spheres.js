import * as THREE from 'three';

class Spheres extends THREE.Mesh{
	constructor({viewport, nodeIndices, nodePositionMap, nodeColorMap, nodeSizeMap, nodeFlagsMap}){
		// baseGeo
		const baseGeo = new THREE.SphereBufferGeometry(0.5, 10, 2, 0, Math.PI*2, Math.PI/2, Math.PI/2);
		baseGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI/2));

		// instance baseGeo
		const geo = new THREE.InstancedBufferGeometry();
		geo.attributes.position = baseGeo.attributes.position;
		geo.attributes.normal = baseGeo.attributes.normal;
		geo.index = baseGeo.index;

		geo.setAttribute('nodeIndex', new THREE.InstancedBufferAttribute(new Uint16Array(nodeIndices), 1, false));

		// create material
		const mat = new THREE.ShaderMaterial({
			lights: true,
			// wireframe: true,
			// transparent: true,
			uniforms: {
				flatShading: {value: false},
				anyHighlighted: {value: false},
				constantScreenSize: {value: true},
				opacity: {value: 1.0},
				viewport: {value: viewport},
				nodePositionMap:  {value: nodePositionMap},
				nodeColorMap: {value: nodeColorMap},
				nodeSizeMap: {value: nodeSizeMap},
				nodeFlagsMap: {value: nodeFlagsMap},
				nodeColumns: {value: nodePositionMap.image.width},
				...THREE.UniformsLib[ "lights" ]
			},
			vertexShader: `
			uniform bool anyHighlighted;
			uniform bool constantScreenSize;
			uniform vec4 viewport;
			uniform sampler2D nodePositionMap;
			uniform sampler2D nodeColorMap;
			uniform sampler2D nodeSizeMap;
			uniform sampler2D nodeFlagsMap;
			uniform float nodeColumns;
			attribute float nodeIndex;
			#include <pullvertex> 
			
			varying vec4 vPosition;
			varying vec4 vNormal;
			varying vec3 vColor;

			#include <inverse>
			#include <transpose>
			#include <lookAt>
			#include <pixelSizeAt>

			varying float vOpacity;

			void main(){
				/* Pull variables */
				vec3 nodePos = pullVec3(nodePositionMap, int(nodeIndex), int(nodeColumns));
				vec3 nodeColor = pullVec3(nodeColorMap, int(nodeIndex), int(nodeColumns));
				float nodeSize = pullFloat(nodeSizeMap, int(nodeIndex), int(nodeColumns));
				float nodeFlags = pullFloat(nodeFlagsMap, int(nodeIndex), int(nodeColumns));

				bool isHovered = mod(nodeFlags, 2.0) > 0.0;
				bool isHighlighted = mod(floor(nodeFlags/2.0), 2.0)>0.0;
				bool isSelected = mod(floor(nodeFlags / 4.0), 2.0) > 0.;

				if(isHovered || isHighlighted){
					vColor = vec3(1, 1, 1);
					vOpacity = 1.0;
				}else{
					if(anyHighlighted){
						vColor = nodeColor;
						vOpacity = 0.1;
					}else{
						vColor = nodeColor;
						vOpacity = 1.0;
					}
				}

				// calc pixel radius
				vec3 up = projectionMatrix[1].xyz;
				mat4 lookAtMatrix = lookAt(nodePos, cameraPosition, up);
				mat4 m = modelViewMatrix * lookAtMatrix;

				float radius = constantScreenSize ? nodeSize * pixelSizeAt(nodePos).x : nodeSize;
				vPosition = m * vec4(position*radius, 1.0);


				vNormal = transpose(inverse(m))*vec4(normal, 1);

				vec4 projected = projectionMatrix * vPosition;
				if(isHovered || isHighlighted){
					projected.z-=1.0;
				}
				
				gl_Position = projected; 
			}`,

			fragmentShader: `
			#include <lighting>
			// uniform vec4 viewport;
			uniform bool flatShading;
			varying vec4 vPosition;
			varying vec4 vNormal;
			varying vec3 vColor;
			varying float vOpacity;

			void main(){
				// apply lighting
				vec3 color = vColor;
				if(!flatShading){
					color *= lighting(vPosition.xyz, vNormal.xyz);
				}
				
				// final color with opacity
				gl_FragColor = vec4(color, vOpacity);
			}`
		});

		// create mesh
		super(geo, mat);
		this.frustumCulled = false;
	}
}

export default Spheres;