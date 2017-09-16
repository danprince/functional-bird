// config & models

let scale = (x) => Math.floor(x * 64);

let width = 6;
let height = 9;

let sprites = {
  bird:  { x: scale(0), y: 0 },
  flap:  { x: scale(1), y: 0 },
  floor: { x: scale(2), y: 0 },
  tower: { x: scale(3), y: 0 },
  roof:  { x: scale(4), y: 0 }
};

let blocks = {
  floor: { sprite: sprites.floor, solid: true },
  tower: { sprite: sprites.tower, solid: true },
  roof:  { sprite: sprites.roof, solid: true }
};

// dom & prep

let canvas = document.getElementById('render');
let context = canvas.getContext('2d');

canvas.width = scale(width);
canvas.height = scale(height);

let spritesheet = new Image();
spritesheet.src = 'spritesheet.png';

// utils

function range(x) {
  let xs = [];

  for (let i = 0; i < x; i++) {
    xs[i] = x;
  }

  return xs;
}

function random(x) {
  return Math.floor(Math.random() * x);
}

function merge(objA, objB) {
  return Object.assign({}, objA, objB);
}

// rendering engine

function clear() {
  context.clearRect(0, 0, scale(width), scale(height));
}

function drawSprite(sprite, x, y) {
  context.drawImage(
    spritesheet,
    sprite.x, sprite.y, scale(1), scale(1),
    scale(x), scale(height - y - 1), scale(1), scale(1)
  );
}

function drawLevel(level) {
  let screenX = Math.max(0, level.length - width - 2);
  for (let x = screenX; x < level.length; x++) {
    for (let y = 0; y < level[x].length; y++) {
      let block = level[x][y];
      drawSprite(block.sprite, x, y);
    }
  }
}

function drawText(text, x, y) {
  context.font = `14pt 'Press Start 2P', monospace`;
  context.fillStyle = 'white';
  context.textBaseline = 'top';
  context.textAlign = 'center';
  context.strokeStyle = 'black';
  context.lineWidth = 6;
  context.lineJoin = 'round';

  context.strokeText(text, x, y);
  context.fillText(text, x, y);
}

function focusOn(entity) {
  context.translate(
    scale((width / 2) - entity.x - 0.5),
    0
  );
}

function render(state) {
  let { bird, level } = state;

  clear();

  context.save();

  focusOn(bird);

  drawLevel(level);

  drawSprite(
    bird.flapping ? sprites.flap : sprites.bird,
    bird.x,
    bird.y
  );

  context.restore();

  drawText(state.score, scale(width / 2), 30);

  if (state.gameOver) {
    drawText('GAME OVER', scale(width / 2), scale(height / 2 - 1));
    drawText('Press R to restart', scale(width / 2), scale(height / 2));
  }

  if (!state.playing) {
    drawText('Click to start', scale(width / 2), scale(height / 2));
  }
}

// game logic

function* levelGenerator() {
  while (true) {
    let height = random(5);
    let tower = range(height).map(_ => blocks.tower);
    yield [blocks.floor, ...tower, blocks.roof];
    yield [blocks.floor];
  }
}

let columnGenerator = levelGenerator();

function nextColumn() {
  return columnGenerator.next().value;
}

// update functions

function applyGravity(entity) {
  let vy = Math.max(entity.vy - .003, -.1);
  return merge(entity, { vy });
}

function applyVelocity(entity) {
  let x = entity.x + entity.vx;
  let y = entity.y + entity.vy;
  return merge(entity, { x, y});
}

function applyPhysics(state) {
  let { bird, playing } = state;

  if (playing) {
    return (
      applyGravity(
        applyVelocity(
          bird
        )
      )
    );
  } else {
    return (
      applyVelocity(
        bird
      )
    );
  }
}

function buildLevel(state) {
  let { level, bird } = state;
  let lookAhead = Math.ceil(bird.x + (width / 2) + 1);

  if (lookAhead > level.length) {
    if (!state.playing) {
      return [...level, [blocks.floor]];
    } else {
      return [...level, nextColumn()];
    }
  } else {
    return level;
  }
}

function calculateScore(state) {
  let { bird, level } = state;
  let levelSoFar = level.slice(0, Math.ceil(bird.x));

  let score = 0;

  for (let column of levelSoFar) {
    if (column.length > 1) {
      score += 1;
    }
  }

  return score;
}

function gameOver(state) {
  let bird = merge(state.bird, { vx: 0, vy: -0.1 });

  return merge(state, {
    bird,
    gameOver: true
  });
}

function collisions(state) {
  let { bird, level, score } = state;

  let block = level[Math.round(bird.x)][Math.round(bird.y)];
  let hasCollision = block && block.solid;

  if (hasCollision) {
    return gameOver(state);
  } else {
    return state;
  }
}

function tick(state) {
  let newState = merge(state, {
    bird: applyPhysics(state),
    level: buildLevel(state),
    score: calculateScore(state)
  });

  return collisions(newState);
}

function flap(bird) {
  let vy = Math.min(bird.vy + 0.09, 0.05);
  return merge(bird, { vy, flapping: !bird.flapping });
}

// game state

function level() {
  return range(width).map(_ => [blocks.floor]);
}

function bird() {
  return {
    x: width / 2,
    y: height / 2,
    vx: 0.05,
    vy: 0,
    flapping: false
  };
}

let state = {
  bird: bird(),
  level: level(),
  score: 0
};

// game updates

function update(event, state) {
  switch (event) {
    case 'tick': {
      return tick(state);
    }

    case 'flap': {
      if (!state.playing) {
        return merge(state, { playing: true });
      } else {
        return merge(state, { bird: flap(state.bird) });
      }
    }

    case 'reset': {
      if (state.gameOver) {
        return { bird: bird(), level: level(), score: 0 };
      } else {
        return state;
      }
    }
  }

  return state;
}

// game events

let spaces = Stream.fromKey('Space');
let clicks = Stream.fromEvent('click', window);

let resets = Stream.fromKey('r').map(_ => 'reset');
let flaps = Stream.combine([clicks, spaces]).map(_ => 'flap');

let timer = Stream.fromTimer(15).map(_ => 'tick');
let events = Stream.combine([timer, resets, flaps]);

events
  .fold(update, state)
  .debounce(15)
  .subscribe(render)

