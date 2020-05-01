import * as THREE from 'three';

class Spheres extends THREE.Mesh{
	constructor({nodes, nodePositionMap, nodeColorMap, nodeSizeMap, nodeFlagsMap}){
		// baseGeo
		const baseGeo = new THREE.SphereBufferGeometry(0.5);

		// instance baseGeo
		const geo = new THREE.InstancedBufferGeometry();
		geo.attributes.position = baseGeo.attributes.position;
		geo.attributes.normal = baseGeo.attributes.normal;
		geo.index = baseGeo.index;

		geo.setAttribute('nodeIndex', new THREE.InstancedBufferAttribute(new Float32Array(nodes), 1));

		// create material
		const mat = new THREE.ShaderMaterial({
			lights: true,
			// transparent: true,
			uniforms: {
				anyHighlighted: {value: false},
				constantScreenSize: {value: true},
				opacity: {value: 1.0},
				viewport: {value: window.renderer.getCurrentViewport()},
				nodePositionMap:  {value: nodePositionMap},
				nodeColorMap: {value: nodeColorMap},
				nodeSizeMap: {value: nodeSizeMap},
				nodeFlagsMap: {value: nodeFlagsMap},
				columns: {value: nodePositionMap.image.width},
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
			uniform float columns;
			attribute float nodeIndex;
			#include <pullvertex> 
			
			varying vec4 vPosition;
			varying vec4 vNormal;
			varying vec3 vColor;
			varying float vIsHighlighted;
			varying float vIsHovered;

			#include <inverse>
			#include <transpose>
			#include <lookAt>
			#include <pixelSizeAt>

			varying float vOpacity;

			void main(){
				/* Pull variables */
				vec3 nodePos = pullVec3(nodePositionMap, int(nodeIndex), int(columns));
				vec3 nodeColor = pullVec3(nodeColorMap, int(nodeIndex), int(columns));
				float nodeSize = pullFloat(nodeSizeMap, int(nodeIndex), int(columns));
				float nodeFlags = pullFloat(nodeFlagsMap, int(nodeIndex), int(columns));
				bool isHovered = mod(nodeFlags, 2.0) > 0.0;
				bool isHighlighted = mod(floor(nodeFlags/2.0), 2.0)>0.0;
				bool isSelected = mod(floor(nodeFlags / 4.0), 2.0) > 0.;
				vIsHighlighted = float(isHighlighted);
				vIsHovered = float(isHovered);

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
			uniform vec4 viewport;
			varying vec4 vPosition;
			varying vec4 vNormal;
			varying vec3 vColor;
			varying float vIsHighlighted;
			varying float vIsHovered;
			varying float vOpacity;

			void main(){
				// apply lighting
				vec3 litColor = lighting(vPosition.xyz, vNormal.xyz) * vColor;
				
				// final color with opacity
				gl_FragColor = vec4(litColor, vOpacity);
			}`
		});

		// create mesh
		super(geo, mat);
		this.frustumCulled = false;
	}
}

export default Spheres;