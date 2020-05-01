
import autoComplete from 'js-autocomplete'
import fuzzysort from 'fuzzysort';
import * as THREE from 'three'
var removeAccents = it => it.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

class AutoCompleteComponent extends THREE.EventDispatcher{
	constructor(values){
		super()
		this.targets = values.map(t=>({original:t, normalized:removeAccents(t)}));
		this.domElement = document.createElement('div');
		this.domElement.classList.add('autocomplete');
		let inputElement = document.createElement('input');
		inputElement.placeholder = "search artists..."
		inputElement.id = 'autoID';
		// inputElement.style.position = 'fixed';
		// inputElement.style.top = '0px';
		// inputElement.style.left = '0px';
		this.domElement.appendChild(inputElement);

		let complete = new autoComplete({
			selector: inputElement,
			delay: 0,
			minChars: 1,
			cache: false,
			source: (term, response)=>{
				this.suggestions = this.suggest(term);
				this.dispatchEvent({type: 'input', value: inputElement.value});
				response(this.suggestions);
			},

			onSelect: (event, term, item)=>{
				inputElement.blur();
				this.dispatchEvent({type: 'select', value: term});
			}
		});
	}

	suggest(term){
		
		const suggestions =  fuzzysort.go(removeAccents(term), this.targets, {
			key:'normalized',
			limit: 4
		});

		return suggestions.map(s=>s.obj.original)
	}
}

export default AutoCompleteComponent;