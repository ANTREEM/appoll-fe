/**
 * @typedef {object} QuestionMessage
 * @property {number} poll_id
 * @property {string} question
 * @property {boolean} is_opened
 * @property {Object.<string, number>} answers
 */

const WS_ENDPOINT = 'wss://n84zxaq6o7.execute-api.eu-central-1.amazonaws.com/Prod';
const RECONNECTION_LIMIT = 5;

/** @type {WebSocket} */
let ws;
let reconnections = 0;
let currentQuestion = 0;

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
    console.log('Socker error', ev);
  });
  ws.addEventListener('message', event => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (e) {
      console.log('Unexpected message', event);
    }
    if (message) {
      handleMessage(message);
    }
  });
}

function reconnect() {
  if (reconnections < RECONNECTION_LIMIT) {
    reconnections++;
    setTimeout(connect, 2 ** (reconnections - 1) * 1000);
  }
}

/**
 * @param {string} state
 */
function setState(state) {
  document.body.dataset.state = state;
}


const form = document.querySelector('form');
const questionLabel = form.querySelector('label');
const answerList = form.querySelector('ul');
const answerTpl = document.querySelector('template').content;
/**
 * @param {QuestionMessage} message
 */
function buildQuestion(message) {
  questionLabel.textContent = message.question;
  answerList.innerHTML = '';
  Object.keys(message.answers).sort().forEach(answer => {
    const fragment = answerTpl.cloneNode(true);
    const id = `answer:${answer}`; // #YOLO
    /** @type {HTMLLabelElement} */
    const label = fragment.querySelector('label');
    const radio = fragment.querySelector('input');
    label.textContent = answer;
    label.htmlFor = id;
    radio.id = id;
    radio.value = answer;
    answerList.appendChild(fragment);
  });
  currentQuestion = message.poll_id;
}

function handleMessage(message) {
  if ('poll_id' in message) {
    buildQuestion(message);
    let state = 'poll-ended';
    if (message.poll_id === +sessionStorage.youWon) {
      state = 'you-won';
    } else {
      delete sessionStorage.youWon;
      const isActive = message.is_opened && message.poll_id !== +sessionStorage.lastVoted;
      state = isActive ? 'question-active' : 'poll-ended';
    }
    setState(state);
  } else if (message.you_won) {
    sessionStorage.youWon = currentQuestion;
    setState('you-won');
  } else if (Array.isArray(message.update_sources)) {
    if (message.update_sources.includes('css')) {
      updateStylesheet();
    }
  }
}

function handleSubmit(event) {
  event.preventDefault();
  if (!currentQuestion) {
    return;
  }
  const preference = event.target.elements.answer.value;
  if (!preference) {
    return;
  }
  sessionStorage.lastVoted = currentQuestion;
  sendMessage({ poll_id: currentQuestion, preference });
  setState('thanks-for-voting');
}

/**
 * @param {object} message
 */
function sendMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      message: 'vote',
      userVote: message
    }));
  }
}

const stylesheet = document.getElementById('stylesheet');
const sshref = stylesheet.getAttribute('href');
function updateStylesheet() {
  stylesheet.href = `${sshref}?v=${Date.now()}`;
}

connect();

form.addEventListener('submit', handleSubmit);
