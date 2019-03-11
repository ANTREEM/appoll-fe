/**
 * @typedef {object} PollMessage
 * @property {string} type
 * @property {number} [question]
 * @property {number} [answer]
 * @property {boolean} [active]
 */

const WS_ENDPOINT = 'wss://71ilea0hs0.execute-api.eu-central-1.amazonaws.com/Prod';
const RECONNECTION_LIMIT = 5;

/** @type {WebSocket} */
let ws;
let reconnections = 0;

function connect() {
  ws = new WebSocket(WS_ENDPOINT);

  ws.addEventListener('open', () => {
    console.log('Connection open!');
    reconnections = 0;
    setState('');
  });
  ws.addEventListener('close', (ev) => {
    console.log('Connection closed?!', ev);
    setState('connection-lost');
    reconnect();
  });
  ws.addEventListener('error', (ev) => {
    console.log('Connection failed', ev);
    reconnect();
  });
  ws.addEventListener('message', event => {
    /** @type {PollMessage} */
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (e) {
      console.log('Unexpected message', event);
    }
    handleMessage(message);
  });
}

function reconnect() {
  if (reconnections < RECONNECTION_LIMIT) {
    reconnections++;
    setTimeout(connect, reconnections * 1000);
  }
}

/**
 * @param {string} state
 */
function setState(state) {
  document.body.dataset.state = state;
}

function getCurrentQuestion() {
  const match = document.body.dataset.state.match(/^question_(\d+)$/);
  return match ? +match[1] : null;
}

/**
 * @param {PollMessage} message
 */
function handleMessage(message) {
  switch (message.type) {
    case 'question':
      if (message.active) {
        setState(`question_${message.question}`);
      } else if (+sessionStorage.lastVoted === message.question) {
        setState('thanks-for-voting');
      } else {
        setState('poll-ended');
      }
      break;
    case 'update-css':
      updateStylesheet();
      break;
    case 'you-won':
      setState('you-won');
      break;
  }
}

function handleSubmit(event) {
  event.preventDefault();
  const question = getCurrentQuestion();
  if (!question) {
    return;
  }
  const answer = +event.target.elements[`question_${question}`].value;
  if (!answer) {
    return;
  }
  sessionStorage.lastVoted = question;
  sendMessage({ type: 'answer', question, answer });
  setState('thanks-for-voting');
}

/**
 * @param {PollMessage} message
 */
function sendMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

const stylesheet = document.getElementById('stylesheet');
const sshref = stylesheet.getAttribute('href');
function updateStylesheet() {
  stylesheet.href = `${sshref}?v=${Date.now()}`;
}


connect();

[ ...document.querySelectorAll('form') ].forEach(form => {
  form.addEventListener('submit', handleSubmit);
});
