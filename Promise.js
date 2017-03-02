var Promise = (function() {
	function Promise(resolver){
		// Promise构造函数的参数必须是函数
		if (typeof resolver !== 'function'){
			throw new TypeError('Promise resolver ' + resolver + ' is not a function');
		}

		if (!(this instanceof Promise)) return new Promise(resolver);

		var self = this;
		self.callbacks = [];
		self.status = 'pending';

		function resolve(value) {
			// 链式调用
			if (value instanceof Promise) {
				return value.then(resolve, reject);
			}

			setTimeout(function() {
				if (self.status !== 'pending') {
					return ;
				}
				self.status = 'resolved';
				self.data = value;

				for (var i = 0; i < self.callbacks.length; i++){
					self.callbacks[i].onResolved(value);
				}
			})
		}

		function reject(reason) {
			setTimeout(function(){
				if (self.status !== 'pending'){
					return ;
				}

				self.status = 'rejected';
				self.data = reason;

				for (var i = 0; i< self.callbacks.length; i++){
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

	function resolvePromise(promise, x, resolve, reject){
		var then,
			thenCallerOrThrow = false;

		if (promise === x) {
			return reject(new TypeError('Chaining cycle detected for promise!'));
		}

		if (x instanceof Promise) {
			if (x.status === 'pending') {
				x.then(function(v) {
					resolvePromise(promise, v, resolve, reject);
				}, reject);
			} else {
				x.then(resolve, reject);
			}
			return ;
		}

		if ((x !== null) && ((typeof x === 'object') || (typeof x === 'function'))) {
			try {
				then = x.then;
				if (typeof then === 'function') {
					then.call(x, function rs(y) {
						if (thenCallerOrThrow) { return }
						thenCallerOrThrow = true;
						return resolvePromise(promise, y, resolve, reject);
					}, function rj(r){
						if (thenCallerOrThrow) { return }
						thenCallerOrThrow = true;
						return reject(r);
					})
				} else {
					return resolve(x);
				}
			} catch(e) {
				if (thenCallerOrThrow) { return }
				thenCallerOrThrow = true;
				return reject(e);
			}
		} else {
			return resolve(x);
		}
	}

	Promise.prototype.then = function(onResolved, onRejected) {
		onResolved = typeof onResolved === 'function' ? onResolved : function(v) { return v; }
		onRejected = typeof onRejected === 'function' ? onRejected : function(r) { return r; }
		var self = this;
		var promise2;

		if (self.status === 'pending') {
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

		if (self.status === 'resolved') {
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

		if (self.status === 'reject'){
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

	Promise.prototype.spread = function(fn, onRejected) {
		return this.then(function(values){
			return fn.apply(null, values);
		}, onRejected);
	}

	Promise.prototype.inject = function(fn, onRejected) {
		return this.then(function(v) {
			return fn.apply(null, fn.toString().match(/\((.*?)\)/)[1].split(',').map(function(key){
				return v[key];
			}));
		}, onRejected);
	}

	Promise.prototype.delay = function(duration) {
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
	

	Promise.prototype.valueOf = function() {
		return this.data;
	}

	Promise.prototype.catch = function() {
		return this.then(null, onRejected);
	}

	Promise.prototype.resolve = function(value) {
		return new Promise(function(resolve){
			resolve(value);
		})
	}

	Promise.prototype.reject = function(reason) {
		return new Promise(function(resolve, reject) {
			reject(reason);
		})
	}

	Promise.prototype.fcall = function(fn) {
		return Promise.resolve().then(fn);
	}

	Promise.done = Promise.stop = function() {
		return new Promise(function(){})
	}

	Promise.prototype.finally = function(fn) {
		return this.then(function(v) {
			setTimeout(fn);
			return v;
		}, function(r) {
			setTimeout(fn);
			throw r;
		})
	} 

	Promise.all = function(promises) {
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

	Promise.race = function(promises) {
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

	Promise.prototype.deferred = Promise.prototype.defer = function() {
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