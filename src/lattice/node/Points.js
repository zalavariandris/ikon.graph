import * as THREE from 'three'

class Points extends THREE.Points{
	constructor({nodes, nodePositionMap, nodeColorMap, nodeSizeMap, nodeFlagsMap}){
		/* base geo */
		const baseGeo = new THREE.BufferGeometry();
		baseGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0]), 3));

		/* Instance baseGeo */
		const geo = new THREE.InstancedBufferGeometry();
		// copy base geo attributes
		geo.attributes.position = baseGeo.attributes.position;

		// instance atributes
		geo.setAttribute('nodeIndex', new THREE.InstancedBufferAttribute(new Float32Array(nodes), 1));
		// geo.setAttribute('size', new THREE.InstancedBufferAttribute(new Float32Array(sizes), 1));

		// create material
		const mat = new THREE.ShaderMaterial({
			transparent: true,
			uniforms:{
				viewport: {value: window.renderer.getCurrentViewport()},
				constantScreenSize: {value: true},
				opacity:{value: 1.0},
				anyHighlighted: {value: false},
				nodePositionMap:  {value: nodePositionMap},
				nodeColorMap: {value: nodeColorMap},
				nodeSizeMap: {value: nodeSizeMap},
				nodeFlagsMap: {value: nodeFlagsMap},
				nodeColumns: {value: nodePositionMap.image.width}
			},
			extensions: {
				derivatives: true
			},
			vertexShader: `
			uniform vec4 viewport;
			uniform sampler2D nodePositionMap;
			uniform bool constantScreenSize;
			uniform sampler2D nodeColorMap;
			uniform float nodeColumns;
			attribute float nodeIndex;
			uniform sampler2D nodeSizeMap;
			uniform sampler2D nodeFlagsMap;
			varying vec3 vColor;
			varying float vIsHovered;
			#include <pullvertex> 
			#include <pixelSizeAt>
			void main(){
				/* Pull variables */
				vec3 nodePos = pullVec3(nodePositionMap, int(nodeIndex), int(nodeColumns));
				vec3 nodeColor = pullVec3(nodeColorMap, int(nodeIndex), int(nodeColumns));
				float nodeSize = pullFloat(nodeSizeMap, int(nodeIndex), int(nodeColumns));
				float nodeFlags = pullFloat(nodeFlagsMap, int(nodeIndex), int(nodeColumns));
				bool isHovered = mod(nodeFlags, 2.0) > 0.0;
				bool isHighlighted = mod(floor(nodeFlags/2.0), 2.0)>0.0;
				bool isSelected = mod(floor(nodeFlags / 4.0), 2.0) > 0.;
				vIsHovered = float(isHovered);

				/* Color */
				if(isHovered || isHighlighted){
					vColor = vec3(1,1,1);
				}else{
					vColor = nodeColor;
				}

				/* Position */
				vec4 mvPosition = modelViewMatrix * vec4( position+nodePos, 1.0 );
				vec4 projected = projectionMatrix * mvPosition;
				if(isHovered || isHighlighted){
					projected.z-=100.0;
				}
				gl_Position = projected;

				/* Size */

				gl_PointSize = constantScreenSize ? nodeSize : nodeSize * pixelSizeAt(nodePos).x;
			}`,
			fragmentShader: `
			varying vec3 vColor;
			varying float vIsHovered;
			uniform float opacity;

			void main(){
				/* Color */
				vec2 pos = gl_PointCoord+vec2(-0.5, -0.5);
				float dist = sqrt(dot(pos, pos));

				float radius = 0.5;
				float delta=fwidth(dist);
				float alpha = 1.0-smoothstep(radius-delta, radius, dist);
				float isStroke = 1.0-smoothstep(radius-delta-delta*0.33, radius-delta*0.33, dist);
				if(alpha>0.0){
					gl_FragColor = vec4(mix(vec3(0,0,0), vColor, isStroke), alpha*opacity);

				}else{
					discard;
				}
			}
			`
		});

		// create mesh
		super(geo, mat);
		this.frustumCulled = false;
	}
}

export default Points;