import * as THREE from 'three';

class Lines extends THREE.Line{
	constructor({
			links,
			nodePositionMap,
			nodeColorMap,
			nodeSizeMap,
			nodeFlagsMap,
			edgeWidthMap,
			edgeOpacityMap,
			edgeColorMap,
			edgeUseNodeColorMap
		}){
		// geo
		const baseGeo = new THREE.BufferGeometry();
		baseGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0,0,0,-1]), 3));
		// var defaultTransform = new THREE.Matrix4()
		// 	.makeRotationX( -Math.PI/2 )
		// 	.multiply( new THREE.Matrix4().makeTranslation(0, 0.5, 0) );
		// baseGeo.applyMatrix4(defaultTransform);

		const geo = new THREE.InstancedBufferGeometry();
		geo.attributes.position = baseGeo.attributes.position;
		// geo.attributes.normal = baseGeo.attributes.normal;
		// geo.index = baseGeo.index;

		// const indices = this.graph.edges().map(e=>{
		// 	const s = this.graph.source(e);
		// 	const t = this.graph.target(e);
		// 	const sourceIdx = this.graph.nodes().indexOf(s);
		// 	const targetIdx = this.graph.nodes().indexOf(t);
		// 	return [sourceIdx, targetIdx];
		// }).flat();
		const indices = links.flatMap(link=>{
			return [link.source, link.target];
		});
		geo.setAttribute('indices', new THREE.InstancedBufferAttribute(new Uint16Array(indices), 2));
		
		const edgeIndices = Array.from({length: links.length}, (_, i)=>i)
		geo.setAttribute('edgeIndex', new THREE.InstancedBufferAttribute(new Float32Array(edgeIndices), 1));
		
		const mat = new THREE.ShaderMaterial({
			transparent: true,
			uniforms: {
				nodePositionMap: {value: nodePositionMap},
				nodeColorMap: {value: nodeColorMap},
				nodeFlagsMap: {value: nodeFlagsMap},
				nodeColumns: {value: nodePositionMap.image.width},
				edgeColorMap: {value: edgeColorMap},
				edgeColumns: {value: edgeColorMap.image.width},
				edgeUseNodeColorMap: {value: edgeUseNodeColorMap},
				edgeOpacityMap: {value: edgeOpacityMap}
			},
			vertexColors: THREE.VertexColors,
			vertexShader: `
			attribute vec2 indices;
			attribute float edgeIndex;
			attribute float width;
			uniform sampler2D nodePositionMap;
			uniform sampler2D nodeColorMap;
			uniform sampler2D nodeFlagsMap;
			uniform float nodeColumns;
			uniform sampler2D edgeColorMap;
			uniform sampler2D edgeUseNodeColorMap;
			uniform sampler2D edgeOpacityMap;
			uniform float edgeColumns;
			varying vec3 vColor;
			varying float vOpacity;
			varying float vIsHighlighted;

			#include <pullvertex>
			#include <lookAt>

			void main(){
				/* Pull attribites */
				int sourceNodeIndex = int(indices.x);
				int targetNodeIndex = int(indices.y);

				/* Pull variables */
				vec3 sourcePos = pullVec3(nodePositionMap, sourceNodeIndex, int(nodeColumns));
				vec3 targetPos = pullVec3(nodePositionMap, targetNodeIndex, int(nodeColumns));
				float edgeOpacity = pullFloat(edgeOpacityMap, int(edgeIndex), int(edgeColumns));
				float useNodeColor = pullFloat(edgeUseNodeColorMap, int(edgeIndex), int(edgeColumns));
				vec3 sourceColor = pullVec3(nodeColorMap, sourceNodeIndex, int(nodeColumns));
				vec3 targetColor = pullVec3(nodeColorMap, targetNodeIndex, int(nodeColumns));
				vec3 edgeColor = pullVec3(edgeColorMap, int(edgeIndex), int(edgeColumns));

				float sourceNodeFlags = pullFloat(nodeFlagsMap, int(sourceNodeIndex), int(nodeColumns));
				float targetNodeFlags = pullFloat(nodeFlagsMap, int(targetNodeIndex), int(nodeColumns));
				
				bool isSourceHovered = mod(sourceNodeFlags, 2.0) > 0.0;
				bool isSourceHighlighted = mod(floor(sourceNodeFlags/2.0), 2.0)>0.0;
				bool isTargetHovered = mod(targetNodeFlags, 2.0) > 0.0;
				bool isTargetHighlighted = mod(floor(targetNodeFlags/2.0), 2.0)>0.0;
				
				bool isHighlighted = isTargetHighlighted && isSourceHighlighted;
				vIsHighlighted = float(isHighlighted);

				/* Position */
				// transform line points
				vec4 transformed = vec4(position, 1);
				transformed.z*=length(sourcePos-targetPos);
				transformed = lookAt(sourcePos, targetPos, vec3(0,1,0)) * transformed;

				// project
				vec4 projected = projectionMatrix * modelViewMatrix * transformed;
				if(isHighlighted){
					projected.z+=-100.0;
				}
				gl_Position = projected;

				/* Color */
				if(isHighlighted){
					vColor = vec3(0.5, 0.5, 0.5);
					vOpacity=1.0;
				}else{
					vColor = mix(sourceColor, targetColor, -position.z);
					vOpacity = edgeOpacity;
				}
			}`,

			fragmentShader: `
			varying vec3 vColor;
			varying float vOpacity;
			varying float vIsHighlighted;
			void main(){
				gl_FragColor = vec4(vColor, vOpacity);
			}`			
		});

		super(geo, mat)
		this.frustumCulled = false;
	}
}

export default Lines;