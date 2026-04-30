import { Engine, Render, Runner, World, Bodies, Body, Composite, Events } from 'matter-js';

// Configuration
export const PLINKO_CONFIG = {
  width: 800,
  height: 850,
  rows: 16,
  pegRadius: 4,
  ballRadius: 9,
  pegDensity: 42, // Horizontal and vertical spacing between pegs
  gravity: 1.2, // 1.2 default
};

// Buckets mapping
export const BUCKETS = [
  { multiplier: 10000, label: '10K', color: '#FFE100' },
  { multiplier: 216, label: '216', color: '#FFB400' },
  { multiplier: 26, label: '26', color: '#FF9400' },
  { multiplier: 7.0, label: '7.0', color: '#FF8200' },
  { multiplier: 2.5, label: '2.5', color: '#FF7000' },
  { multiplier: 1.1, label: '1.1', color: '#FF5E00' },
  { multiplier: 0.1, label: '0.1', color: '#FF4A00' },
  { multiplier: 0.1, label: '0.1', color: '#FF3600' },
  { multiplier: 0.1, label: '0.1', color: '#FF2200' },
  { multiplier: 0.1, label: '0.1', color: '#FF3600' },
  { multiplier: 0.1, label: '0.1', color: '#FF4A00' },
  { multiplier: 1.1, label: '1.1', color: '#FF5E00' },
  { multiplier: 2.5, label: '2.5', color: '#FF7000' },
  { multiplier: 7.0, label: '7.0', color: '#FF8200' },
  { multiplier: 26, label: '26', color: '#FF9400' },
  { multiplier: 216, label: '216', color: '#FFB400' },
  { multiplier: 10000, label: '10K', color: '#FFE100' },
];

