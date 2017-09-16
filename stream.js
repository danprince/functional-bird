class Stream {
  constructor(producer) {
    this.subscribers = new Set();
    producer(value => this.next(value));
  }

  subscribe(func) {
    this.subscribers.add(func);
  }

  next(value) {
    this.subscribers.forEach(
      func => func(value)
    );
  }

  map(func) {
    return new Stream(next => {
      this.subscribe(val => {
        let mapped = func(val);
        next(mapped);
      });
    })
  }

  fold(func, state) {
    return new Stream(next => {
      this.subscribe(val => {
        state = func(val, state);
        next(state);
      });
    });
  }

  merge(stream) {
    return new Stream(next => {
      this.subscribe(next);
      stream.subscribe(next);
    });
  }

  debounce(ms) {
    let lastCalled = 0;

    return new Stream(next => {
      this.subscribe(val => {
        let time = Date.now();

        if (time - lastCalled > ms) {
          next(val);
          lastCalled = time;
        }
      });
    });
  }
}

Stream.fromTimer = function fromTimer(ms) {
  return new Stream(
    next => setInterval(next, ms)
  );
}

Stream.fromEvent = function fromEvent(name, element=window) {
  return new Stream(
    next => element.addEventListener(name, next)
  );
}

Stream.fromKey = function fromKey(name, element=window) {
  return new Stream(next => {
    window.addEventListener('keyup', event => {
      if (event.key === name || event.code === name) {
        next(event);
      }
    });
  });
}

Stream.combine = function combine(streams) {
  return new Stream(next => {
    for (let stream of streams) {
      stream.subscribe(next);
    }
  });
}
