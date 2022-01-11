// Download getopts.js from:
// https://raw.githubusercontent.com/mynameisneo7/bitburner-scripts/develop/lib/getopts.js
import getopts from '/lib/getopts.js';

// Monitor if the script is already running
var running;

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog('ALL');
  if (running !== true)
    running = false;

  // Parse options
  const opts = getopts(ns.args, matrixOpts(ns));

  // Validate options
  if (opts.help === true) {
    help(ns);
  } else if (opts._.length) {
    error(ns, 'too many arguments.');
  } else if (typeof opts.blur == 'boolean' || opts.blur < 0 || opts.blur > 10 || !Number.isInteger(Math.floor(opts.blur))) {
    error(ns, 'blur must be an integer from 0 to 10.');
  } else if (typeof opts.color == 'boolean' || !Number.isInteger(Math.floor(opts.color))) { // We don't actually validate which integer (see later)
    error(ns, 'color must be an integer from 0 to 359.');
  } else if (typeof opts.delay == 'boolean' || opts.delay < 1 || opts.delay > 10000 || !Number.isInteger(Math.floor(opts.delay))) {
    error(ns, 'delay must be an integer from 1 to 10000.');
  } else if (opts.rainbow !== false && (opts.rainbow < 1 || opts.rainbow > 100 || !Number.isInteger(Math.floor(opts.rainbow)))) {
    error(ns, 'rainbow must be an integer from 1 to 100.');
  } else if (typeof opts.opacity == 'boolean' || opts.opacity < 0 || opts.opacity > 100 || !Number.isInteger(Math.floor(opts.opacity))) {
    error(ns, 'opacity must be an integer from 0 to 100.');
  }

  if (opts.random === true) {
    opts.color = Math.floor(Math.random() * 360);
  }

  if (opts.rainbow === true) {
    opts.rainbow = 10;
  } else {
    opts.rainbow = Math.floor(opts.rainbow);
  }

  // Do not pass here if another script is running
  if (running) {
    ns.tprintf('%s: ERROR: script is already running.', ns.getScriptName());
    ns.tprint('ERROR: Script is already running with');
    ns.tprint('ERROR: other arguments. Kill previous');
    ns.tprint('ERROR: PIDs if you want to use new ');
    ns.tprint('ERROR: arguments.')
    ns.exit();
  }

  // Grab our document and window...
  const doc = eval('document');
  const win = eval('window');

  if (!running) mCleanup(); // Clean up in case of previous errors
  ns.atExit(mCleanup);      // and at exit.

  // Make sure we're on the terminal first
  try {
    let tmp = doc.querySelector('#terminal').parentNode;
  } catch (e) {
    ns.tail()
    ns.print('ERROR: Could not find terminal.');
    ns.print('ERROR: Please switch back to the terminal');
    ns.print('ERROR: before running this script.');
    error(ns, 'could not find terminal.');
  }

  ns.print('INFO: Matrix terminal background started.');
  ns.print(sprintf('INFO:  Delay: %dms  Hue: %d°  Opacity: %d%%', Math.floor(opts.delay), Math.floor(opts.color), Math.floor(opts.opacity)));
  ns.print(sprintf('INFO:  Blur: %dpx   Rainbow: %s', Math.floor(opts.blur), (opts.rainbow === false) ? 'Off' : Math.floor(opts.rainbow) + 's'));

  // Add stylesheet for canvas
  var style = doc.createElement('style');
  Object.assign(style, { id: 'matrix-css' });
  style.type = 'text/css';
  style.innerHTML = matrixCSS(opts);
  doc.head.appendChild(style);

  // We actually want the parent of the terminal
  const term = doc.querySelector('#terminal').parentNode;
  Object.assign(term.parentNode, { id: 'transparent-term' });

  // Set up our canvas
  const canvas = doc.createElement('canvas');
  Object.assign(canvas, { id: 'matrix-canvas' });
  term.parentNode.insertBefore(canvas, term);

  var ctx = canvas.getContext('2d');
  var columns = [];
  var chars = [];

  canvas.height = win.screen.height;
  canvas.width = win.screen.width;

  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.shadowBlur = 2;

  for (let i = 0; i < 256; columns[i] = 1, chars[i++] = '゠'); // aka 12448

  running = true;
  while (true) {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.shadowColor = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    columns.map(function (value, index) {
      // Overwrites the previous light-green char with a green one
      ctx.fillStyle = ctx.shadowColor = '#000';
      ctx.fillRect(index * 10, value - 10, 10, 10);
      // Defaults to green, but altered by the hue filter
      ctx.fillStyle = ctx.shadowColor = '#0F0';
      ctx.fillText(chars[index], index * 10, value - 10);

      columns[index] = value > 758 + Math.random() * 1e4 ? 0 : value + 10;
      chars[index] = String.fromCharCode(12448 + Math.random() * 96);

      ctx.fillStyle = ctx.shadowColor = '#AFA';
      ctx.fillText(chars[index], index * 10, value);
    });

    await ns.sleep(opts.delay);
  }
}