export function initPlinko(canvas: HTMLCanvasElement, onEnterBucket: (index: number, multiplier: number, name: string) => void) {
  const engine = Engine.create();
  engine.world.gravity.y = PLINKO_CONFIG.gravity;

  const render = Render.create({
    canvas,
    engine,
    options: {
      width: PLINKO_CONFIG.width,
      height: PLINKO_CONFIG.height,
      background: '#0a1017',
      wireframes: false,
    },
  });

  const runner = Runner.create();
  Runner.run(runner, engine);
  Render.run(render);

  const { width, height, rows, pegDensity, pegRadius, ballRadius } = PLINKO_CONFIG;
  const startY = 100;
  
  const pegs: Matter.Body[] = [];
  
  // Create Pegs
  for (let r = 0; r < rows; r++) {
    const numPegs = 3 + r;
    const rowWidth = (numPegs - 1) * pegDensity;
    const startX = (width - rowWidth) / 2;
    
    for (let c = 0; c < numPegs; c++) {
      const x = startX + c * pegDensity;
      const y = startY + r * pegDensity;
      
      const peg = Bodies.circle(x, y, pegRadius, {
        isStatic: true,
        restitution: 0.8,
        friction: 0.05,
        render: {
          fillStyle: '#3a4a5a',
        },
      });
      pegs.push(peg);
    }
  }

  // Create boundary funnel walls
  const margin = 10 + ballRadius * 2; 
  const wallThickness = 60;
  
  const firstRowPegs = 3;
  const firstRowWidth = (firstRowPegs - 1) * pegDensity;
  const leftTopX = (width - firstRowWidth) / 2 - margin;
  const rightTopX = (width - firstRowWidth) / 2 + firstRowWidth + margin;
  
  const lastRowPegs = 3 + rows - 1;
  const lastRowWidth = (lastRowPegs - 1) * pegDensity;
  const leftBottomX = (width - lastRowWidth) / 2 - margin;
  const rightBottomX = (width - lastRowWidth) / 2 + lastRowWidth + margin;
  const btmY = startY + (rows - 1) * pegDensity + 20;

  const createWall = (x1: number, y1: number, x2: number, y2: number) => {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    return Bodies.rectangle(cx, cy, length + wallThickness / 2, wallThickness, {
      isStatic: true,
      angle: angle,
      render: { visible: false } // invisible physics body, we'll draw dots manually
    });
  };

  const funnelLines = [
    // Top funnel guides (feeding into the top hole)
    [-100, -100, leftTopX, startY],
    [width + 100, -100, rightTopX, startY],
    // Side guides along the pegs
    [leftTopX, startY, leftBottomX, btmY],
    [rightTopX, startY, rightBottomX, btmY],
  ];

  const walls = funnelLines.map(([x1, y1, x2, y2]) => createWall(x1, y1, x2, y2));

  Composite.add(engine.world, [...pegs, ...walls]);

  // Render dotted funnel lines manually
  Events.on(render, 'afterRender', () => {
    const ctx = render.context;
    ctx.beginPath();
    ctx.setLineDash([6, 8]); // dotted line dash pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // muted white
    ctx.lineWidth = 2;
    
    funnelLines.forEach(([x1, y1, x2, y2]) => {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    });
    
    ctx.stroke();
    ctx.setLineDash([]); // reset line dash for other renders
  });

  // Create Bucket Sensors
  const bottomY = startY + (rows - 1) * pegDensity + 20; 
  // We have 17 buckets. They correspond to the gaps between the 18 pegs of the last row (row 15).
  // The last row has 18 pegs, and spans X from startX to startX + 17*pegDensity.
  const lastRowStartX = (width - lastRowWidth) / 2;

  const bucketHeight = 60;
  const bucketWidth = pegDensity; // width of each bucket

  // array to map sensor IDs to their multiplier and index
  const sensorMap = new Map<number, { index: number, multiplier: number }>();

  for (let i = 0; i < 17; i++) {
    const bucketX = lastRowStartX + ((i + 0.5) * pegDensity); // center of bucket gap
    const sensor = Bodies.rectangle(bucketX, bottomY + bucketHeight / 2, bucketWidth - 4, bucketHeight, {
      isStatic: true,
      isSensor: true,
      render: {
        visible: false, // We'll draw buckets via HTML overlay or custom render
      }
    });
    
    sensorMap.set(sensor.id, { index: i, multiplier: BUCKETS[i].multiplier });
    Composite.add(engine.world, sensor);

    // Create bucket wall dividers
    const wallHeight = 80;
    // Dividers are directly under the pegs
    if (i === 0) {
      // leftmost divider
      const leftDiv = Bodies.rectangle(bucketX - pegDensity/2, bottomY + wallHeight/2 - 10, 4, wallHeight, { isStatic: true, render: { fillStyle: '#3a4a5a' } });
      Composite.add(engine.world, leftDiv);
    }
    const rightDiv = Bodies.rectangle(bucketX + pegDensity/2, bottomY + wallHeight/2 - 10, 4, wallHeight, { isStatic: true, render: { fillStyle: '#3a4a5a' } });
    Composite.add(engine.world, rightDiv);
  }

  // Handle collisions
  Events.on(engine, 'collisionStart', (event) => {
    const pairs = event.pairs;
    
    for (let i = 0; i < pairs.length; i++) {
      const { bodyA, bodyB } = pairs[i];
      
      const checkBucket = (sensorA: Matter.Body, ballB: Matter.Body) => {
        if (sensorA.isSensor && !ballB.isStatic && ballB.label === 'ball') {
          const data = sensorMap.get(sensorA.id);
          if (data !== undefined) {
            const name = ballB.plugin?.name || 'Ball';
            onEnterBucket(data.index, data.multiplier, name);
            Composite.remove(engine.world, ballB);
          }
        }
      }

      checkBucket(bodyA, bodyB);
      checkBucket(bodyB, bodyA);
    }
  });

  const dropBall = (name: string = 'Ball') => {
    // Drop close to center, with slight random offset to prevent piling up predictably
    const offsetX = (Math.random() - 0.5) * 16;
    const x = width / 2 + offsetX;
    const y = 30; // Above top pegs

    // Generate a color based on the name string (simple hash)
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = `hsl(${Math.abs(hash) % 360}, 80%, 60%)`;

    const ball = Bodies.circle(x, y, PLINKO_CONFIG.ballRadius, {
      restitution: 0.4 + Math.random() * 0.4, // Random bounce between 0.4 and 0.8
      friction: 0.005,
      density: 1.5,
      label: 'ball',
      plugin: { name },
      render: {
        fillStyle: color, // Dynamic ball color
      }
    });

    Composite.add(engine.world, ball);
  };

  const destroy = () => {
    Render.stop(render);
    Runner.stop(runner);
    Engine.clear(engine);
    if (render.canvas) {
      // Don't remove from DOM, just clear context
      const ctx = render.canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, render.canvas.width, render.canvas.height);
    }
    render.context = null as any;
    render.textures = {};
  };

  return { dropBall, destroy, engine, render, runner };
}
