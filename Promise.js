var Promise = (function() {
	var STATUS_PENDING = 'pending',
		STATUS_RESOLVE = 'resolved',
		STATUS_REJECT  = 'rejected',
		p = Promise.prototype;


	function Promise(resolver){
		// Promise构造函数的参数必须是函数
		if (typeof resolver !== 'function'){
			throw new TypeError('Promise resolver ' + resolver + ' is not a function');
		}

		if (!(this instanceof Promise)) return new Promise(resolver);

        /* Promise对象的三种状态 */
		
		 var self = this;

		self.callbacks = [];
		self.status = STATUS_PENDING;

		function resolve(value) {
			// 链式调用
			if (value instanceof Promise) {
				return value.then(resolve, reject);
			}

			setTimeout(function() {
				if (self.status !== STATUS_PENDING) {
					return ;
				}
				self.status = STATUS_RESOLVE;
				self.data = value;

				for (var i = 0, len = self.callbacks.length; i < len; i++){
					self.callbacks[i].onResolved(value);
				}
			})
		}

		function reject(reason) {
			setTimeout(function(){
				if (self.status !== STATUS_PENDING){
					return ;
				}

				self.status = STATUS_REJECT;
				self.data = reason;

				for (var i = 0, len = self.callbacks.length; i < len; i++){
					self.callbacks[i].onRejected(reason);
				}
			})
		}

		try {
			resolver(resolve, reject);
		} catch(e) {
			reject(e);
		}
	}

	function resolvePromise(promise, chain, resolve, reject){
		var then,
			thenCallerOrThrow = false;

		if (promise === chain) {
			return reject(new TypeError('Chaining cycle detected for promise!'));
		}

		if (chain instanceof Promise) {
			if (chain.status === STATUS_PENDING) {
				chain.then(function(value) {
					resolvePromise(promise, value, resolve, reject);
				}, reject);
			} else {
				chain.then(resolve, reject);
			}
			return ;
		}

		if ((chain !== null) && ((typeof chain === 'object') || (typeof chain === 'function'))) {
			try {
				then = chain.then;
				if (typeof then === 'function') {
					then.call(chain, function rs(y) {
						if (thenCallerOrThrow) { return }
						thenCallerOrThrow = true;
						return resolvePromise(promise, y, resolve, reject);
					}, function rj(r){
						if (thenCallerOrThrow) { return }
						thenCallerOrThrow = true;
						return reject(r);
					})
				} else {
					return resolve(chain);
				}
			} catch(e) {
				if (thenCallerOrThrow) { return }
				thenCallerOrThrow = true;
				return reject(e);
			}
		} else {
			return resolve(chain);
		}
	}

	/* then方法传入参数为两个函数 */
	p.then = function(onResolved, onRejected) {
		onResolved = typeof onResolved === 'function' ? onResolved : function(v) { return v; }
		onRejected = typeof onRejected === 'function' ? onRejected : function(r) { return r; }
		var self = this,
		    promise2;

		if (self.status === STATUS_PENDING) {
			return promise2 = new Promise(function(resolve, reject) {
				self.callbacks.push({
					onResolved: function(value){
						try {
							var value = onResolved(value);
							resolvePromise(promise2, value, resolve, reject);
						} catch(e) {
							return reject(e);
						}
					}, 
					onRejected: function(reason) {
						try {
							var value = onRejected(reason);
							resolvePromise(promise2, value, resolve, reject);
						} catch(e) {
							return reject(e);
						}
					}
				})
			})
		}

		if (self.status === STATUS_RESOLVE) {
			return promise2 = new Promise(function(resolve, reject){
				setTimeout(function(){
					try {
						var value = onResolved(self.data);
						resolvePromise(promise2, value, resolve, reject);
					} catch(e) {
						return reject(e);
					}
				})
			})
		}

		if (self.status === STATUS_REJECT){
			return promise2 = new Promise(function(resolve, reject){
				setTimeout(function(){
					try{
						var value = onRejected(self.data);
						resolvePromise(promise2, value, resolve, reject);
					} catch(e) {
						return reject(e);
					}
				})
			})
		}

	}

	p.spread = function(fn, onRejected) {
		return this.then(function(values){
			return fn.apply(null, values);
		}, onRejected);
	}

	p.inject = function(fn, onRejected) {
		return this.then(function(v) {
			return fn.apply(null, fn.toString().match(/\((.*?)\)/)[1].split(',').map(function(key){
				return v[key];
			}));
		}, onRejected);
	}

	p.delay = function(duration) {
		return this.then(function(value) {
			return new Promise(function(resolve, reject) {
				setTimeout(function() {
					resolve(value);
				}, duration);
			})
		}, function(reason) {
			return new Promise(function(resolve, reject) {
				setTimeout(function() {
					reject(reason);
				}, duration);
			})
		})
	}
	
	p.valueOf = function() {
		return this.data;
	}

	p.catch = function(onRejected) {
		return this.then(null, onRejected);
	}

	p.resolve = function(value) {
		return new Promise(function(resolve){
			resolve(value);
		})
	}

	p.reject = function(reason) {
		return new Promise(function(resolve, reject) {
			reject(reason);
		})
	}

	p.fcall = function(fn) {
		return Promise.resolve().then(fn);
	}

	p.done = p.stop = function() {
		return new Promise(function(){})
	}

	p.finally = function(fn) {
		return this.then(function(v) {
			setTimeout(fn);
			return v;
		}, function(r) {
			setTimeout(fn);
			throw r;
		})
	} 

	p.all = function(promises) {
		return new Promise(function(resolve, reject){
			var resolvedCounter = 0;
			var promiseNum = promises.length;
			var resolvedValues = new Array(promiseNum);

			for (var i = 0; i < promiseNum; i++){
				(function(i){
					Promise.resolve(promise[i]).then(function(value){
						resolvedCounter++;
						resolvedValues[i] = value;
						if (resolvedCounter == promiseNum) {
							return resolve(resolvedValues);
						}
					}, function(reason){
						return reject(reason);
					})
				})(i)
			}
		})
	}

	p.race = function(promises) {
		return new Promise(function(resolve, reject){
			for (var i = 0; i< promises.length; i++) {
				Promise.resolve(promise[i]).then(function(value){
					return resolve(value);
				}, function(reason) {
					return reject(reason);
				})
			}
		})
	}

	p.deferred = p.defer = function() {
		var dfd = {};
		dfd.promise  = new Promise(function(resolve, reject) {
			dfd.resolve = resolve;
			dfd.reject = reject;
		})
		return dfd;
	}

	try {
		module.exports = Promise;
	} catch(e) {}

	return Promise;

})();