function watch(target={}, deep=false){
	const proxy = new Proxy(target, {
		set: (obj, prop, value)=>{
			obj[prop] = value;
			if(proxy._handlers[prop]){
				for(let handler of proxy._handlers[prop]){
					handler(value);
				}
			}
			return true;
		}
	});
	proxy._handlers = {}
	proxy.watch = function(prop, handler){
		if(!proxy._handlers[prop]){proxy._handlers[prop]=[];}
		proxy._handlers[prop].push(handler);

	}
	return proxy;
}
export default watch;