/** Return CSS
 *  @param opts   getops options
 *  @return Array
 */
function matrixCSS(opts) {
  let anim = sprintf(' rainbow %ds infinite', (opts.rainbow !== false) ? opts.rainbow : 0);
  return [
    'canvas#matrix-canvas {',
    '  position: fixed;',
    '  top: 0;',
    '  left: 0;',
    '  pointer-events: none;',  // FIX #2: Let mouse events fall through
    '  opacity:' + sprintf(' %d%%;', Math.floor(opts.opacity)),
    '  filter:' + sprintf(' hue-rotate(%ddeg)', (Math.floor(opts.color) % 360)) // mod color degrees to 0-359
  /*         */ + sprintf(' blur(%dpx)', Math.floor(opts.blur))
  /*         */ + ';',
    ((opts.rainbow !== false) ?
    '  -webkit-animation:' + anim + ';':''),
    '}',
    '',
    '@-webkit-keyframes rainbow {',
    '  0%   { -webkit-filter: hue-rotate(0deg); }',
    '  100% { -webkit-filter: hue-rotate(359deg); }',
    '}',
  ].join('\n');
}

/** Cleanup DOM */
function mCleanup() {
  running = false;
  const doc = eval('document');
  try {
    doc.getElementById('matrix-canvas').remove();
    doc.getElementById('matrix-css').remove();
  } catch (e) { };
}

/** Prints standardized error messages
 *  @param {NS}   ns
 *  @param msg    message to print
 */
function error(ns, msg, where = 0) {
  ns.tprintf('%s: %s', ns.getScriptName(), msg);
  help(ns);
}

/** Return getops configuration
 *  @param {NS}   ns
 *  @return Object
 */
function matrixOpts(ns) {
  return {
    boolean: {
      help: ['h', 'help'],
      random: ['r', 'random'],
    },
    string: {
      blur: ['b', 'blur'],
      color: ['c', 'color'],
      delay: ['d', 'delay'],
      opacity: ['o', 'opacity'],
      rainbow: ['R', 'rainbow'],
    },
    default: {
      blur: 0,
      color: 0,
      delay: 33,
      help: false,
      opacity: 25,
      rainbow: false,
      random: false,
    },
    alias: {
      blur: ['b', 'blur'],
      color: ['c', 'color'],
      delay: ['d', 'delay'],
      help: ['h', 'help'],
      opacity: ['o', 'opacity'],
      random: ['r', 'random'],
      rainbow: ['R', 'rainbow'],
    },
    unknown: (arg) => {
      if (arg == 't')
        ns.tail();
      error(ns, sprintf('invalid option: %s\n', ((arg.length > 1) ? '--' : '-') + arg));
    }
  };
}

/** Help output
 *  Will also forcibly exit the script.
 *  @param {NS} ns
 */
function help(ns) {
  let p = ns.tprintf;
  p('Usage: %s [OPTIONS]', ns.getScriptName());
  p(['',
    'Changes your terminal background to a green matrix style output.',
    '',
    '  -b, --blur N         Apply blur with N pixels. (default: 0)',
    '  -c, --color DEG      Color hue in degrees from the base. (default: 0)',
    '  -d, --delay MS       Delay in milliseconds between updates. (default: 33)',
    '                       Lower values result in faster animation.',
    '  -o, --opacity PCT    Percentage of opacity. (default: 25)',
    '  -R, --rainbow [SEC]  Loop through rainbow colors in seconds. (default: Off|10)',
    '',
    '  -r, --random         Chooses a random color. Overrides -c and --color.',
    '  -t, --tail           Tail the output log.',
    '',
    '  -h, --help           This help.',
    '',
    'NOTE: Can only be run when the terminal is visible.',
  ].join('\n'));

  ns.exit();
}
